// Configuration de l'API
// Changez cette URL selon votre environnement

// Pour tester sur un appareil physique, utilisez l'IP de votre machine
// Exemple: http://192.168.1.100:3000/api

// Pour l'émulateur Android: http://10.0.2.2:3000/api
// Pour le simulateur iOS: http://localhost:3000/api

export const API_CONFIG = {
  // Remplacez par l'IP de votre machine pour tester sur un vrai téléphone
  baseURL: 'http://192.168.1.100:3000/api', // À modifier avec votre IP
  timeout: 10000,
  whatsappNumber: '+243999972466'
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};
