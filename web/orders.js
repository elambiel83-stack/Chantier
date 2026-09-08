(function () {
  // Un article de commande peut provenir d'un partenaire de la marketplace (nom publié par
  // ce partenaire lui-même — voir POST /api/vendor/products): à échapper avant innerHTML,
  // sans quoi un partenaire malveillant pourrait injecter du HTML/JS visible par le client.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  const STATUS_LABELS = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    delivering: 'En livraison',
    completed: 'Terminée',
    cancelled: 'Annulée'
  };
  // Étapes du suivi de commande. 'cancelled' est un état terminal à part, jamais une étape
  // du parcours normal (une commande annulée ne "passe" pas par confirmée/en livraison).
  const STATUS_STEPS = ['pending', 'confirmed', 'delivering', 'completed'];

  function statusStepper(status) {
    if (status === 'cancelled') {
      return '<p class="mt-3 text-sm font-medium text-red-600">Commande annulée</p>';
    }
    const currentIndex = STATUS_STEPS.indexOf(status);
    const steps = STATUS_STEPS.map((step, index) => {
      const done = index <= currentIndex;
      const dotClass = done ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500';
      const labelClass = done ? 'text-slate-800 font-medium' : 'text-slate-400';
      const connectorClass = index < currentIndex ? 'bg-red-600' : 'bg-slate-200';
      return `
        <div class="flex flex-1 items-center">
          <div class="flex flex-col items-center gap-1">
            <span class="flex h-6 w-6 items-center justify-center rounded-full text-xs ${dotClass}">${index + 1}</span>
            <span class="text-[11px] text-center ${labelClass}">${STATUS_LABELS[step]}</span>
          </div>
          ${index < STATUS_STEPS.length - 1 ? `<span class="mx-1 h-0.5 flex-1 ${connectorClass}"></span>` : ''}
        </div>
      `;
    }).join('');
    return `<div class="mt-3 flex items-start">${steps}</div>`;
  }
  const PAYMENT_PROVIDER_LABELS = {
    paypal: 'PayPal',
    airtel_money: 'Airtel Money',
    orange_money: 'Orange Money'
  };
  const PAYMENT_STATUS_LABELS = {
    pending: 'en attente',
    authorized: 'autorisé',
    paid: 'payé',
    failed: 'échoué',
    cancelled: 'annulé',
    refunded: 'remboursé'
  };

  const statusEl = document.getElementById('orders-status');
  const listEl = document.getElementById('orders-list');

  if (!localStorage.getItem('accessToken')) {
    window.location.assign('auth.html');
    return;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return iso;
    }
  }

  function timeAgo(iso) {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return 'à l’instant';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    return `il y a ${hours} h`;
  }

  function orderCard(order) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-surface border border-slate-200 bg-white p-4 shadow-sm';
    wrapper.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-semibold">Commande ${order.id.slice(0, 8)}</p>
          <p class="text-xs text-slate-500">${formatDate(order.created_at)}</p>
        </div>
        <div class="text-right">
          <p class="font-bold">${order.total_amount} ${order.currency}</p>
          <p class="text-xs text-slate-500">${STATUS_LABELS[order.status] || order.status}</p>
        </div>
      </div>
      <p class="mt-2 text-sm text-slate-600">
        Paiement : ${PAYMENT_PROVIDER_LABELS[order.payment_provider] || order.payment_provider || '—'}
        ${order.payment_status ? `(${PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status})` : ''}
      </p>
      ${statusStepper(order.status)}
      ${order.delivery_latitude != null && order.delivery_longitude != null
        ? `<a class="mt-3 inline-block text-sm text-red-600 underline" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}">Voir la position de livraison</a>`
        : ''}
      ${order.status === 'delivering' && order.driver_latitude != null && order.driver_longitude != null
        ? `<p class="mt-2 text-sm">
             <a class="text-red-600 underline" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${order.driver_latitude},${order.driver_longitude}">Suivre le livreur en direct</a>
             <span class="text-slate-400">(position ${timeAgo(order.driver_location_updated_at)})</span>
           </p>`
        : ''}
      ${order.possible_delay
        ? `<p class="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">⚠️ Votre livraison semble retardée en chemin (embouteillage ou imprévu possible). Notre équipe reste en contact avec le livreur.</p>`
        : ''}
      <button type="button" class="mt-3 block text-sm text-red-600 underline detail-toggle">Voir le détail</button>
      <div class="mt-3 hidden space-y-1 border-t border-slate-200 pt-3 text-sm detail-content"></div>
    `;

    const toggle = wrapper.querySelector('.detail-toggle');
    const content = wrapper.querySelector('.detail-content');
    let loaded = false;
    toggle.addEventListener('click', async () => {
      const willShow = content.classList.contains('hidden');
      if (willShow && !loaded) {
        content.textContent = 'Chargement...';
        content.classList.remove('hidden');
        try {
          const { order: detail } = await window.apiCall(`/orders/${order.id}`);
          content.innerHTML = detail.items.map((item) => `
            <div class="flex justify-between">
              <span>${escapeHtml(item.name_fr)} × ${item.qty} ${escapeHtml(item.unit)}${item.vendor_name ? ` <span class="text-slate-400">(${escapeHtml(item.vendor_name)} · ${escapeHtml(item.vendor_status)})</span>` : ''}</span>
              <span>${(item.qty * item.unit_price_usd).toFixed(2)} USD</span>
            </div>
          `).join('') || '<p class="text-slate-500">Aucun article.</p>';
          loaded = true;
        } catch (error) {
          content.textContent = error.message || 'Impossible de charger le détail.';
        }
      } else {
        content.classList.toggle('hidden', !willShow);
      }
      toggle.textContent = content.classList.contains('hidden') ? 'Voir le détail' : 'Masquer le détail';
    });

    return wrapper;
  }

  // Tant qu'une commande est en livraison, on rafraîchit périodiquement pour refléter la
  // position du livreur en direct — sans polling permanent une fois plus aucune commande
  // active (la boucle s'arrête d'elle-même en ne se replanifiant pas).
  let refreshTimer = null;
  async function refreshOrders() {
    try {
      const { orders } = await window.apiCall('/orders');
      if (!orders.length) {
        statusEl.textContent = "Vous n'avez pas encore de commande.";
        listEl.innerHTML = '';
        return;
      }
      statusEl.textContent = '';
      listEl.innerHTML = '';
      orders.forEach((order) => listEl.appendChild(orderCard(order)));
      if (orders.some((order) => order.status === 'delivering')) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshOrders, 20000);
      }
    } catch (error) {
      statusEl.textContent = error.message || 'Impossible de charger vos commandes.';
    }
  }

  refreshOrders();
}());
