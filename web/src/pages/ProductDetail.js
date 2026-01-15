import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/ProductDetail.css';

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/products/${id}`);
      setProduct(response.data.product);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find(item => item.productId === id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        productId: id,
        name: product.name,
        price: product.price.amount,
        unit: product.price.unit,
        quantity,
        seller: product.seller._id
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    alert('Produit ajouté au panier!');
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!product) {
    return <div className="error">Produit non trouvé</div>;
  }

  return (
    <div className="product-detail">
      <Link to="/products" className="back-link">← Retour aux produits</Link>

      <div className="product-detail-container">
        <div className="product-images">
          {product.images && product.images.length > 0 ? (
            <img src={product.images[0].url} alt={product.name} />
          ) : (
            <div className="placeholder-image-large">📦</div>
          )}
        </div>

        <div className="product-details">
          <h1>{product.name}</h1>
          <p className="product-category-badge">{product.category}</p>
          
          <div className="product-price-large">
            {product.price.amount} {product.price.currency} / {product.price.unit}
          </div>

          {product.rating.count > 0 && (
            <div className="product-rating-large">
              ⭐ {product.rating.average.toFixed(1)} ({product.rating.count} avis)
            </div>
          )}

          <div className="product-description">
            <h3>Description</h3>
            <p>{product.description}</p>
          </div>

          {product.specifications && (
            <div className="product-specifications">
              <h3>Spécifications</h3>
              <ul>
                {product.specifications.brand && (
                  <li><strong>Marque:</strong> {product.specifications.brand}</li>
                )}
                {product.specifications.model && (
                  <li><strong>Modèle:</strong> {product.specifications.model}</li>
                )}
                {product.specifications.material && (
                  <li><strong>Matériau:</strong> {product.specifications.material}</li>
                )}
                {product.specifications.weight && (
                  <li><strong>Poids:</strong> {product.specifications.weight} kg</li>
                )}
              </ul>
            </div>
          )}

          <div className="product-stock">
            <p>Stock disponible: {product.stock.quantity} {product.stock.unit}</p>
          </div>

          <div className="product-seller-info">
            <h3>Vendeur</h3>
            <p><strong>{product.seller.name}</strong></p>
            {product.seller.company && (
              <p>{product.seller.company.name}</p>
            )}
            {product.seller.rating && (
              <p>⭐ {product.seller.rating.average.toFixed(1)}</p>
            )}
          </div>

          <div className="product-actions">
            <div className="quantity-selector">
              <label>Quantité:</label>
              <input
                type="number"
                min="1"
                max={product.stock.quantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
              />
            </div>
            <button onClick={handleAddToCart} className="btn-primary btn-large">
              Ajouter au panier
            </button>
          </div>

          {product.location && (
            <div className="product-location">
              <p>📍 {product.location.city}, {product.location.country}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
