import type { Metadata } from "next";
import { getSession } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { openBillingPortal, startProCheckout } from "../actions";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const { operator } = await getSession();
  if (!operator) return null;
  const { upgraded } = await searchParams;
  const pro = operator.plan === "pro";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="h-display text-4xl">Billing</h1>
      {upgraded && !pro && (
        <p className="rounded-xl bg-sun/15 px-4 py-3 text-sm text-[#9a5d06]">Payment received — your plan updates as soon as Stripe confirms it (a few seconds). Refresh the page.</p>
      )}
      <div className="card p-6">
        <p className="label">Current plan</p>
        <p className="h-display text-5xl">{pro ? "Pro" : "Free"}</p>
        <p className="mt-2 text-sm text-ink-2">
          {pro ? `Unlimited experiences. Subscription status: ${operator.subscription_status ?? "active"}.` : "One experience, unlimited bookings."}
        </p>
        <div className="mt-6">
          {pro ? (
            <form action={openBillingPortal}><SubmitButton className="btn-ghost" pendingText="Opening…">Manage subscription</SubmitButton></form>
          ) : (
            <form action={startProCheckout}><SubmitButton pendingText="Redirecting to Stripe…">Upgrade to Pro — 19 € / month</SubmitButton></form>
          )}
        </div>
      </div>
      <div className="card p-6 text-sm text-ink-2">
        <p className="font-semibold text-ink">Test mode</p>
        <p className="mt-1">This demo uses Stripe test mode. Pay with card <code className="rounded bg-sand px-1.5">4242 4242 4242 4242</code>, any future date and any CVC. No real money moves.</p>
      </div>
    </div>
  );
}
