// Configuration du frontend pour se connecter au backend
// L'URL de l'API est déduite de la page: une adresse codée en dur casse dès que le site
// n'est plus servi depuis localhost (Codespaces, préproduction, mise en ligne).
function resolveApiBaseUrl() {
  const DEFAULT_API_PORT = '3000';
  try {
    const override = window.API_BASE_URL || localStorage.getItem('apiBaseUrl');
    if (override) return override;
  } catch (error) {
    // localStorage indisponible: on continue avec la déduction automatique.
  }
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) {
    return `http://localhost:${DEFAULT_API_PORT}/api`;
  }
  const { protocol, hostname, port, origin } = window.location;
  // Site servi par le backend lui-même: même origine, ni CORS ni contenu mixte.
  if (port === DEFAULT_API_PORT) return `${origin}/api`;
  // Codespaces / port forwarding: <codespace>-<port>.app.github.dev
  const forwarded = hostname.match(/^(.+)-(\d+)\.(app\.github\.dev|githubpreview\.dev)$/);
  if (forwarded) return `${protocol}//${forwarded[1]}-${DEFAULT_API_PORT}.${forwarded[3]}/api`;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//${hostname}:${DEFAULT_API_PORT}/api`;
  // Déploiement classique: l'API est derrière /api sur le même domaine.
  return `${origin}/api`;
}

const API_CONFIG = {
  // URL de l'API backend
  baseURL: resolveApiBaseUrl(),
  
  // Endpoints
  endpoints: {
    products: '/products',
    productById: (id) => `/products/${id}`,
    productsByCategory: (category) => `/products/category/${category}`,
    cart: '/cart',
    orders: '/orders',
    paypalOrder: (orderId) => `/orders/${orderId}/paypal`,
    paypalCapture: (orderId) => `/orders/${orderId}/paypal/capture`
  },
  
  // Timeout pour les requêtes (en ms)
  timeout: 10000
};

// Les taux ci-dessous ne sont qu'un repli hors ligne: la référence est /api/currency-rates,
// c'est-à-dire la table utilisée par le backend pour facturer.
window.COMMERCE_CONFIG = {
  currencies: {
    USD: { locale: 'en-US', rate: 1 },
    CDF: { locale: 'fr-CD', rate: 2800 },
    EUR: { locale: 'fr-FR', rate: 0.92 }
  },
  defaultCurrency: 'USD'
};

window.loadCurrencyRates = async function() {
  try {
    const response = await fetch(API_CONFIG.baseURL + '/currency-rates');
    if (!response.ok) throw new Error('Taux indisponibles');
    const data = await response.json();
    Object.entries(data.rates || {}).forEach(([currency, rate]) => {
      if (!window.COMMERCE_CONFIG.currencies[currency] || !Number.isFinite(Number(rate))) return;
      window.COMMERCE_CONFIG.currencies[currency].rate = Number(rate);
    });
    return true;
  } catch (error) {
    console.warn('⚠️ Taux de change de repli utilisés:', error.message);
    return false;
  }
};

// Renouveler la session à partir du jeton de rafraîchissement
window.refreshSession = async function() {
  const token = localStorage.getItem('refreshToken');
  if (!token) return false;
  try {
    const response = await fetch(API_CONFIG.baseURL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!response.ok) throw new Error('Renouvellement refusé');
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch (error) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    return false;
  }
};

// Fonction utilitaire pour faire des appels API
window.apiCall = async function(endpoint, options = {}, allowRefresh = true) {
  const url = API_CONFIG.baseURL + endpoint;
  const accessToken = localStorage.getItem('accessToken');
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers
    },
    ...options
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    // Jeton expiré: on le renouvelle une seule fois puis on rejoue la requête.
    if (response.status === 401 && allowRefresh && accessToken && !endpoint.startsWith('/auth/')) {
      if (await window.refreshSession()) {
        return window.apiCall(endpoint, options, false);
      }
    }

    if (!response.ok) {
      throw new Error(data.message || 'Erreur API');
    }

    return data;
  } catch (error) {
    console.error('Erreur API:', error);
    throw error;
  }
};

// Panier synchronisé entre appareils pour un compte connecté (voir README > Panier).
// Sans session (visiteur), le panier reste local — ces fonctions ne font rien.
window.syncCartToServer = async function(cart) {
  if (!localStorage.getItem('accessToken')) return;
  try {
    await window.apiCall('/cart', { method: 'PUT', body: { items: cart.map(({ id, qty }) => ({ id, qty })) } });
  } catch (error) {
    // Pas bloquant: le panier reste utilisable localement même si la synchronisation échoue
    // (hors ligne, session expirée...).
    console.warn('Synchronisation du panier impossible:', error.message);
  }
};

window.fetchCartFromServer = async function() {
  if (!localStorage.getItem('accessToken')) return null;
  try {
    const { cart } = await window.apiCall('/cart');
    return cart.items;
  } catch (error) {
    console.warn('Impossible de récupérer le panier distant:', error.message);
    return null;
  }
};
