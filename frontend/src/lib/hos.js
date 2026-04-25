// HOS (Hours of Service) engine — Property-carrying driver, 70hr/8day cycle.
// Builds a chronological timeline of duty events for the trip and groups them
// into daily logs starting at 00:00 each day.
//
// Rules implemented (FMCSA §395):
//  - 11-hour driving limit per shift
//  - 14-hour on-duty window per shift (after 10hr off-duty break)
//  - 30-minute break required after 8 cumulative hours of driving
//  - 10-hour off-duty restart between shifts
//  - 70 hours on-duty in any rolling 8 days (cycle)
//  - 1 hour on-duty for pickup, 1 hour on-duty for dropoff
//  - Fueling stop (15 min, on-duty) at least every 1,000 miles
//
// Duty statuses: "off", "sb" (sleeper), "driving", "on" (on-duty not driving)

export const DUTY = { OFF: "off", SB: "sb", DRIVING: "driving", ON: "on" };

const HOUR = 3600;
const AVG_SPEED_MPH = 55; // Used only when distributing OSRM duration; OSRM gives us actual duration.

// Configurable limits
const MAX_DRIVING_PER_SHIFT = 11 * HOUR;
const MAX_WINDOW_PER_SHIFT = 14 * HOUR;
const BREAK_AFTER_DRIVING = 8 * HOUR;
const BREAK_DURATION = 0.5 * HOUR;
const RESTART_OFF = 10 * HOUR;
const MAX_CYCLE = 70 * HOUR;
const FUEL_INTERVAL_MILES = 1000;
const FUEL_DURATION = 0.25 * HOUR; // 15 min on-duty
const PICKUP_DURATION = 1 * HOUR;
const DROPOFF_DURATION = 1 * HOUR;

/**
 * Build the trip timeline.
 * @param {object} input
 * @param {{lat,lon,label}} input.current
 * @param {{lat,lon,label}} input.pickup
 * @param {{lat,lon,label}} input.dropoff
 * @param {number} input.cycleUsedHours - hrs already used in 70/8 cycle
 * @param {number} input.toPickupMeters
 * @param {number} input.toPickupSeconds
 * @param {number} input.toDropoffMeters
 * @param {number} input.toDropoffSeconds
 * @param {Date} input.startTime
 */
