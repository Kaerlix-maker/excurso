"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

export type BookState = { error?: string } | null;

const BookInput = z.object({
  slot_id: z.uuid(),
  seats: z.coerce.number().int().min(1).max(10, "Max 10 seats per booking."),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email."),
});

const ERRORS: Record<string, string> = {
  not_enough_seats: "Sorry — not enough seats left on this departure. Pick another time.",
  slot_in_past: "This departure has already left.",
  experience_inactive: "This experience is not available any more.",
  slot_not_found: "This departure no longer exists.",
};

/**
 * 1. reserve the seats in the database (locked, so no overbooking)
 * 2. create a Stripe Checkout session for the deposit
 * 3. send the customer to Stripe
 * The booking becomes "confirmed" only when Stripe calls our webhook.
 */
export async function reserveAndPay(_: BookState, form: FormData): Promise<BookState> {
  const p = BookInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const admin = supabaseAdmin();

  const { data: booking, error } = await admin.rpc("reserve_seats", {
    p_slot: p.data.slot_id, p_seats: p.data.seats, p_name: p.data.name, p_email: p.data.email,
  });
  if (error || !booking) return { error: ERRORS[error?.message ?? ""] ?? "Could not reserve — please try again." };

  const { data: slot } = await admin
    .from("slots")
    .select("starts_at, experiences(id, title), operators(slug, name, currency)")
    .eq("id", booking.slot_id)
    .single();
  if (!slot?.experiences || !slot.operators) return { error: "Could not load this departure." };

  const base = `${env.siteUrl()}/b/${slot.operators.slug}`;
  let url: string;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: booking.customer_email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: slot.operators.currency,
          unit_amount: booking.deposit_cents,
          product_data: {
            name: `Deposit — ${slot.experiences.title}`,
            description: `${booking.seats} seat${booking.seats > 1 ? "s" : ""} · ${new Date(slot.starts_at).toUTCString()} · ${slot.operators.name}`,
          },
        },
      }],
      metadata: { booking_id: booking.id },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // matches the 35-min seat hold
      success_url: `${base}/done?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${slot.experiences.id}?cancelled=1`,
    });
    await admin.from("bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);
    url = session.url!;
  } catch {
    // Release the seats right away if Stripe failed.
    await admin.from("bookings").update({ status: "expired" }).eq("id", booking.id);
    return { error: "Payment could not be started. Please try again." };
  }
  redirect(url);
}
