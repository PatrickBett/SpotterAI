// DailyLogSheet.jsx
// Draws ONE FMCSA-style daily log: a 24-hour grid with 4 duty-status rows
// and a continuous line showing what the driver was doing each minute.

import { DUTY } from "../lib/hos";
import { formatDate, formatHours } from "../lib/format";

// The four rows on a standard log sheet, top to bottom.
const ROWS = [
  { key: DUTY.OFF, label: "1. Off Duty", color: "hsl(215, 16%, 60%)" },
  { key: DUTY.SB, label: "2. Sleeper Berth", color: "hsl(270, 60%, 55%)" },
  { key: DUTY.DRIVING, label: "3. Driving", color: "hsl(152, 70%, 38%)" },
  {
    key: DUTY.ON,
    label: "4. On Duty (not driving)",
    color: "hsl(38, 95%, 50%)",
  },
];

// SVG layout constants (in user units).
const WIDTH = 960;
const PAD_LEFT = 200;
const PAD_RIGHT = 60;
const PAD_TOP = 30;
const ROW_HEIGHT = 42;
const GRID_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const GRID_H = ROW_HEIGHT * 4;
const HOUR_W = GRID_W / 24;
const HEIGHT = PAD_TOP + GRID_H + 50;

export default function DailyLogSheet({
  day,
  dayIndex,
  totalDays,
  driver = "Driver",
  carrier = "RouteLog Logistics",
}) {
  const dayStart = new Date(day.date);

  // 1. Convert the day's events into a continuous list of segments
  //    (gaps between events default to "off duty").
  const segments = buildSegments(day.events, dayStart);

  // 2. Convert those segments into an SVG path string.
  const dutyPath = buildPath(segments);

  return (
    <div className="surface-card p-5 animate-fade-in">
      {/* Header: day number + driver/carrier info */}
      <Header
        day={day}
        dayIndex={dayIndex}
        totalDays={totalDays}
        driver={driver}
        carrier={carrier}
      />

      {/* The actual SVG log grid */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[720px]"
          style={{ background: "hsl(var(--card))" }}
        >
          <HourGrid />
          <DutyRows day={day} />
          <DutyLine path={dutyPath} />
          <EventDots events={day.events} dayStart={dayStart} />
          <DayTotal day={day} />
        </svg>
      </div>

      {/* Remarks list under the grid */}
      <Remarks events={day.events} />
    </div>
  );
}

// ---- Step 1: build segments ---------------------------------------------

// Walk through the day's events and produce a list of {startHr, endHr, status}
// covering the full 0–24h day. Anywhere there's no event, we fill with OFF.
function buildSegments(events, dayStart) {
  const segments = [];
  let cursor = 0;

  for (const ev of events) {
    const startHr = Math.max(0, (ev.start - dayStart) / 3600000);
    const endHr = Math.min(24, (ev.end - dayStart) / 3600000);

    // Gap before this event? Fill with OFF.
    if (startHr > cursor) {
      segments.push({ startHr: cursor, endHr: startHr, status: DUTY.OFF });
    }
    segments.push({ startHr, endHr, status: ev.status });
    cursor = endHr;
  }

  // Trailing gap to midnight.
  if (cursor < 24) {
    segments.push({ startHr: cursor, endHr: 24, status: DUTY.OFF });
  }

  return segments;
}

// ---- Step 2: build the SVG path -----------------------------------------

// Find which Y coordinate corresponds to a duty status.
function rowY(status) {
  const idx = ROWS.findIndex((r) => r.key === status);
  return PAD_TOP + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
}

// Convert segments into a single SVG path. For each segment we draw a
// horizontal line; between segments we add a vertical drop to the new row.
function buildPath(segments) {
  const parts = [];

  segments.forEach((seg, i) => {
    const x1 = PAD_LEFT + seg.startHr * HOUR_W;
    const x2 = PAD_LEFT + seg.endHr * HOUR_W;
    const y = rowY(seg.status);

    if (i === 0) {
      parts.push(`M ${x1} ${y}`);
    } else {
      const prevY = rowY(segments[i - 1].status);
      if (prevY !== y) parts.push(`L ${x1} ${y}`); // vertical drop
    }
    parts.push(`L ${x2} ${y}`);
  });

  return parts.join(" ");
}

// ---- Sub-components for the SVG -----------------------------------------

function HourGrid() {
  return (
    <>
      {/* Hour columns (every hour, thicker every 6 hrs) */}
      {Array.from({ length: 25 }, (_, h) => {
        const x = PAD_LEFT + h * HOUR_W;
        const isMajor = h % 6 === 0;
        return (
          <line
            key={`col-${h}`}
            x1={x}
            y1={PAD_TOP}
            x2={x}
            y2={PAD_TOP + GRID_H}
            stroke={isMajor ? "hsl(var(--foreground))" : "hsl(var(--border))"}
            strokeWidth={isMajor ? 1 : 0.5}
          />
        );
      })}

      {/* 15-minute tick marks above the grid */}
      {Array.from({ length: 24 * 4 + 1 }, (_, q) => {
        const x = PAD_LEFT + (q / 4) * HOUR_W;
        const isHour = q % 4 === 0;
        return (
          <line
            key={`tick-${q}`}
            x1={x}
            y1={PAD_TOP - (isHour ? 6 : 3)}
            x2={x}
            y2={PAD_TOP}
            stroke="hsl(var(--foreground))"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Hour labels: Mid / 6 / Noon / 6 / Mid */}
      {Array.from({ length: 25 }, (_, h) => {
        const x = PAD_LEFT + h * HOUR_W;
        let label;
        if (h === 0 || h === 24) label = "Mid";
        else if (h === 12) label = "Noon";
        else label = h > 12 ? h - 12 : h;
        return (
          <text
            key={`hl-${h}`}
            x={x}
            y={PAD_TOP - 10}
            textAnchor="middle"
            fontSize="9"
            fill="hsl(var(--muted-foreground))"
            fontFamily="Inter"
          >
            {label}
          </text>
        );
      })}
    </>
  );
}

function DutyRows({ day }) {
  return (
    <>
      {ROWS.map((row, i) => {
        const y = PAD_TOP + i * ROW_HEIGHT;
        return (
          <g key={row.key}>
            {/* Alternating row background */}
            <rect
              x={PAD_LEFT}
              y={y}
              width={GRID_W}
              height={ROW_HEIGHT}
              fill={i % 2 === 0 ? "hsl(var(--background))" : "transparent"}
            />
            {/* Top border of the row */}
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={PAD_LEFT + GRID_W}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
            />
            {/* Row label on the left */}
            <text
              x={PAD_LEFT - 12}
              y={y + ROW_HEIGHT / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="500"
              fill="hsl(var(--foreground))"
              fontFamily="Inter"
            >
              {row.label}
            </text>
            {/* Row total (hours) on the right */}
            <text
              x={PAD_LEFT + GRID_W + 8}
              y={y + ROW_HEIGHT / 2 + 4}
              fontSize="11"
              fontWeight="600"
              fill={row.color}
              fontFamily="Inter"
              className="font-mono-num"
            >
              {formatHours(day.totals[row.key] || 0)}
            </text>
          </g>
        );
      })}

      {/* Bottom border of the whole grid */}
      <line
        x1={PAD_LEFT}
        y1={PAD_TOP + GRID_H}
        x2={PAD_LEFT + GRID_W}
        y2={PAD_TOP + GRID_H}
        stroke="hsl(var(--foreground))"
        strokeWidth={1}
      />
    </>
  );
}

function DutyLine({ path }) {
  return (
    <path
      d={path}
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth={2.25}
      strokeLinejoin="miter"
      strokeLinecap="square"
    />
  );
}

// Small dots for special events (pickup, dropoff, fuel) on the duty line.
function EventDots({ events, dayStart }) {
  const marked = events.filter((e) => e.meta?.kind);
  return marked.map((e, i) => {
    const startHr = (e.start - dayStart) / 3600000;
    const x = PAD_LEFT + Math.max(0, Math.min(24, startHr)) * HOUR_W;
    const y = rowY(e.status);
    return (
      <circle
        key={`dot-${i}`}
        cx={x}
        cy={y}
        r={4}
        fill="hsl(var(--card))"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
    );
  });
}

function DayTotal({ day }) {
  const total =
    (day.totals.off || 0) +
    (day.totals.sb || 0) +
    (day.totals.driving || 0) +
    (day.totals.on || 0);

  return (
    <>
      <text
        x={PAD_LEFT + GRID_W + 8}
        y={PAD_TOP + GRID_H + 18}
        fontSize="10"
        fontWeight="700"
        fill="hsl(var(--foreground))"
        fontFamily="Inter"
      >
        Total
      </text>
      <text
        x={PAD_LEFT + GRID_W + 8}
        y={PAD_TOP + GRID_H + 32}
        fontSize="11"
        fontWeight="700"
        fill="hsl(var(--primary))"
        fontFamily="Inter"
        className="font-mono-num"
      >
        {formatHours(total)}
      </text>
    </>
  );
}

// ---- Header & Remarks ---------------------------------------------------

function Header({ day, dayIndex, totalDays, driver, carrier }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-border mb-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Daily Log Sheet · Day {dayIndex + 1} of {totalDays}
        </div>
        <div className="text-lg font-semibold">{formatDate(day.date)}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <Field label="Driver" value={driver} />
        <Field label="Carrier" value={carrier} />
        <Field label="Vehicle #" value="TRK-001" />
        <Field label="Cycle" value="70hr / 8 day" />
      </div>
    </div>
  );
}

// Decide if an event is interesting enough to list under "Remarks".
function isRemarkable(e) {
  return e.status === DUTY.ON || e.meta?.kind || e.label?.includes("hour");
}

function Remarks({ events }) {
  const items = events.filter(isRemarkable);

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        Remarks
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {items.length === 0 && (
          <li className="text-muted-foreground italic">
            No on-duty events recorded.
          </li>
        )}
        {items.map((e, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="text-muted-foreground font-mono-num shrink-0 w-12">
              {e.start.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <span>{e.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
