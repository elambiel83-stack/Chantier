(() => {
  const state = { orders: [], userSearch: '' };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
  const roleLabels = { customer: 'Client', staff: 'Équipe', admin: 'Administrateur' };
  const statusLabels = { pending: 'En attente', confirmed: 'Confirmée', delivering: 'En livraison', completed: 'Terminée', cancelled: 'Annulée' };

  function showStatus(message, type = 'error') {
    const element = $('#page-status');
    element.textContent = message;
    element.className = `mb-6 rounded-lg border px-4 py-3 ${type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`;
  }

  function money(amount, currency) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(amount) || 0);
  }

  function date(value) {
    return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-';
  }

  function renderStats() {
    const counts = state.orders.reduce((result, order) => {
      result.total += 1;
      result[order.status] = (result[order.status] || 0) + 1;
      return result;
    }, { total: 0 });
    $('#stat-total').textContent = counts.total;
    ['pending', 'confirmed', 'delivering', 'completed'].forEach((status) => { $(`#stat-${status}`).textContent = counts[status] || 0; });
  }

  function renderOrders() {
    const selectedStatus = $('#order-filter').value;
    const orders = state.orders.filter((order) => !selectedStatus || order.status === selectedStatus);
    $('#orders-body').innerHTML = orders.length ? orders.map((order) => `
      <tr>
        <td class="font-mono text-xs">${escapeHtml(order.id.slice(0, 8))}</td>
        <td><strong>${escapeHtml(order.full_name)}</strong><br><span class="text-xs text-slate-500">${escapeHtml(order.phone)}</span></td>
        <td>${escapeHtml(money(order.total_amount, order.currency))}</td>
        <td>${escapeHtml(date(order.created_at))}</td>
        <td><select class="status-select px-2 py-1 border text-sm" data-order-id="${escapeHtml(order.id)}" aria-label="Statut de la commande ${escapeHtml(order.id)}">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`).join('')}</select></td>
        <td class="text-sm">${order.assigned_to ? escapeHtml(order.assigned_to.slice(0, 8)) : 'Non affectée'}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty-state">Aucune commande pour ce filtre.</td></tr>';
    document.querySelectorAll('.status-select').forEach((select) => select.addEventListener('change', updateOrderStatus));
  }

  async function updateOrderStatus(event) {
    const select = event.currentTarget;
    const order = state.orders.find((item) => item.id === select.dataset.orderId);
    const previous = order?.status;
    select.disabled = true;
    try {
      await window.apiCall(window.API_CONFIG.endpoints.orderStatus(order.id), { method: 'PATCH', body: { status: select.value } });
      order.status = select.value;
      renderStats();
      showStatus('Statut de la commande mis à jour.', 'success');
    } catch (error) {
      select.value = previous;
      showStatus(error.message);
    } finally {
      select.disabled = false;
    }
  }

  async function loadUsers() {
    const query = new URLSearchParams({ limit: '100' });
    if (state.userSearch) query.set('search', state.userSearch);
    const data = await window.apiCall(`${window.API_CONFIG.endpoints.adminUsers}?${query}`);
    $('#users-body').innerHTML = data.users.length ? data.users.map((user) => `
      <tr><td><strong>${escapeHtml(user.email)}</strong><br><span class="text-xs text-slate-500">${escapeHtml(date(user.created_at))}</span></td>
      <td><select class="role-select px-2 py-1 border text-sm" data-user-id="${escapeHtml(user.id)}" data-current-role="${escapeHtml(user.role)}" ${user.id === window.currentAdminId ? 'disabled' : ''} aria-label="Rôle de ${escapeHtml(user.email)}">
        ${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${value === user.role ? 'selected' : ''}>${label}</option>`).join('')}</select></td>
      <td><span class="status-pill ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? 'Actif' : 'Désactivé'}</span></td></tr>`).join('') : '<tr><td colspan="3" class="empty-state">Aucun utilisateur trouvé.</td></tr>';
    document.querySelectorAll('.role-select').forEach((select) => select.addEventListener('change', updateUserRole));
  }

  async function updateUserRole(event) {
    const select = event.currentTarget;
    const previous = select.dataset.currentRole;
    select.disabled = true;
    try {
      await window.apiCall(window.API_CONFIG.endpoints.userRole(select.dataset.userId), { method: 'PATCH', body: { role: select.value } });
      select.dataset.currentRole = select.value;
      showStatus('Rôle utilisateur mis à jour et enregistré dans le journal.', 'success');
      await loadAudit();
    } catch (error) {
      select.value = previous;
      showStatus(error.message);
    } finally {
      select.disabled = false;
    }
  }

  async function loadAudit() {
    const data = await window.apiCall(`${window.API_CONFIG.endpoints.adminAuditLog}?limit=20`);
    $('#audit-list').innerHTML = data.events.length ? data.events.map((event) => `<li><strong>${escapeHtml(event.action)}</strong><span>${escapeHtml(event.actor_email || 'Compte supprimé')} → ${escapeHtml(event.target_email || 'Compte supprimé')}</span><time datetime="${escapeHtml(event.created_at)}">${escapeHtml(date(event.created_at))}</time></li>`).join('') : '<li class="empty-state">Aucun événement.</li>';
  }

  async function loadDashboard() {
    $('#refresh-button').disabled = true;
    try {
      const [orders, users] = await Promise.all([
        window.apiCall(window.API_CONFIG.endpoints.orders),
        loadUsers(),
        loadAudit()
      ]);
      state.orders = orders.orders || [];
      renderStats();
      renderOrders();
      if (users) await users;
      $('#page-status').classList.add('hidden');
    } catch (error) {
      showStatus(error.message || 'Impossible de charger le dashboard.');
    } finally {
      $('#refresh-button').disabled = false;
    }
  }

  async function init() {
    try {
      const session = await window.apiCall(window.API_CONFIG.endpoints.authMe);
      const permissions = session.user?.permissions || [];
      if (session.user?.role !== 'admin' || !permissions.includes('orders:read_all') || !permissions.includes('users:assign_role')) {
        throw new Error('Accès administrateur requis.');
      }
      window.currentAdminId = session.user.id;
      $('#admin-identity').textContent = `Administrateur · ${session.user.id.slice(0, 8)}`;
      await loadDashboard();
    } catch (error) {
      showStatus(error.message || 'Session administrateur invalide.');
      setTimeout(() => window.location.assign('auth.html'), 1200);
    }
  }

  $('#order-filter').addEventListener('change', renderOrders);
  $('#user-search').addEventListener('input', () => { state.userSearch = $('#user-search').value.trim(); loadUsers().catch((error) => showStatus(error.message)); });
  $('#refresh-button').addEventListener('click', loadDashboard);
  $('#logout-button').addEventListener('click', async () => {
    try { await window.apiCall('/auth/logout', { method: 'POST', body: { token: localStorage.getItem('refreshToken') } }, false); } catch (error) { console.warn(error.message); }
    localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem('authUser');
    window.location.assign('auth.html');
  });
  init();
})();
