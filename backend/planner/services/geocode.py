# planner/services/geocode.py
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

def geocode_location(query: str):
    """
    Returns (lon, lat) as floats or None.
    """
    params = {
        "q": query,
        "format": "json",
        "limit": 1
    }
    headers = {
        # Nominatim requires a valid User-Agent
        "User-Agent": "spotterai/1.0 (contact: patrickbett018@gmail.com)"
    }

    resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
    if resp.status_code != 200:
        return None

    data = resp.json()
    if not data:
        return None

    return float(data[0]["lon"]), float(data[0]["lat"])