import math
from datetime import timedelta

def calculate_hos_plan(total_miles, start_cycle_hours):
    # Constants based on prompt assumptions
    AVG_SPEED = 65 
    DRIVE_LIMIT = 11
    DUTY_LIMIT = 14
    CYCLE_LIMIT = 70
    
    total_drive_time = total_miles / AVG_SPEED
    remaining_cycle = CYCLE_LIMIT - start_cycle_hours
    
    days = []
    current_miles = 0
    
    # Simplified logic to chunk the trip into days
    while current_miles < total_miles:
        day_drive = min(DRIVE_LIMIT, (total_miles - current_miles) / AVG_SPEED)
        # Add logic for 30-min breaks and fuel here
        days.append({
            "driving": day_drive,
            "on_duty": day_drive + 1, # 1hr for pickup/dropoff
            "miles_covered": day_drive * AVG_SPEED
        })
        current_miles += (day_drive * AVG_SPEED)
        
    return days