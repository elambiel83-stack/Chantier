const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Base de données simulée pour les produits
const PRODUCTS = [
  { 
    id: "BRQ-001", 
    name_fr: "Brique en bloc ciment", 
    name_en: "Cement block brick", 
    unit: "pcs", 
    price: 0.45, 
    img: "https://images.unsplash.com/photo-1496247749665-49cf5b1022e9?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 10000
  },
  { 
    id: "SAB-001", 
    name_fr: "Sable concassé (m³)", 
    name_en: "Crushed sand (m³)", 
    unit: "m3", 
    price: 18.00, 
    img: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 500
  },
  { 
    id: "MOL-001", 
    name_fr: "Moellon", 
    name_en: "Rubble stone", 
    unit: "ton", 
    price: 22.00, 
    img: "https://images.unsplash.com/photo-1606761568499-6d2451b23c85?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 300
  },
  { 
    id: "PAV-001", 
    name_fr: "Pavé", 
    name_en: "Paver", 
    unit: "sqm", 
    price: 14.00, 
    img: "https://images.unsplash.com/photo-1599842055622-5b164b4a9490?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 2000
  },
  { 
    id: "CIM-001", 
    name_fr: "Ciment (sac 50kg)", 
    name_en: "Cement (50kg)", 
    unit: "bag", 
    price: 11.50, 
    img: "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 5000
  },
  { 
    id: "CAR-001", 
    name_fr: "Carreaux (m²)", 
    name_en: "Tiles (sqm)", 
    unit: "sqm", 
    price: 19.00, 
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop", 
    category: "produits",
    stock: 1500
  },
  // Services
  { 
    id: "SVC-001", 
    name_fr: "Livraison chantier", 
    name_en: "Site delivery", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1540580124-955e7160e54f?q=80&w=1200&auto=format&fit=crop", 
    category: "services",
    stock: 9999
  },
  { 
    id: "SVC-002", 
    name_fr: "Pose de pavés (m²)", 
    name_en: "Paver installation (sqm)", 
    unit: "sqm", 
    price: 5.00, 
    img: "https://images.unsplash.com/photo-1529429617124-0e7ac6d0c6f9?q=80&w=1200&auto=format&fit=crop", 
    category: "services",
    stock: 9999
  },
  // Facilitation
  { 
    id: "FAC-001", 
    name_fr: "Assistance achat", 
    name_en: "Purchase assistance", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=1200&auto=format&fit=crop", 
    category: "facilitation",
    stock: 9999
  },
  { 
    id: "FAC-002", 
    name_fr: "Conseil technique", 
    name_en: "Technical advice", 
    unit: "service", 
    price: 0.00, 
    img: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop", 
    category: "facilitation",
    stock: 9999
  }
];

// Stockage temporaire des paniers (en production, utiliser une base de données)
let carts = {};

// Routes API

// Route de test
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API MonChantier',
    version: '1.0.0',
    endpoints: [
      'GET /api/products',
      'GET /api/products/:id',
      'GET /api/products/category/:category',
      'POST /api/cart',
      'GET /api/cart/:sessionId',
      'DELETE /api/cart/:sessionId'
    ]
  });
});

// Récupérer tous les produits
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  
  let filteredProducts = [...PRODUCTS];
  
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name_fr.toLowerCase().includes(searchLower) ||
      p.name_en.toLowerCase().includes(searchLower) ||
      p.id.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    success: true,
    count: filteredProducts.length,
    products: filteredProducts
  });
});

// Récupérer un produit par ID
app.get('/api/products/:id', (req, res) => {
  const product = PRODUCTS.find(p => p.id === req.params.id);
  
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Produit non trouvé'
    });
  }
  
  res.json({
    success: true,
    product
  });
});

// Récupérer les produits par catégorie
app.get('/api/products/category/:category', (req, res) => {
  const filteredProducts = PRODUCTS.filter(p => p.category === req.params.category);
  
  res.json({
    success: true,
    category: req.params.category,
    count: filteredProducts.length,
    products: filteredProducts
  });
});

// Ajouter/mettre à jour le panier
app.post('/api/cart', (req, res) => {
  const { sessionId, items } = req.body;
  
  if (!sessionId || !items) {
    return res.status(400).json({
      success: false,
      message: 'SessionId et items requis'
    });
  }
  
  // Valider les items
  const validatedItems = items.map(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) {
      throw new Error(`Produit ${item.id} non trouvé`);
    }
    return {
      id: item.id,
      qty: Math.max(1, parseInt(item.qty) || 1),
      product
    };
  });
  
  carts[sessionId] = {
    items: validatedItems,
    updatedAt: new Date()
  };
  
  res.json({
    success: true,
    message: 'Panier mis à jour',
    cart: carts[sessionId]
  });
});

// Récupérer le panier
app.get('/api/cart/:sessionId', (req, res) => {
  const cart = carts[req.params.sessionId];
  
  if (!cart) {
    return res.json({
      success: true,
      cart: { items: [] }
    });
  }
  
  res.json({
    success: true,
    cart
  });
});

// Supprimer le panier
app.delete('/api/cart/:sessionId', (req, res) => {
  delete carts[req.params.sessionId];
  
  res.json({
    success: true,
    message: 'Panier supprimé'
  });
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Erreur serveur'
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📦 ${PRODUCTS.length} produits chargés`);
  console.log(`🌍 CORS activé pour: ${process.env.CORS_ORIGIN || '*'}`);
});