export function planTrip(input) {
  const {
    current, pickup, dropoff, cycleUsedHours,
    toPickupMeters, toPickupSeconds,
    toDropoffMeters, toDropoffSeconds,
    startTime,
  } = input;

  const events = []; // {start: Date, end: Date, status, label, meta?}
  let cursor = new Date(startTime);
  let cycleUsed = cycleUsedHours * HOUR;
  let shiftDriving = 0;
  let shiftWindow = 0;
  let drivingSinceBreak = 0;
  let shiftStart = new Date(cursor);

  function pushEvent(status, durationSec, label, meta) {
    if (durationSec <= 0) return;
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + durationSec * 1000);
    events.push({ start, end, status, label, meta });
    cursor = end;
    if (status === DUTY.DRIVING || status === DUTY.ON) {
      cycleUsed += durationSec;
    }
    if (status !== DUTY.OFF && status !== DUTY.SB) {
      shiftWindow += durationSec;
    }
    if (status === DUTY.DRIVING) {
      shiftDriving += durationSec;
      drivingSinceBreak += durationSec;
    }
  }

  function takeBreak30() {
    pushEvent(DUTY.OFF, BREAK_DURATION, "30-min break");
    drivingSinceBreak = 0;
    // Note: a 30-min off-duty does NOT reset shift window.
    shiftWindow += BREAK_DURATION;
  }

  function take10HourReset() {
    pushEvent(DUTY.SB, RESTART_OFF, "10-hour off-duty (sleeper berth)");
    shiftDriving = 0;
    shiftWindow = 0;
    drivingSinceBreak = 0;
    shiftStart = new Date(cursor);
  }

  function take34HourRestart() {
    pushEvent(DUTY.OFF, 34 * HOUR, "34-hour cycle restart");
    shiftDriving = 0;
    shiftWindow = 0;
    drivingSinceBreak = 0;
    cycleUsed = 0;
    shiftStart = new Date(cursor);
  }

  // Drive a segment of `totalSeconds` covering `totalMeters`,
  // inserting fueling stops, breaks, and resets as needed.
  function driveSegment(totalSeconds, totalMeters, label, milesAtSegmentStart) {
    let remainingSec = totalSeconds;
    let remainingMeters = totalMeters;
    // miles of this segment driven so far
    let drivenMeters = 0;

    while (remainingSec > 0) {
      // Check 70/8 cycle before doing anything new
      if (cycleUsed >= MAX_CYCLE - 60) {
        take34HourRestart();
      }

      // Need 10-hr reset?
      if (shiftDriving >= MAX_DRIVING_PER_SHIFT - 60 || shiftWindow >= MAX_WINDOW_PER_SHIFT - 60) {
        take10HourReset();
        continue;
      }

      // Need 30-min break?
      if (drivingSinceBreak >= BREAK_AFTER_DRIVING - 60) {
        takeBreak30();
        continue;
      }

      // How long can we drive right now?
      const drivableShift = Math.min(
        MAX_DRIVING_PER_SHIFT - shiftDriving,
        MAX_WINDOW_PER_SHIFT - shiftWindow,
        BREAK_AFTER_DRIVING - drivingSinceBreak,
        MAX_CYCLE - cycleUsed,
      );

      // Distance until next fuel stop
      const totalMilesDriven = (milesAtSegmentStart + drivenMeters / 1609.344);
      const milesUntilFuel = FUEL_INTERVAL_MILES - (totalMilesDriven % FUEL_INTERVAL_MILES);
      const secUntilFuel = (milesUntilFuel / AVG_SPEED_MPH) * HOUR;

      const driveChunk = Math.min(remainingSec, drivableShift, secUntilFuel);
      if (driveChunk <= 0) {
        // Cannot drive — force a break/reset
        if (drivingSinceBreak >= BREAK_AFTER_DRIVING - 60) takeBreak30();
        else take10HourReset();
        continue;
      }

      const chunkMeters = (driveChunk / totalSeconds) * totalMeters;
      pushEvent(DUTY.DRIVING, driveChunk, label);
      remainingSec -= driveChunk;
      remainingMeters -= chunkMeters;
      drivenMeters += chunkMeters;

      // Fuel stop if we just hit a 1000-mi multiple and there's more to drive
      const newTotalMiles = milesAtSegmentStart + drivenMeters / 1609.344;
      if (
        remainingSec > 60 &&
        Math.floor(newTotalMiles / FUEL_INTERVAL_MILES) >
          Math.floor((newTotalMiles - chunkMeters / 1609.344) / FUEL_INTERVAL_MILES)
      ) {
        pushEvent(DUTY.ON, FUEL_DURATION, "Fueling stop", { kind: "fuel" });
      }
    }
    return drivenMeters;
  }

  // ===== Trip sequence =====
  // 1. Drive: current -> pickup
  driveSegment(toPickupSeconds, toPickupMeters, `Drive to pickup: ${pickup.label.split(",")[0]}`, 0);

  // 2. Pickup (1 hr on-duty)
  if (shiftWindow + PICKUP_DURATION > MAX_WINDOW_PER_SHIFT) take10HourReset();
  pushEvent(DUTY.ON, PICKUP_DURATION, `Pickup at ${pickup.label.split(",")[0]}`, { kind: "pickup" });

  // 3. Drive: pickup -> dropoff
  driveSegment(
    toDropoffSeconds,
    toDropoffMeters,
    `Drive to dropoff: ${dropoff.label.split(",")[0]}`,
    toPickupMeters / 1609.344,
  );

  // 4. Dropoff (1 hr on-duty)
  if (shiftWindow + DROPOFF_DURATION > MAX_WINDOW_PER_SHIFT) take10HourReset();
  pushEvent(DUTY.ON, DROPOFF_DURATION, `Dropoff at ${dropoff.label.split(",")[0]}`, { kind: "dropoff" });

  return {
    events,
    summary: buildSummary(events, toPickupMeters + toDropoffMeters),
    days: groupByDay(events),
  };
}

