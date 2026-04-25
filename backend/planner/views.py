# planner/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import requests

from .hos_logic import calculate_hos_plan
from .models import Trip
from .services.geocode import geocode_location  # if you put helper in services

OSRM_URL = "http://router.project-osrm.org/route/v1/driving"


class PlanTripView(APIView):
    def post(self, request):
        data = request.data

        current = (data.get("current") or "").strip()
        pickup = (data.get("pickup") or "").strip()
        dropoff = (data.get("dropoff") or "").strip()
        cycleUsedHours = data.get("cycleUsedHours")

        # Validate input
        if not all([current, pickup, dropoff]):
            return Response(
                {"error": "current_location, pickup_location, dropoff_location are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if cycleUsedHours is None:
            return Response(
                {"error": "cycle_used_hours is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1) Geocode all locations
        current_coords = geocode_location(current)
        pickup_coords = geocode_location(pickup)
        dropoff_coords = geocode_location(dropoff)

        if not all([current_coords, pickup_coords, dropoff_coords]):
            return Response(
                {"error": "Failed to geocode one or more locations"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2) Build OSRM coordinate string (lon,lat;lon,lat;...)
        coords_list = ";".join([
            f"{current_coords[0]},{current_coords[1]}",
            f"{pickup_coords[0]},{pickup_coords[1]}",
            f"{dropoff_coords[0]},{dropoff_coords[1]}",
        ])

        # 3) Call OSRM
        try:
            route_resp = requests.get(
                f"{OSRM_URL}/{coords_list}?overview=full&geometries=geojson",
                timeout=15
            )
        except requests.RequestException:
            return Response({"error": "Routing service unreachable"}, status=502)

        if route_resp.status_code != 200:
            return Response({"error": "Routing service failed"}, status=502)

        route_data = route_resp.json()
        routes = route_data.get("routes")
        if not routes:
            return Response({"error": "Route not found"}, status=400)

        # 4) Compute distance + HOS
        distance_meters = routes[0]["distance"]
        distance_miles = distance_meters * 0.000621371

        logs = calculate_hos_plan(distance_miles, float(cycleUsedHours))

        result = {
            "summary": {
                "totalMiles": distance_miles,
                "totalDrivingHours": distance_miles / 65.0,
            },
            "geometry": routes[0]["geometry"],
            "logs": logs
        }

        # 5) Persist (optional but matches your model)
        Trip.objects.create(
            current=current,
            pickup=pickup,
            dropoff=dropoff,
            cycleUsedHours=cycleUsedHours,
            plan_data=result
        )

        return Response(result, status=200)