"use client";
import { moneyInput, parseMoney } from "@/lib/money";
export function MoneyField({ value, onChange, className = "input", label }: { value: number; onChange: (cents: number) => void; className?: string; label: string }) {
  const commit = (input: HTMLInputElement) => { const cents = parseMoney(input.value); if (cents === null) input.value = moneyInput(value); else { input.value = moneyInput(cents); onChange(cents); } };
  return <input key={value} className={className} aria-label={label} inputMode="decimal" defaultValue={moneyInput(value)} onBlur={(e) => commit(e.currentTarget)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />;
}
