"use client";
import { useActionState, useMemo, useState } from "react";
import { reserveAndPay } from "@/app/b/actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { depositFor, money } from "@/lib/format";

type Slot = { slot_id: string; starts_at: string; capacity: number; seats_left: number };

export function BookingForm({ slots, priceCents, depositPercent, currency, timeZone, cancelled }: {
  slots: Slot[]; priceCents: number; depositPercent: number; currency: string; timeZone: string; cancelled: boolean;
}) {
  const [state, action] = useActionState(reserveAndPay, null);
  const days = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = fmt.format(new Date(s.starts_at));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].slice(0, 14);
  }, [slots, timeZone]);

  const [day, setDay] = useState(days[0]?.[0] ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [seats, setSeats] = useState(2);
  const chosen = slots.find((s) => s.slot_id === slotId);
  const maxSeats = Math.min(10, chosen?.seats_left ?? 10);
  const { total, deposit } = depositFor(priceCents, Math.min(seats, maxSeats), depositPercent);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });

  if (!slots.length) {
    return <div className="card h-fit p-6 text-ink-2">No departures are open for booking yet. Check back soon!</div>;
  }

  return (
    <form action={action} className="card h-fit space-y-5 p-6 lg:sticky lg:top-6">
      {cancelled && <FormMessage error="Payment cancelled — your seats were not booked." />}
      <div>
        <p className="label">1 · Pick a day</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map(([d]) => (
            <button key={d} type="button" onClick={() => { setDay(d); setSlotId(null); }}
              className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${d === day ? "border-sea bg-sea text-white" : "border-line bg-white hover:border-sea"}`}>{d}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">2 · Pick a time</p>
        <div className="grid grid-cols-3 gap-2">
          {days.find(([d]) => d === day)?.[1].map((s) => {
            const full = s.seats_left === 0;
            return (
              <button key={s.slot_id} type="button" disabled={full} onClick={() => setSlotId(s.slot_id)}
                className={`rounded-xl border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${slotId === s.slot_id ? "border-sea bg-sea/10 font-semibold text-sea" : "border-line bg-white hover:border-sea"}`}>
                {time.format(new Date(s.starts_at))}
                <span className={`block text-[11px] ${s.seats_left <= 3 && !full ? "text-coral" : "text-mute"}`}>{full ? "Full" : `${s.seats_left} left`}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={chosen ? "" : "pointer-events-none opacity-40"}>
        <p className="label">3 · Your details</p>
        <input type="hidden" name="slot_id" value={slotId ?? ""} />
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2">
            <span className="text-sm">Seats</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer seats" className="h-8 w-8 rounded-full border border-line" onClick={() => setSeats(Math.max(1, seats - 1))}>−</button>
              <span className="w-5 text-center font-semibold">{Math.min(seats, maxSeats)}</span>
              <button type="button" aria-label="More seats" className="h-8 w-8 rounded-full border border-line" onClick={() => setSeats(Math.min(maxSeats, seats + 1))}>+</button>
            </div>
            <input type="hidden" name="seats" value={Math.min(seats, maxSeats)} />
          </div>
          <input name="name" required placeholder="Full name" autoComplete="name" className="input" />
          <input name="email" type="email" required placeholder="Email" autoComplete="email" className="input" />
        </div>
      </div>
      <div className="space-y-1 border-t border-line pt-4 text-sm">
        <p className="flex justify-between text-ink-2"><span>Total</span><span>{money(total, currency)}</span></p>
        <p className="flex justify-between text-lg font-semibold"><span>Deposit today</span><span>{money(deposit, currency)}</span></p>
      </div>
      <FormMessage error={state?.error} />
      <SubmitButton className="btn-primary w-full py-3" disabled={!chosen} pendingText="Holding your seats…">Pay deposit & book</SubmitButton>
      <p className="text-center text-xs text-mute">Secure payment by Stripe · test mode</p>
    </form>
  );
}
