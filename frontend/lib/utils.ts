import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)); }
export const money = (value: number | string | null | undefined, compact = false): string => {
  const parsed = Number(value); if (value == null || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("ru-KZ", { style: "currency", currency: "KZT", maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(Object.is(parsed, -0) ? 0 : parsed);
};
export const number = (value: number | null | undefined): string => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("ru-KZ").format(Object.is(value, -0) ? 0 : value);
export const percent = (value: number | null | undefined, digits = 1): string => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("ru-RU", {style: "percent", maximumFractionDigits: digits}).format(Object.is(value, -0) ? 0 : value);
export const dateText = (value: string): string => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
export const dateTimeText = (value: string): string => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
export const plural = (value: number, forms: readonly [string, string, string]): string => {
  const tail = Math.abs(value) % 100;
  const unit = Math.abs(value) % 10;
  const word = tail >= 11 && tail <= 14 ? forms[2] : unit === 1 ? forms[0] : unit >= 2 && unit <= 4 ? forms[1] : forms[2];
  return `${number(value)} ${word}`;
};
