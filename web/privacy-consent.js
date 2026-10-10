(() => {
  'use strict';
  const KEY = 'monchantier_privacy_v1';
  const ADS_ID = 'AW-18453977660';
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      return value && value.version === 1 && typeof value.ads === 'boolean' ? value : null;
    } catch { return null; }
  };
  let adsLoaded = false;
  let banner = document.getElementById('privacy-choice');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'privacy-choice';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Préférences de confidentialité');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:white;color:#172033;padding:16px;box-shadow:0 -3px 15px #0002;border-top:1px solid #ccc;';
    banner.innerHTML = '<p>Les fonctions nécessaires restent actives. Google Ads est désactivé sauf si vous acceptez les traceurs publicitaires.</p><button type="button" id="privacy-reject">Refuser</button> <button type="button" id="privacy-accept-ads">Accepter la publicité</button>';
    document.body.appendChild(banner);
  }
  const link = document.createElement('button');
  link.type = 'button';
  link.id = 'privacy-manage';
  link.textContent = 'Gérer mes préférences';
  link.setAttribute('aria-controls', 'privacy-choice');
  link.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9998;padding:8px 12px;background:#fff;color:#172033;border:1px solid #64748b;border-radius:8px;box-shadow:0 2px 8px #0002;font-size:13px;';
  document.body.appendChild(link);
  function show() { banner.hidden = false; link.hidden = true; }
  function hide() { banner.hidden = true; link.hidden = false; }
  function loadAds() {
    if (adsLoaded || document.querySelector('script[data-monchantier-google-ads]')) return;
    adsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ADS_ID;
    script.dataset.monchantierGoogleAds = '1';
    script.onload = () => { if (read()?.ads === true) window.gtag('config', ADS_ID); };
    document.head.appendChild(script);
  }
  function save(ads) {
    const previous = read();
    try { localStorage.setItem(KEY, JSON.stringify({ads: Boolean(ads), version: 1, updatedAt: new Date().toISOString()})); }
    catch { if (ads) return; }
    hide();
    if (ads) loadAds();
    else if (adsLoaded || previous?.ads === true) {
      // Reload to stop further page activity with an already loaded advertising library.
      window.location.reload();
    }
  }
  document.getElementById('privacy-reject')?.addEventListener('click', () => save(false));
  document.getElementById('privacy-accept-ads')?.addEventListener('click', () => save(true));
  link.addEventListener('click', show);
  const choice = read();
  if (choice) { hide(); if (choice.ads) loadAds(); } else show();
  window.MonChantierPrivacy = { preferences: read, setAdvertising: save, openPreferences: show };
})();
