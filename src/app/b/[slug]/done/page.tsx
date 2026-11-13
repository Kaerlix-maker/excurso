import type { Metadata } from "next";
import Link from "next/link";
import { dateTime, money } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking" };

export default async function DonePage({ params, searchParams }: PageProps<"/b/[slug]/done">) {
  const { slug } = await params;
  const sid = (await searchParams).session_id;
  // The Checkout session id is long and unguessable; we only show non-sensitive details.
  const { data: b } = typeof sid === "string" && sid.startsWith("cs_")
    ? await supabaseAdmin().from("bookings")
        .select("status, seats, deposit_cents, amount_cents, customer_name, slots(starts_at, experiences(title), operators(name, slug, currency, timezone))")
        .eq("stripe_session_id", sid).maybeSingle()
    : { data: null };
  const op = b?.slots?.operators;
  if (!b || !op || op.slug !== slug) {
    return <Shell><h1 className="h-display text-4xl">Booking not found</h1><p className="mt-2 text-ink-2">If you just paid, check your email for the receipt from Stripe.</p></Shell>;
  }

  const confirmed = b.status === "confirmed";
  return (
    <Shell>
      {/* Stripe usually calls the webhook within a second or two; refresh until confirmed. */}
      {b.status === "pending" && <meta httpEquiv="refresh" content="3" />}
      <div className={`mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full text-3xl ${confirmed ? "bg-sea text-white" : "bg-sun/20"}`}>{confirmed ? "✓" : "…"}</div>
      <h1 className="h-display text-center text-4xl">
        {confirmed ? `You're booked, ${b.customer_name.split(" ")[0]}!` : b.status === "needs_refund" ? "Sorry — that departure filled up" : "Confirming your payment…"}
      </h1>
      {b.status === "needs_refund" && <p className="mt-3 text-center text-ink-2">Your payment arrived after the seats were released. {op.name} will refund your deposit.</p>}
      <div className="card mt-8 divide-y divide-line text-sm">
        <Row k="Experience" v={b.slots?.experiences?.title ?? ""} />
        <Row k="Departure" v={b.slots ? dateTime(b.slots.starts_at, op.timezone) : ""} />
        <Row k="Seats" v={String(b.seats)} />
        <Row k="Deposit paid" v={money(b.deposit_cents, op.currency)} />
        <Row k="Due on the day" v={money(b.amount_cents - b.deposit_cents, op.currency)} />
      </div>
      <p className="mt-8 text-center"><Link href={`/b/${op.slug}`} className="text-sm text-sea underline">Back to {op.name}</Link></p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md flex-1 px-6 py-16">{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <p className="flex justify-between px-5 py-3"><span className="text-mute">{k}</span><span className="font-medium">{v}</span></p>;
}
