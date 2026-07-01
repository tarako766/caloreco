const TZ_OFFSET_MIN = 9 * 60; // JST (Asia/Tokyo, no DST)

export function toJstDateString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = date.getTime() + TZ_OFFSET_MIN * 60 * 1000;
  const j = new Date(ms);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatJstDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+09:00`).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  });
}

export function formatJstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}
