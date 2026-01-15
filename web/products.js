// Produits chargés depuis l'API
window.PRODUCTS = [];

// Flag pour savoir si on utilise l'API ou les données locales
window.USE_API = true;

// Données locales en fallback si l'API n'est pas disponible
const LOCAL_PRODUCTS = [
  { id: "BRQ-001", name_fr: "Brique en bloc ciment", name_en: "Cement block brick", unit: "pcs", price: 0.45, img: "assets/mesproduits.png", category: "produits" },
  { id: "SAB-001", name_fr: "Sable concassé (m³)", name_en: "Crushed sand (m³)", unit: "m3", price: 18.00, img: "assets/mesproduits.png", category: "produits" },
  { id: "MOL-001", name_fr: "Moellon", name_en: "Rubble stone", unit: "ton", price: 22.00, img: "assets/mesproduits.png", category: "produits" },
  { id: "PAV-001", name_fr: "Pavé", name_en: "Paver", unit: "sqm", price: 14.00, img: "assets/mesproduits.png", category: "produits" },
  { id: "CIM-001", name_fr: "Ciment (sac 50kg)", name_en: "Cement (50kg)", unit: "bag", price: 11.50, img: "assets/mesproduits.png", category: "produits" },
  { id: "CAR-001", name_fr: "Carreaux (m²)", name_en: "Tiles (sqm)", unit: "sqm", price: 19.00, img: "assets/mesproduits.png", category: "produits" },
  { id: "SVC-001", name_fr: "Livraison chantier", name_en: "Site delivery", unit: "service", price: 0.00, img: "assets/mesproduits.png", category: "services" },
  { id: "SVC-002", name_fr: "Pose de pavés (m²)", name_en: "Paver installation (sqm)", unit: "sqm", price: 5.00, img: "assets/mesproduits.png", category: "services" },
  { id: "FAC-001", name_fr: "Assistance achat", name_en: "Purchase assistance", unit: "service", price: 0.00, img: "assets/mesproduits.png", category: "facilitation" },
  { id: "FAC-002", name_fr: "Conseil technique", name_en: "Technical advice", unit: "service", price: 0.00, img: "assets/mesproduits.png", category: "facilitation" }
];

// Charger les produits depuis l'API
async function loadProducts() {
  if (window.USE_API && window.apiCall) {
    try {
      console.log('🔄 Chargement des produits depuis l\'API...');
      const response = await window.apiCall('/products');
      if (response.success && response.products) {
        window.PRODUCTS = response.products;
        console.log(`✅ ${response.products.length} produits chargés depuis l'API`);
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors du chargement depuis l\'API:', error);
      console.log('📦 Utilisation des données locales en fallback');
    }
  }
  
  // Fallback sur les données locales
  window.PRODUCTS = LOCAL_PRODUCTS;
  return false;
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProducts);
} else {
  loadProducts();
}

