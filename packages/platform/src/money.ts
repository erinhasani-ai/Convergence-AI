// Deterministic money and quote rules (plan §5.1.2, QUOTE-1.0.0). Integer minor units, USD only in demo.
import type { Equipment, Money } from "@contracts";
import { RATE_CARD } from "@fixtures/shared/seed";

export const usd = (amountMinor: number): Money => {
  if (!Number.isSafeInteger(amountMinor)) throw new Error(`Money must be an integer minor amount, got ${amountMinor}`);
  return { amountMinor, currency: "USD" };
};

export function sum(items: Money[]): Money {
  for (const m of items) if (m.currency !== "USD") throw new Error(`Currency mismatch: ${m.currency}`);
  return usd(items.reduce((acc, m) => acc + m.amountMinor, 0));
}

export function formatUsd(m: Money | null | undefined): string {
  if (!m) return "—";
  const sign = m.amountMinor < 0 ? "-" : "";
  return `${sign}$${(Math.abs(m.amountMinor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** QUOTE-1.0.0: max(minimum, base + roundHalfUp(km * perKm)) + surcharges for required equipment. */
export function transportQuote(distanceKm: number, required: Equipment[]): { price: Money; basis: string } {
  const distanceMinor = Math.round(distanceKm * RATE_CARD.perKmMinor);
  const core = Math.max(RATE_CARD.minimumMinor, RATE_CARD.baseMinor + distanceMinor);
  const winch = required.includes("winch") ? RATE_CARD.winchMinor : 0;
  if (required.includes("parcel_space")) throw new Error("unsupported_input: rate card covers vehicles only");
  return {
    price: usd(core + winch),
    basis: `${RATE_CARD.rateCardId}: $${RATE_CARD.baseMinor / 100} base + ${distanceKm} km × $${RATE_CARD.perKmMinor / 100}/km${winch ? ` + $${winch / 100} winch` : ""}`,
  };
}