function buildSummary(events, totalMeters) {
  let drivingSec = 0, onSec = 0, offSec = 0, sbSec = 0;
  let breaks = 0, fuels = 0, resets = 0;
  for (const e of events) {
    const d = (e.end - e.start) / 1000;
    if (e.status === DUTY.DRIVING) drivingSec += d;
    else if (e.status === DUTY.ON) onSec += d;
    else if (e.status === DUTY.OFF) offSec += d;
    else if (e.status === DUTY.SB) sbSec += d;
    if (e.label === "30-min break") breaks++;
    if (e.meta?.kind === "fuel") fuels++;
    if (e.label?.includes("10-hour")) resets++;
  }
  const start = events[0]?.start;
  const end = events[events.length - 1]?.end;
  return {
    totalMiles: totalMeters / 1609.344,
    totalDrivingHours: drivingSec / HOUR,
    totalOnDutyHours: (drivingSec + onSec) / HOUR,
    totalOffHours: offSec / HOUR,
    totalSbHours: sbSec / HOUR,
    totalElapsedHours: start && end ? (end - start) / 1000 / HOUR : 0,
    breaks, fuels, resets,
    startTime: start,
    endTime: end,
  };
}

// Split events at midnight boundaries into daily log objects.
function groupByDay(events) {
  if (!events.length) return [];
  const days = new Map();
  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function startOfDay(d) {
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
  }
  function endOfDay(d) {
    const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
  }

  for (const ev of events) {
    let segStart = new Date(ev.start);
    const segEnd = new Date(ev.end);
    while (segStart < segEnd) {
      const eod = endOfDay(segStart);
      const sliceEnd = segEnd <= eod ? segEnd : new Date(startOfDay(new Date(segStart.getTime() + 24*3600*1000)));
      const key = dayKey(segStart);
      if (!days.has(key)) {
        days.set(key, {
          date: startOfDay(segStart),
          events: [],
          totals: { off: 0, sb: 0, driving: 0, on: 0 },
        });
      }
      const day = days.get(key);
      const dur = (sliceEnd - segStart) / 1000;
      day.events.push({
        start: new Date(segStart),
        end: new Date(sliceEnd),
        status: ev.status,
        label: ev.label,
        meta: ev.meta,
      });
      day.totals[ev.status] += dur / HOUR;
      segStart = sliceEnd;
    }
  }

  // If a day ends before 24h was filled, pad off-duty? We'll let the renderer
  // treat unfilled time as off-duty visually but only return real events here.
  return Array.from(days.values()).sort((a, b) => a.date - b.date);
}

// Pick interesting events along the route to display as map markers.
// Returns events with their approximate position by interpolating along the
// route geometry based on cumulative driving time.
export function placeStopsOnRoute(events, geometry, totalDrivingSec) {
  if (!geometry?.length) return [];
  const stops = [];
  let drivenSec = 0;
  for (const ev of events) {
    if (ev.status === DUTY.DRIVING) {
      drivenSec += (ev.end - ev.start) / 1000;
      continue;
    }
    if (!["30-min break", "Pickup", "Dropoff"].some((k) => ev.label?.startsWith(k)) && ev.meta?.kind !== "fuel" && !ev.label?.includes("10-hour") && !ev.label?.includes("34-hour")) continue;
    if (ev.meta?.kind !== "fuel" && !ev.label?.includes("break") && !ev.label?.includes("hour") && !ev.label?.startsWith("Pickup") && !ev.label?.startsWith("Dropoff")) continue;
    const ratio = totalDrivingSec > 0 ? Math.min(1, drivenSec / totalDrivingSec) : 0;
    const idx = Math.floor(ratio * (geometry.length - 1));
    stops.push({
      position: geometry[idx],
      ev,
    });
  }
  return stops;
}
