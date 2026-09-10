(function () {
  // Le sujet/message d'un ticket peut venir du staff (canal externe consigné manuellement) ou
  // d'un visiteur anonyme non authentifié: jamais du texte de confiance avant affichage — voir
  // le même choix pour les champs produit d'un partenaire dans web/site.js.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  const STATUS_LABELS = { open: 'Ouvert', pending: 'En attente', resolved: 'Résolu', closed: 'Fermé' };
  const STATUS_BADGE = {
    open: 'bg-amber-100 text-amber-800',
    pending: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-slate-200 text-slate-700'
  };
  const CHANNEL_LABELS = { web: 'Site web', whatsapp: 'WhatsApp', email: 'E-mail', phone: 'Téléphone' };

  const anonSection = document.getElementById('anon-section');
  const customerSection = document.getElementById('customer-section');
  const anonForm = document.getElementById('anon-ticket-form');
  const anonFormStatus = document.getElementById('anon-form-status');
  const anonConfirmation = document.getElementById('anon-confirmation');
  const ticketForm = document.getElementById('ticket-form');
  const ticketFormStatus = document.getElementById('ticket-form-status');
  const listEl = document.getElementById('tickets-list');
  const listStatus = document.getElementById('tickets-list-status');

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('fr-FR');
    } catch (error) {
      return iso;
    }
  }

  function messageBlock(message) {
    const fromStaff = message.author_type === 'staff';
    return `
      <div class="rounded-lg px-3 py-2 text-sm ${fromStaff ? 'bg-slate-100' : 'bg-red-50'}">
        <div class="text-xs text-slate-500 mb-1">${fromStaff ? 'MonChantier' : 'Vous'} · ${formatDate(message.created_at)}</div>
        <div class="whitespace-pre-wrap">${escapeHtml(message.body)}</div>
      </div>`;
  }

  async function loadThread(ticketId, content) {
    content.innerHTML = '<p class="text-slate-500 text-sm">Chargement...</p>';
    try {
      const { messages } = await window.apiCall(`/tickets/${ticketId}`);
      content.innerHTML = `
        <div class="space-y-2">${messages.map(messageBlock).join('') || '<p class="text-slate-500 text-sm">Aucun message.</p>'}</div>
        <form class="reply-form mt-3 flex flex-col gap-2">
          <textarea name="message" required minlength="1" maxlength="5000" rows="2" placeholder="Votre message..." class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          <button type="submit" class="signal-button self-start px-3 py-2 rounded-lg text-white text-sm">Envoyer</button>
        </form>
        <p class="reply-status text-sm" role="status" aria-live="polite"></p>
      `;
      content.querySelector('.reply-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.target;
        const statusEl = content.querySelector('.reply-status');
        const submitButton = form.querySelector('button[type=submit]');
        const messageValue = new FormData(form).get('message');
        submitButton.disabled = true;
        try {
          await window.apiCall(`/tickets/${ticketId}/messages`, { method: 'POST', body: { message: messageValue } });
          await loadThread(ticketId, content);
        } catch (error) {
          statusEl.textContent = error.message || 'Envoi impossible.';
          submitButton.disabled = false;
        }
      });
    } catch (error) {
      content.innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(error.message || 'Impossible de charger la conversation.')}</p>`;
    }
  }

  function renderTickets(tickets) {
    if (!tickets.length) {
      listEl.innerHTML = '<p class="text-slate-500">Aucun ticket pour le moment.</p>';
      return;
    }
    listEl.innerHTML = tickets.map((ticket) => `
      <div class="ticket-card bg-white rounded-xl p-4 shadow" data-ticket-id="${ticket.id}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-semibold">${escapeHtml(ticket.subject)}</span>
          <span class="text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[ticket.status] || 'bg-slate-100 text-slate-700'}">${STATUS_LABELS[ticket.status] || ticket.status}</span>
        </div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(CHANNEL_LABELS[ticket.channel] || ticket.channel)} · ${formatDate(ticket.created_at)}</div>
        <button type="button" class="detail-toggle mt-3 text-sm text-red-600 underline" data-ticket-id="${ticket.id}">Voir la conversation</button>
        <div class="detail-content hidden mt-3 border-t border-slate-200 pt-3"></div>
      </div>
    `).join('');

    listEl.querySelectorAll('.detail-toggle').forEach((button) => {
      // .closest('[data-ticket-id]') matcherait le bouton lui-même en premier (il porte
      // aussi cet attribut, pour l'appel API) — .ticket-card cible sans ambiguïté le
      // conteneur parent.
      const card = button.closest('.ticket-card');
      const content = card.querySelector('.detail-content');
      let loaded = false;
      button.addEventListener('click', async () => {
        const willShow = content.classList.contains('hidden');
        content.classList.toggle('hidden', !willShow);
        button.textContent = willShow ? 'Masquer' : 'Voir la conversation';
        if (willShow && !loaded) {
          loaded = true;
          await loadThread(button.dataset.ticketId, content);
        }
      });
    });
  }

  async function loadTickets() {
    listStatus.textContent = 'Chargement...';
    try {
      const { tickets } = await window.apiCall('/tickets');
      renderTickets(tickets);
      listStatus.textContent = '';
    } catch (error) {
      listStatus.textContent = error.message || 'Impossible de charger vos tickets.';
    }
  }

  ticketForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ticketForm.reportValidity()) return;
    const submitButton = document.getElementById('submit-ticket');
    const formData = new FormData(ticketForm);
    submitButton.disabled = true;
    ticketFormStatus.textContent = 'Envoi...';
    try {
      await window.apiCall('/tickets', { method: 'POST', body: { subject: formData.get('subject'), message: formData.get('message') } });
      ticketForm.reset();
      ticketFormStatus.textContent = 'Ticket envoyé. Notre équipe va vous répondre ici.';
      await loadTickets();
    } catch (error) {
      ticketFormStatus.textContent = error.message || 'Envoi impossible.';
    } finally {
      submitButton.disabled = false;
    }
  });

  anonForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!anonForm.reportValidity()) return;
    const submitButton = document.getElementById('submit-anon-ticket');
    const formData = new FormData(anonForm);
    // Un champ optionnel laissé vide arrive comme chaîne vide via FormData, pas comme
    // absent: à envoyer tel quel, contactEmail="" échouerait la validation e-mail du
    // serveur alors que le champ est censé être facultatif (même choix que sourceUrl
    // dans import.js).
    const body = {
      contactName: formData.get('contactName'),
      contactPhone: formData.get('contactPhone') || undefined,
      contactEmail: formData.get('contactEmail') || undefined,
      subject: formData.get('subject'),
      message: formData.get('message'),
      'cf-turnstile-response': formData.get('cf-turnstile-response') || undefined
    };
    submitButton.disabled = true;
    anonFormStatus.textContent = 'Envoi...';
    anonConfirmation.classList.add('hidden');
    try {
      const { ticket } = await window.apiCall('/tickets', { method: 'POST', body });
      anonForm.reset();
      anonFormStatus.textContent = '';
      anonConfirmation.textContent = `Ticket envoyé (référence ${ticket.id.slice(0, 8)}). Nous vous recontactons dès que possible.`;
      anonConfirmation.classList.remove('hidden');
    } catch (error) {
      anonFormStatus.textContent = error.message || 'Envoi impossible.';
    } finally {
      submitButton.disabled = false;
    }
  });

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      anonSection.classList.remove('hidden');
      return;
    }
    try {
      const { user } = await window.apiCall('/auth/me');
      if (user.role !== 'customer') {
        // Staff/admin/partenaire: pas de formulaire client ici — le staff dispose de son
        // propre espace (admin-tickets.html), un partenaire n'a pas de rôle défini dans ce
        // parcours de support.
        anonSection.classList.remove('hidden');
        return;
      }
      customerSection.classList.remove('hidden');
      await loadTickets();
    } catch (error) {
      anonSection.classList.remove('hidden');
    }
  }

  init();
})();
