// Types for the Supabase schema in supabase/migrations/0001_init.sql.
// (Can be regenerated with: npx supabase gen types typescript --project-id <id>)

export type Plan = "free" | "pro";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "expired" | "needs_refund";

export type Operator = {
  id: string; owner_id: string; name: string; slug: string; currency: string; timezone: string;
  plan: Plan; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  subscription_status: string | null; created_at: string;
};
export type Experience = {
  id: string; operator_id: string; title: string; description: string; location: string;
  duration_minutes: number; price_cents: number; deposit_percent: number; default_capacity: number;
  active: boolean; created_at: string;
};
export type Slot = { id: string; experience_id: string; operator_id: string; starts_at: string; capacity: number; created_at: string };
export type Booking = {
  id: string; slot_id: string; operator_id: string; customer_name: string; customer_email: string;
  seats: number; amount_cents: number; deposit_cents: number; status: BookingStatus;
  stripe_session_id: string | null; expires_at: string; confirmed_at: string | null; created_at: string;
};

type Rel<Col extends string, Ref extends string> = {
  foreignKeyName: `${string}_${Col}_fkey`; columns: [Col]; isOneToOne: false; referencedRelation: Ref; referencedColumns: ["id"];
};
type Table<Row, Required extends keyof Row, R extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: R;
};

export type Database = {
  public: {
    Tables: {
      operators: Table<Operator, "owner_id" | "name" | "slug">;
      experiences: Table<Experience, "operator_id" | "title" | "duration_minutes" | "price_cents", [Rel<"operator_id", "operators">]>;
      slots: Table<Slot, "experience_id" | "starts_at" | "capacity", [Rel<"experience_id", "experiences">, Rel<"operator_id", "operators">]>;
      bookings: Table<Booking, "slot_id" | "operator_id" | "customer_name" | "customer_email" | "seats" | "amount_cents" | "deposit_cents", [Rel<"slot_id", "slots">, Rel<"operator_id", "operators">]>;
    };
    Views: Record<string, never>;
    Functions: {
      slot_availability: { Args: { p_experience: string }; Returns: { slot_id: string; starts_at: string; capacity: number; seats_left: number }[] };
      reserve_seats: { Args: { p_slot: string; p_seats: number; p_name: string; p_email: string }; Returns: Booking };
      confirm_booking: { Args: { p_session: string }; Returns: Booking };
      seats_taken: { Args: { p_slot: string }; Returns: number };
      operator_stats: { Args: { op: string }; Returns: { revenue_cents: number; deposits_cents: number; bookings_30d: number; seats_30d: number; occupancy_pct: number; upcoming_slots: number }[] };
    };
    Enums: { plan: Plan; booking_status: BookingStatus };
    CompositeTypes: Record<string, never>;
  };
};
