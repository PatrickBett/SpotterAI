export function formatHours(h) {
  if (!isFinite(h)) return "–";
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function formatDate(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(d) {
  if (!d) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatMiles(mi) {
  return `${mi.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`;
}
