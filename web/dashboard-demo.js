(function () {
  'use strict';

  const RATE_CDF = 2800;
  const VAT_RATE = 0.16;
  const STORAGE_KEY = 'monchantierMultiRoleDemo';

  const roles = [
    { id: 'client', label: 'Client', short: 'CL', description: 'Acheter et suivre' },
    { id: 'supplier', label: 'Fournisseur', short: 'FO', description: 'Préparer les produits' },
    { id: 'carrier', label: 'Partenaire / Transporteur', short: 'TR', description: 'Planifier la livraison' },
    { id: 'driver', label: 'Chauffeur', short: 'CH', description: 'Exécuter la mission' },
    { id: 'admin', label: 'Administrateur', short: 'AD', description: 'Superviser l’activité' }
  ];

  const stages = ['Commande', 'Paiement', 'Préparation', 'En route', 'Livrée'];
  const stateLabels = ['Panier à confirmer', 'Paiement confirmé', 'En préparation', 'Livraison en cours', 'Commande livrée'];
  const stateHints = [
    'Confirmez la commande côté Client, puis passez au rôle Fournisseur.',
    'Le fournisseur peut maintenant accepter et préparer les produits.',
    'Le transporteur peut affecter Patrick à cette livraison.',
    'Le chauffeur peut démarrer puis terminer la mission.',
    'Le parcours est terminé. Réinitialisez la démo pour le rejouer.'
  ];
  const pageTitles = {
    client: 'Bonjour, Erick',
    supplier: 'Espace fournisseur',
    carrier: 'Centre de transport',
    driver: 'Mission du jour',
    admin: 'Vue d’ensemble'
  };
  const products = [
    { id: 'blocks', name: 'Blocs ciment 15', unit: 'pièce', price: 1.25, stock: '2 400 pièces', art: '' },
    { id: 'sand', name: 'Sable concassé', unit: 'm³', price: 42, stock: '64 m³', art: 'sand' },
    { id: 'pavers', name: 'Pavés autobloquants', unit: 'm²', price: 18, stock: '180 m²', art: 'pavers' }
  ];

  const initialState = {
    role: 'client',
    stage: 0,
    currency: 'USD',
    driverAssigned: false,
    locationShared: true,
    quantities: { blocks: 150, sand: 3, pavers: 0 }
  };

  let state = loadState();
  let me = null;

  const authLoading = document.getElementById('auth-loading');
  const denied = document.getElementById('denied');
  const app = document.getElementById('demo-app');
  const dashboard = document.getElementById('dashboard-content');
  const notice = document.getElementById('demo-notice');
  const currencySelect = document.getElementById('currency-select');

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved ? Object.assign({}, initialState, saved) : JSON.parse(JSON.stringify(initialState));
    } catch (error) {
      return JSON.parse(JSON.stringify(initialState));
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notify(message) {
    notice.innerHTML = '<span></span>' + message;
  }

  function money(value) {
    if (state.currency === 'CDF') {
      return Math.round(value * RATE_CDF).toLocaleString('fr-FR') + ' FC';
    }
    return Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $';
  }

  function subtotal() {
    return products.reduce(function (sum, product) {
      return sum + product.price * (state.quantities[product.id] || 0);
    }, 0);
  }

  function total() {
    return subtotal() * (1 + VAT_RATE);
  }

  function kpi(label, value, note, chip) {
    return '<article class="demo-kpi">' +
      '<div class="demo-kpi-head"><span>' + label + '</span><span class="demo-chip">' + (chip || 'Temps réel') + '</span></div>' +
      '<div class="demo-kpi-value">' + value + '</div><div class="demo-kpi-note">' + note + '</div></article>';
  }

  function panel(title, subtitle, body, action) {
    return '<section class="demo-panel"><div class="demo-panel-head"><div><h2>' + title + '</h2>' +
      (subtitle ? '<p>' + subtitle + '</p>' : '') + '</div>' + (action || '') +
      '</div><div class="demo-panel-body">' + body + '</div></section>';
  }

  function badge() {
    return '<span class="demo-status">' + stateLabels[state.stage] + '</span>';
  }

  function routeMap() {
    return '<div class="demo-map" aria-label="Itinéraire schématique à Kolwezi">' +
      '<svg viewBox="0 0 460 190" aria-hidden="true"><path d="M55 145 C115 65 180 160 250 85 S355 78 405 38" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"></path>' +
      '<path d="M55 145 C115 65 180 160 250 85 S355 78 405 38" fill="none" stroke="#ff6333" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"></path></svg>' +
      '<span class="demo-pin start"></span><span class="demo-pin end"></span>' +
      '<span class="demo-map-label start">Dépôt Manika</span><span class="demo-map-label end">Joli Site</span></div>';
  }

  function cartLines() {
    return products.filter(function (product) {
      return state.quantities[product.id] > 0;
    }).map(function (product) {
      return '<div class="demo-line"><span><strong>' + product.name + '</strong><small>' +
        state.quantities[product.id] + ' ' + product.unit + '</small></span><strong>' +
        money(product.price * state.quantities[product.id]) + '</strong></div>';
    }).join('');
  }

  function productCards() {
    return products.map(function (product) {
      return '<article class="demo-product"><div class="demo-product-art ' + product.art + '"></div>' +
        '<div class="demo-product-copy"><h3>' + product.name + '</h3><p>Disponible · ' + product.stock + '</p>' +
        '<div class="demo-product-foot"><strong>' + money(product.price) + ' / ' + product.unit + '</strong>' +
        '<button type="button" class="demo-button dark add-product" data-product="' + product.id + '"' +
        (state.stage > 0 ? ' disabled' : '') + '>+ Ajouter</button></div></div></article>';
    }).join('');
  }

  function renderClient() {
    const primary = state.stage === 0
      ? '<button type="button" id="confirm-order" class="demo-button primary full">Payer et confirmer · ' + money(total()) + '</button>'
      : '<button type="button" id="track-order" class="demo-button full">Voir le suivi en direct</button>';

    return '<div class="demo-kpis">' +
      kpi('Commande active', '01', stateLabels[state.stage]) +
      kpi('Valeur du panier', money(total()), 'TVA 16 % incluse', 'USD / CDF') +
      kpi('Distance estimée', '8,4 km', 'Dépôt → Joli Site') +
      kpi('Livraison estimée', state.stage >= 3 ? '26 min' : 'Aujourd’hui', 'Créneau 14h–16h') +
      '</div><div class="demo-grid"><div class="demo-stack">' +
      panel('Catalogue recommandé', 'Matériaux disponibles à Kolwezi', '<div class="demo-product-grid">' + productCards() + '</div>') +
      (state.stage >= 1 ? panel('Suivi de la livraison', 'Commande MC-2026-0418', routeMap() +
        '<div class="demo-driver"><span class="demo-avatar">PM</span><span><strong>Patrick Mwamba</strong><small>' +
        (state.driverAssigned ? 'Chauffeur affecté · Toyota Dyna 08' : 'En attente d’affectation') +
        '</small></span>' + badge() + '</div>') : '') +
      '</div><div class="demo-stack">' +
      panel('Votre commande', 'Prix calculés automatiquement', cartLines() +
        '<div class="demo-total"><span>Total TTC</span><strong>' + money(total()) + '</strong></div>' + primary +
        '<label class="demo-line"><span>Partager ma position</span><input id="share-location" type="checkbox"' +
        (state.locationShared ? ' checked' : '') + '></label>') +
      panel('Progression', 'Visible par tous les rôles', renderMiniProgress()) +
      '</div></div>';
  }

  function renderSupplier() {
    const actionLabel = state.stage < 1 ? 'Paiement attendu' : state.stage === 1 ? 'Accepter et préparer' : 'Commande traitée';
    return '<div class="demo-kpis">' +
      kpi('À préparer', state.stage === 1 ? '01' : '00', 'Commande prioritaire') +
      kpi('Valeur du jour', money(812), '+12 % cette semaine') +
      kpi('Stock disponible', '96 %', '3 familles suivies') +
      kpi('Délai moyen', '38 min', 'Objectif < 45 min') +
      '</div><div class="demo-grid"><div class="demo-stack">' +
      panel('Commande à traiter', 'MC-2026-0418 · Erick Lambi',
        '<div class="demo-line"><span><strong>Blocs ciment + sable</strong><small>Livraison à Joli Site</small></span>' + badge() + '</div>' +
        '<div class="demo-line"><span>Total TTC</span><strong>' + money(total()) + '</strong></div>' +
        '<div class="demo-actions"><button id="prepare-order" type="button" class="demo-button primary"' +
        (state.stage !== 1 ? ' disabled' : '') + '>' + actionLabel + '</button>' +
        '<button id="view-location" type="button" class="demo-button">Voir le point de livraison</button></div>') +
      panel('Niveaux de stock', 'Synchronisés avec le catalogue',
        stockRow('Blocs ciment', 88, '2 400', false) +
        stockRow('Sable', 46, '64 m³', true) +
        stockRow('Pavés', 72, '180 m²', false)) +
      '</div><div class="demo-stack">' +
      panel('Consignes', 'Préparation et qualité', '<div class="demo-note-box">Vérifier la qualité des blocs et protéger le sable pendant le transport. Le client demande une livraison sans déchargement mécanique.</div>') +
      panel('Progression', 'État partagé', renderMiniProgress()) +
      '</div></div>';
  }

  function stockRow(label, width, value, warning) {
    return '<div class="demo-stock"><span>' + label + '</span><span class="demo-stock-track">' +
      '<span class="demo-stock-fill ' + (warning ? 'warn' : '') + '" style="width:' + width + '%"></span></span><strong>' + value + '</strong></div>';
  }

  function renderCarrier() {
    return '<div class="demo-kpis">' +
      kpi('Missions actives', state.stage === 3 ? '03' : '02', 'Kolwezi aujourd’hui') +
      kpi('Chauffeurs libres', state.driverAssigned ? '03' : '04', 'Sur 7 chauffeurs') +
      kpi('Taux à l’heure', '92 %', '+4 points ce mois') +
      kpi('Distance du jour', '126 km', 'Toutes missions') +
      '</div><div class="demo-grid"><div class="demo-stack">' +
      panel('Planifier la livraison', 'Mission MC-2026-0418 · 8,4 km', routeMap() +
        '<div class="demo-driver"><span class="demo-avatar">PM</span><span><strong>Patrick Mwamba</strong><small>Toyota Dyna 08 · capacité 4,5 t</small></span>' +
        '<span class="demo-status">' + (state.driverAssigned ? 'Affecté' : 'Disponible') + '</span></div>' +
        '<div class="demo-actions"><button id="assign-driver" type="button" class="demo-button primary"' +
        (state.stage !== 2 || state.driverAssigned ? ' disabled' : '') + '>' +
        (state.driverAssigned ? 'Patrick est affecté' : state.stage === 2 ? 'Affecter Patrick' : 'Marchandise non prête') +
        '</button><button id="contact-driver" type="button" class="demo-button">Contacter</button></div>') +
      '</div><div class="demo-stack">' +
      panel('Flotte disponible', 'Capacité et proximité',
        driverLine('PM', 'Patrick Mwamba', 'Dyna 08 · 4,5 t', 'Disponible') +
        driverLine('JK', 'Jean Kabamba', 'Canter 12 · 5 t', 'En mission') +
        driverLine('KM', 'Kevin Mutombo', 'Fuso 04 · 8 t', 'Entretien')) +
      panel('Progression', 'État partagé', renderMiniProgress()) +
      '</div></div>';
  }

  function driverLine(initials, name, vehicle, status) {
    return '<div class="demo-line"><span class="demo-driver"><span class="demo-avatar">' + initials +
      '</span><span><strong>' + name + '</strong><small>' + vehicle + '</small></span></span><span class="demo-status">' + status + '</span></div>';
  }

  function renderDriver() {
    const canStart = state.stage === 2 && state.driverAssigned;
    const canFinish = state.stage === 3;
    let actionLabel = 'Aucune mission prête';
    if (canStart) actionLabel = 'Démarrer la livraison';
    if (canFinish) actionLabel = 'Marquer comme livrée';
    if (state.stage === 4) actionLabel = 'Mission terminée';

    return '<div class="demo-kpis">' +
      kpi('Mission actuelle', state.driverAssigned ? 'MC-0418' : '—', stateLabels[state.stage]) +
      kpi('Distance', '8,4 km', state.stage === 3 ? '6,1 km restants' : 'Trajet total') +
      kpi('Temps estimé', state.stage === 3 ? '26 min' : '34 min', 'Trafic fluide') +
      kpi('Missions du jour', state.stage === 4 ? '04' : '03', 'Objectif 4') +
      '</div><div class="demo-grid"><div class="demo-stack">' +
      panel('Itinéraire de livraison', 'Dépôt Manika → Quartier Joli Site', routeMap() +
        '<div class="demo-actions"><button id="driver-action" type="button" class="demo-button primary full"' +
        (!canStart && !canFinish ? ' disabled' : '') + '>' + actionLabel + '</button>' +
        '<button id="call-client" type="button" class="demo-button full">Appeler le client</button></div>') +
      '</div><div class="demo-stack">' +
      panel('Détails de la mission', 'Commande MC-2026-0418',
        '<div class="demo-line"><span>Client</span><strong>Erick Lambi</strong></div>' +
        '<div class="demo-line"><span>Chargement</span><strong>150 blocs + 3 m³</strong></div>' +
        '<div class="demo-line"><span>Paiement</span><strong>Confirmé</strong></div>' +
        '<div class="demo-line"><span>Position client</span><strong>' + (state.locationShared ? 'Partagée' : 'Non partagée') + '</strong></div>') +
      panel('Progression', 'Mise à jour en temps réel', renderMiniProgress()) +
      '</div></div>';
  }

  function renderAdmin() {
    const controls = stateLabels.map(function (label, index) {
      return '<button type="button" class="demo-state-button ' + (index === state.stage ? 'active' : '') +
        '" data-stage="' + index + '"><span>' + label + '</span><strong>' + (index + 1) + '</strong></button>';
    }).join('');
    return '<div class="demo-kpis">' +
      kpi('Ventes aujourd’hui', money(4278), '+18 % vs hier') +
      kpi('Commandes', '18', '3 nécessitent une action') +
      kpi('Livraisons actives', '07', '92 % à l’heure') +
      kpi('Paiements validés', '96 %', '1 en vérification') +
      '</div><div class="demo-grid"><div class="demo-stack">' +
      panel('Commandes récentes', 'Supervision de tous les acteurs',
        '<div class="demo-table-wrap"><table class="demo-table"><thead><tr><th>Commande</th><th>Client</th><th>État</th><th>Montant</th><th>Zone</th></tr></thead><tbody>' +
        orderRow('MC-0418', 'Erick Lambi', stateLabels[state.stage], money(total()), 'Kolwezi') +
        orderRow('MC-0417', 'Grâce K.', 'Commande livrée', money(284), 'Musompo') +
        orderRow('MC-0416', 'BTP Horizon', 'Livraison en cours', money(1240), 'Manika') +
        '</tbody></table></div>') +
      panel('Santé opérationnelle', 'Services simulés',
        '<div class="demo-line"><span>Catalogue et stock</span><strong>Opérationnel</strong></div>' +
        '<div class="demo-line"><span>Paiements</span><strong>Opérationnel</strong></div>' +
        '<div class="demo-line"><span>Localisation</span><strong>Opérationnel</strong></div>') +
      '</div><div class="demo-stack">' +
      panel('Contrôle de démonstration', 'Tester directement chaque état', '<div class="demo-state-controls">' + controls + '</div>') +
      panel('Accès', 'Séparation des données', '<div class="demo-note-box">Cette page utilise des données fictives. Les commandes réelles restent accessibles depuis l’espace Commandes.</div>') +
      '</div></div>';
  }

  function orderRow(reference, client, status, amount, zone) {
    return '<tr><td><strong>' + reference + '</strong></td><td>' + client + '</td><td>' + status +
      '</td><td><strong>' + amount + '</strong></td><td>' + zone + '</td></tr>';
  }

  function renderMiniProgress() {
    return stateLabels.map(function (label, index) {
      const color = index < state.stage ? '#0c9a6b' : index === state.stage ? '#ff6333' : '#dfe5e7';
      return '<div class="demo-line"><span style="display:flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:50%;background:' +
        color + '"></i>' + label + '</span>' + (index === state.stage ? '<strong>Actuel</strong>' : '') + '</div>';
    }).join('');
  }

  function setRole(role) {
    state.role = role;
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setStage(stage, message) {
    state.stage = Math.max(0, Math.min(4, Number(stage)));
    if (state.stage >= 3) state.driverAssigned = true;
    saveState();
    render();
    notify(message || ('État appliqué : ' + stateLabels[state.stage] + '.'));
  }

  function renderNavigation() {
    const desktop = document.getElementById('role-nav');
    const mobile = document.getElementById('mobile-role-nav');
    const buttons = roles.map(function (role) {
      return '<button type="button" class="demo-role-button ' + (role.id === state.role ? 'active' : '') +
        '" data-role="' + role.id + '"><span class="demo-role-icon">' + role.short + '</span>' +
        '<span class="demo-role-copy"><strong>' + role.label + '</strong><small>' + role.description + '</small></span></button>';
    }).join('');
    desktop.innerHTML = buttons;
    mobile.innerHTML = buttons;
    document.querySelectorAll('[data-role]').forEach(function (button) {
      button.addEventListener('click', function () { setRole(button.dataset.role); });
    });
  }

  function renderProgress() {
    document.getElementById('progress-steps').innerHTML = stages.map(function (label, index) {
      const status = index < state.stage ? 'done' : index === state.stage ? 'active' : '';
      return '<li class="' + status + '"><span>' + (index < state.stage ? '✓' : index + 1) + '</span><small>' + label + '</small></li>';
    }).join('');
  }

  function bindActions() {
    document.querySelectorAll('.add-product').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.product;
        state.quantities[id] = (state.quantities[id] || 0) + 1;
        saveState();
        render();
        notify('Produit ajouté au panier de démonstration.');
      });
    });
    const shareLocation = document.getElementById('share-location');
    if (shareLocation) {
      shareLocation.addEventListener('change', function () {
        state.locationShared = shareLocation.checked;
        saveState();
        notify(state.locationShared ? 'Position partagée avec le chauffeur.' : 'Partage de position désactivé.');
      });
    }
    const confirmOrder = document.getElementById('confirm-order');
    if (confirmOrder) confirmOrder.addEventListener('click', function () { setStage(1, 'Paiement simulé avec succès. Passez au rôle Fournisseur.'); });
    const trackOrder = document.getElementById('track-order');
    if (trackOrder) trackOrder.addEventListener('click', function () { notify(state.stage >= 3 ? 'Position du chauffeur actualisée.' : 'Le suivi sera disponible au départ du chauffeur.'); });
    const prepareOrder = document.getElementById('prepare-order');
    if (prepareOrder) prepareOrder.addEventListener('click', function () { setStage(2, 'La commande est prête pour le transporteur.'); });
    const viewLocation = document.getElementById('view-location');
    if (viewLocation) viewLocation.addEventListener('click', function () { notify(state.locationShared ? 'Point de livraison : Quartier Joli Site, Kolwezi.' : 'Le client n’a pas partagé sa position.'); });
    const assignDriver = document.getElementById('assign-driver');
    if (assignDriver) assignDriver.addEventListener('click', function () {
      state.driverAssigned = true;
      saveState();
      render();
      notify('Patrick a reçu la mission. Passez au rôle Chauffeur.');
    });
    const contactDriver = document.getElementById('contact-driver');
    if (contactDriver) contactDriver.addEventListener('click', function () { notify('Mode démo : conversation avec Patrick préparée.'); });
    const driverAction = document.getElementById('driver-action');
    if (driverAction) driverAction.addEventListener('click', function () {
      if (state.stage === 2 && state.driverAssigned) setStage(3, 'Livraison démarrée. Le client peut suivre Patrick.');
      else if (state.stage === 3) setStage(4, 'Commande livrée avec succès.');
    });
    const callClient = document.getElementById('call-client');
    if (callClient) callClient.addEventListener('click', function () { notify('Mode démo : appel du client préparé.'); });
    document.querySelectorAll('[data-stage]').forEach(function (button) {
      button.addEventListener('click', function () { setStage(button.dataset.stage); });
    });
  }

  function render() {
    renderNavigation();
    renderProgress();
    currencySelect.value = state.currency;
    document.getElementById('page-title').textContent = pageTitles[state.role];
    document.getElementById('state-badge').textContent = stateLabels[state.stage];
    document.getElementById('state-badge').dataset.stage = String(state.stage);
    document.getElementById('scenario-hint').textContent = stateHints[state.stage];

    const renderers = {
      client: renderClient,
      supplier: renderSupplier,
      carrier: renderCarrier,
      driver: renderDriver,
      admin: renderAdmin
    };
    dashboard.innerHTML = renderers[state.role]();
    bindActions();
  }

  document.getElementById('reset-demo').addEventListener('click', function () {
    state = JSON.parse(JSON.stringify(initialState));
    saveState();
    render();
    notify('La démonstration a été réinitialisée.');
  });

  currencySelect.addEventListener('change', function () {
    state.currency = currencySelect.value;
    saveState();
    render();
    notify('Les montants sont maintenant affichés en ' + state.currency + '.');
  });

  document.getElementById('logout-button').addEventListener('click', async function () {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) await window.apiCall('/auth/logout', { method: 'POST', body: { token: refreshToken } });
    } catch (error) {
      // La session locale doit quand même être fermée.
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      window.location.assign('index.html');
    }
  });

  async function init() {
    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('postLoginRedirect', 'dashboard-demo.html');
      window.location.assign('auth.html');
      return;
    }

    try {
      const data = await window.apiCall('/auth/me');
      me = data.user;
    } catch (error) {
      localStorage.setItem('postLoginRedirect', 'dashboard-demo.html');
      window.location.assign('auth.html');
      return;
    }

    authLoading.classList.add('hidden');

    if (!me || me.role !== 'admin') {
      denied.classList.remove('hidden');
      return;
    }

    const authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
    document.getElementById('user-name').textContent = authUser && authUser.email ? authUser.email : 'Administrateur';
    document.getElementById('user-role').textContent = 'Compte administrateur';
    app.classList.remove('hidden');
    render();
  }

  init();
}());
