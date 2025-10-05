// src/api/apiClient.ts

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000', 
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur pour LOGGUER chaque requête avant son envoi
apiClient.interceptors.request.use(
  (config) => {
    console.log('%c🚀 REQUÊTE SORTANTE:', 'color: #0077cc;', {
      method: config.method?.toUpperCase(),
      url: config.baseURL + config.url,
      headers: config.headers,
      data: config.data,
    });
    
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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