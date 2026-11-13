import type { BookingStatus } from "@/lib/types";

const STYLE: Record<BookingStatus, string> = {
  confirmed: "bg-sea/10 text-sea",
  pending: "bg-sun/15 text-[#9a5d06]",
  cancelled: "bg-ink/5 text-mute",
  expired: "bg-ink/5 text-mute",
  needs_refund: "bg-coral/10 text-coral",
};
const LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed", pending: "Awaiting payment", cancelled: "Cancelled", expired: "Expired", needs_refund: "Refund needed",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>;
}
