import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric value as Bangladeshi Taka (BDT / ৳)
 * Uses the Bangladeshi numbering system with appropriate comma separators
 */
export function formatBDT(
  value: string | number | null | undefined,
  options?: { showSymbol?: boolean; decimals?: number }
): string {
  const { showSymbol = true, decimals = 2 } = options ?? {};

  if (value === null || value === undefined || value === "") {
    return showSymbol ? "৳0.00" : "0.00";
  }

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    return showSymbol ? "৳0.00" : "0.00";
  }

  // Format with Bangladeshi locale for proper comma grouping (lakhs/crores)
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(num));

  const sign = num < 0 ? "-" : "";
  const symbol = showSymbol ? "৳" : "";

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format a number with percentage sign
 */
export function formatPercent(
  value: string | number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

/**
 * Format a number for display (shares, quantities)
 */
export function formatNumber(
  value: string | number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a date for display in Asia/Dhaka timezone
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: "short" | "medium" | "long" = "medium"
): string {
  if (!date) return "—";

  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Dhaka",
  };

  switch (style) {
    case "short":
      options.day = "2-digit";
      options.month = "2-digit";
      options.year = "2-digit";
      break;
    case "medium":
      options.day = "numeric";
      options.month = "short";
      options.year = "numeric";
      break;
    case "long":
      options.day = "numeric";
      options.month = "long";
      options.year = "numeric";
      break;
  }

  return new Intl.DateTimeFormat("en-GB", options).format(d);
}

/**
 * Get profit/loss color class
 */
export function getPLColor(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "text-muted-foreground";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "text-muted-foreground";
  return num > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

/**
 * Get profit/loss background class for badges
 */
export function getPLBgColor(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "bg-muted";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "bg-muted";
  return num > 0
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
}
