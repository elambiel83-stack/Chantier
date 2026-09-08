(function () {
  const CHANNEL_LABELS = { email: 'E-mail', sms: 'SMS', whatsapp: 'WhatsApp' };

  const emailEl = document.getElementById('account-email');
  const badgeEl = document.getElementById('account-verified-badge');
  const accountStatus = document.getElementById('account-status');
  const verificationSection = document.getElementById('verification-section');
  const channelChoices = document.getElementById('channel-choices');
  const sendForm = document.getElementById('send-code-form');
  const sendButton = document.getElementById('send-code-button');
  const sendStatus = document.getElementById('send-status');
  const confirmForm = document.getElementById('confirm-code-form');
  const confirmStatus = document.getElementById('confirm-status');

  if (!localStorage.getItem('accessToken')) {
    window.location.assign('auth.html');
    return;
  }

  async function loadAccount() {
    try {
      const { user } = await window.apiCall('/auth/me');
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
    } catch (error) {
      accountStatus.textContent = error.message || 'Impossible de charger votre compte.';
    }
  }

  async function loadChannels() {
    try {
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
    } catch (error) {
      accountStatus.textContent = error.message || 'Impossible de charger les canaux de vérification.';
    }
  }

  sendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const channel = new FormData(sendForm).get('channel');
    if (!channel) return;
    sendButton.disabled = true;
    sendStatus.textContent = 'Envoi en cours...';
    try {
      await window.apiCall('/auth/verification/send', { method: 'POST', body: { channel } });
      sendStatus.textContent = 'Code envoyé, vérifiez votre ' + (CHANNEL_LABELS[channel] || channel).toLowerCase() + '.';
      confirmForm.classList.remove('hidden');
    } catch (error) {
      sendStatus.textContent = error.message || 'Impossible d\'envoyer le code.';
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

  loadAccount();
}());
