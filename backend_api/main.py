# backend_api/main.py

from fastapi import Request, HTTPException
from core.config import app
from api.routers import employees, dashboard, payslips, schedules, monthly_inputs

print("--- LECTURE DU FICHIER main.py (POINT D'ENTRÉE) ---")

# Inclusion des routeurs de chaque domaine
app.include_router(employees.router)
app.include_router(dashboard.router)
app.include_router(payslips.router)
app.include_router(schedules.router)
app.include_router(monthly_inputs.router)


@app.get("/")
def read_root():
    """ Point de terminaison racine pour vérifier que l'API est en ligne. """
    return {"message": "API du SaaS RH fonctionnelle !"}

@app.post("/api/test-cors")
async def test_cors_endpoint(request: Request):
    """ Point de terminaison pour tester la configuration CORS. """
    print("--- ✅ REQUÊTE REÇUE SUR /api/test-cors ---")
    try:
        data = await request.json()
        print(f"--- ✅ CORPS DE LA REQUÊTE : {data} ---")
        return {"status": "ok", "received_data": data}
    except Exception as e:
        print(f"--- ❌ ERREUR LORS DE LA LECTURE DU CORPS : {e} ---")
        raise HTTPException(status_code=400, detail="Corps de la requête invalide.")

print("--- APPLICATION PRÊTE ---")