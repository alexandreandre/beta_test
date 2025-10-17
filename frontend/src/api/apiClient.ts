// src/api/apiClient.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000', 
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur pour LOGGUER chaque requête avant son envoi
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    // Si un token existe ET qu'un header Authorization n'est pas déjà défini pour cette requête, on l'ajoute.
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // --- NOUVEAU LOG PLUS PRÉCIS ---
    console.groupCollapsed(`%c🚀 REQUÊTE SORTANTE: ${config.method?.toUpperCase()} ${config.url}`, 'color: #0077cc; font-weight: bold;');
    console.log('%cURL:', 'color: #0077cc;', `${config.baseURL}${config.url}`);
    console.log('%cHEADER Authorization:', 'color: #0077cc;', config.headers.Authorization || '--- NON DÉFINI ---');
    console.log('%cTOUS LES HEADERS:', 'color: #0077cc;', config.headers);
    console.log('%cDATA:', 'color: #0077cc;', config.data);
    console.groupEnd();
    // --- FIN DU NOUVEAU LOG ---

    return config;
  },
  (error) => {
    console.error('❌ ERREUR AVANT ENVOI:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour LOGGUER chaque réponse à sa réception
apiClient.interceptors.response.use(
  (response) => {
    console.log('%c✅ RÉPONSE REÇUE:', 'color: #009966;', {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ ERREUR DE RÉPONSE:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);


export default apiClient;