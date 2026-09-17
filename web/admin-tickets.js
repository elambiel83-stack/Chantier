(function () {
  const STATUS_LABELS = { open: 'Ouvert', pending: 'En attente', resolved: 'Résolu', closed: 'Fermé' };
  const STATUS_BADGE = {
    open: 'bg-amber-100 text-amber-800',
    pending: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-slate-200 text-slate-700'
  };
  const CHANNEL_LABELS = { web: 'Web', whatsapp: 'WhatsApp', email: 'E-mail', phone: 'Téléphone' };

  const deniedEl = document.getElementById('denied');
  const dashboardEl = document.getElementById('dashboard');
  const scopeNoteEl = document.getElementById('scope-note');
  const whoamiEl = document.getElementById('whoami');
  const ticketsEl = document.getElementById('tickets');
  const ticketsStatusEl = document.getElementById('tickets-status');
  const statusFilterEl = document.getElementById('status-filter');
  const assignedFilterEl = document.getElementById('assigned-filter');
  const logoutButton = document.getElementById('logout-button');
  const toggleCreateButton = document.getElementById('toggle-create');
  const createForm = document.getElementById('create-form');
  const createStatus = document.getElementById('create-status');

  let me = null;

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

  function contactLabel(ticket) {
    const name = ticket.customer_name || ticket.contact_name || '—';
    const reach = ticket.contact_email || ticket.customer_email || ticket.contact_phone || ticket.customer_phone || '';
    return reach ? `${name} · ${reach}` : name;
  }

  function assignmentLabel(ticket) {
    if (!ticket.assigned_to) return 'Non affecté';
    if (ticket.assigned_to === me.id) return 'Affecté à vous';
    return 'Affecté à un autre agent';
  }

  function messageBlock(message) {
    const fromStaff = message.author_type === 'staff';
    return `
      <div class="rounded-lg px-3 py-2 text-sm ${fromStaff ? 'bg-slate-100' : 'bg-red-50'}">
        <div class="text-xs text-slate-500 mb-1">
          ${fromStaff ? 'Staff' : 'Client'} · ${formatDate(message.created_at)}
          ${message.sent_via_channel ? ' · envoyé au client' : ''}
        </div>
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
          <textarea name="message" required minlength="1" maxlength="5000" rows="2" placeholder="Votre réponse..." class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          <button type="submit" class="signal-button self-start px-3 py-2 rounded-lg text-white text-sm">Répondre</button>
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
          const { message } = await window.apiCall(`/tickets/${ticketId}/messages`, { method: 'POST', body: { message: messageValue } });
          statusEl.textContent = message.sent_via_channel ? 'Réponse transmise au client.' : 'Réponse enregistrée.';
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
      ticketsEl.innerHTML = '<p class="text-slate-500">Aucun ticket à afficher.</p>';
      return;
    }
    ticketsEl.innerHTML = tickets.map((ticket) => {
      const badge = STATUS_BADGE[ticket.status] || 'bg-slate-100 text-slate-700';
      const canClaim = !ticket.assigned_to;
      const canUnassign = me.role === 'admin' && ticket.assigned_to;
      return `
        <div class="ticket-card bg-white rounded-xl p-4 shadow" data-ticket-id="${ticket.id}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-semibold">${escapeHtml(ticket.subject)}</span>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badge}">${STATUS_LABELS[ticket.status] || ticket.status}</span>
          </div>
          <div class="mt-1 text-sm text-slate-600">${escapeHtml(contactLabel(ticket))}</div>
          <div class="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            <span>${escapeHtml(CHANNEL_LABELS[ticket.channel] || ticket.channel)}</span>
            <span>${formatDate(ticket.created_at)}</span>
            <span>${assignmentLabel(ticket)}</span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            ${canClaim ? `<button type="button" class="claim-ticket signal-button text-white px-3 py-2 rounded-lg text-sm" data-ticket-id="${ticket.id}">Réclamer</button>` : ''}
            ${canUnassign ? `<button type="button" class="unassign-ticket outline-button border px-3 py-2 rounded-lg text-sm" data-ticket-id="${ticket.id}">Libérer</button>` : ''}
            <label class="text-xs text-slate-500 ml-auto" for="status-${ticket.id}">Statut</label>
            <select class="status-select border rounded-lg px-2 py-1 text-sm" id="status-${ticket.id}" data-ticket-id="${ticket.id}">
              ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${ticket.status === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            <button type="button" class="detail-toggle text-sm text-red-600 underline" data-ticket-id="${ticket.id}">Voir la conversation</button>
          </div>
          <div class="detail-content hidden mt-3 border-t border-slate-200 pt-3"></div>
        </div>
      `;
    }).join('');

    ticketsEl.querySelectorAll('.claim-ticket').forEach((button) => {
      button.addEventListener('click', () => runAction(button, () => window.apiCall(`/tickets/${button.dataset.ticketId}/claim`, { method: 'POST' })));
    });
    ticketsEl.querySelectorAll('.unassign-ticket').forEach((button) => {
      button.addEventListener('click', () => runAction(button, () => window.apiCall(`/tickets/${button.dataset.ticketId}/assign`, { method: 'PATCH', body: { assigneeUserId: null } })));
    });
    ticketsEl.querySelectorAll('.status-select').forEach((select) => {
      select.addEventListener('change', () => runAction(select, () => window.apiCall(`/tickets/${select.dataset.ticketId}/status`, { method: 'PATCH', body: { status: select.value } })));
    });
    ticketsEl.querySelectorAll('.detail-toggle').forEach((button) => {
      // .closest('[data-ticket-id]') matcherait le bouton lui-même (il porte aussi cet
      // attribut, pour l'appel API) — .ticket-card cible sans ambiguïté le conteneur parent.
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

  async function runAction(control, action) {
    control.disabled = true;
    ticketsStatusEl.textContent = 'Traitement en cours...';
    try {
      await action();
      ticketsStatusEl.textContent = 'Mis à jour.';
      await loadTickets();
    } catch (error) {
      ticketsStatusEl.textContent = error.message || 'Action refusée.';
      control.disabled = false;
    }
  }

  async function loadTickets() {
    ticketsStatusEl.textContent = 'Chargement...';
    const params = new URLSearchParams();
    if (statusFilterEl.value) params.set('status', statusFilterEl.value);
    if (assignedFilterEl.value) params.set('assigned', assignedFilterEl.value);
    try {
      const data = await window.apiCall(`/tickets${params.toString() ? `?${params.toString()}` : ''}`);
      renderTickets(data.tickets || []);
      ticketsStatusEl.textContent = '';
    } catch (error) {
      ticketsStatusEl.textContent = error.message || 'Impossible de charger les tickets.';
    }
  }

  toggleCreateButton.addEventListener('click', () => createForm.classList.toggle('hidden'));

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!createForm.reportValidity()) return;
    const submitButton = createForm.querySelector('button[type=submit]');
    const formData = Object.fromEntries(new FormData(createForm));
    // Un ID client vide reste une chaîne vide (pas undefined) via FormData: le serveur
    // attend soit une valeur UUID valide, soit son absence complète.
    if (!formData.customerId) delete formData.customerId;
    if (!formData.contactName) delete formData.contactName;
    if (!formData.contactPhone) delete formData.contactPhone;
    if (!formData.contactEmail) delete formData.contactEmail;
    submitButton.disabled = true;
    createStatus.textContent = 'Création...';
    try {
      await window.apiCall('/tickets', { method: 'POST', body: formData });
      createForm.reset();
      createForm.classList.add('hidden');
      createStatus.textContent = '';
      await loadTickets();
    } catch (error) {
      createStatus.textContent = error.message || 'Création impossible.';
    } finally {
      submitButton.disabled = false;
    }
  });

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'admin-tickets.html');
      window.location.assign('auth.html');
      return;
    }
    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'admin-tickets.html');
      window.location.assign('auth.html');
      return;
    }
    if (!['staff', 'admin'].includes(me.role)) {
      deniedEl.classList.remove('hidden');
      return;
    }
    const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
    whoamiEl.textContent = authUser?.email ? `${authUser.email} · ${me.role}` : me.role;
    scopeNoteEl.textContent = 'Tout le staff peut répondre à n’importe quel ticket; réclamez-le pour le suivre dans "Affectés à moi".';
    dashboardEl.classList.remove('hidden');
    await loadTickets();
  }

  statusFilterEl.addEventListener('change', loadTickets);
  assignedFilterEl.addEventListener('change', loadTickets);
  document.getElementById('refresh').addEventListener('click', loadTickets);
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
