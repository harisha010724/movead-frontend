/**
 * The company positioning line, in one place so the brand panel and the
 * small-screen header can never drift apart.
 *
 * It is split around the differentiator rather than stored as one string: the
 * claim that carries the weight is the pricing model, and setting it in the
 * accent colour is what stops the sentence reading as a block of marketing.
 */
const LEAD = "India's first transparent ";
const ACCENT = 'pay-per-verified-kilometre';
const TAIL = ' vehicle advertising marketplace.';

export const POSITIONING = `${LEAD}${ACCENT}${TAIL}`;

export function PositioningText({ accentClassName }: { accentClassName?: string }) {
  return (
    <>
      {LEAD}
      {/*
        Held on one line: the hyphens are break opportunities, and left alone
        the phrase splits as "pay-" / "per-verified-kilometre", which reads as
        two half-terms rather than the one thing being claimed.
      */}
      <span className={`whitespace-nowrap ${accentClassName ?? ''}`}>{ACCENT}</span>
      {TAIL}
    </>
  );
}
