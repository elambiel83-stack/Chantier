(function(){
  const FR = {
    hero1: "Achetez",
    hero2: "et matériaux de construction, livrés à votre chantier.",
    subhero: "Briques, moellon, sable concassé, pavés, ciment, carreaux, faïences — paiement flexible, livraison rapide.",
    browse: "Parcourir le catalogue",
    locate: "Partager ma localisation",
    catalog: "Catalogue",
    catalogSub: "Prix indicatifs, confirmation via WhatsApp.",
    cat_produits: "Produits",
    cat_services: "Services",
    cat_facilitation: "Facilitation",
    cart: "Panier",
    checkout: "Commander via WhatsApp",
    contact: "Contacts",
    legal: "Mentions",
    footerAbout: "E‑commerce de matériaux et services de construction basé à Kolwezi (RDC). Livraison chantier, paiement flexible.",
    cartNote: "Astuce: Ajoutez votre localisation Google Maps dans le message WhatsApp pour une livraison plus rapide."
  };
  const EN = {
    hero1: "Buy",
    hero2: "and building materials, delivered to your site.",
    subhero: "Bricks, rubble, crushed sand, pavers, cement, tiles — flexible payment, fast delivery.",
    browse: "Browse catalog",
    locate: "Share my location",
    catalog: "Catalog",
    catalogSub: "Indicative prices, confirm via WhatsApp.",
    cat_produits: "Products",
    cat_services: "Services",
    cat_facilitation: "Facilitation",
    cart: "Cart",
    checkout: "Order via WhatsApp",
    contact: "Contacts",
    legal: "Legal",
    footerAbout: "E‑commerce for construction materials based in Kolwezi (DRC). Site delivery, flexible payment.",
    cartNote: "Tip: Include your Google Maps location in the WhatsApp message for faster delivery."
  };
  let lang = localStorage.getItem("lang") || "fr";
  const dict = () => lang === "fr" ? FR : EN;
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = dict()[key] || el.textContent;
    });
  }
  function money(v){ return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {style:"currency", currency:"USD"}).format(v); }

  document.getElementById("lang-fr").onclick = () => { lang="fr"; localStorage.setItem("lang","fr"); applyI18n(); render(); };
  document.getElementById("lang-en").onclick = () => { lang="en"; localStorage.setItem("lang","en"); applyI18n(); render(); };

  const waNumber = "+243999972466";
  const waBase = "https://wa.me/" + waNumber.replace(/\D/g, "");
  const whatsappBtn = document.getElementById("whatsapp");
  const whatsappFloat = document.getElementById("whatsapp-float");
  const waLink = document.getElementById("waLink");
  
  if(whatsappBtn) whatsappBtn.href = waBase;
  if(whatsappFloat) whatsappFloat.href = waBase;
  if(waLink) waLink.href = waBase;

  // Partage de localisation
  const shareLocationBtn = document.getElementById("shareLocation");
  if(shareLocationBtn) {
    shareLocationBtn.addEventListener("click", function() {
      if (navigator.geolocation) {
        shareLocationBtn.textContent = lang === "fr" ? "Localisation..." : "Getting location...";
        shareLocationBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
          function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            const message = encodeURIComponent(
              (lang === "fr" ? "Bonjour, voici ma localisation: " : "Hello, here is my location: ") + mapsUrl
            );
            window.open(waBase + "?text=" + message, "_blank");
            shareLocationBtn.textContent = lang === "fr" ? "Partager ma localisation" : "Share my location";
            shareLocationBtn.disabled = false;
          },
          function(error) {
            alert(lang === "fr" 
              ? "Impossible d'obtenir votre localisation. Veuillez autoriser l'accès à la géolocalisation." 
              : "Unable to get your location. Please allow location access.");
            shareLocationBtn.textContent = lang === "fr" ? "Partager ma localisation" : "Share my location";
            shareLocationBtn.disabled = false;
          }
        );
      } else {
        alert(lang === "fr" 
          ? "La géolocalisation n'est pas supportée par votre navigateur." 
          : "Geolocation is not supported by your browser.");
      }
    });
  }

  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  function render(){
    if(!grid) return;
    const q = (search?.value || "").toLowerCase();
    const items = (window.PRODUCTS || []).filter(p => (p.category === currentCategory) && ((p.name_fr + " " + p.name_en).toLowerCase().includes(q)));
    grid.innerHTML = items.map(p => `
      <div class="bg-white rounded-2xl shadow p-4 flex flex-col">
        <img src="${p.img}" alt="${p.name_fr}" class="h-32 sm:h-40 w-full object-cover rounded-xl">
        <div class="mt-3 sm:mt-4 font-semibold text-sm sm:text-base">${lang === "fr" ? p.name_fr : p.name_en}</div>
        <div class="text-slate-500 text-xs sm:text-sm">${p.id} · ${p.unit}${p.stock ? ' · Stock: ' + p.stock : ''}</div>
        <div class="mt-2 text-lg sm:text-xl font-bold">${money(p.price)}</div>
        <div class="mt-3 sm:mt-4 flex gap-2">
          <input type="number" min="1" value="1" class="border rounded-lg px-2 py-1 w-16 sm:w-24 text-sm sm:text-base" id="qty-${p.id}">
          <button class="flex-1 px-2 sm:px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-black text-xs sm:text-sm" onclick="addToCart('${p.id}')">${lang==='fr'?'Ajouter':'Add'}</button>
        </div>
      </div>
    `).join("");
  }

  // Catalog category tabs setup
  let currentCategory = 'produits';
  const tabs = document.querySelectorAll('.catalog-tab');
  function setCategory(cat){
    currentCategory = cat;
    if(tabs && tabs.length){
      tabs.forEach(t=>{
        if(t.dataset.category===cat){
          t.classList.add('bg-slate-900','text-white');
          t.classList.remove('bg-slate-100');
        } else {
          t.classList.remove('bg-slate-900','text-white');
          t.classList.add('bg-slate-100');
        }
      });
    }
    render();
  }
  tabs.forEach(t => t.addEventListener('click', ()=> setCategory(t.dataset.category)));
  setCategory(currentCategory);

  window.addToCart = function(id){
    const qEl = document.getElementById("qty-"+id);
    const qty = Math.max(1, parseInt(qEl?.value||"1",10));
    const product = window.PRODUCTS.find(x=>x.id===id);
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const idx = cart.findIndex(x=>x.id===id);
    if(idx>=0){ cart[idx].qty += qty; } else { cart.push({id, qty}); }
    localStorage.setItem("cart", JSON.stringify(cart));
    alert((lang==='fr'?'Ajouté au panier: ':'Added to cart: ') + (lang==='fr'?product.name_fr:product.name_en));
  };

  // Cart page logic
  const items = document.getElementById("items");
  function renderCart(){
    if(!items) return;
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const enriched = cart.map(c => ({...c, product: window.PRODUCTS.find(p=>p.id===c.id)}));
    let total = 0;
    items.innerHTML = enriched.map(({product, qty}) => {
      const line = product.price * qty;
      total += line;
      return `<div class="bg-white rounded-xl p-3 md:p-4 shadow flex items-center gap-3 md:gap-4">
        <img src="${product.img}" class="h-12 w-12 sm:h-16 sm:w-16 rounded-lg object-cover flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm md:text-base truncate">${lang === "fr" ? product.name_fr : product.name_en}</div>
          <div class="text-slate-500 text-xs md:text-sm">${product.id} · ${qty} ${product.unit} × ${money(product.price)}</div>
        </div>
        <div class="font-bold text-sm md:text-base flex-shrink-0">${money(line)}</div>
      </div>`;
    }).join("");
    const totalEl = document.getElementById("total");
    if(totalEl) totalEl.textContent = (lang==='fr'?'Total: ':'Total: ') + money(total);
    const checkout = document.getElementById("checkout");
    if(checkout){
      const text = encodeURIComponent((lang==='fr'?'Bonjour, je souhaite commander: ':'Hello, I want to order: ')
        + enriched.map(({product, qty}) => `\n- ${qty} × ${product.id} ${lang==='fr'?product.name_fr:product.name_en}`).join("")
        + `\n${lang==='fr'?'Montant estimé: ':'Estimated total: '} ${money(total)}\n${lang==='fr'?'Ma localisation: ':'My location: '}\n`);
      checkout.href = waBase + "?text=" + text;
    }
  }

  applyI18n();
  
  // Attendre le chargement des produits avant de faire le rendu
  if (window.loadProducts) {
    window.loadProducts().then(() => {
      render();
      renderCart();
    });
  } else {
    render();
    renderCart();
  }
  
  if (search) search.addEventListener("input", render);
})();