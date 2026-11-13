import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { Onboarding } from "./Onboarding";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/experiences", label: "Experiences" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/billing", label: "Billing" },
];

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, operator } = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-paper lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-5 lg:block">
          <Logo href="/dashboard" />
          {operator && <p className="mt-0 text-xs text-mute lg:mt-6">{operator.name} · <span className="font-semibold uppercase text-sea">{operator.plan}</span></p>}
        </div>
        {operator && (
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-sand hover:text-ink">{n.label}</Link>
            ))}
            <Link href={`/b/${operator.slug}`} target="_blank" className="whitespace-nowrap rounded-xl px-3 py-2 text-sm text-sea hover:bg-sand">Your booking page ↗</Link>
          </nav>
        )}
        <form action={signOut} className="hidden px-6 pb-6 lg:block">
          <p className="truncate text-xs text-mute">{user.email}</p>
          <button className="mt-1 text-xs font-semibold text-ink-2 underline">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-5 sm:p-8 lg:p-10">{operator ? children : <Onboarding />}</main>
    </div>
  );
}
