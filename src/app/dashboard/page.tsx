import Link from "next/link";
import { dateTime, money } from "@/lib/format";
import { getSession } from "@/lib/supabase/server";
import { StatusBadge } from "./StatusBadge";

export default async function Overview() {
  const { sb, operator } = await getSession();
  if (!operator) return null;

  const [{ data: stats }, { data: recent }, { data: next }] = await Promise.all([
    sb.rpc("operator_stats", { op: operator.id }).single(),
    sb.from("bookings").select("id, customer_name, seats, deposit_cents, status, created_at, slots(starts_at, experiences(title))")
      .order("created_at", { ascending: false }).limit(6),
    sb.from("slots").select("id, starts_at, capacity, experiences(title)")
      .gt("starts_at", new Date().toISOString()).order("starts_at").limit(5),
  ]);

  const seatsTaken = await Promise.all((next ?? []).map((s) => sb.rpc("seats_taken", { p_slot: s.id }).then((r) => r.data ?? 0)));
  const cur = operator.currency;

  const cards = [
    { label: "Bookings value · 30 days", value: money(stats?.revenue_cents ?? 0, cur) },
    { label: "Deposits collected", value: money(stats?.deposits_cents ?? 0, cur) },
    { label: "Bookings · 30 days", value: String(stats?.bookings_30d ?? 0), sub: `${stats?.seats_30d ?? 0} seats` },
    { label: "Next 30 days filled", value: `${stats?.occupancy_pct ?? 0}%`, sub: `${stats?.upcoming_slots ?? 0} departures` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-display text-4xl">Good to see you</h1>
        <p className="mt-1 text-ink-2">Here&apos;s how {operator.name} is doing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="label">{c.label}</p>
            <p className="h-display text-4xl">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-mute">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h-display text-2xl">Next departures</h2>
            <Link href="/dashboard/experiences" className="text-sm text-sea underline">Manage</Link>
          </div>
          {next?.length ? (
            <ul className="space-y-4">
              {next.map((s, i) => {
                const pct = Math.min(100, Math.round((100 * seatsTaken[i]) / s.capacity));
                return (
                  <li key={s.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{s.experiences?.title}</span>
                      <span className="text-mute">{dateTime(s.starts_at, operator.timezone)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
                      <div className="h-full rounded-full bg-sea" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-mute">{seatsTaken[i]} / {s.capacity} seats</p>
                  </li>
                );
              })}
            </ul>
          ) : <Empty text="No upcoming departures yet." href="/dashboard/experiences" cta="Add departures" />}
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h-display text-2xl">Latest bookings</h2>
            <Link href="/dashboard/bookings" className="text-sm text-sea underline">All bookings</Link>
          </div>
          {recent?.length ? (
            <ul className="divide-y divide-line">
              {recent.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{b.customer_name} · {b.seats} seat{b.seats > 1 ? "s" : ""}</p>
                    <p className="text-xs text-mute">{b.slots?.experiences?.title} — {b.slots && dateTime(b.slots.starts_at, operator.timezone)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={b.status} />
                    <p className="mt-1 text-xs text-mute">{money(b.deposit_cents, cur)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty text="No bookings yet. Share your booking page!" href={`/b/${operator.slug}`} cta="Open booking page" />}
        </section>
      </div>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-2">
      <p>{text}</p>
      <Link href={href} className="btn-ghost mt-3">{cta}</Link>
    </div>
  );
}
