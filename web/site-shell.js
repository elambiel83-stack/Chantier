(function () {
  if (document.documentElement.dataset.chantierShell === '1') return;
  document.documentElement.dataset.chantierShell = '1';

  const isHome = /(^|\/)index\.html$/.test(location.pathname) || location.pathname.endsWith('/');
  if (isHome) return;

  const body = document.body;
  body.classList.add('chantier-shell-page');

  const existingHeader = body.querySelector(':scope > header');
  if (existingHeader) existingHeader.classList.add('chantier-legacy-header');

  const header = document.createElement('header');
  header.className = 'chantier-global-header';
  header.innerHTML = `
    <div class="chantier-global-header__inner">
      <a class="site-brand" href="index.html" aria-label="Chantier.online — Accueil">
        <img src="assets/chantier-logo.svg" alt="Chantier.online — Tout pour bâtir.">
      </a>
      <nav class="chantier-global-nav" aria-label="Navigation principale">
        <a href="index.html#catalog">Catalogue</a>
        <a href="professionals.html">Professionnels</a>
        <a href="partners.html">Partenaires</a>
        <a href="operations.html">Devis & logistique</a>
        <a href="orders.html">Mes commandes</a>
        <a href="account.html">Mon compte</a>
      </nav>
      <a class="chantier-header-whatsapp" href="https://wa.me/243840468602" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>`;
  body.prepend(header);

  if (!body.querySelector(':scope > footer')) {
    const footer = document.createElement('footer');
    footer.className = 'chantier-global-footer';
    footer.innerHTML = `
      <div class="chantier-global-footer__inner">
        <div><strong>CHANTIER<span class="brand-domain">.online</span></strong><span class="chantier-footer-tagline">Tout pour bâtir.</span></div>
        <div class="chantier-footer-links">
          <a href="mailto:contact@chantier.online">contact@chantier.online</a>
          <a href="https://wa.me/243840468602">+243 840 468 602</a>
          <a href="privacy.html">Confidentialité</a>
          <a href="terms.html">Conditions de vente</a>
        </div>
      </div>`;
    body.append(footer);
  }
})();