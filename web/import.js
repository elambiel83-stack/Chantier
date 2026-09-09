(function () {
  const STATUS_LABELS = {
    submitted: 'Envoyée, en attente de devis',
    quoted: 'Devis proposé',
    compliance_cleared: 'Conformité validée, commande à venir',
    ordered: 'Commandée chez le fournisseur',
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

  const form = document.getElementById('import-form');
  const formStatus = document.getElementById('import-form-status');
  const listEl = document.getElementById('import-list');
  const listStatus = document.getElementById('import-list-status');

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

  function renderRequests(requests) {
    if (!requests.length) {
      listEl.innerHTML = '<p class="text-slate-500">Aucune demande pour le moment.</p>';
      return;
    }
    listEl.innerHTML = requests.map((request) => {
      const badge = STATUS_BADGE[request.status] || 'bg-slate-100 text-slate-700';
      const canCancel = request.status === 'submitted' || request.status === 'quoted';
      return `
        <div class="bg-white rounded-xl p-4 shadow" data-request-id="${request.id}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-mono text-xs text-slate-500" title="${request.id}">${request.id.slice(0, 8)}…</span>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${STATUS_LABELS[request.status] || request.status}</span>
          </div>
          <p class="mt-2 text-sm">${escapeHtml(request.description)}</p>
          ${request.source_url ? `<a class="text-xs text-red-600 underline break-all" href="${escapeHtml(request.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(request.source_url)}</a>` : ''}
          <div class="mt-2 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>Quantité : ${request.target_qty}</span>
            <span>${formatDate(request.created_at)}</span>
            ${request.quote_amount ? `<span>Devis : ${money(request.quote_amount, request.quote_currency)}</span>` : ''}
          </div>
          ${request.status === 'rejected' && request.staff_notes ? `<p class="mt-2 text-sm text-red-700">Motif : ${escapeHtml(request.staff_notes)}</p>` : ''}
          ${canCancel ? `<button type="button" class="cancel-request mt-3 text-xs text-red-600 underline" data-request-id="${request.id}">Annuler la demande</button>` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.cancel-request').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.apiCall(`/import-requests/${button.dataset.requestId}/cancel`, { method: 'POST' });
          await loadRequests();
        } catch (error) {
          listStatus.textContent = error.message || 'Annulation impossible.';
          button.disabled = false;
        }
      });
    });
  }

  async function loadRequests() {
    listStatus.textContent = 'Chargement...';
    try {
      const data = await window.apiCall('/import-requests');
      renderRequests(data.requests || []);
      listStatus.textContent = '';
    } catch (error) {
      listStatus.textContent = error.message || 'Impossible de charger vos demandes.';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = document.getElementById('submit-import');
    const formData = new FormData(form);
    submitButton.disabled = true;
    formStatus.textContent = 'Envoi de votre demande...';
    try {
      await window.apiCall('/import-requests', {
        method: 'POST',
        body: {
          sourceUrl: formData.get('sourceUrl') || undefined,
          description: formData.get('description'),
          targetQty: Number(formData.get('targetQty'))
        }
      });
      form.reset();
      formStatus.textContent = 'Demande envoyée. Notre équipe sourcing va l’étudier.';
      await loadRequests();
    } catch (error) {
      formStatus.textContent = error.message || 'Envoi impossible.';
    } finally {
      submitButton.disabled = false;
    }
  });

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'import.html');
      window.location.assign('auth.html');
      return;
    }
    await loadRequests();
  }

  init();
})();
