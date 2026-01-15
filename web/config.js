// Configuration du frontend pour se connecter au backend
const API_CONFIG = {
  // URL de l'API backend
  baseURL: 'http://localhost:3000/api',
  
  // Endpoints
  endpoints: {
    products: '/products',
    productById: (id) => `/products/${id}`,
    productsByCategory: (category) => `/products/category/${category}`,
    cart: '/cart',
    cartById: (sessionId) => `/cart/${sessionId}`
  },
  
  // Timeout pour les requêtes (en ms)
  timeout: 10000
};

// Fonction utilitaire pour faire des appels API
window.apiCall = async function(endpoint, options = {}) {
  const url = API_CONFIG.baseURL + endpoint;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Erreur API');
    }
    
    return data;
  } catch (error) {
    console.error('Erreur API:', error);
    throw error;
  }
};

// Générer ou récupérer un ID de session
window.getSessionId = function() {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};
