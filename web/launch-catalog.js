// Offers confirmed by the promoter; stock, delivery and units require a final quote.
(function(root) {
  const offers = [
  {
    "id": "CH-BRQ-ROUGE",
    "name_fr": "Brique rouge",
    "name_en": "Red brick",
    "unit": "pcs",
    "price": 0,
    "category": "produits",
    "catalog_group": "maconnerie",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 1,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-BLC-15",
    "name_fr": "Bloc creux 15 × 20 × 40 cm",
    "name_en": "Hollow block 15 × 20 × 40 cm",
    "unit": "pcs",
    "price": 1.3,
    "category": "produits",
    "catalog_group": "maconnerie",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 100,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-BLC-20",
    "name_fr": "Bloc creux 20 × 20 × 40 cm",
    "name_en": "Hollow block 20 × 20 × 40 cm",
    "unit": "pcs",
    "price": 1.5,
    "category": "produits",
    "catalog_group": "maconnerie",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 100,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-SABLE",
    "name_fr": "Sable concassé",
    "name_en": "Crushed sand",
    "unit": "m³",
    "price": 0,
    "category": "produits",
    "catalog_group": "aggregats",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 1,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-MOELLON",
    "name_fr": "Moellon",
    "name_en": "Rubble stone",
    "unit": "ton",
    "price": 0,
    "category": "produits",
    "catalog_group": "aggregats",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 1,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-TOUT-VENANT",
    "name_fr": "Tout-venant",
    "name_en": "All-in aggregate",
    "unit": "m³",
    "price": 0,
    "category": "produits",
    "catalog_group": "aggregats",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 1,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  },
  {
    "id": "CH-GRAVIER",
    "name_fr": "Gravier",
    "name_en": "Gravel",
    "unit": "ton",
    "price": 0,
    "category": "produits",
    "catalog_group": "aggregats",
    "stock": 0,
    "img": "assets/chantier-mark.svg",
    "launchOffer": true,
    "quoteOnly": true,
    "minimumQuantity": 1,
    "availability": "supplier_confirmation",
    "deliveryTerms": "destination_quote"
  }
];
  function purchaseError(id, quantity) {
    const offer = offers.find(item => item.id === id);
    if (!offer) return null;
    if (quantity < offer.minimumQuantity) return `Commande minimale : ${offer.minimumQuantity} pièces pour ${offer.name_fr}`;
    return 'Un devis avec disponibilité et transport confirmés est nécessaire pour cette offre';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { offers, purchaseError };
  else root.CHANTIER_LAUNCH_OFFERS = offers;
})(typeof window === 'undefined' ? globalThis : window);
