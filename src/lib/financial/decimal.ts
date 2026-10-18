import Decimal from 'decimal.js';

// Configure Decimal globally
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type DecimalInput = string | number | Decimal;

export const ZERO: Decimal = new Decimal(0);
export const ONE: Decimal = new Decimal(1);

export { Decimal };

export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

export function add(...values: DecimalInput[]): Decimal {
  if (values.length === 0) {
    return ZERO;
  }
  return values.reduce<Decimal>((sum, val) => sum.plus(toDecimal(val)), ZERO);
}

export function sub(a: DecimalInput, b: DecimalInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function mul(...values: DecimalInput[]): Decimal {
  if (values.length === 0) {
    return ZERO;
  }
  return values.reduce<Decimal>((prod, val, idx) => {
    return idx === 0 ? toDecimal(val) : prod.times(toDecimal(val));
  }, ZERO);
}

export function div(a: DecimalInput, b: DecimalInput): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero');
  }
  return toDecimal(a).dividedBy(divisor);
}

export function isZero(a: DecimalInput): boolean {
  return toDecimal(a).isZero();
}

export function isPositive(a: DecimalInput): boolean {
  return toDecimal(a).gt(ZERO);
}

export function isNegative(a: DecimalInput): boolean {
  return toDecimal(a).lt(ZERO);
}

export function gte(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).gte(toDecimal(b));
}

export function gt(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).gt(toDecimal(b));
}

export function lte(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lte(toDecimal(b));
}

export function lt(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lt(toDecimal(b));
}

export function max(a: DecimalInput, b: DecimalInput): Decimal {
  const decA = toDecimal(a);
  const decB = toDecimal(b);
  return decA.gte(decB) ? decA : decB;
}

export function min(a: DecimalInput, b: DecimalInput): Decimal {
  const decA = toDecimal(a);
  const decB = toDecimal(b);
  return decA.lte(decB) ? decA : decB;
}

export function round2(value: DecimalInput): string {
  const result = toDecimal(value).toFixed(2, Decimal.ROUND_HALF_UP);
  return result === '-0.00' ? '0.00' : result;
}

export function round4(value: DecimalInput): string {
  const result = toDecimal(value).toFixed(4, Decimal.ROUND_HALF_UP);
  return result === '-0.0000' ? '0.0000' : result;
}

export function toNumber(value: DecimalInput): number {
  return toDecimal(value).toNumber();
}
