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
    authenticate('/auth/register', registerForm);
  });
}());