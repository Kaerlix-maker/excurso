import type Stripe from "stripe";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Stripe → Excurso. The ONLY place where a booking becomes "confirmed" and
 * where an operator becomes "pro". The signature check proves the request
 * really comes from Stripe; every handler is idempotent because Stripe may
 * deliver the same event more than once.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? "", env.stripeWebhookSecret());
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = supabaseAdmin();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        if (s.mode === "payment" && s.payment_status === "paid") {
          const { error } = await admin.rpc("confirm_booking", { p_session: s.id });
          if (error) throw error;
        }
        if (s.mode === "subscription" && s.metadata?.operator_id) {
          await admin.from("operators").update({
            plan: "pro",
            stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
            stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
            subscription_status: "active",
          }).eq("id", s.metadata.operator_id);
        }
        break;
      }
      case "checkout.session.expired": {
        // Customer abandoned payment: release the seats now instead of waiting for the hold to lapse.
        await admin.from("bookings").update({ status: "expired" }).eq("stripe_session_id", event.data.object.id).eq("status", "pending");
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(sub.status);
        await admin.from("operators").update({
          plan: active ? "pro" : "free",
          subscription_status: sub.status,
        }).eq("stripe_subscription_id", sub.id);
        break;
      }
    }
  } catch (e) {
    console.error("webhook handler failed", event.type, e);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }
  return Response.json({ received: true });
}
