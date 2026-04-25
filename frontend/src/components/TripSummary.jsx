// TripSummary.jsx
// Shows a card with the main trip stats (distance, hours, stops, dates).

import {
  Gauge,
  Clock,
  Fuel,
  Coffee,
  Bed,
  Route as RouteIcon,
} from "lucide-react";
import { formatHours, formatMiles, formatDate, formatTime } from "../lib/format";

export default function TripSummary({ summary }) {
  if (!summary) return null;

  // Total off-duty time = pure off-duty + sleeper berth.
  const totalRest = summary.totalOffHours + summary.totalSbHours;

  return (
    <div className="surface-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Trip overview</h2>
        <span className="stat-pill bg-accent/10 text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
          Plan ready
        </span>
      </div>

      {/* Top stats: distance + duty hours */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={RouteIcon}
          label="Total distance"
          value={formatMiles(summary.totalMiles)}
          tone="text-primary"
        />
        <StatCard
          icon={Clock}
          label="Driving time"
          value={formatHours(summary.totalDrivingHours)}
          tone="text-accent"
        />
        <StatCard
          icon={Gauge}
          label="On-duty time"
          value={formatHours(summary.totalOnDutyHours)}
          tone="text-warning"
        />
        <StatCard
          icon={Bed}
          label="Off-duty + sleeper"
          value={formatHours(totalRest)}
          tone="text-muted-foreground"
        />
      </div>

      {/* Counts of stops/breaks/resets */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
        <MiniStat icon={Fuel} value={summary.fuels} label="Fuel stops" />
        <MiniStat icon={Coffee} value={summary.breaks} label="30-min breaks" />
        <MiniStat icon={Bed} value={summary.resets} label="10-hr resets" />
      </div>

      {/* Schedule rows */}
      <div className="pt-2 border-t border-border text-xs space-y-1">
        <Row
          label="Departs"
          value={`${formatDate(summary.startTime)} · ${formatTime(summary.startTime)}`}
        />
        <Row
          label="Arrives"
          value={`${formatDate(summary.endTime)} · ${formatTime(summary.endTime)}`}
        />
        <Row
          label="Total elapsed"
          value={formatHours(summary.totalElapsedHours)}
        />
      </div>
    </div>
  );
}

// One of the four big stat cards (with icon + value).
function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold font-mono-num ${tone}`}>
        {value}
      </div>
    </div>
  );
}

// Smaller centered stat (used for the 3 stop-counts row).
function MiniStat({ icon: Icon, value, label }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-8 w-8 rounded-lg bg-secondary grid place-items-center">
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="mt-1.5 text-base font-semibold font-mono-num">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// One label/value row in the schedule footer.
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium font-mono-num">{value}</span>
    </div>
  );
}
