import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from '../config';

const AuthContext = createContext();

// Jetons sensibles: stockage chiffré (Keychain/Keystore), pas AsyncStorage.
const SESSION_KEY = 'monchantier.session';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

async function request(endpoint, { method = 'GET', body, token } = {}) {
  const response = await fetch(getApiUrl(endpoint), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Requête refusée par le serveur');
    error.status = response.status;
    throw error;
  }
  return data;
}

// Seule une vraie session (compte + jetons) est persistée: le mode visiteur repart de
// zéro à chaque lancement, ce qui est sans conséquence (aucune donnée à perdre).
async function loadPersistedSession() {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

async function persistSession(session) {
  try {
    if (session?.accessToken) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch (error) {
    // Stockage sécurisé indisponible (rare): la session reste utilisable en mémoire
    // pour cette ouverture d'app, simplement pas restaurée à la prochaine.
  }
}

export const AuthProvider = ({ children }) => {
  // session = { accessToken, refreshToken, user } pour un compte,
  // { guest: true, user } pour une visite sans compte (catalogue seul).
  const [session, setSession] = useState(null);
  // Le temps de tenter de restaurer une session persistée au lancement: évite un
  // flash de l'écran de connexion avant de savoir si un compte est déjà connecté.
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const persisted = await loadPersistedSession();
      if (!persisted?.refreshToken) {
        if (active) setRestoring(false);
        return;
      }
      // Le jeton d'accès persisté a presque toujours expiré (15 min): on renouvelle
      // tout de suite plutôt que d'attendre un premier appel API en échec.
      try {
        const data = await request('/auth/refresh', { method: 'POST', body: { token: persisted.refreshToken } });
        const next = { accessToken: data.accessToken, refreshToken: data.refreshToken, user: persisted.user };
        if (active) setSession(next);
        await persistSession(next);
      } catch (error) {
        await persistSession(null);
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Login/register/Google/Apple renvoient tous la même forme ({accessToken, refreshToken,
  // user}): un seul endroit pour l'appliquer à la session en mémoire et persistée.
  const applySession = async (data) => {
    const next = { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
    setSession(next);
    await persistSession(next);
  };

  const login = async (email, password) => {
    await applySession(await request('/auth/login', { method: 'POST', body: { email, password } }));
  };

  const register = async (payload) => {
    await applySession(await request('/auth/register', { method: 'POST', body: payload }));
  };

  // idToken: jeton d'identité obtenu du SDK Google côté client (voir App.js).
  const loginWithGoogle = async (idToken) => {
    await applySession(await request('/auth/google', { method: 'POST', body: { idToken } }));
  };

  // identityToken: jeton d'identité Apple ("Sign in with Apple", authentification iCloud
  // sur iOS). fullName n'est fourni par Apple qu'à la toute première connexion.
  const loginWithApple = async (identityToken, fullName) => {
    await applySession(await request('/auth/apple', { method: 'POST', body: { identityToken, fullName } }));
  };

  const continueAsGuest = () => {
    setSession({ guest: true, user: { email: null, name: 'Visiteur' } });
  };

  const logout = async () => {
    const current = session;
    setSession(null);
    await persistSession(null);
    if (current?.accessToken && current?.refreshToken) {
      try {
        await request('/auth/logout', {
          method: 'POST',
          token: current.accessToken,
          body: { token: current.refreshToken },
        });
      } catch (error) {
        // La session locale est déjà fermée: l'échec distant ne doit pas bloquer.
      }
    }
  };

  const refresh = async (current) => {
    try {
      const data = await request('/auth/refresh', { method: 'POST', body: { token: current.refreshToken } });
      const next = { ...current, accessToken: data.accessToken, refreshToken: data.refreshToken };
      setSession(next);
      await persistSession(next);
      return next.accessToken;
    } catch (error) {
      setSession(null);
      await persistSession(null);
      return null;
    }
  };

  // Appel authentifié: rejoue la requête une fois après renouvellement du jeton.
  const authFetch = async (endpoint, options = {}) => {
    if (!session?.accessToken) {
      const error = new Error('Connectez-vous pour finaliser votre commande.');
      error.status = 401;
      throw error;
    }
    try {
      return await request(endpoint, { ...options, token: session.accessToken });
    } catch (error) {
      if (error.status !== 401) throw error;
      const accessToken = await refresh(session);
      if (!accessToken) throw new Error('Votre session a expiré. Reconnectez-vous.');
      return request(endpoint, { ...options, token: accessToken });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        restoring,
        user: session?.user || null,
        isAuthenticated: Boolean(session?.accessToken),
        login,
        register,
        loginWithGoogle,
        loginWithApple,
        continueAsGuest,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
