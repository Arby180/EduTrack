import { z } from "zod";

export const schoolToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date.");
export const phoneInput = z
  .string()
  .trim()
  .transform((value) => {
    const compact = value.replace(/[\s()-]/g, "");
    if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
    if (/^639\d{9}$/.test(compact)) return `+${compact}`;
    return compact;
  })
  .pipe(
    z
      .string()
      .regex(
        /^(?:|\+[1-9]\d{7,14})$/,
        "Enter a valid guardian phone number, such as 09171234567 or +639171234567, or leave it blank.",
      ),
  );
export const percentage = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 1000) / 10 : null;
export function csvCell(value: string | number | boolean | null | undefined) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
