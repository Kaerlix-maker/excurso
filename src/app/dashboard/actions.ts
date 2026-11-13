"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { SLUG_RE, zonedToUtc } from "@/lib/format";
import { PRO_PRICE_CENTS, stripe } from "@/lib/stripe";
import { getSession, supabaseAdmin } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string } | null;

/** Every action starts here: who is calling, and which business do they own? */
async function requireOperator() {
  const s = await getSession();
  if (!s.user) redirect("/login");
  if (!s.operator) redirect("/dashboard");
  return s as typeof s & { operator: NonNullable<typeof s.operator> };
}

const first = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

// ---------- onboarding ----------
const OperatorInput = z.object({
  name: z.string().trim().min(2, "Business name is too short.").max(80),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "Use 3–40 lowercase letters, numbers or dashes."),
  currency: z.enum(["eur", "usd", "gbp", "chf"]),
  timezone: z.string().min(3).max(60),
});

export async function createOperator(_: FormState, form: FormData): Promise<FormState> {
  const { sb, user, operator } = await getSession();
  if (!user) redirect("/login");
  if (operator) redirect("/dashboard");
  const p = OperatorInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: first(p.error) };
  const { error } = await sb.from("operators").insert({ owner_id: user.id, ...p.data });
  if (error) return { error: error.code === "23505" ? "That page address is taken — try another." : "Could not create your business." };
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/experiences");
}

// ---------- experiences ----------
const ExperienceInput = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(120),
  description: z.string().trim().max(4000).default(""),
  location: z.string().trim().max(200).default(""),
  duration_minutes: z.coerce.number().int().min(15).max(1440),
  price: z.coerce.number().min(1, "Price must be at least 1.").max(100000),
  deposit_percent: z.coerce.number().int().min(10).max(100),
  default_capacity: z.coerce.number().int().min(1).max(500),
});

export async function createExperience(_: FormState, form: FormData): Promise<FormState> {
  const { sb, operator } = await requireOperator();
  const p = ExperienceInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: first(p.error) };
  const { price, ...rest } = p.data;
  const { error } = await sb.from("experiences").insert({ ...rest, price_cents: Math.round(price * 100), operator_id: operator.id });
  if (error) {
    // The free-plan limit is enforced by a database policy, not just here.
    if (error.code === "42501") return { error: "The Free plan includes one experience. Upgrade to Pro for unlimited experiences." };
    return { error: "Could not save the experience." };
  }
  revalidatePath("/dashboard/experiences");
  return { success: "Experience created. Now add departures." };
}

export async function toggleExperience(form: FormData) {
  const { sb } = await requireOperator();
  const id = z.uuid().parse(form.get("id"));
  const active = form.get("active") === "true";
  await sb.from("experiences").update({ active: !active }).eq("id", id); // RLS: only own rows
  revalidatePath("/dashboard/experiences");
}

// ---------- departures ----------
const SlotsInput = z.object({
  experience_id: z.uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
  times: z.string().trim().regex(/^\d{2}:\d{2}(\s*,\s*\d{2}:\d{2})*$/, "Times like 09:00, 17:30"),
  days: z.coerce.number().int().min(1).max(60),
  capacity: z.coerce.number().int().min(1).max(500),
});

export async function addSlots(_: FormState, form: FormData): Promise<FormState> {
  const { sb, operator } = await requireOperator();
  const p = SlotsInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: first(p.error) };
  const { experience_id, start_date, times, days, capacity } = p.data;

  const rows: { experience_id: string; starts_at: string; capacity: number }[] = [];
  const base = new Date(`${start_date}T00:00:00Z`);
  for (let d = 0; d < days; d++) {
    const day = new Date(base.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    for (const t of times.split(",").map((s) => s.trim())) {
      const startsAt = zonedToUtc(`${day}T${t}`, operator.timezone);
      if (new Date(startsAt) > new Date()) rows.push({ experience_id, starts_at: startsAt, capacity });
    }
  }
  if (rows.length === 0) return { error: "All those times are in the past." };
  if (rows.length > 300) return { error: "That's more than 300 departures at once — use fewer days." };

  const { error } = await sb.from("slots").upsert(rows, { onConflict: "experience_id,starts_at", ignoreDuplicates: true });
  if (error) return { error: "Could not add departures." };
  revalidatePath("/dashboard/experiences");
  return { success: `${rows.length} departure${rows.length > 1 ? "s" : ""} added.` };
}

export async function deleteSlot(form: FormData) {
  const { sb } = await requireOperator();
  const id = z.uuid().parse(form.get("id"));
  // Fails (FK restrict) if the departure already has bookings — that's intended.
  await sb.from("slots").delete().eq("id", id);
  revalidatePath("/dashboard/experiences");
}

// ---------- bookings ----------
export async function cancelBooking(form: FormData) {
  const { sb } = await requireOperator();
  const id = z.uuid().parse(form.get("id"));
  await sb.from("bookings").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

// ---------- billing ----------
export async function startProCheckout() {
  const { user, operator } = await requireOperator();
  const admin = supabaseAdmin();
  let customer = operator.stripe_customer_id;
  if (!customer) {
    const c = await stripe().customers.create({ email: user.email ?? undefined, name: operator.name, metadata: { operator_id: operator.id } });
    customer = c.id;
    // Billing columns are not writable by users — only the server can set them.
    await admin.from("operators").update({ stripe_customer_id: customer }).eq("id", operator.id);
  }
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{
      quantity: 1,
      price_data: { currency: "eur", unit_amount: PRO_PRICE_CENTS, recurring: { interval: "month" }, product_data: { name: "Excurso Pro" } },
    }],
    metadata: { operator_id: operator.id },
    subscription_data: { metadata: { operator_id: operator.id } },
    success_url: `${env.siteUrl()}/dashboard/billing?upgraded=1`,
    cancel_url: `${env.siteUrl()}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const { operator } = await requireOperator();
  if (!operator.stripe_customer_id) redirect("/dashboard/billing");
  const portal = await stripe().billingPortal.sessions.create({
    customer: operator.stripe_customer_id,
    return_url: `${env.siteUrl()}/dashboard/billing`,
  });
  redirect(portal.url);
}
