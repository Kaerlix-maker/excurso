import { test } from "node:test";
import assert from "node:assert/strict";
import { depositFor, money, slugify, SLUG_RE, zonedToUtc } from "../src/lib/format.ts";

test("slugify produces slugs the database accepts", () => {
  assert.equal(slugify("Annaba Kayak & Co"), "annaba-kayak-co");
  assert.equal(slugify("  Él Café — Tours!! "), "el-cafe-tours");
  assert.ok(SLUG_RE.test(slugify("Annaba Kayak & Co")));
  assert.ok(slugify("x".repeat(80)).length <= 40);
});

test("deposit matches the SQL rounding in reserve_seats()", () => {
  assert.deepEqual(depositFor(4000, 3, 25), { total: 12000, deposit: 3000 });
  assert.deepEqual(depositFor(1999, 1, 33), { total: 1999, deposit: 660 }); // ceil(659.67)
  assert.deepEqual(depositFor(100, 1, 10), { total: 100, deposit: 50 });     // Stripe minimum
});

test("local departure time is converted with the operator's time zone", () => {
  assert.equal(zonedToUtc("2027-07-01T09:00", "Europe/Paris"), "2027-07-01T07:00:00.000Z");   // CEST, UTC+2
  assert.equal(zonedToUtc("2027-01-15T09:00", "Europe/Paris"), "2027-01-15T08:00:00.000Z");   // CET, UTC+1
  assert.equal(zonedToUtc("2027-01-15T09:00", "Africa/Algiers"), "2027-01-15T08:00:00.000Z");
  assert.throws(() => zonedToUtc("tomorrow", "Europe/Paris"));
});

test("money formats in the operator's currency", () => {
  assert.equal(money(12000, "eur"), "€120.00");
});
