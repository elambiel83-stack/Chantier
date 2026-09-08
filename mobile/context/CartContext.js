import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config';

const CartContext = createContext();

const CART_KEY = 'monchantier.cart';
const CURRENCY_KEY = 'monchantier.currency';
// Repli hors ligne uniquement: les taux facturés viennent de /api/currency-rates.
const FALLBACK_RATES = { USD: 1, CDF: 2800, EUR: 0.92 };

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
