import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/Products.css';

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    minPrice: '',
    maxPrice: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [filters]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products', { params: filters });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const categories = [
    'cement', 'concrete', 'bricks', 'steel', 'wood', 
    'roofing', 'plumbing', 'electrical', 'paint', 'tiles', 
    'tools', 'equipment', 'other'
  ];

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Catalogue de Produits</h1>
        <p>Découvrez notre large sélection de matériaux de construction</p>
      </div>

      <div className="products-container">
        <aside className="filters-sidebar">
          <h3>Filtres</h3>
          
          <div className="filter-group">
            <label>Recherche</label>
            <input
              type="text"
              name="search"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Catégorie</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Prix minimum</label>
            <input
              type="number"
              name="minPrice"
              placeholder="0"
              value={filters.minPrice}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Prix maximum</label>
            <input
              type="number"
              name="maxPrice"
              placeholder="1000"
              value={filters.maxPrice}
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
        </aside>

        <div className="products-content">
          {loading ? (
            <div className="loading">Chargement...</div>
          ) : products.length === 0 ? (
            <div className="no-products">
              <p>Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(product => (
                <Link
                  key={product._id}
                  to={`/products/${product._id}`}
                  className="product-card"
                >
                  <div className="product-image">
                    {product.images && product.images[0] ? (
                      <img src={product.images[0].url} alt={product.name} />
                    ) : (
                      <div className="placeholder-image">📦</div>
                    )}
                  </div>
                  <div className="product-info">
                    <h3>{product.name}</h3>
                    <p className="product-category">{product.category}</p>
                    <p className="product-price">
                      {product.price.amount} {product.price.currency} / {product.price.unit}
                    </p>
                    <p className="product-seller">
                      Vendeur: {product.seller?.name || 'N/A'}
                    </p>
                    {product.rating.count > 0 && (
                      <p className="product-rating">
                        ⭐ {product.rating.average.toFixed(1)} ({product.rating.count})
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Products;
