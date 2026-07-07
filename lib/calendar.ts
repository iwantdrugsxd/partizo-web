import { Outing } from "@/lib/types";

function toICSDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Builds a downloadable .ics file for an outing - no backend or calendar API needed. */
export function buildICS(outing: Outing): string {
  const start = toICSDate(outing.dateTime);
  const end = toICSDate(outing.dateTime + 2 * 60 * 60 * 1000);
  const escape = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Partizo//Outing//EN",
    "BEGIN:VEVENT",
    `UID:${outing.id}@partizo.app`,
    `DTSTAMP:${toICSDate(Date.now())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(outing.title)}`,
    `DESCRIPTION:${escape(outing.description || "")}`,
    `LOCATION:${escape(outing.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(outing: Outing) {
  const blob = new Blob([buildICS(outing)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${outing.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(outing: Outing): string {
  const start = toICSDate(outing.dateTime);
  const end = toICSDate(outing.dateTime + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: outing.title,
    dates: `${start}/${end}`,
    details: outing.description || "",
    location: outing.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
