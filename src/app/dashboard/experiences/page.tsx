import type { Metadata } from "next";
import Link from "next/link";
import { dateTime, money } from "@/lib/format";
import { getSession } from "@/lib/supabase/server";
import { deleteSlot, toggleExperience } from "../actions";
import { AddSlotsForm, NewExperienceForm } from "./forms";

export const metadata: Metadata = { title: "Experiences" };

export default async function ExperiencesPage() {
  const { sb, operator } = await getSession();
  if (!operator) return null;

  const { data: experiences } = await sb
    .from("experiences")
    .select("*, slots(id, starts_at, capacity)")
    .order("created_at")
    .gt("slots.starts_at", new Date().toISOString())
    .order("starts_at", { referencedTable: "slots" })
    .limit(20, { referencedTable: "slots" });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: operator.timezone }).format(new Date()); // YYYY-MM-DD
  const canAdd = operator.plan === "pro" || (experiences?.length ?? 0) < 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h-display text-4xl">Experiences</h1>
        <p className="mt-1 text-ink-2">What you sell, and when it departs.</p>
      </div>

      {experiences?.map((e) => (
        <section key={e.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6">
            <div>
              <h2 className="h-display text-3xl">{e.title}</h2>
              <p className="mt-1 text-sm text-ink-2">
                {money(e.price_cents, operator.currency)} per person · {e.deposit_percent}% deposit · {e.duration_minutes} min
                {e.location && ` · ${e.location}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/b/${operator.slug}/${e.id}`} target="_blank" className="btn-ghost">Preview ↗</Link>
              <form action={toggleExperience}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="active" value={String(e.active)} />
                <button className={e.active ? "btn-ghost" : "btn-primary"}>{e.active ? "Hide from page" : "Publish"}</button>
              </form>
            </div>
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
            <div>
              <p className="label">Upcoming departures</p>
              {e.slots.length ? (
                <ul className="flex flex-wrap gap-2">
                  {e.slots.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
                      {dateTime(s.starts_at, operator.timezone)} <span className="text-mute">· {s.capacity}</span>
                      <form action={deleteSlot}>
                        <input type="hidden" name="id" value={s.id} />
                        <button aria-label="Remove departure" title="Remove (only if no bookings)" className="h-6 w-6 rounded-full text-mute hover:bg-coral/10 hover:text-coral">×</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-mute">No upcoming departures — add some so customers can book.</p>}
            </div>
            <AddSlotsForm experienceId={e.id} defaultCapacity={e.default_capacity} today={today} />
          </div>
        </section>
      ))}

      {canAdd ? (
        <NewExperienceForm currency={operator.currency} first={!experiences?.length} />
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-ink-2">The Free plan includes one experience. Pro unlocks unlimited experiences.</p>
          <Link href="/dashboard/billing" className="btn-primary">Upgrade to Pro</Link>
        </div>
      )}
    </div>
  );
}
