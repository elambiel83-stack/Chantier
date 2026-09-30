(function () {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const status = document.getElementById('auth-status');
  const socialStatus = document.getElementById('social-auth-status');
  let publicConfig = {};

  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Masquer' : 'Afficher';
      button.setAttribute('aria-label', `${reveal ? 'Masquer' : 'Afficher'} le mot de passe`);
    });
  });

  async function configureTurnstile() {
    try {
      if (!publicConfig.turnstileSiteKey) return;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => document.querySelectorAll('.turnstile-slot').forEach((slot) => {
        window.turnstile.render(slot, { sitekey: publicConfig.turnstileSiteKey });
      });
      document.head.appendChild(script);
    } catch (error) {
      // Le CAPTCHA est une protection optionnelle: aucun message technique n'est montré.
    }
  }

  async function finishSocialAuthentication(endpoint, body) {
    socialStatus.textContent = 'Connexion sécurisée en cours...';
    try {
      const data = await window.apiCall(endpoint, { method: 'POST', body });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      await mergeCartOnLogin();
      const redirect = localStorage.getItem('postLoginRedirect');
      localStorage.removeItem('postLoginRedirect');
      window.location.assign(redirect || 'index.html');
    } catch (error) {
      socialStatus.textContent = error.message || 'Connexion sociale impossible.';
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function configureSocialAuthentication() {
    const available = [];
    if (publicConfig.googleClientId) {
      available.push('Gmail');
      await loadScript('https://accounts.google.com/gsi/client');
      window.google.accounts.id.initialize({
        client_id: publicConfig.googleClientId,
        callback: ({ credential }) => finishSocialAuthentication('/auth/google', { idToken: credential })
      });
      window.google.accounts.id.renderButton(document.getElementById('google-auth-button'), {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', width: 320, locale: 'fr'
      });
    }

    if (publicConfig.appleClientId && publicConfig.appleRedirectUri) {
      available.push('iCloud');
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js');
      window.AppleID.auth.init({
        clientId: publicConfig.appleClientId,
        scope: 'name email',
        redirectURI: publicConfig.appleRedirectUri,
        usePopup: true
      });
      const appleButton = document.getElementById('apple-auth-button');
      appleButton.classList.remove('hidden');
      appleButton.classList.add('flex');
      appleButton.addEventListener('click', async () => {
        try {
          const result = await window.AppleID.auth.signIn();
          const identityToken = result?.authorization?.id_token;
          const name = result?.user?.name;
          const fullName = name ? [name.firstName, name.lastName].filter(Boolean).join(' ') : undefined;
          if (!identityToken) throw new Error('Jeton iCloud manquant');
          await finishSocialAuthentication('/auth/apple', { identityToken, ...(fullName ? { fullName } : {}) });
        } catch (error) {
          if (error?.error !== 'popup_closed_by_user') socialStatus.textContent = error.message || 'Connexion iCloud impossible.';
        }
      });
    }
    if (!available.length) socialStatus.textContent = 'Gmail et iCloud seront disponibles après configuration de leurs identifiants de production.';
  }

  document.querySelectorAll('[data-auth-view]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const isLogin = tab.dataset.authView === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      registerForm.classList.toggle('hidden', isLogin);
      document.querySelectorAll('[data-auth-view]').forEach((item) => {
        item.classList.toggle('border-b-2', item === tab);
        item.classList.toggle('border-red-600', item === tab);
        item.classList.toggle('text-red-700', item === tab);
        item.classList.toggle('text-slate-600', item !== tab);
      });
      status.textContent = '';
    });
  });

  // Fusionne le panier local (ajouté avant la connexion, ou par un visiteur) avec celui déjà
  // enregistré côté serveur pour ce compte (ajouté depuis un autre appareil) plutôt que de
  // perdre l'un des deux — les quantités des produits communs aux deux s'additionnent.
  async function mergeCartOnLogin() {
    try {
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]').filter((item) => item && item.id && Number(item.qty) > 0);
      const serverItems = (window.fetchCartFromServer ? await window.fetchCartFromServer() : null) || [];
      const merged = new Map(serverItems.map((item) => [item.id, item.qty]));
      for (const item of localCart) {
        merged.set(item.id, (merged.get(item.id) || 0) + item.qty);
      }
      const mergedItems = [...merged].map(([id, qty]) => ({ id, qty }));
      localStorage.setItem('cart', JSON.stringify(mergedItems));
      if (mergedItems.length && window.syncCartToServer) await window.syncCartToServer(mergedItems);
    } catch (error) {
      // Pas bloquant: la connexion réussit même si la fusion du panier échoue.
    }
  }

  async function authenticate(endpoint, form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Traitement en cours...';
    try {
      const data = await window.apiCall(endpoint, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      await mergeCartOnLogin();
      // Retour sur la page d'où venait l'utilisateur (le panier, l'espace staff...).
      const redirect = localStorage.getItem('postLoginRedirect');
      localStorage.removeItem('postLoginRedirect');
      // Cette valeur n'est jamais fournie par l'utilisateur: uniquement des noms de page
      // fixés par notre propre code (voir cart.html, admin.html).
      window.location.assign(redirect || 'index.html');
    } catch (error) {
      status.textContent = error.message || 'Impossible de vous authentifier.';
    } finally {
      button.disabled = false;
    }
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    authenticate('/auth/login', loginForm);
  });
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = registerForm.elements.password.value;
    const confirmation = registerForm.elements.confirmPassword.value;
    if (password !== confirmation) {
      status.textContent = 'Les deux mots de passe ne correspondent pas.';
      registerForm.elements.confirmPassword.focus();
      return;
    }
    authenticate('/auth/register', registerForm);
  });

  fetch(`${API_CONFIG.baseURL}/public-config`)
    .then((response) => response.ok ? response.json() : {})
    .then(async (config) => {
      publicConfig = config;
      await configureTurnstile();
      await configureSocialAuthentication();
    })
    .catch(() => { socialStatus.textContent = 'Connexion par e-mail disponible.'; });
}());
