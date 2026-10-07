(function () {
  const deniedEl = document.getElementById('denied');
  const dashboardEl = document.getElementById('dashboard');
  const whoamiEl = document.getElementById('whoami');
  const logoutButton = document.getElementById('logout-button');
  const kycQueueEl = document.getElementById('kyc-queue');
  const kycStatusEl = document.getElementById('kyc-status');
  const kycDetailEl = document.getElementById('kyc-detail');
  const amlAlertsEl = document.getElementById('aml-alerts');
  const amlStatusEl = document.getElementById('aml-status');

  let me = null;
  let profiles = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('fr-FR');
    } catch (error) {
      return value;
    }
  }

  async function loadQueue() {
    kycStatusEl.textContent = 'Chargement...';
    const data = await window.apiCall('/admin/kyc/queue');
    profiles = data.profiles || [];
    if (!profiles.length) {
      kycQueueEl.innerHTML = '<p class="text-sm text-slate-500">Aucun dossier en attente.</p>';
      kycStatusEl.textContent = '';
      kycDetailEl.innerHTML = '<p class="text-sm text-slate-500">Aucun dossier sélectionné.</p>';
      return;
    }
    kycQueueEl.innerHTML = profiles.map((profile) => `
      <button type="button" class="kyc-entry block w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50" data-user-id="${profile.user_id}">
        <div class="flex items-center justify-between gap-2">
          <strong>${escapeHtml(profile.full_name || profile.email)}</strong>
          <span class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(profile.verification_status)}</span>
        </div>
        <div class="mt-1 text-sm text-slate-600">${escapeHtml(profile.email)} · ${escapeHtml(profile.customer_type)}</div>
        <div class="mt-1 text-xs text-slate-500">Soumis le ${formatDate(profile.submitted_at)} · Score client ${profile.customer_risk_score}/100</div>
      </button>
    `).join('');
    kycQueueEl.querySelectorAll('.kyc-entry').forEach((button) => {
      button.addEventListener('click', () => loadProfile(button.dataset.userId));
    });
    kycStatusEl.textContent = '';
    await loadProfile(profiles[0].user_id);
  }

  function renderList(title, items, formatter) {
    if (!items.length) return `<p class="text-sm text-slate-500">Aucun ${title.toLowerCase()}.</p>`;
    return `<div class="space-y-2">${items.map(formatter).join('')}</div>`;
  }

  async function loadProfile(userId) {
    const data = await window.apiCall(`/admin/kyc/${userId}`);
    const profile = data.profile;
    kycDetailEl.innerHTML = `
      <div class="rounded-lg border border-slate-200 p-3">
        <div class="flex items-center justify-between gap-2">
          <strong>${escapeHtml(profile.customerName || profile.email)}</strong>
          <span class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(profile.verificationStatus)}</span>
        </div>
        <div class="mt-2 text-sm text-slate-600">${escapeHtml(profile.email)} · ${escapeHtml(profile.customerType)}</div>
        <div class="mt-2 grid gap-2 text-sm md:grid-cols-2">
          <div><span class="font-medium">Nationalité :</span> ${escapeHtml(profile.nationality || '—')}</div>
          <div><span class="font-medium">Document :</span> ${escapeHtml(profile.documentType || '—')} (${escapeHtml(profile.documentNumberMasked || '—')})</div>
          <div><span class="font-medium">Adresse :</span> ${escapeHtml(profile.residentialAddress || '—')}</div>
          <div><span class="font-medium">Référence prestataire :</span> ${escapeHtml(profile.providerCaseReference || '—')}</div>
        </div>
      </div>
      <form id="review-form" class="rounded-lg border border-slate-200 p-3 space-y-3">
        <div>
          <label class="block text-sm font-medium" for="review-status-select">Décision</label>
          <select id="review-status-select" name="status" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
            <option value="kyc_en_revue">Passer en revue</option>
            <option value="kyc_approuve">Approuver</option>
            <option value="kyc_refuse">Refuser</option>
            <option value="kyc_expire">Expirer</option>
          </select>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium" for="customer-risk-score">Score client</label>
            <input id="customer-risk-score" name="customerRiskScore" type="number" min="0" max="100" value="${profile.customerRiskScore ?? 0}" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium" for="transaction-risk-score">Score transactionnel</label>
            <input id="transaction-risk-score" name="transactionRiskScore" type="number" min="0" max="100" value="${profile.transactionRiskScore ?? 0}" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium" for="next-review-at">Prochaine revalidation</label>
          <input id="next-review-at" name="nextReviewAt" type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium" for="review-justification">Justification</label>
          <textarea id="review-justification" name="justification" rows="3" class="mt-1 w-full rounded border border-slate-300 px-3 py-2" required>${escapeHtml(profile.reviewNotes || profile.rejectionReason || '')}</textarea>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex items-center gap-2 text-sm"><input id="requested-documents" name="requestedAdditionalDocuments" type="checkbox" ${profile.requestedAdditionalDocuments ? 'checked' : ''}> Demander des justificatifs supplémentaires</label>
          <div class="text-sm text-slate-500">Sanctions: ${escapeHtml(profile.sanctionsScreeningStatus)} · PEP: ${escapeHtml(profile.pepScreeningStatus)}</div>
        </div>
        <button type="submit" class="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">Enregistrer la décision</button>
        <p id="review-status-message" class="text-sm" role="status" aria-live="polite"></p>
      </form>
      <div class="rounded-lg border border-slate-200 p-3">
        <h3 class="font-medium">Documents</h3>
        <div class="mt-3">${renderList('document', data.documents || [], (document) => `
          <div class="rounded border border-slate-200 p-2 text-sm">
            <strong>${escapeHtml(document.file_name)}</strong> · ${escapeHtml(document.document_kind)} · ${escapeHtml(document.review_status)}
            <div class="text-slate-500">${escapeHtml(document.storageKeyMasked || '')}</div>
          </div>
        `)}</div>
      </div>
      <div class="rounded-lg border border-slate-200 p-3">
        <h3 class="font-medium">Historique</h3>
        <div class="mt-3">${renderList('événement', data.auditLog || [], (entry) => `
          <div class="rounded border border-slate-200 p-2 text-sm">
            <div class="flex items-center justify-between gap-2">
              <strong>${escapeHtml(entry.action)}</strong>
              <span class="text-xs text-slate-500">${formatDate(entry.created_at)}</span>
            </div>
            <div class="text-slate-500">${escapeHtml(entry.justification || '')}</div>
          </div>
        `)}</div>
      </div>
    `;

    document.getElementById('review-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const statusEl = document.getElementById('review-status-message');
      statusEl.textContent = 'Enregistrement...';
      try {
        await window.apiCall(`/admin/kyc/${userId}/review`, {
          method: 'PATCH',
          body: {
            status: form.get('status'),
            justification: form.get('justification'),
            nextReviewAt: form.get('nextReviewAt') || undefined,
            customerRiskScore: Number(form.get('customerRiskScore')),
            transactionRiskScore: Number(form.get('transactionRiskScore')),
            requestedAdditionalDocuments: form.get('requestedAdditionalDocuments') === 'on'
          }
        });
        statusEl.textContent = 'Décision enregistrée.';
        await loadQueue();
      } catch (error) {
        statusEl.textContent = error.message || 'Impossible d’enregistrer la décision.';
      }
    });
  }

  async function loadAlerts() {
    amlStatusEl.textContent = 'Chargement...';
    const data = await window.apiCall('/admin/aml/alerts');
    const alerts = data.alerts || [];
    if (!alerts.length) {
      amlAlertsEl.innerHTML = '<p class="text-sm text-slate-500">Aucune alerte AML active.</p>';
      amlStatusEl.textContent = '';
      return;
    }
    amlAlertsEl.innerHTML = alerts.map((alert) => `
      <form class="aml-case rounded-lg border border-slate-200 p-3" data-case-id="${alert.aml_case_id}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>${escapeHtml(alert.alert_type)}</strong>
          <span class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(alert.status)} · ${escapeHtml(alert.severity)}</span>
        </div>
        <div class="mt-1 text-sm text-slate-600">${escapeHtml(alert.full_name || alert.email || 'Compte inconnu')}</div>
        <div class="mt-1 text-sm">${escapeHtml(alert.reason)}</div>
        <div class="mt-1 text-xs text-slate-500">Score ${alert.risk_score}/100 · ${formatDate(alert.created_at)}</div>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          <select name="status" class="rounded border border-slate-300 px-3 py-2 text-sm">
            ${['ouvert', 'en_revue', 'escalade', 'clos_sans_suite', 'clos_avec_action', 'signale_aux_autorites'].map((status) => `<option value="${status}" ${alert.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <select name="severity" class="rounded border border-slate-300 px-3 py-2 text-sm">
            ${['low', 'medium', 'high', 'critical'].map((severity) => `<option value="${severity}" ${alert.severity === severity ? 'selected' : ''}>${severity}</option>`).join('')}
          </select>
          <input name="resolutionNotes" class="rounded border border-slate-300 px-3 py-2 text-sm" value="${escapeHtml(alert.resolution_notes || '')}" placeholder="Notes de résolution">
        </div>
        <div class="mt-3 flex items-center gap-3">
          <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Mettre à jour</button>
          <span class="text-sm" data-role="status"></span>
        </div>
      </form>
    `).join('');
    amlAlertsEl.querySelectorAll('.aml-case').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const statusEl = form.querySelector('[data-role="status"]');
        const formData = new FormData(form);
        statusEl.textContent = 'Enregistrement...';
        try {
          await window.apiCall(`/admin/aml/cases/${form.dataset.caseId}`, {
            method: 'PATCH',
            body: {
              status: formData.get('status'),
              severity: formData.get('severity'),
              resolutionNotes: formData.get('resolutionNotes')
            }
          });
          statusEl.textContent = 'Mis à jour.';
          await loadAlerts();
        } catch (error) {
          statusEl.textContent = error.message || 'Impossible de mettre à jour le cas.';
        }
      });
    });
    amlStatusEl.textContent = '';
  }

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'admin-compliance.html');
      window.location.assign('auth.html');
      return;
    }
    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'admin-compliance.html');
      window.location.assign('auth.html');
      return;
    }
    if (!['compliance', 'admin'].includes(me.role)) {
      deniedEl.classList.remove('hidden');
      return;
    }
    const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
    whoamiEl.textContent = authUser?.email ? `${authUser.email} · ${me.role}` : me.role;
    dashboardEl.classList.remove('hidden');
    await Promise.all([loadQueue(), loadAlerts()]);
  }

  document.getElementById('refresh-kyc').addEventListener('click', loadQueue);
  document.getElementById('refresh-aml').addEventListener('click', loadAlerts);
  logoutButton.addEventListener('click', async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    logoutButton.disabled = true;
    try {
      if (refreshToken) await window.apiCall('/auth/logout', { method: 'POST', body: { token: refreshToken } });
    } catch (error) {
      // ignore
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      window.location.assign('index.html');
    }
  });

  init();
}());
