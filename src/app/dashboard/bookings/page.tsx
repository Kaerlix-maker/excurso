import type { Metadata } from "next";
import { dateTime, money } from "@/lib/format";
import { getSession } from "@/lib/supabase/server";
import { cancelBooking } from "../actions";
import { StatusBadge } from "../StatusBadge";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const { sb, operator } = await getSession();
  if (!operator) return null;
  const { data: bookings } = await sb
    .from("bookings")
    .select("*, slots(starts_at, experiences(title))")
    .neq("status", "expired")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-4xl">Bookings</h1>
        <p className="mt-1 text-ink-2">Customers pay a deposit online; the rest is due on the day.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
            <tr><th className="p-4">Customer</th><th className="p-4">Departure</th><th className="p-4">Seats</th><th className="p-4">Deposit / total</th><th className="p-4">Status</th><th className="p-4" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bookings?.map((b) => (
              <tr key={b.id}>
                <td className="p-4"><p className="font-medium">{b.customer_name}</p><p className="text-xs text-mute">{b.customer_email}</p></td>
                <td className="p-4"><p>{b.slots?.experiences?.title}</p><p className="text-xs text-mute">{b.slots && dateTime(b.slots.starts_at, operator.timezone)}</p></td>
                <td className="p-4">{b.seats}</td>
                <td className="p-4">{money(b.deposit_cents, operator.currency)} <span className="text-mute">/ {money(b.amount_cents, operator.currency)}</span></td>
                <td className="p-4"><StatusBadge status={b.status} /></td>
                <td className="p-4 text-right">
                  {b.status === "confirmed" && (
                    <form action={cancelBooking}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-xs font-semibold text-coral underline">Cancel</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!bookings?.length && <tr><td colSpan={6} className="p-10 text-center text-mute">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-mute">Cancelling frees the seats. Refund the deposit from your Stripe dashboard if needed.</p>
    </div>
  );
}
