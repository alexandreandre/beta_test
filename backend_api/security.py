from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client
from typing import Optional
from pydantic import BaseModel
import os

# --- Connexion Supabase (spécifique à ce module) ---
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# --- Modèles ---
class User(BaseModel):
    id: str
    email: Optional[str] = None
    role: str

# OAuth2 scheme qui pointe vers notre futur endpoint de login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Valide le token JWT, récupère l'utilisateur depuis Supabase Auth,
    puis son rôle depuis notre table 'profiles'.
    """
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        profile_response = supabase.table('profiles').select('role').eq('id', user.id).single().execute()
        print(profile_response)
        if not profile_response.data:
            raise HTTPException(status_code=404, detail="Profil utilisateur non trouvé")

        return User(id=str(user.id), email=user.email, role=profile_response.data['role'])

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Impossible de valider les identifiants",
            headers={"WWW-Authenticate": "Bearer"},
        )