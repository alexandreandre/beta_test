# backend_api/api/routers/dashboard.py

import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException

from core.config import PATH_TO_PAYROLL_ENGINE
from schemas.general import DashboardRatesResponse

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)


@router.get("/contribution-rates", response_model=DashboardRatesResponse)
def get_contribution_rates():
    """ Récupère les taux de cotisation et vérifie leur fraîcheur. """
    try:
        chemin_cotisations = PATH_TO_PAYROLL_ENGINE / "data" / "cotisations.json"
        data = json.loads(chemin_cotisations.read_text(encoding="utf-8"))
        last_scraped_str = data.get("meta", {}).get("last_scraped")
        rates_with_status = []

        if last_scraped_str:
            last_scraped_date = datetime.fromisoformat(last_scraped_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            delta = now - last_scraped_date

            for rate in data.get("cotisations", []):
                if delta > timedelta(days=7):
                    status = "red"
                elif delta > timedelta(days=1):
                    status = "orange"
                else:
                    status = "green"
                rate["status"] = status
                rates_with_status.append(rate)

        return {"rates": rates_with_status, "last_check": last_scraped_str}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fichier cotisations.json introuvable.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



