from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from supabase import create_client
import os
from security import get_current_user, User
from pydantic import BaseModel

# --- Connexion Supabase (spécifique à ce routeur) ---
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")) # Utilise la clé publique ici

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password
        })
        return {"access_token": res.session.access_token, "token_type": "bearer"}
    except Exception:
        raise HTTPException(status_code=400, detail="Email ou mot de passe incorrect")

@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    """ Récupère les informations de l'utilisateur actuellement connecté. """
    return current_user