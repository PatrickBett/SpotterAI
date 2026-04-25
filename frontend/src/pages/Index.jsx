// Index.jsx — main page of the app.
// Holds the trip form, the route map, the trip summary, and the daily logs.

import { useState } from "react";
import {
  Truck,
  ChevronRight,
  MapPinned,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import TripForm from "../components/TripForm.jsx";
import TripSummary from "../components/TripSummary.jsx";
import RouteMap from "../components/RouteMap.jsx";
import DailyLogSheet from "../components/DailyLogSheet.jsx";

import { geocode, getRoute } from "../lib/routing.js";
import { planTrip, placeStopsOnRoute, DUTY } from "../lib/hos.js";

export default function Index() {
  // Loading flag for the "plan trip" button.
  const [loading, setLoading] = useState(false);
  // The full result we get back after planning a trip.
  const [result, setResult] = useState(null);

  // Called when the user submits the TripForm.
  // Steps: geocode -> route -> plan HOS -> place stops on map.
  async function handlePlan(input) {
    setLoading(true);
    setResult(null);

    try {
      // 1) Convert the 3 location strings into {lat, lon} (parallel).
      toast.loading("Geocoding locations…", { id: "plan" });
      const [current, pickup, dropoff] = await Promise.all([
        geocode(input.current),
        geocode(input.pickup),
        geocode(input.dropoff),
      ]);

      // 2) Get the two driving legs from OSRM (parallel).
      toast.loading("Computing route…", { id: "plan" });
      const [legA, legB] = await Promise.all([
        getRoute([current, pickup]),
        getRoute([pickup, dropoff]),
      ]);

      // 3) Build the HOS-compliant timeline.
      toast.loading("Building HOS timeline…", { id: "plan" });
      const plan = planTrip({
        current,
        pickup,
        dropoff,
        cycleUsedHours: input.cycleUsedHours,
        toPickupMeters: legA.distanceMeters,
        toPickupSeconds: legA.durationSeconds,
        toDropoffMeters: legB.distanceMeters,
        toDropoffSeconds: legB.durationSeconds,
        startTime: defaultStartTime(),
      });

      // 4) Combine both route legs and figure out where each stop sits
      //    along the route so we can place markers on the map.
      const fullGeometry = [...legA.geometry, ...legB.geometry];
      const totalDrivingSec = plan.events
        .filter((e) => e.status === DUTY.DRIVING)
        .reduce((sum, e) => sum + (e.end - e.start) / 1000, 0);
      const stops = placeStopsOnRoute(
        plan.events,
        fullGeometry,
        totalDrivingSec,
      );

      // 5) Save everything for the UI to render.
      setResult({
        waypoints: [current, pickup, dropoff],
        geometry: fullGeometry,
        stops,
        plan,
      });

      const dayCount = plan.days.length;
      toast.success(`Plan ready · ${dayCount} day${dayCount > 1 ? "s" : ""}`, {
        id: "plan",
      });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to plan trip", { id: "plan" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <PlannerSection loading={loading} result={result} onPlan={handlePlan} />
      <HowItWorks />
      <SiteFooter />
    </div>
  );
}

// ---- Sections ------------------------------------------------------------

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground shadow-card">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold leading-tight tracking-tight">
              RouteLog
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              ELD Trip Planner · FMCSA HOS
            </div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a
            href="#planner"
            className="hover:text-foreground transition-colors"
          >
            Planner
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a
            href="https://www.fmcsa.dot.gov/regulations/hours-of-service"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            FMCSA rules
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="container pt-12 pb-8">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 stat-pill bg-primary/10 text-primary mb-4">
          <ShieldCheck className="h-3.5 w-3.5" />
          70hr / 8 day · Property-carrying driver
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
          Plan compliant trips.
          <br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Generate ELD logs instantly..
          </span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl">
          Enter your route, and RouteLog calculates Hours-of-Service, schedules
          required breaks, fueling, and sleeper-berth resets — then draws every
          daily log sheet for you.
        </p>
      </div>
    </section>
  );
}

