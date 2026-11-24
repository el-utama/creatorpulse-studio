import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...classes: ClassValue[]): string { return twMerge(clsx(classes)); }

export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return "—";
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatDate(isoString: string | number): string {
  return new Date(typeof isoString === "number" ? isoString * 1000 : isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function generateState(): string {
  return crypto.randomUUID();
}