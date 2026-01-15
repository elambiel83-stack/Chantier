import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Cart.css';

function Cart() {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const storedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(storedCart);
  }, []);

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    const updatedCart = [...cart];
    updatedCart[index].quantity = newQuantity;
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const removeItem = (index) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    alert('Fonctionnalité de paiement à venir!');
  };

  return (
    <div className="cart-page">
      <h1>Panier</h1>

      {cart.length === 0 ? (
        <div className="empty-cart">
          <p>Votre panier est vide</p>
          <Link to="/products" className="btn-primary">
            Continuer vos achats
          </Link>
        </div>
      ) : (
        <div className="cart-container">
          <div className="cart-items">
            {cart.map((item, index) => (
              <div key={index} className="cart-item">
                <div className="cart-item-info">
                  <h3>{item.name}</h3>
                  <p className="cart-item-price">
                    {item.price} USD / {item.unit}
                  </p>
                </div>
                <div className="cart-item-actions">
                  <div className="quantity-control">
                    <button onClick={() => updateQuantity(index, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, item.quantity + 1)}>+</button>
                  </div>
                  <div className="cart-item-total">
                    {(item.price * item.quantity).toFixed(2)} USD
                  </div>
                  <button onClick={() => removeItem(index)} className="btn-remove">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>Résumé</h2>
            <div className="summary-line">
              <span>Sous-total:</span>
              <span>{calculateTotal().toFixed(2)} USD</span>
            </div>
            <div className="summary-line">
              <span>Livraison:</span>
              <span>À calculer</span>
            </div>
            <div className="summary-line total">
              <span>Total:</span>
              <span>{calculateTotal().toFixed(2)} USD</span>
            </div>
            <button onClick={handleCheckout} className="btn-primary btn-full">
              Passer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
