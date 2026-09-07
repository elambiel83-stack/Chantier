// Configuration de l'app: lue depuis les variables d'environnement EXPO_PUBLIC_*
// (inlinées au build par Expo, pas besoin de dépendance supplémentaire). Copiez
// .env.example vers .env.local et adaptez-le à votre environnement — voir ce fichier
// pour le détail de chaque variable.

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

export const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
  timeout: 10000,
  whatsappNumber: process.env.EXPO_PUBLIC_WHATSAPP_NUMBER || '+243999972466',
};

// Client OAuth Google: expo-auth-session accepte un identifiant par plateforme.
// Non définis, Google.useAuthRequest reste inactif (bouton désactivé) plutôt que
// d'utiliser un faux identifiant qui échouerait silencieusement.
export const GOOGLE_AUTH_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};
