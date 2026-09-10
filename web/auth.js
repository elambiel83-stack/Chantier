(function () {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const status = document.getElementById('auth-status');

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

  function completeSession(data) {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('authUser', JSON.stringify(data.user));
    // Retour sur la page d'où venait l'utilisateur (le panier en général).
    const redirect = localStorage.getItem('postLoginRedirect');
    localStorage.removeItem('postLoginRedirect');
    window.location.assign(data.user?.role === 'admin' ? 'admin.html' : (redirect === 'cart.html' ? 'cart.html' : 'index.html'));
  }

  async function authenticate(endpoint, form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Traitement en cours...';
    try {
      const data = await window.apiCall(endpoint, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      completeSession(data);
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
    authenticate('/auth/register', registerForm);
  });

  async function authenticateSocial(endpoint, body) {
    status.textContent = 'Traitement en cours...';
    try {
      const data = await window.apiCall(endpoint, { method: 'POST', body });
      completeSession(data);
    } catch (error) {
      status.textContent = error.message || 'Impossible de vous authentifier.';
    }
  }

  function initGoogleSignIn(clientId) {
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => authenticateSocial(window.API_CONFIG.endpoints.authGoogle, { credential: response.credential }),
      auto_select: true,
      use_fedcm_for_prompt: true
    });
    const container = document.getElementById('google-signin-button');
    container.hidden = false;
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', locale: 'fr' });
    // Propose automatiquement les comptes Google déjà connectés sur cet appareil/navigateur,
    // sans que l'utilisateur ait à cliquer sur le bouton.
    window.google.accounts.id.prompt();
  }

  function initFacebookSignIn(appId) {
    const button = document.getElementById('facebook-signin-button');
    button.hidden = false;

    function handleFacebookResponse(response) {
      if (response.status === 'connected') {
        authenticateSocial(window.API_CONFIG.endpoints.authFacebook, { accessToken: response.authResponse.accessToken });
      }
    }

    function onSdkReady() {
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
      // Si le navigateur a déjà une session Facebook autorisée pour ce site, on se
      // connecte automatiquement sans attendre un clic (même logique que Google One Tap).
      window.FB.getLoginStatus(handleFacebookResponse);
      button.addEventListener('click', () => {
        window.FB.login(handleFacebookResponse, { scope: 'email' });
      });
    }

    if (window.FB) return onSdkReady();
    window.fbAsyncInit = onSdkReady;
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/fr_FR/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }

  (async function initSocialAuth() {
    try {
      const config = await window.apiCall(window.API_CONFIG.endpoints.socialConfig);
      if (!config.google && !config.facebook) return;
      document.getElementById('social-auth').hidden = false;
      if (config.google) initGoogleSignIn(config.google.clientId);
      if (config.facebook) initFacebookSignIn(config.facebook.appId);
    } catch (error) {
      // Pas de connexion sociale possible pour l'instant: les formulaires classiques restent utilisables.
      console.warn('Connexion sociale indisponible:', error.message);
    }
  }());
}());