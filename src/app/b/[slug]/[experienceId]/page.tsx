import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { money } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase/server";
import { BookingForm } from "./BookingForm";

async function load(slug: string, experienceId: string) {
  if (!z.uuid().safeParse(experienceId).success) return null;
  const sb = supabasePublic();
  const { data: operator } = await sb.from("operators").select("id, name, slug, currency, timezone").eq("slug", slug).maybeSingle();
  if (!operator) return null;
  const { data: experience } = await sb.from("experiences")
    .select("id, title, description, location, duration_minutes, price_cents, deposit_percent")
    .eq("id", experienceId).eq("operator_id", operator.id).eq("active", true).maybeSingle();
  if (!experience) return null;
  const { data: slots } = await sb.rpc("slot_availability", { p_experience: experience.id });
  return { operator, experience, slots: slots ?? [] };
}

export async function generateMetadata({ params }: PageProps<"/b/[slug]/[experienceId]">): Promise<Metadata> {
  const { slug, experienceId } = await params;
  const d = await load(slug, experienceId);
  return { title: d ? `${d.experience.title} — ${d.operator.name}` : "Not found" };
}

export default async function ExperiencePage({ params, searchParams }: PageProps<"/b/[slug]/[experienceId]">) {
  const { slug, experienceId } = await params;
  const d = await load(slug, experienceId);
  if (!d) notFound();
  const { operator, experience, slots } = d;
  const cancelled = (await searchParams).cancelled;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link href={`/b/${operator.slug}`} className="text-sm text-mute hover:text-ink">← {operator.name}</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          <h1 className="h-display text-5xl leading-tight">{experience.title}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            <span>⏱ {Math.floor(experience.duration_minutes / 60) ? `${Math.floor(experience.duration_minutes / 60)} h ` : ""}{experience.duration_minutes % 60 ? `${experience.duration_minutes % 60} min` : ""}</span>
            {experience.location && <span>📍 {experience.location}</span>}
            <span>💳 {experience.deposit_percent}% deposit online</span>
          </p>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-ink-2">{experience.description}</p>
          <div className="card mt-8 p-5 text-sm text-ink-2">
            <p className="font-semibold text-ink">How it works</p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>Choose a departure and the number of seats.</li>
              <li>Pay the deposit by card — your seats are held while you pay.</li>
              <li>You&apos;re confirmed instantly. Pay the rest ({money(experience.price_cents, operator.currency)} / person in total) on the day.</li>
            </ol>
          </div>
        </div>
        <BookingForm
          slots={slots}
          priceCents={experience.price_cents}
          depositPercent={experience.deposit_percent}
          currency={operator.currency}
          timeZone={operator.timezone}
          cancelled={Boolean(cancelled)}
        />
      </div>
    </div>
  );
}
