# backend_api/schemas/schedule.py

from pydantic import BaseModel
from typing import List

class CalendarData(BaseModel):
    day: int
    type: str
    hours: float | None = None

class CalendarResponse(BaseModel):
    planned: List[CalendarData]
    actual: List[CalendarData]

class PlannedCalendarEntry(BaseModel):
    jour: int
    type: str
    heures_prevues: float | None = None

class PlannedCalendarRequest(BaseModel):
    year: int
    month: int
    calendrier_prevu: List[PlannedCalendarEntry]

class ActualHoursEntry(BaseModel):
    jour: int
    heures_faites: float | None = None
    type: str | None = None 

class ActualHoursRequest(BaseModel):
    year: int
    month: int
    calendrier_reel: List[ActualHoursEntry]
