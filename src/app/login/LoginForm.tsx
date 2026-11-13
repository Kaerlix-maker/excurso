"use client";
import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ initialMode, next }: { initialMode: "signin" | "signup"; next?: string }) {
  const [mode, setMode] = useState(initialMode);
  const [inState, inAction] = useActionState(signIn, null);
  const [upState, upAction] = useActionState(signUp, null);
  const state = mode === "signin" ? inState : upState;

  return (
    <form action={mode === "signin" ? inAction : upAction} className="space-y-4">
      <h1 className="h-display text-4xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="text-sm text-ink-2">
        {mode === "signin" ? "Sign in to manage your bookings." : "Free forever for one experience. No card needed."}
      </p>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"} className="input" />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton className="btn-primary w-full py-3">{mode === "signin" ? "Sign in" : "Create account"}</SubmitButton>
      <p className="text-center text-sm text-ink-2">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button type="button" className="font-semibold text-sea underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
