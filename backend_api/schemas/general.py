# backend_api/schemas/general.py

from pydantic import BaseModel
from typing import List

class ContributionRate(BaseModel):
    id: str
    libelle: str
    salarial: float | dict | str | None = None
    patronal: float | dict | str | None = None
    status: str

class DashboardRatesResponse(BaseModel):
    rates: List[ContributionRate]
    last_check: str | None = None

class PayrollEventsResponse(BaseModel):
    status: str
    events_count: int