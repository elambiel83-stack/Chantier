(function () {
  const STATUS_LABELS = {
    submitted: 'Envoyée',
    quoted: 'Devis proposé',
    compliance_cleared: 'Conformité validée',
    ordered: 'Commandée',
    delivered: 'Livrée',
    rejected: 'Refusée',
    cancelled: 'Annulée'
  };
  const STATUS_BADGE = {
    submitted: 'bg-amber-100 text-amber-800',
    quoted: 'bg-blue-100 text-blue-800',
    compliance_cleared: 'bg-indigo-100 text-indigo-800',
    ordered: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-200 text-slate-700'
  };

  const deniedEl = document.getElementById('denied');
  const dashboardEl = document.getElementById('dashboard');
  const scopeNoteEl = document.getElementById('scope-note');
  const whoamiEl = document.getElementById('whoami');
  const requestsEl = document.getElementById('requests');
  const requestsStatusEl = document.getElementById('requests-status');
  const statusFilterEl = document.getElementById('status-filter');
  const logoutButton = document.getElementById('logout-button');

  let me = null;
  let currentRequests = [];

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

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function assignmentLabel(request) {
    if (!request.assigned_to) return 'Non affectée';
    if (request.assigned_to === me.id) return 'Affectée à vous';
    return 'Affectée à un autre agent';
  }

  // Un membre staff doit d'abord réclamer une demande non affectée avant d'agir dessus;
  // un admin peut toujours agir, le serveur reste de toute façon la seule autorité (409 sinon).
  function canAct(request) {
    return me.role === 'admin' || request.assigned_to === me.id;
  }

  function renderRequests(requests) {
    if (!requests.length) {
      requestsEl.innerHTML = '<p class="text-slate-500">Aucune demande à afficher.</p>';
      return;
    }
    requestsEl.innerHTML = requests.map((request) => {
      const badge = STATUS_BADGE[request.status] || 'bg-slate-100 text-slate-700';
      const acting = canAct(request);
      const canClaim = me.role === 'staff' && request.status === 'submitted' && !request.assigned_to;
      const canQuote = acting && request.status === 'submitted';
      const canReview = acting && request.status === 'quoted';
      const canOrder = acting && request.status === 'compliance_cleared';
      const canDeliver = acting && request.status === 'ordered';
      const canReject = acting && ['submitted', 'quoted', 'compliance_cleared'].includes(request.status);
      const canCancel = acting && ['submitted', 'quoted', 'compliance_cleared', 'ordered'].includes(request.status);

      return `
        <div class="bg-white rounded-xl p-4 shadow" data-request-id="${request.id}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-mono text-xs text-slate-500" title="${request.id}">${request.id.slice(0, 8)}…</span>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${STATUS_LABELS[request.status] || request.status}</span>
          </div>
          <div class="mt-2">
            <div class="font-semibold">${escapeHtml(request.full_name || '—')}</div>
            <div class="text-slate-500 text-sm">${escapeHtml(request.phone || '')}</div>
          </div>
          <p class="mt-2 text-sm">${escapeHtml(request.description)}</p>
          ${request.source_url ? `<a class="text-xs text-red-600 underline break-all" href="${escapeHtml(request.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(request.source_url)}</a>` : ''}
          <div class="mt-2 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>Quantité : ${request.target_qty}</span>
            <span>${formatDate(request.created_at)}</span>
            <span>${assignmentLabel(request)}</span>
            ${request.quote_amount ? `<span>Devis : ${money(request.quote_amount, request.quote_currency)}</span>` : ''}
          </div>
          ${request.compliance_notes ? `<p class="mt-2 text-sm bg-indigo-50 text-indigo-900 rounded p-2">Conformité : ${escapeHtml(request.compliance_notes)}</p>` : ''}
          ${request.staff_notes ? `<p class="mt-2 text-sm text-slate-600">Note staff : ${escapeHtml(request.staff_notes)}</p>` : ''}

          <div class="mt-3 flex flex-wrap gap-2">
            ${canClaim ? `<button type="button" class="claim-request signal-button text-white px-3 py-2 rounded-lg text-sm" data-request-id="${request.id}">Réclamer</button>` : ''}
            ${canQuote ? `<button type="button" class="toggle-panel outline-button border px-3 py-2 rounded-lg text-sm" data-panel="quote-${request.id}">Chiffrer</button>` : ''}
            ${canReview ? `<button type="button" class="toggle-panel outline-button border px-3 py-2 rounded-lg text-sm" data-panel="compliance-${request.id}">Valider la conformité</button>` : ''}
            ${canOrder ? `<button type="button" class="status-request signal-button text-white px-3 py-2 rounded-lg text-sm" data-request-id="${request.id}" data-status="ordered">Marquer commandée</button>` : ''}
            ${canDeliver ? `<button type="button" class="status-request signal-button text-white px-3 py-2 rounded-lg text-sm" data-request-id="${request.id}" data-status="delivered">Marquer livrée</button>` : ''}
            ${canReject ? `<button type="button" class="toggle-panel outline-button border px-3 py-2 rounded-lg text-sm" data-panel="reject-${request.id}">Refuser</button>` : ''}
            ${canCancel ? `<button type="button" class="status-request outline-button border px-3 py-2 rounded-lg text-sm" data-request-id="${request.id}" data-status="cancelled">Annuler</button>` : ''}
          </div>

          ${canQuote ? `
            <form class="quote-form hidden mt-3 flex flex-wrap items-end gap-2" id="quote-${request.id}" data-request-id="${request.id}">
              <div>
                <label class="block text-xs font-medium mb-1">Montant</label>
                <input type="number" step="0.01" min="0.01" name="quoteAmount" required class="border rounded-lg px-2 py-1 w-28 text-sm">
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Devise</label>
                <select name="quoteCurrency" class="border rounded-lg px-2 py-1 text-sm">
                  <option value="USD">USD</option><option value="CDF">CDF</option><option value="EUR">EUR</option>
                </select>
              </div>
              <button type="submit" class="signal-button text-white px-3 py-2 rounded-lg text-sm">Envoyer le devis</button>
            </form>` : ''}

          ${canReview ? `
            <form class="compliance-form hidden mt-3 gap-2" id="compliance-${request.id}" data-request-id="${request.id}">
              <label class="block text-xs font-medium mb-1">Normes, code douanier et certificats fournisseur vérifiés</label>
              <textarea name="complianceNotes" required minlength="10" rows="2" class="w-full border rounded-lg px-2 py-1 text-sm"></textarea>
              <button type="submit" class="mt-2 signal-button text-white px-3 py-2 rounded-lg text-sm">Valider la conformité</button>
            </form>` : ''}

          ${canReject ? `
            <form class="reject-form hidden mt-3 gap-2" id="reject-${request.id}" data-request-id="${request.id}">
              <label class="block text-xs font-medium mb-1">Motif du refus</label>
              <textarea name="staffNotes" required minlength="3" rows="2" class="w-full border rounded-lg px-2 py-1 text-sm"></textarea>
              <button type="submit" class="mt-2 outline-button border px-3 py-2 rounded-lg text-sm">Confirmer le refus</button>
            </form>` : ''}
        </div>
      `;
    }).join('');

    requestsEl.querySelectorAll('.toggle-panel').forEach((button) => {
      button.addEventListener('click', () => {
        document.getElementById(button.dataset.panel)?.classList.toggle('hidden');
      });
    });
    requestsEl.querySelectorAll('.claim-request').forEach((button) => {
      button.addEventListener('click', () => runAction(button, () => window.apiCall(`/import-requests/${button.dataset.requestId}/claim`, { method: 'POST' })));
    });
    requestsEl.querySelectorAll('.status-request').forEach((button) => {
      button.addEventListener('click', () => runAction(button, () => window.apiCall(`/import-requests/${button.dataset.requestId}/status`, { method: 'PATCH', body: { status: button.dataset.status } })));
    });
    requestsEl.querySelectorAll('.quote-form').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        runAction(form.querySelector('button[type=submit]'), () => window.apiCall(`/import-requests/${form.dataset.requestId}/quote`, {
          method: 'POST',
          body: { quoteAmount: Number(formData.get('quoteAmount')), quoteCurrency: formData.get('quoteCurrency') }
        }));
      });
    });
    requestsEl.querySelectorAll('.compliance-form').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        runAction(form.querySelector('button[type=submit]'), () => window.apiCall(`/import-requests/${form.dataset.requestId}/compliance`, {
          method: 'POST',
          body: { complianceNotes: formData.get('complianceNotes') }
        }));
      });
    });
    requestsEl.querySelectorAll('.reject-form').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        runAction(form.querySelector('button[type=submit]'), () => window.apiCall(`/import-requests/${form.dataset.requestId}/status`, {
          method: 'PATCH',
          body: { status: 'rejected', staffNotes: formData.get('staffNotes') }
        }));
      });
    });
  }

  async function runAction(button, action) {
    button.disabled = true;
    requestsStatusEl.textContent = 'Traitement en cours...';
    try {
      await action();
      requestsStatusEl.textContent = 'Mis à jour.';
      await loadRequests();
    } catch (error) {
      requestsStatusEl.textContent = error.message || 'Action refusée.';
      button.disabled = false;
    }
  }

  async function loadRequests() {
    requestsStatusEl.textContent = 'Chargement...';
    const status = statusFilterEl.value;
    try {
      const data = await window.apiCall(`/import-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`);
      currentRequests = data.requests || [];
      renderRequests(currentRequests);
      requestsStatusEl.textContent = '';
    } catch (error) {
      requestsStatusEl.textContent = error.message || 'Impossible de charger les demandes.';
    }
  }

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'admin-imports.html');
      window.location.assign('auth.html');
      return;
    }
    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'admin-imports.html');
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
      ? 'Vous voyez toutes les demandes.'
      : 'Vous voyez les demandes envoyées non affectées et celles qui vous sont affectées.';
    dashboardEl.classList.remove('hidden');
    await loadRequests();
  }

  statusFilterEl.addEventListener('change', loadRequests);
  document.getElementById('refresh').addEventListener('click', loadRequests);
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
