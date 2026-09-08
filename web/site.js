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
    cat_partenaires: "Partenaires",
    cart: "Panier",
    checkout: "Commander via WhatsApp",
    pay: "Payer et commander",
    emptyCart: "Votre panier est vide.",
    removedItems: "Des articles indisponibles ont été retirés de votre panier.",
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
    cat_partenaires: "Partners",
    cart: "Cart",
    checkout: "Order via WhatsApp",
    pay: "Pay and order",
    emptyCart: "Your cart is empty.",
    removedItems: "Unavailable items were removed from your cart.",
    contact: "Contacts",
    legal: "Legal",
    footerAbout: "E‑commerce for construction materials based in Kolwezi (DRC). Site delivery, flexible payment.",
    cartNote: "Tip: Include your Google Maps location in the WhatsApp message for faster delivery."
  };
  let lang = localStorage.getItem("lang") || "fr";
  let currency = localStorage.getItem("currency") || window.COMMERCE_CONFIG?.defaultCurrency || "USD";
  const dict = () => lang === "fr" ? FR : EN;
  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = dict()[key] || el.textContent;
    });
  }
  function money(v){
    const currencyConfig = window.COMMERCE_CONFIG?.currencies?.[currency] || { locale: "en-US", rate: 1 };
    return new Intl.NumberFormat(currencyConfig.locale, {style:"currency", currency}).format(v * currencyConfig.rate);
  }

  document.querySelectorAll("#currency, #checkout-currency").forEach((selector) => {
    selector.value = currency;
    selector.addEventListener("change", () => {
      currency = selector.value;
      localStorage.setItem("currency", currency);
      document.querySelectorAll("#currency, #checkout-currency").forEach((item) => { item.value = currency; });
      render();
      renderCart();
    });
  });

  const langFrButton = document.getElementById("lang-fr");
  const langEnButton = document.getElementById("lang-en");
  if (langFrButton) langFrButton.onclick = () => { lang="fr"; localStorage.setItem("lang","fr"); applyI18n(); render(); renderCart(); };
  if (langEnButton) langEnButton.onclick = () => { lang="en"; localStorage.setItem("lang","en"); applyI18n(); render(); renderCart(); };

  const waNumber = "+243999972466";
  const waBase = "https://wa.me/" + waNumber.replace(/\D/g, "");
  const whatsappBtn = document.getElementById("whatsapp");
  const whatsappFloat = document.getElementById("whatsapp-float");
  const waLink = document.getElementById("waLink");
  
  if(whatsappBtn) whatsappBtn.href = waBase;
  if(whatsappFloat) whatsappFloat.href = waBase;
  if(waLink) waLink.href = waBase;

  const authLink = document.getElementById('auth-link');
  const logoutButton = document.getElementById('logout-button');
  const staffLink = document.getElementById('staff-link');
  const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (authLink && authUser) {
    authLink.textContent = authUser.email || 'Mon compte';
    authLink.href = 'account.html';
    authLink.classList.add('max-w-36', 'truncate');
    logoutButton?.classList.remove('hidden');
  }
  if (staffLink && authUser && ['staff', 'admin'].includes(authUser.role)) {
    staffLink.classList.remove('hidden');
  }
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      logoutButton.disabled = true;
      try {
        if (refreshToken) await window.apiCall('/auth/logout', { method: 'POST', body: { token: refreshToken } });
      } catch (error) {
        console.error('Déconnexion distante impossible:', error);
      } finally {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('authUser');
        window.location.assign('index.html');
      }
    });
  }

  function readCart() {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      return Array.isArray(cart) ? cart.filter((item) => item && item.id && Number(item.qty) > 0) : [];
    } catch (error) {
      return [];
    }
  }

  function updateCartCount() {
    const count = readCart().reduce((total, item) => total + Number(item.qty), 0);
    document.querySelectorAll('#cart-count').forEach((badge) => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  }

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
      <div class="catalog-card bg-white rounded-2xl shadow p-4 flex flex-col">
        <img src="${p.img}" alt="${p.name_fr}" class="h-32 sm:h-40 w-full object-cover rounded-xl">
        <div class="mt-3 sm:mt-4 font-semibold text-sm sm:text-base">${lang === "fr" ? p.name_fr : p.name_en}</div>
        <div class="text-slate-500 text-xs sm:text-sm">${p.id} · ${p.unit}${p.stock ? ' · Stock: ' + p.stock : ''}</div>
        <div class="mt-2 text-lg sm:text-xl font-bold">${money(p.price)}</div>
        <div class="mt-3 sm:mt-4 flex gap-2">
          <input type="number" min="1" value="1" class="border rounded-lg px-2 py-1 w-16 sm:w-24 text-sm sm:text-base" id="qty-${p.id}">
          <button class="dark-button flex-1 px-2 sm:px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-black text-xs sm:text-sm" onclick="addToCart('${p.id}')">${lang==='fr'?'Ajouter':'Add'}</button>
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
    const cart = readCart();
    const idx = cart.findIndex(x=>x.id===id);
    if(idx>=0){ cart[idx].qty += qty; } else { cart.push({id, qty}); }
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
    renderCart();
    alert((lang==='fr'?'Ajouté au panier: ':'Added to cart: ') + (lang==='fr'?product.name_fr:product.name_en));
  };

  window.updateCartItem = function(id, quantity) {
    const cart = readCart();
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.qty = Math.max(0, Math.min(10000, Number(quantity) || 0));
    localStorage.setItem('cart', JSON.stringify(cart.filter((entry) => entry.qty > 0)));
    updateCartCount();
    renderCart();
  };

  window.removeFromCart = function(id) {
    localStorage.setItem('cart', JSON.stringify(readCart().filter((item) => item.id !== id)));
    updateCartCount();
    renderCart();
  };

  // Cart page logic
  const items = document.getElementById("items");
  function renderCart(){
    if(!items) return;
    const cart = readCart();
    const catalog = window.PRODUCTS || [];
    const enriched = cart
      .map(c => ({...c, product: catalog.find(p => p.id === c.id)}))
      .filter(entry => entry.product);
    // Un produit retiré du catalogue ne doit pas casser le rendu du panier.
    if (catalog.length && enriched.length !== cart.length) {
      localStorage.setItem('cart', JSON.stringify(enriched.map(({id, qty}) => ({id, qty}))));
      const notice = document.getElementById('checkout-status');
      if (notice) notice.textContent = dict().removedItems;
    }
    let total = 0;
    items.innerHTML = enriched.length ? enriched.map(({product, qty}) => {
      const line = product.price * qty;
      total += line;
      return `<div class="bg-white rounded-xl p-3 md:p-4 shadow flex items-center gap-3 md:gap-4">
        <img src="${product.img}" alt="${lang === "fr" ? product.name_fr : product.name_en}" class="h-12 w-12 sm:h-16 sm:w-16 rounded-lg object-cover flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm md:text-base truncate">${lang === "fr" ? product.name_fr : product.name_en}</div>
          <div class="text-slate-500 text-xs md:text-sm">${product.id} · ${qty} ${product.unit} × ${money(product.price)}</div>
        </div>
        <div class="font-bold text-sm md:text-base flex-shrink-0">${money(line)}</div>
        <div class="flex items-center gap-1">
          <button type="button" class="h-8 w-8 rounded border" onclick="updateCartItem('${product.id}', ${qty - 1})" aria-label="Diminuer la quantité">−</button>
          <span class="min-w-6 text-center text-sm">${qty}</span>
          <button type="button" class="h-8 w-8 rounded border" onclick="updateCartItem('${product.id}', ${qty + 1})" aria-label="Augmenter la quantité">+</button>
          <button type="button" class="ml-2 text-xs text-red-600 underline" onclick="removeFromCart('${product.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join("") : `<p class="text-slate-500">${dict().emptyCart}</p>`;
    updateCartCount();
    const subtotalEl = document.getElementById("subtotal");
    if(subtotalEl) subtotalEl.textContent = money(total);
    const totalEl = document.getElementById("total");
    if(totalEl) totalEl.textContent = money(total);
  }

  const checkoutForm = document.getElementById("checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!checkoutForm.reportValidity()) return;
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const status = document.getElementById("checkout-status");
      const submitButton = document.getElementById("checkout");
      if (!localStorage.getItem('accessToken')) {
        localStorage.setItem('postLoginRedirect', 'cart.html');
        window.location.assign('auth.html');
        return;
      }
      if (!cart.length) {
        status.textContent = lang === "fr" ? "Votre panier est vide." : "Your cart is empty.";
        return;
      }
      const formData = new FormData(checkoutForm);
      const paymentProvider = formData.get("paymentProvider");
      submitButton.disabled = true;
      status.textContent = lang === "fr" ? "Création de votre commande..." : "Creating your order...";
      try {
        const orderResponse = await window.apiCall("/orders", {
          method: "POST",
          body: {
            customer: { fullName: formData.get("fullName"), phone: formData.get("phone"), email: formData.get("email") || undefined },
            currency: formData.get("currency"),
            paymentProvider,
            items: cart.map((item) => ({ id: item.id, qty: item.qty }))
          }
        });
        localStorage.setItem("lastOrderId", orderResponse.order.id);
        if (paymentProvider === "paypal" || paymentProvider === "cinetpay") {
          const providerLabel = paymentProvider === "paypal" ? "PayPal" : "CinetPay";
          status.textContent = lang === "fr" ? `Redirection sécurisée vers ${providerLabel}...` : `Redirecting securely to ${providerLabel}...`;
          const paymentResponse = await window.apiCall(`/orders/${orderResponse.order.id}/${paymentProvider}`, { method: "POST" });
          const redirectUrl = paymentProvider === "paypal" ? paymentResponse.approvalUrl : paymentResponse.paymentUrl;
          if (!redirectUrl) throw new Error(`Lien de paiement ${providerLabel} indisponible`);
          window.location.assign(redirectUrl);
          return;
        }
        localStorage.removeItem("cart");
        renderCart();
        checkoutForm.reset();
        // reset() rétablit les valeurs du HTML: on remet la devise choisie.
        document.querySelectorAll("#currency, #checkout-currency").forEach((item) => { item.value = currency; });
        const payment = orderResponse.payment;
        status.textContent = payment
          ? (lang === "fr"
              ? `Commande ${orderResponse.order.id} créée. Envoyez le paiement via ${payment.label} au ${payment.payoutNumber} en indiquant la référence ${payment.reference}. Votre commande sera confirmée après vérification.`
              : `Order ${orderResponse.order.id} created. Send payment via ${payment.label} to ${payment.payoutNumber} with reference ${payment.reference}. Your order will be confirmed after verification.`)
          : (lang === "fr" ? `Commande ${orderResponse.order.id} créée.` : `Order ${orderResponse.order.id} created.`);
      } catch (error) {
        // Session expirée malgré le renouvellement: on renvoie vers la connexion.
        if (!localStorage.getItem("accessToken")) {
          localStorage.setItem("postLoginRedirect", "cart.html");
          window.location.assign("auth.html");
          return;
        }
        status.textContent = error.message;
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  applyI18n();
  updateCartCount();
  
  // Attendre le catalogue et les taux de change officiels avant le premier rendu
  Promise.all([
    window.loadProducts ? window.loadProducts() : Promise.resolve(),
    window.loadCurrencyRates ? window.loadCurrencyRates() : Promise.resolve()
  ]).then(() => {
    render();
    renderCart();
  });
  
  if (search) search.addEventListener("input", render);
})();