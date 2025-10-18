from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from supabase import create_client
import os
from security import get_current_user, User
from pydantic import BaseModel

# --- Connexion Supabase (spécifique à ce routeur) ---
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")) # Utilise la clé publique (anon) ici

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        print(f"--- 🕵️ [login] Tentative de connexion pour: {form_data.username}")
        res = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password
        })
        print(f"--- ✅ [login] Connexion réussie pour: {form_data.username}")
        # Ne jamais logger le token complet en production, mais utile pour le débogage
        print(f"--- 🔑 [login] Token généré (début): {res.session.access_token[:30]}...")
        return {"access_token": res.session.access_token, "token_type": "bearer"}
    except Exception as e:
        print(f"--- ❌ [login] Échec de la connexion pour {form_data.username}: {e}")
        raise HTTPException(status_code=400, detail="Email ou mot de passe incorrect")

@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Récupère les informations de l'utilisateur actuellement connecté."""
    print(f"--- 🕵️ [/me] Début de la récupération du profil pour l'utilisateur ID: {current_user.id}")
    try:
        # La dépendance get_current_user a déjà fait tout le travail.
        # Si nous arrivons ici, c'est que tout s'est bien passé.
        print(f"--- ✅ [/me] Profil utilisateur récupéré avec succès pour: {current_user.email}")
        return current_user
    except Exception as e:
        # Ce bloc ne sera probablement jamais atteint si get_current_user lève une HTTPException,
        # mais il est bon de l'avoir pour capturer d'autres erreurs inattendues.
        print(f"--- ❌ [/me] Erreur inattendue lors de la récupération du profil: {e}")
        raise e