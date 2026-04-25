from django.db import models

class Trip(models.Model):
    current = models.CharField(max_length=255)
    pickup = models.CharField(max_length=255)
    dropoff = models.CharField(max_length=255)
    cycleUsedHours = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Store the complex calculation result as JSON
    plan_data = models.JSONField()