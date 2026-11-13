import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const failed = sp.error === "confirm";
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10"><Logo /></div>
        {failed && <p className="mb-4 rounded-xl bg-coral/10 px-3.5 py-2.5 text-sm text-coral">That confirmation link is invalid or expired.</p>}
        <LoginForm initialMode={mode} next={next} />
      </div>
    </div>
  );
}
