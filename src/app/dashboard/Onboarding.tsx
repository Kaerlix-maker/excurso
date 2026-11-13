"use client";
import { useActionState, useState } from "react";
import { createOperator } from "./actions";
import { slugify } from "@/lib/format";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function Onboarding() {
  const [state, action] = useActionState(createOperator, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="h-display text-4xl">Set up your business</h1>
      <p className="mt-2 text-ink-2">This takes 30 seconds. You can change it later.</p>
      <form action={action} className="card mt-8 space-y-5 p-6">
        <div>
          <label className="label" htmlFor="name">Business name</label>
          <input id="name" name="name" required className="input" value={name} placeholder="Annaba Kayak"
            onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
        </div>
        <div>
          <label className="label" htmlFor="slug">Your booking page</label>
          <div className="flex items-center rounded-xl border border-line bg-white pl-3.5 text-sm focus-within:border-sea">
            <span className="text-mute">/b/</span>
            <input id="slug" name="slug" required className="w-full bg-transparent py-2.5 pr-3.5 outline-none" value={slug}
              onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" className="input" defaultValue="eur">
              <option value="eur">EUR €</option><option value="usd">USD $</option><option value="gbp">GBP £</option><option value="chf">CHF</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="timezone">Time zone</label>
            <input id="timezone" name="timezone" className="input" defaultValue="Europe/Paris"
              // Fill in the browser's time zone once mounted (the server can't know it).
              ref={(el) => { if (el && !el.dataset.auto) { el.dataset.auto = "1"; el.value = Intl.DateTimeFormat().resolvedOptions().timeZone; } }} />
          </div>
        </div>
        <FormMessage error={state?.error} />
        <SubmitButton className="btn-primary w-full py-3">Create my booking page</SubmitButton>
      </form>
    </div>
  );
}
