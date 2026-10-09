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
    "img": "https://images.pexels.com/photos/33973793/pexels-photo-33973793.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/brique-rouge.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/36120820/pexels-photo-36120820.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/bloc-creux-15.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/37528609/pexels-photo-37528609.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/bloc-creux-20.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/27523355/pexels-photo-27523355.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/sable-concasse.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/9002960/pexels-photo-9002960.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/moellon.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/28101589/pexels-photo-28101589.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/tout-venant.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
    "img": "https://images.pexels.com/photos/10921738/pexels-photo-10921738.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop",
    "imageFallback": "assets/products/gravier.svg",
    "imageCredit": "Pexels — photographie illustrative",
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
