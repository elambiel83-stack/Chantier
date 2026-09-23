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
// Aucun des trois définis: Google.useAuthRequest lève une exception synchrone dès son
// premier rendu (invariantClientId dans expo-auth-session — vérifié en conditions
// réelles, contrairement à ce que le commentaire précédent supposait), ce qui plantait
// tout l'écran de connexion/inscription avant même d'afficher le formulaire e-mail/mot
// de passe. GOOGLE_AUTH_CONFIGURED reflète la vraie disponibilité; un identifiant de
// repli non fonctionnel évite seulement le crash, jamais utilisé si un vrai est défini.
const NOT_CONFIGURED_PLACEHOLDER = 'google-oauth-not-configured';
export const GOOGLE_AUTH_CONFIGURED = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID
);
export const GOOGLE_AUTH_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || NOT_CONFIGURED_PLACEHOLDER,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || NOT_CONFIGURED_PLACEHOLDER,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || NOT_CONFIGURED_PLACEHOLDER,
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};
