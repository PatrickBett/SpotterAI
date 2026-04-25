import { useState } from "react";
import {
  Truck,
  MapPin,
  Package,
  Flag,
  Clock,
  Loader2,
  Play,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function TripForm({ onSubmit, loading }) {
  const [current, setCurrent] = useState("Chicago, IL");
  const [pickup, setPickup] = useState("Dallas, TX");
  const [dropoff, setDropoff] = useState("Los Angeles, CA");
  const [cycleUsed, setCycleUsed] = useState("12");
  

  // function handleSubmit(e) {
  //   e.preventDefault();

  //   const cycle = parseFloat(cycleUsed);
  //   if (isNaN(cycle) || cycle < 0 || cycle > 70) return;

  //   onSubmit({
  //     current: current.trim(),
  //     pickup: pickup.trim(),
  //     dropoff: dropoff.trim(),
  //     cycleUsedHours: cycle,
  //   });
  // }

  async function handleSubmit(e) {
    e.preventDefault();
      onSubmit({
        current: current.trim(),
        pickup: pickup.trim(),
        dropoff: dropoff.trim(),
        cycleUsedHours: parseFloat(cycleUsed) || 0,
      });

    const cycle = parseFloat(cycleUsed);
    if (isNaN(cycle) || cycle < 0 || cycle > 70) return;

    // 1. Prepare the payload
    const tripData = {
      current: current.trim(),
      pickup: pickup.trim(),
      dropoff: dropoff.trim(),
      cycleUsedHours: cycle,
    };
    console.log("Submitting trip data:", tripData);
    

    try {
      // 2. Make the POST request to your Django server
      const response = await fetch("http://localhost:8000/api/plan-trip/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // 3. Parse the JSON result from Django
      const result = await response.json();
      console.log("Received response:", result);
      // onSubmit(result);

      // 4. Send the result back up to the parent component (App.jsx)
    
    } catch (error) {
      console.error("Error planning trip:", error);
      alert(
        "Failed to connect to the backend server. Make sure Django is running on port 8000.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground shadow-card">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">
            Trip details
          </h2>
          <p className="text-xs text-muted-foreground">
            Property-carrying driver · 70hr / 8 day cycle
          </p>
        </div>
      </div>

      <LocationField
        id="current"
        label="Current location"
        icon={MapPin}
        iconColor="text-primary"
        value={current}
        onChange={setCurrent}
        placeholder="e.g. Chicago, IL"
      />
      <LocationField
        id="pickup"
        label="Pickup location"
        icon={Package}
        iconColor="text-accent"
        value={pickup}
        onChange={setPickup}
        placeholder="e.g. Dallas, TX"
      />
      <LocationField
        id="dropoff"
        label="Dropoff location"
        icon={Flag}
        iconColor="text-warning"
        value={dropoff}
        onChange={setDropoff}
        placeholder="e.g. Los Angeles, CA"
      />

      <div className="space-y-1.5">
        <Label
          htmlFor="cycleUsed"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Current cycle used (hrs)
        </Label>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="cycleUsed"
            type="number"
            step="0.25"
            min="0"
            max="70"
            value={cycleUsed}
            onChange={(e) => setCycleUsed(e.target.value)}
            className="pl-9 h-11 font-mono-num"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Hours already used in your rolling 8-day window (max 70)
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-gradient-primary hover:opacity-95 text-primary-foreground font-semibold shadow-card"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Planning…
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" /> Plan trip & generate logs
          </>
        )}
      </Button>
    </form>
  );
}

function LocationField({
  id,
  label,
  icon: Icon,
  iconColor,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Icon
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${iconColor}`}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="pl-9 h-11"
        />
      </div>
    </div>
  );
}
