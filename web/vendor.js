(function () {
  const CATEGORY_LABELS = {
    produits: 'Produits',
    services: 'Services',
    facilitation: 'Facilitation',
    partenaires: 'Partenaires'
  };
  const ITEM_STATUS_LABELS = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    ready: 'Prête',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };
  // Transitions proposées depuis chaque statut — le serveur reste la seule autorité (404 si
  // l'article n'appartient pas à ce partenaire), ceci n'évite que d'afficher une action déjà
  // hors de propos pour ce statut.
  const NEXT_STATUS = {
    pending: [{ label: 'Confirmer', status: 'confirmed' }, { label: 'Annuler', status: 'cancelled' }],
    confirmed: [{ label: 'Marquer prête', status: 'ready' }, { label: 'Annuler', status: 'cancelled' }],
    ready: [{ label: 'Marquer livrée', status: 'delivered' }]
  };

  const deniedEl = document.getElementById('denied');
  const dashboardEl = document.getElementById('dashboard');
  const whoamiEl = document.getElementById('whoami');
  const logoutButton = document.getElementById('logout-button');
  const productsListEl = document.getElementById('products-list');
  const productFormStatusEl = document.getElementById('product-form-status');
  const ordersListEl = document.getElementById('orders-list');
  const ordersStatusEl = document.getElementById('orders-status');

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('fr-FR');
    } catch (error) {
      return iso;
    }
  }

  async function loadProducts() {
    try {
      const data = await window.apiCall('/vendor/products');
      const products = data.products || [];
      productsListEl.innerHTML = products.length
        ? products.map((product) => `
            <div class="bg-white rounded-xl p-3 shadow flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="font-semibold">${escapeHtml(product.name_fr)} <span class="text-xs font-normal text-slate-400">(${product.id})</span></div>
                <div class="text-slate-500 text-sm">${CATEGORY_LABELS[product.category] || product.category} · ${product.price} USD / ${escapeHtml(product.unit)} · stock ${product.stock}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold px-2 py-1 rounded-full ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}">${product.isActive ? 'Publié' : 'Suspendu'}</span>
                <button type="button" class="product-toggle px-3 py-1 rounded-lg text-sm outline-button border" data-product-id="${product.id}" data-active="${product.isActive}">${product.isActive ? 'Suspendre' : 'Republier'}</button>
              </div>
            </div>
          `).join('')
        : '<p class="text-slate-500 text-sm">Aucun produit publié pour le moment.</p>';
      productsListEl.querySelectorAll('.product-toggle').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await window.apiCall(`/vendor/products/${button.dataset.productId}`, { method: 'PATCH', body: { isActive: button.dataset.active !== 'true' } });
            await loadProducts();
          } catch (error) {
            productFormStatusEl.textContent = error.message || 'Action refusée.';
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      productFormStatusEl.textContent = error.message || 'Impossible de charger votre catalogue.';
    }
  }

  document.getElementById('product-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    productFormStatusEl.textContent = 'Publication en cours...';
    try {
      await window.apiCall('/vendor/products', {
        method: 'POST',
        body: {
          nameFr: document.getElementById('product-name-fr').value.trim(),
          nameEn: document.getElementById('product-name-en').value.trim(),
          unit: document.getElementById('product-unit').value.trim(),
          price: Number(document.getElementById('product-price').value),
          category: document.getElementById('product-category').value,
          stockQty: Number(document.getElementById('product-stock').value || 0)
        }
      });
      productFormStatusEl.textContent = 'Produit publié.';
      event.target.reset();
      await loadProducts();
    } catch (error) {
      productFormStatusEl.textContent = error.message || 'Publication refusée.';
    }
  });

  function orderItemCard(item) {
    const actions = NEXT_STATUS[item.vendor_status] || [];
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-white rounded-xl p-3 shadow';
    wrapper.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="font-semibold">${escapeHtml(item.name_fr)} × ${item.qty} ${escapeHtml(item.unit)}</div>
          <div class="text-slate-500 text-sm">Commande ${item.order_id.slice(0, 8)} · ${formatDate(item.created_at)}</div>
        </div>
        <span class="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">${ITEM_STATUS_LABELS[item.vendor_status] || item.vendor_status}</span>
      </div>
      <div class="mt-2 text-sm text-slate-600">
        Client : ${escapeHtml(item.full_name || '—')} · ${escapeHtml(item.phone || '')}
        ${item.delivery_latitude != null && item.delivery_longitude != null
          ? ` · <a class="text-red-600 underline" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${item.delivery_latitude},${item.delivery_longitude}">Voir la position de livraison</a>`
          : ''}
      </div>
      ${actions.length ? `<div class="mt-3 flex flex-wrap gap-2">${actions.map((action, index) => `
        <button type="button" class="item-action px-3 py-2 rounded-lg text-sm ${action.status === 'cancelled' ? 'outline-button border' : 'signal-button text-white'}" data-action-index="${index}">${action.label}</button>
      `).join('')}</div>` : ''}
    `;
    wrapper.querySelectorAll('.item-action').forEach((button, index) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.apiCall(`/vendor/order-items/${item.id}/status`, { method: 'PATCH', body: { status: actions[index].status } });
          await loadOrders();
        } catch (error) {
          ordersStatusEl.textContent = error.message || 'Action refusée.';
          button.disabled = false;
        }
      });
    });
    return wrapper;
  }

  async function loadOrders() {
    ordersStatusEl.textContent = 'Chargement...';
    try {
      const data = await window.apiCall('/vendor/orders');
      const items = data.items || [];
      ordersListEl.innerHTML = '';
      if (!items.length) {
        ordersStatusEl.textContent = 'Aucune commande à préparer pour le moment.';
        return;
      }
      ordersStatusEl.textContent = '';
      items.forEach((item) => ordersListEl.appendChild(orderItemCard(item)));
    } catch (error) {
      ordersStatusEl.textContent = error.message || 'Impossible de charger vos commandes.';
    }
  }

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'vendor.html');
      window.location.assign('auth.html');
      return;
    }
    let me;
    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'vendor.html');
      window.location.assign('auth.html');
      return;
    }
    if (me.role !== 'vendor') {
      deniedEl.classList.remove('hidden');
      return;
    }
    const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
    whoamiEl.textContent = authUser?.email ? `${authUser.email} · partenaire` : 'partenaire';
    dashboardEl.classList.remove('hidden');
    await Promise.all([loadProducts(), loadOrders()]);
  }

  logoutButton.addEventListener('click', async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    logoutButton.disabled = true;
    try {
      if (refreshToken) await window.apiCall('/auth/logout', { method: 'POST', body: { token: refreshToken } });
    } catch (error) {
      // La session locale est déjà fermée: l'échec distant ne doit pas bloquer.
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      window.location.assign('index.html');
    }
  });

  init();
})();
