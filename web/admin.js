(function () {
  const STATUS_LABELS = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    delivering: 'En livraison',
    completed: 'Terminée',
    cancelled: 'Annulée'
  };
  const STATUS_BADGE = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    delivering: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };
  const PAYMENT_LABELS = {
    paypal: 'PayPal',
    airtel_money: 'Airtel Money',
    orange_money: 'Orange Money'
  };

  const deniedEl = document.getElementById('denied');
  const dashboardEl = document.getElementById('dashboard');
  const scopeNoteEl = document.getElementById('scope-note');
  const whoamiEl = document.getElementById('whoami');
  const ordersEl = document.getElementById('orders');
  const ordersStatusEl = document.getElementById('orders-status');
  const statusFilterEl = document.getElementById('status-filter');
  const logoutButton = document.getElementById('logout-button');

  let me = null; // { id, role }

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(amount));
    } catch (error) {
      return `${amount} ${currency}`;
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('fr-FR');
    } catch (error) {
      return iso;
    }
  }

  function assignmentLabel(order) {
    if (!order.assigned_to) return 'Non assignée';
    if (order.assigned_to === me.id) return 'Assignée à vous';
    return 'Assignée à un autre agent';
  }

  function paymentLabel(order) {
    if (!order.payment_provider) return '';
    const label = PAYMENT_LABELS[order.payment_provider] || order.payment_provider;
    if (order.payment_provider !== 'paypal' && order.payment_status === 'pending') {
      return `${label} · à vérifier manuellement`;
    }
    return `${label} · ${order.payment_status}`;
  }

  // Boutons proposés: le serveur reste la seule autorité (409 si refusé), ceci n'évite
  // que d'afficher une action qu'on sait déjà interdite pour ce rôle/statut/affectation.
  function availableActions(order) {
    const actions = [];
    const mine = order.assigned_to === me.id;
    if (me.role === 'admin') {
      if (order.status === 'pending') {
        actions.push({ label: 'Confirmer', status: 'confirmed', variant: 'signal' });
        actions.push({ label: 'Annuler', status: 'cancelled', variant: 'outline' });
      } else if (order.status === 'confirmed') {
        actions.push({ label: 'Mettre en livraison', status: 'delivering', variant: 'signal' });
        actions.push({ label: 'Annuler', status: 'cancelled', variant: 'outline' });
      } else if (order.status === 'delivering') {
        actions.push({ label: 'Marquer terminée', status: 'completed', variant: 'signal' });
      }
    } else if (me.role === 'staff') {
      if (order.status === 'confirmed' && !order.assigned_to) {
        actions.push({ label: 'Réclamer', claim: true, variant: 'signal' });
      } else if (order.status === 'confirmed' && mine) {
        actions.push({ label: 'Mettre en livraison', status: 'delivering', variant: 'signal' });
        actions.push({ label: 'Annuler', status: 'cancelled', variant: 'outline' });
      } else if (order.status === 'delivering' && mine) {
        actions.push({ label: 'Marquer terminée', status: 'completed', variant: 'signal' });
      }
    }
    return actions;
  }

  function renderOrders(orders) {
    if (!orders.length) {
      ordersEl.innerHTML = '<p class="text-slate-500">Aucune commande à afficher.</p>';
      return;
    }
    ordersEl.innerHTML = orders.map((order) => {
      const badge = STATUS_BADGE[order.status] || 'bg-slate-100 text-slate-700';
      const payment = paymentLabel(order);
      const actions = availableActions(order);
      return `
        <div class="bg-white rounded-xl p-4 shadow" data-order-id="${order.id}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-mono text-xs text-slate-500" title="${order.id}">${order.id.slice(0, 8)}…</span>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${STATUS_LABELS[order.status] || order.status}</span>
          </div>
          <div class="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div class="font-semibold">${escapeHtml(order.full_name || '—')}</div>
              <div class="text-slate-500 text-sm">${escapeHtml(order.phone || '')}</div>
            </div>
            <div class="text-lg font-bold">${money(order.total_amount, order.currency)}</div>
          </div>
          <div class="mt-2 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>${formatDate(order.created_at)}</span>
            <span>${assignmentLabel(order)}</span>
            ${payment ? `<span>${escapeHtml(payment)}</span>` : ''}
          </div>
          ${actions.length ? `<div class="mt-3 flex flex-wrap gap-2">${actions.map((action, index) => `
            <button type="button" class="order-action px-3 py-2 rounded-lg text-sm ${action.variant === 'signal' ? 'signal-button text-white' : 'outline-button border'}"
              data-order-id="${order.id}" data-action-index="${index}">${action.label}</button>
          `).join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    ordersEl.querySelectorAll('.order-action').forEach((button) => {
      button.addEventListener('click', () => {
        const orderId = button.dataset.orderId;
        const order = currentOrders.find((item) => item.id === orderId);
        const action = availableActions(order)[Number(button.dataset.actionIndex)];
        if (action) runAction(order, action, button);
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  let currentOrders = [];

  async function runAction(order, action, button) {
    button.disabled = true;
    ordersStatusEl.textContent = 'Traitement en cours...';
    try {
      if (action.claim) {
        await window.apiCall(`/orders/${order.id}/claim`, { method: 'POST' });
      } else {
        await window.apiCall(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: action.status } });
      }
      ordersStatusEl.textContent = 'Mis à jour.';
      await loadOrders();
    } catch (error) {
      ordersStatusEl.textContent = error.message || 'Action refusée.';
      button.disabled = false;
    }
  }

  async function loadOrders() {
    ordersStatusEl.textContent = 'Chargement...';
    const status = statusFilterEl.value;
    try {
      const data = await window.apiCall(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
      currentOrders = data.orders || [];
      renderOrders(currentOrders);
      ordersStatusEl.textContent = '';
    } catch (error) {
      ordersStatusEl.textContent = error.message || 'Impossible de charger les commandes.';
    }
  }

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'admin.html');
      window.location.assign('auth.html');
      return;
    }
    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'admin.html');
      window.location.assign('auth.html');
      return;
    }
    if (!['staff', 'admin'].includes(me.role)) {
      deniedEl.classList.remove('hidden');
      return;
    }
    const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
    whoamiEl.textContent = authUser?.email ? `${authUser.email} · ${me.role}` : me.role;
    scopeNoteEl.textContent = me.role === 'admin'
      ? 'Vous voyez toutes les commandes.'
      : 'Vous voyez les commandes confirmées non affectées et celles qui vous sont assignées.';
    dashboardEl.classList.remove('hidden');
    await loadOrders();
  }

  statusFilterEl.addEventListener('change', loadOrders);
  document.getElementById('refresh').addEventListener('click', loadOrders);
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
