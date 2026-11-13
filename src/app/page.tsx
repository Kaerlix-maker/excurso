import Link from "next/link";
import { Logo } from "@/components/Logo";

const DEMO = process.env.NEXT_PUBLIC_DEMO_PATH ?? "/b/demo-kayak";

const FEATURES = [
  { t: "Your own booking page", d: "A clean page with your own link. Share it on Instagram, WhatsApp or from your website." },
  { t: "Deposits, paid upfront", d: "Customers pay a deposit by card to confirm. No more no-shows for your sunset trip." },
  { t: "Never overbooked", d: "Seats are locked while a customer pays. Two people can't buy the last kayak at the same second." },
  { t: "A live dashboard", d: "Revenue, bookings and how full your next departures are — at a glance." },
];

export default function Home() {
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link href={DEMO} className="hidden text-ink-2 hover:text-ink sm:inline">See a demo page</Link>
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/login?mode=signup" className="btn-primary">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-sea">
          <span className="h-1.5 w-1.5 rounded-full bg-sun" /> For tours, excursions & outdoor activities
        </p>
        <h1 className="h-display max-w-4xl text-5xl leading-[1.02] sm:text-7xl">
          Fill every seat. <span className="italic text-sea">Get paid before</span> you leave the dock.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">
          Excurso gives small tour and activity operators a booking page, card deposits and a live dashboard —
          set up in five minutes, no website needed.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/login?mode=signup" className="btn-primary px-6 py-3 text-base">Create your booking page</Link>
          <Link href={DEMO} className="btn-ghost px-6 py-3 text-base">Try the customer side →</Link>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="bg-paper p-7">
              <h3 className="h-display text-2xl">{f.t}</h3>
              <p className="mt-2 text-sm text-ink-2">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="h-display text-4xl">Simple pricing</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="card p-8">
            <p className="label">Free</p>
            <p className="h-display text-5xl">0 €</p>
            <ul className="mt-6 space-y-2 text-sm text-ink-2">
              <li>✓ 1 experience</li><li>✓ Unlimited departures & bookings</li><li>✓ Card deposits</li>
            </ul>
          </div>
          <div className="card border-sea p-8 ring-4 ring-sea/10">
            <p className="label text-sea">Pro</p>
            <p className="h-display text-5xl">19 € <span className="text-base text-mute">/ month</span></p>
            <ul className="mt-6 space-y-2 text-sm text-ink-2">
              <li>✓ Unlimited experiences</li><li>✓ Everything in Free</li><li>✓ Cancel anytime</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-mute">
          <span>Excurso — a portfolio project by <a className="underline" href="https://kaerlix-maker.github.io">Kaerlix</a>. Payments run in Stripe test mode.</span>
          <a className="underline" href="https://github.com/kaerlix-maker/excurso">Source code</a>
        </div>
      </footer>
    </div>
  );
}
