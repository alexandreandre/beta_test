// src/contexts/AuthContext.tsx (VERSION CORRIGÉE)

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '@/api/apiClient';

interface User {
  id: string;
  email: string;
  role: 'rh' | 'salarie';
  first_name: string; // On ajoute le prénom
}
interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ce hook s'exécute au chargement de l'app pour vérifier si un token existe déjà
  useEffect(() => {
    console.log('%c[AuthContext] 🔄 Vérification de la session au montage...', 'color: purple');
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('%c[AuthContext]   - ✅ Token trouvé dans le localStorage.', 'color: purple');
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // On s'assure que la requête pour restaurer la session utilise bien le token, comme dans la fonction login.
      apiClient.get('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(response => {
          // La réponse de /api/auth/me contient les données utilisateur à jour (y compris le rôle)
          console.log('%c[AuthContext]   - ✅ Session restaurée avec succès. Utilisateur:', 'color: green', response.data);
          setUser(response.data);
        })
        .catch(() => { // Si le token est invalide/expiré
          console.log('%c[AuthContext]   - ❌ Token invalide. Nettoyage de la session.', 'color: red');
          localStorage.removeItem('authToken');
          delete apiClient.defaults.headers.common['Authorization'];
        })
        .finally(() => setIsLoading(false));
    } else {
      console.log('%c[AuthContext]   - 🤷 Aucun token trouvé. Utilisateur non connecté.', 'color: gray');
      setIsLoading(false);
    }
  }, []);

  // src/contexts/AuthContext.tsx -> Remplacer la fonction login

  const login = async (token: string) => {
    console.log('%c[AuthContext] 🚀 Tentative de connexion...', 'color: blue; font-weight: bold;');
    console.log(`%c[AuthContext]   - Token brut reçu: ${token.substring(0, 30)}...`, 'color: blue');

    // --- CORRECTION & FIABILISATION ---
    // 1. On s'assure que le token final est propre (sans "Bearer " en double)
    const finalToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    const authHeader = `Bearer ${finalToken}`;
    console.log(`%c[AuthContext]   - Header Authorization préparé: ${authHeader.substring(0, 30)}...`, 'color: darkcyan');

    // 2. Sauvegarder le token propre pour la session et les futures requêtes
    localStorage.setItem('authToken', finalToken);
    apiClient.defaults.headers.common['Authorization'] = authHeader;
    
    try {
      // 3. On passe le header explicitement pour CET appel immédiat
      console.log('%c[AuthContext]   - Appel de /api/auth/me pour récupérer l\'utilisateur...', 'color: blue');
      const response = await apiClient.get('/api/auth/me', {
        headers: { Authorization: authHeader }
      });
      console.log('%c[AuthContext]   - ✅ Utilisateur récupéré avec succès:', 'color: green', response.data);
      setUser(response.data);
    } catch (error) {
      // Si la récupération échoue, on nettoie tout pour éviter un état incohérent
      console.error('%c[AuthContext]   - ❌ Échec de la récupération de l\'utilisateur après connexion.', 'color: red', error);
      logout();
      throw error;
    }
  };
  
  const logout = () => {
    console.log('%c[AuthContext] 🚪 Déconnexion...', 'color: orange; font-weight: bold;');
    setUser(null);
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};