import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { money } from "@/lib/format";
import { supabasePublic } from "@/lib/supabase/server";

async function load(slug: string) {
  const sb = supabasePublic();
  const { data: operator } = await sb.from("operators").select("id, name, slug, currency, timezone").eq("slug", slug).maybeSingle();
  if (!operator) return null;
  const { data: experiences } = await sb.from("experiences")
    .select("id, title, description, location, duration_minutes, price_cents, deposit_percent")
    .eq("operator_id", operator.id).eq("active", true).order("created_at");
  return { operator, experiences: experiences ?? [] };
}

export async function generateMetadata({ params }: PageProps<"/b/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data ? `Book with ${data.operator.name}` : "Not found" };
}

export default async function OperatorPage({ params }: PageProps<"/b/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { operator, experiences } = data;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <p className="label">Book online</p>
      <h1 className="h-display text-5xl">{operator.name}</h1>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {experiences.map((e) => (
          <Link key={e.id} href={`/b/${operator.slug}/${e.id}`} className="card group p-6 transition hover:border-sea hover:shadow-lg hover:shadow-sea/5">
            <h2 className="h-display text-3xl group-hover:text-sea">{e.title}</h2>
            {e.location && <p className="mt-1 text-sm text-mute">📍 {e.location}</p>}
            <p className="mt-3 line-clamp-3 text-sm text-ink-2">{e.description}</p>
            <p className="mt-5 flex items-baseline justify-between">
              <span><b className="text-xl">{money(e.price_cents, operator.currency)}</b> <span className="text-sm text-mute">/ person</span></span>
              <span className="text-sm font-semibold text-sea">Book →</span>
            </p>
          </Link>
        ))}
        {!experiences.length && <p className="text-ink-2">No experiences are open for booking right now.</p>}
      </div>
      <Footer />
    </div>
  );
}

export function Footer() {
  return <p className="mt-16 text-center text-xs text-mute">Bookings powered by <Link href="/" className="underline">Excurso</Link> · secure payment by Stripe</p>;
}
