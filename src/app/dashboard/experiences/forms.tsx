"use client";
import { useActionState, useEffect, useRef } from "react";
import { addSlots, createExperience } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function NewExperienceForm({ currency, first }: { currency: string; first: boolean }) {
  const [state, action] = useActionState(createExperience, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={action} className="card space-y-5 p-6">
      <h2 className="h-display text-2xl">{first ? "Create your first experience" : "New experience"}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" name="title" placeholder="Sunset kayak tour" required />
        <Field label="Meeting point" name="location" placeholder="Saint-Cloud beach" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} className="input" placeholder="What's included, what to bring…" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label={`Price / person (${currency.toUpperCase()})`} name="price" type="number" step="0.01" min="1" defaultValue="40" required />
        <Field label="Deposit %" name="deposit_percent" type="number" min="10" max="100" defaultValue="30" required />
        <Field label="Duration (min)" name="duration_minutes" type="number" min="15" defaultValue="120" required />
        <Field label="Seats per departure" name="default_capacity" type="number" min="1" defaultValue="10" required />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Create experience</SubmitButton>
    </form>
  );
}

export function AddSlotsForm({ experienceId, defaultCapacity, today }: { experienceId: string; defaultCapacity: number; today: string }) {
  const [state, action] = useActionState(addSlots, null);

  return (
    <form action={action} className="space-y-3 rounded-xl bg-sand p-4">
      <p className="label">Add departures</p>
      <input type="hidden" name="experience_id" value={experienceId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" name="start_date" type="date" min={today} defaultValue={today} required />
        <Field label="For (days)" name="days" type="number" min="1" max="60" defaultValue="7" required />
      </div>
      <div className="grid grid-cols-[1fr_90px] gap-3">
        <Field label="Times" name="times" placeholder="09:00, 17:30" defaultValue="09:00, 17:30" required />
        <Field label="Seats" name="capacity" type="number" min="1" defaultValue={String(defaultCapacity)} required />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton className="btn-dark w-full" pendingText="Adding…">Add departures</SubmitButton>
    </form>
  );
}

function Field({ label, name, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const id = `${name}-${rest.placeholder ?? ""}`.replace(/\W+/g, "-");
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={name} className="input" {...rest} />
    </div>
  );
}
