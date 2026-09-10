import React, { createContext, useContext, useState } from 'react';
import { getApiUrl } from '../config';

const AuthContext = createContext();

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

export const AuthProvider = ({ children }) => {
  // session = { accessToken, refreshToken, user } pour un compte,
  // { guest: true, user } pour une visite sans compte (catalogue seul).
  const [session, setSession] = useState(null);

  const login = async (email, password) => {
    const data = await request('/auth/login', { method: 'POST', body: { email, password } });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  };

  const register = async (payload) => {
    const data = await request('/auth/register', { method: 'POST', body: payload });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  };

  const loginWithGoogle = async (idToken) => {
    const data = await request('/auth/google', { method: 'POST', body: { credential: idToken } });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  };

  const loginWithFacebook = async (accessToken) => {
    const data = await request('/auth/facebook', { method: 'POST', body: { accessToken } });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  };

  const continueAsGuest = () => {
    setSession({ guest: true, user: { email: null, name: 'Visiteur' } });
  };

  const logout = async () => {
    const current = session;
    setSession(null);
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
      return next.accessToken;
    } catch (error) {
      setSession(null);
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
        user: session?.user || null,
        isAuthenticated: Boolean(session?.accessToken),
        login,
        register,
        loginWithGoogle,
        loginWithFacebook,
        continueAsGuest,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