function PlannerSection({ loading, result, onPlan }) {
  return (
    <section id="planner" className="container pb-16">
      {/* Two-column layout: form on the left, map+summary on the right */}
      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <TripForm onSubmit={onPlan} loading={loading} />
          {result?.plan?.summary && (
            <TripSummary summary={result.plan.summary} />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {!result && !loading && <EmptyState />}
          {loading && <LoadingState />}
          {result && (
            <>
              <RouteMap
                waypoints={result.waypoints}
                geometry={result.geometry}
                stops={result.stops}
              />
              <RouteCallout waypoints={result.waypoints} />
            </>
          )}
        </div>
      </div>

      {/* Daily logs (rendered below once we have a result) */}
      {result?.plan?.days?.length > 0 && <DailyLogs days={result.plan.days} />}
    </section>
  );
}

function DailyLogs({ days }) {
  return (
    <div className="mt-12">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Compliance
          </div>
          <h2 className="text-2xl font-bold">Daily log sheets</h2>
          <p className="text-sm text-muted-foreground">
            {days.length} day{days.length > 1 ? "s" : ""} · auto-filled per
            FMCSA §395
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="hidden sm:inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-border hover:bg-secondary transition-colors"
        >
          <ScrollText className="h-4 w-4" /> Print logs
        </button>
      </div>

      <div className="space-y-6">
        {days.map((day, i) => (
          <DailyLogSheet
            key={i}
            day={day}
            dayIndex={i}
            totalDays={days.length}
          />
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  // Static informational cards explaining each rule.
  const cards = [
    {
      title: "11 / 14 hour limits",
      body: "Caps driving at 11 hrs and the on-duty window at 14 hrs per shift, then schedules a 10-hr sleeper reset.",
    },
    {
      title: "30-min break",
      body: "Automatically inserted after 8 cumulative driving hours since the last break.",
    },
    {
      title: "70-hour cycle",
      body: "Tracks the rolling 8-day total and triggers a 34-hour restart when the cycle is exhausted.",
    },
    {
      title: "1,000-mile fueling",
      body: "On-duty 15-min fueling stop placed at every 1,000 miles travelled, per company policy.",
    },
    {
      title: "Pickup & dropoff",
      body: "1 hour on-duty (not driving) is reserved at both pickup and dropoff locations.",
    },
    {
      title: "Real routing",
      body: "Distances and durations from OSRM (OpenStreetMap), so timing reflects actual road network.",
    },
  ];

  return (
    <section id="how" className="border-t border-border bg-gradient-surface">
      <div className="container py-14">
        <h2 className="text-2xl font-bold mb-8">
          How RouteLog stays compliant
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((c) => (
            <div key={c.title} className="surface-card p-5">
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center mb-3">
                <ChevronRight className="h-5 w-5" />
              </div>
              <div className="font-semibold mb-1">{c.title}</div>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div>
          © {new Date().getFullYear()} RouteLog · For demonstration. Not a
          substitute for a certified ELD.
        </div>
        <div>Map data © OpenStreetMap contributors · Routing by OSRM</div>
      </div>
    </footer>
  );
}

// ---- Small UI helpers ----------------------------------------------------

function EmptyState() {
  return (
    <div className="surface-card h-[520px] grid place-items-center text-center p-8">
      <div className="max-w-sm">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
          <MapPinned className="h-7 w-7" />
        </div>
        <h3 className="font-semibold text-lg mb-1">
          Your route will appear here
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter trip details on the left and we'll plot the route, schedule
          required stops, and generate every daily log sheet.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="surface-card h-[520px] grid place-items-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
        <div className="text-sm text-muted-foreground">
          Geocoding & routing…
        </div>
      </div>
    </div>
  );
}

function RouteCallout({ waypoints }) {
  const [start, pickup, dropoff] = waypoints;
  return (
    <div className="surface-card p-4 grid sm:grid-cols-3 gap-3 text-sm">
      <Leg color="bg-primary" label="Start" location={start.label} />
      <Leg color="bg-accent" label="Pickup" location={pickup.label} />
      <Leg color="bg-warning" label="Dropoff" location={dropoff.label} />
    </div>
  );
}

function Leg({ color, label, location }) {
  // Show only "City, State" instead of the full geocoded address.
  const short = location.split(",").slice(0, 2).join(",");
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-medium truncate" title={location}>
          {short}
        </div>
      </div>
    </div>
  );
}

// ---- Helpers -------------------------------------------------------------

// Pick a sensible default start time for a new trip:
// today at 06:00, or tomorrow 06:00 if it's already past noon.
function defaultStartTime() {
  const d = new Date();
  if (d.getHours() >= 12) d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
}
