from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client
from gotrue.errors import AuthApiError
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None

# OAuth2 scheme qui pointe vers notre futur endpoint de login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Valide le token JWT, récupère l'utilisateur depuis Supabase Auth,
    puis son rôle depuis notre table 'profiles'.
    """
    try:
        print(f"--- 🕵️ [get_current_user] Validation du token...")
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if not user:
            print("--- ❌ [get_current_user] Token valide mais aucun utilisateur trouvé.")
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        print(f"--- ✅ [get_current_user] Utilisateur authentifié: {user.email} (ID: {user.id})")
        print(f"--- 🕵️ [get_current_user] Récupération du profil depuis la table 'profiles'...")
        # On retire .single() pour éviter une erreur si le profil n'existe pas.
        # La requête retournera une liste (vide ou avec un élément).
        profile_response = supabase.table('profiles').select('role, first_name, last_name').eq('id', user.id).execute()
        
        print(f"--- 📦 [get_current_user] Réponse de Supabase (profiles): {profile_response}")

        if not profile_response.data or len(profile_response.data) == 0:
            print(f"--- ❌ [get_current_user] Profil non trouvé pour l'utilisateur ID: {user.id}")
            raise HTTPException(status_code=404, detail="Profil utilisateur non trouvé")

        profile_data = profile_response.data[0]
        user_data = User(
                id=str(user.id),
                email=user.email,
                role=profile_data['role'],
                first_name=profile_data.get('first_name'),
                last_name=profile_data.get('last_name')
            )
        print(f"--- ✅ [get_current_user] Utilisateur complet avec profil: {user_data.model_dump_json(indent=2)}")
        return user_data

    except HTTPException as http_exc:
        # Laisse passer les exceptions HTTP que nous avons levées intentionnellement (comme la 404)
        raise http_exc
    except AuthApiError as e:
        print(f"--- ❌ [get_current_user] Erreur d'API Supabase Auth: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token invalide ou expiré: {e.message}")
    except Exception as e:
        print(f"--- ❌ [get_current_user] Erreur inattendue: {e}")
        # Pour toute autre erreur imprévue, on lève une erreur 500.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erreur interne du serveur: {e}")