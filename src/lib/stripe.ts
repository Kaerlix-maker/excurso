import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;
export function stripe() {
  client ??= new Stripe(env.stripeSecret());
  return client;
}

export const PRO_PRICE_CENTS = 1900; // 19 €/month
