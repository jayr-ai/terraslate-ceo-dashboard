// "2026-11-15" -> "November 15, 2026". Formatted in UTC from a UTC-midnight
// Date so the day never shifts for viewers in other timezones.
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
