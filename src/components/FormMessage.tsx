export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) return <p role="alert" className="rounded-xl bg-coral/10 px-3.5 py-2.5 text-sm text-coral">{error}</p>;
  if (success) return <p role="status" className="rounded-xl bg-sea/10 px-3.5 py-2.5 text-sm text-sea">{success}</p>;
  return null;
}
