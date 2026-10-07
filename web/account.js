(function () {
  const CHANNEL_LABELS = { email: 'E-mail', sms: 'SMS', whatsapp: 'WhatsApp' };
  const KYC_LABELS = {
    non_verifie: 'Non vérifié',
    kyc_en_attente: 'En attente',
    kyc_en_revue: 'En revue',
    kyc_approuve: 'Approuvé',
    kyc_refuse: 'Refusé',
    kyc_expire: 'Expiré'
  };
  const KYC_COLORS = {
    non_verifie: 'text-amber-700',
    kyc_en_attente: 'text-blue-700',
    kyc_en_revue: 'text-indigo-700',
    kyc_approuve: 'text-green-700',
    kyc_refuse: 'text-red-700',
    kyc_expire: 'text-orange-700'
  };

  const emailEl = document.getElementById('account-email');
  const badgeEl = document.getElementById('account-verified-badge');
  const kycBadgeEl = document.getElementById('account-kyc-badge');
  const nextReviewEl = document.getElementById('account-kyc-next-review');
  const accountStatus = document.getElementById('account-status');
  const verificationSection = document.getElementById('verification-section');
  const channelChoices = document.getElementById('channel-choices');
  const sendForm = document.getElementById('send-code-form');
  const sendButton = document.getElementById('send-code-button');
  const sendStatus = document.getElementById('send-status');
  const confirmForm = document.getElementById('confirm-code-form');
  const confirmStatus = document.getElementById('confirm-status');
  const profileForm = document.getElementById('kyc-profile-form');
  const profileStatus = document.getElementById('kyc-profile-status');
  const documentForm = document.getElementById('kyc-document-form');
  const documentStatus = document.getElementById('kyc-document-status');
  const documentsEl = document.getElementById('kyc-documents');
  const auditLogEl = document.getElementById('kyc-audit-log');
  const refreshButton = document.getElementById('kyc-refresh');
  const submitButton = document.getElementById('kyc-submit-button');

  let account = null;

  if (!localStorage.getItem('accessToken')) {
    window.location.assign('auth.html');
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('fr-FR');
    } catch (error) {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function parseRepresentativeLines(value) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, role] = line.split('|').map((part) => part.trim());
      return { name, role };
    });
  }

  function parseBeneficialOwners(value) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, ownership] = line.split('|').map((part) => part.trim());
      return { name, ownershipPercent: Number(ownership) };
    });
  }

  function setKycBadge(status) {
    kycBadgeEl.textContent = KYC_LABELS[status] || status;
    kycBadgeEl.className = `font-medium ${KYC_COLORS[status] || 'text-slate-700'}`;
  }

  async function loadAccount() {
    const { user } = await window.apiCall('/auth/me');
    account = user;
    emailEl.textContent = user.email || '—';
    if (user.verified) {
      badgeEl.textContent = 'Vérifié ✓';
      badgeEl.className = 'font-medium text-green-700';
      verificationSection.classList.add('hidden');
    } else {
      badgeEl.textContent = 'Non vérifié';
      badgeEl.className = 'font-medium text-amber-700';
      await loadChannels();
    }
    setKycBadge(user.kycStatus || 'non_verifie');
    nextReviewEl.textContent = user.nextKycReviewAt ? `Prochaine revalidation prévue : ${formatDate(user.nextKycReviewAt)}` : '';
  }

  async function loadChannels() {
    const { channels } = await window.apiCall('/auth/verification/channels');
    const available = Object.entries(channels).filter(([, enabled]) => enabled);
    if (available.length === 0) {
      channelChoices.innerHTML = '<p class="text-sm text-slate-500">Aucun canal de vérification n\'est disponible pour le moment.</p>';
      sendButton.classList.add('hidden');
      verificationSection.classList.remove('hidden');
      return;
    }
    channelChoices.innerHTML = available.map(([channel], index) => `
      <label class="flex items-center gap-2 text-sm">
        <input type="radio" name="channel" value="${channel}" ${index === 0 ? 'checked' : ''}>
        ${CHANNEL_LABELS[channel] || channel}
      </label>
    `).join('');
    verificationSection.classList.remove('hidden');
  }

  function fillProfile(profile) {
    if (!profile) return;
    profileForm.customerType.value = profile.customerType || 'individual';
    profileForm.legalFullName.value = profile.legalFullName || '';
    profileForm.dateOfBirth.value = profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '';
    profileForm.nationality.value = profile.nationality || '';
    profileForm.residentialAddress.value = profile.residentialAddress || '';
    profileForm.documentType.value = profile.documentType || '';
    profileForm.documentNumber.value = '';
    profileForm.documentIssuingCountry.value = profile.documentIssuingCountry || '';
    profileForm.documentExpiresAt.value = profile.documentExpiresAt ? String(profile.documentExpiresAt).slice(0, 10) : '';
    profileForm.providerMode.value = profile.providerMode || 'internal';
    profileForm.providerCaseReference.value = profile.providerCaseReference || '';
    profileForm.dataRetentionExpiresAt.value = profile.dataRetentionExpiresAt ? String(profile.dataRetentionExpiresAt).slice(0, 10) : '';
    profileForm.businessName.value = profile.businessName || '';
    profileForm.registrationNumber.value = profile.registrationNumber || '';
    profileForm.incorporationCountry.value = profile.incorporationCountry || '';
    profileForm.registeredAddress.value = profile.registeredAddress || '';
    document.getElementById('authorized-representatives').value = (profile.authorizedRepresentatives || []).map((item) => `${item.name} | ${item.role}`).join('\n');
    document.getElementById('beneficial-owners').value = (profile.beneficialOwners || []).map((item) => `${item.name} | ${item.ownershipPercent}`).join('\n');
  }

  function renderDocuments(documents) {
    if (!documents.length) {
      documentsEl.innerHTML = '<p class="text-sm text-slate-500">Aucun document déclaré.</p>';
      return;
    }
    documentsEl.innerHTML = documents.map((document) => `
      <div class="rounded-lg border border-slate-200 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>${escapeHtml(document.file_name)}</strong>
          <span class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(document.review_status)}</span>
        </div>
        <p class="mt-1 text-sm text-slate-600">${escapeHtml(document.document_kind)} · ${escapeHtml(document.storageKeyMasked || '')}</p>
        <p class="mt-1 text-xs text-slate-500">Ajouté le ${formatDate(document.created_at)}${document.retention_expires_at ? ` · conservation jusqu’au ${formatDate(document.retention_expires_at)}` : ''}</p>
        ${document.rejection_reason ? `<p class="mt-1 text-sm text-red-700">${escapeHtml(document.rejection_reason)}</p>` : ''}
      </div>
    `).join('');
  }

  function renderAuditLog(entries) {
    if (!entries.length) {
      auditLogEl.innerHTML = '<p class="text-sm text-slate-500">Aucun événement conformité pour le moment.</p>';
      return;
    }
    auditLogEl.innerHTML = entries.map((entry) => `
      <div class="rounded-lg border border-slate-200 p-3">
        <div class="flex items-center justify-between gap-2">
          <strong>${escapeHtml(entry.action)}</strong>
          <span class="text-xs text-slate-500">${formatDate(entry.created_at)}</span>
        </div>
        <p class="mt-1 text-sm text-slate-600">${escapeHtml(entry.justification || '')}</p>
      </div>
    `).join('');
  }

  async function loadKyc() {
    const data = await window.apiCall('/kyc/profile');
    fillProfile(data.profile);
    renderDocuments(data.documents || []);
    renderAuditLog(data.auditLog || []);
    setKycBadge(data.profile?.verificationStatus || account?.kycStatus || 'non_verifie');
  }

  sendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const channel = new FormData(sendForm).get('channel');
    if (!channel) return;
    sendButton.disabled = true;
    sendStatus.textContent = 'Envoi en cours...';
    try {
      await window.apiCall('/auth/verification/send', { method: 'POST', body: { channel } });
      sendStatus.textContent = `Code envoyé via ${(CHANNEL_LABELS[channel] || channel).toLowerCase()}.`;
      confirmForm.classList.remove('hidden');
    } catch (error) {
      sendStatus.textContent = error.message || 'Impossible d’envoyer le code.';
    } finally {
      sendButton.disabled = false;
    }
  });

  confirmForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = new FormData(confirmForm).get('code');
    confirmStatus.textContent = 'Vérification en cours...';
    try {
      await window.apiCall('/auth/verification/confirm', { method: 'POST', body: { code } });
      confirmStatus.textContent = '';
      await loadAccount();
    } catch (error) {
      confirmStatus.textContent = error.message || 'Code incorrect.';
    }
  });

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileStatus.textContent = 'Enregistrement du dossier...';
    try {
      await window.apiCall('/kyc/profile', {
        method: 'PUT',
        body: {
          customerType: profileForm.customerType.value,
          legalFullName: profileForm.legalFullName.value,
          dateOfBirth: profileForm.dateOfBirth.value,
          nationality: profileForm.nationality.value,
          residentialAddress: profileForm.residentialAddress.value,
          documentType: profileForm.documentType.value,
          documentNumber: profileForm.documentNumber.value,
          documentIssuingCountry: profileForm.documentIssuingCountry.value,
          documentExpiresAt: profileForm.documentExpiresAt.value,
          businessName: profileForm.businessName.value || undefined,
          registrationNumber: profileForm.registrationNumber.value || undefined,
          incorporationCountry: profileForm.incorporationCountry.value || undefined,
          registeredAddress: profileForm.registeredAddress.value || undefined,
          authorizedRepresentatives: parseRepresentativeLines(document.getElementById('authorized-representatives').value),
          beneficialOwners: parseBeneficialOwners(document.getElementById('beneficial-owners').value),
          providerMode: profileForm.providerMode.value,
          providerCaseReference: profileForm.providerCaseReference.value || undefined,
          dataRetentionExpiresAt: profileForm.dataRetentionExpiresAt.value || undefined
        }
      });
      profileStatus.textContent = 'Dossier KYC enregistré.';
      await loadKyc();
    } catch (error) {
      profileStatus.textContent = error.message || 'Impossible d’enregistrer le dossier.';
    }
  });

  submitButton.addEventListener('click', async () => {
    profileStatus.textContent = 'Soumission du dossier...';
    try {
      await window.apiCall('/kyc/submit', { method: 'POST' });
      profileStatus.textContent = 'Dossier soumis à la revue conformité.';
      await loadAccount();
      await loadKyc();
    } catch (error) {
      profileStatus.textContent = error.message || 'Impossible de soumettre le dossier.';
    }
  });

  documentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    documentStatus.textContent = 'Ajout du document...';
    const formData = new FormData(documentForm);
    try {
      await window.apiCall('/kyc/documents', {
        method: 'POST',
        body: {
          documentKind: formData.get('documentKind'),
          fileName: formData.get('fileName'),
          storageKey: formData.get('storageKey'),
          mimeType: formData.get('mimeType') || undefined,
          retentionExpiresAt: formData.get('retentionExpiresAt') || undefined
        }
      });
      documentStatus.textContent = 'Document enregistré.';
      documentForm.reset();
      await loadKyc();
    } catch (error) {
      documentStatus.textContent = error.message || 'Impossible d’enregistrer le document.';
    }
  });

  refreshButton.addEventListener('click', async () => {
    accountStatus.textContent = 'Actualisation...';
    try {
      await loadAccount();
      await loadKyc();
      accountStatus.textContent = '';
    } catch (error) {
      accountStatus.textContent = error.message || 'Impossible d’actualiser la page.';
    }
  });

  (async function init() {
    try {
      await loadAccount();
      await loadKyc();
    } catch (error) {
      accountStatus.textContent = error.message || 'Impossible de charger votre compte.';
    }
  }());
}());
