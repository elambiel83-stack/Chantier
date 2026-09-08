import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const CART_KEY = 'monchantier.cart';
const CURRENCY_KEY = 'monchantier.currency';
// Retient pour quel compte le panier local a déjà été fusionné avec le serveur, pour ne
// fusionner (additionner) qu'une fois par compte plutôt qu'à chaque lancement de l'app —
// sinon un panier déjà synchronisé se dédoublerait à chaque ouverture.
const SYNCED_USER_KEY = 'monchantier.cart.syncedUserId';
// Repli hors ligne uniquement: les taux facturés viennent de /api/currency-rates.
const FALLBACK_RATES = { USD: 1, CDF: 2800, EUR: 0.92 };

// Le serveur ne connaît que {id, qty}: on récupère les détails produit (nom, prix, image...)
// du catalogue pour reconstruire des entrées de panier utilisables par l'UI mobile.
async function enrichWireItems(items) {
  if (!items.length) return [];
  try {
    const response = await fetch(getApiUrl('/products'));
    if (!response.ok) return [];
    const data = await response.json();
    const catalog = new Map((data.products || []).map((product) => [product.id, product]));
    return items
      .map(({ id, qty }) => (catalog.has(id) ? { ...catalog.get(id), quantity: qty } : null))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [rates, setRates] = useState(FALLBACK_RATES);
  // Évite d'écraser le panier/devise persistés par un tableau vide pendant le tout
  // premier rendu, avant que la lecture depuis AsyncStorage n'ait eu le temps de finir.
  const hydrated = useRef(false);
  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  const { session, authFetch } = useAuth();
  const userId = session?.user?.id || null;

  useEffect(() => {
    (async () => {
      try {
        const [storedCart, storedCurrency] = await Promise.all([
          AsyncStorage.getItem(CART_KEY),
          AsyncStorage.getItem(CURRENCY_KEY),
        ]);
        if (storedCart) setCart(JSON.parse(storedCart));
        if (storedCurrency) setCurrency(storedCurrency);
      } catch (error) {
        // Panier/devise repartent à vide: pas bloquant.
      } finally {
        hydrated.current = true;
      }
    })();
    fetch(getApiUrl('/currency-rates'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.rates) setRates((current) => ({ ...current, ...data.rates }));
      })
      .catch(() => {});
  }, []);

  // Synchronise avec le panier serveur quand un compte devient actif (connexion, ou session
  // restaurée au lancement). Ce compte n'a encore jamais été synchronisé sur cet appareil ->
  // fusionne (additionne les quantités communes) pour ne rien perdre d'un panier visiteur ou
  // d'un ancien compte. Déjà synchronisé -> adopte simplement le panier serveur, qui reflète
  // peut-être un changement fait depuis un autre appareil.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { cart: serverCart } = await authFetch('/cart');
        const serverItems = serverCart.items;
        const syncedUserId = await AsyncStorage.getItem(SYNCED_USER_KEY);
        let wireItems;
        if (syncedUserId === userId) {
          wireItems = serverItems;
        } else {
          const merged = new Map(serverItems.map((item) => [item.id, item.qty]));
          for (const item of cartRef.current) {
            merged.set(item.id, (merged.get(item.id) || 0) + item.quantity);
          }
          wireItems = [...merged].map(([id, qty]) => ({ id, qty }));
          await AsyncStorage.setItem(SYNCED_USER_KEY, userId);
        }
        if (wireItems.length) {
          await authFetch('/cart', { method: 'PUT', body: { items: wireItems } });
        }
        setCart(await enrichWireItems(wireItems));
      } catch (error) {
        // Hors ligne ou session invalide: le panier local reste utilisable tel quel.
      }
    })();
  }, [userId]);

  // Répercute toute modification locale du panier vers le serveur, pour que les autres
  // appareils du même compte la voient (best-effort, ne bloque jamais l'UI).
  useEffect(() => {
    if (!hydrated.current || !userId) return;
    const wireItems = cart.map(({ id, quantity }) => ({ id, qty: quantity }));
    authFetch('/cart', { method: 'PUT', body: { items: wireItems } }).catch(() => {});
  }, [cart, userId]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => {});
  }, [cart]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(CURRENCY_KEY, currency).catch(() => {});
  }, [currency]);

  const addToCart = (product, quantity = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);

      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prevCart, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  // Les prix du catalogue sont en USD: convertit et formate selon la devise choisie,
  // pour un affichage cohérent entre le catalogue et le panier.
  const formatAmount = (amountUsd) => `${(amountUsd * (Number(rates[currency]) || 1)).toFixed(2)} ${currency}`;

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
        currency,
        setCurrency,
        rates,
        formatAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
