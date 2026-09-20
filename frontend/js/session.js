/* ============================================
   SESSION MANAGEMENT
   ============================================ */

(function initSessionManager() {
  const STORAGE_USER_KEY = 'ElRinconAzul_current_user';
  const STORAGE_EMAIL_KEY = 'userEmail';
  const STORAGE_PREMIUM_KEY = 'premiumLogged';
  const STORAGE_NORMAL_KEY = 'normalLogged';

  class SessionManager {
    constructor() {
      this.user = this.readStoredUser();
      this.render();
      this.bindEvents();
      this.hydrate();
    }

    getApiBaseCandidates() {
      return window.ApiConfig ? window.ApiConfig.getBaseCandidates() : [''];
    }

    buildApiUrl(base, path) {
      return window.ApiConfig ? window.ApiConfig.buildUrl(base, path) : (base ? `${base}${path}` : path);
    }

    normalizeUser(rawUser) {
      if (!rawUser || typeof rawUser !== 'object') return null;

      return {
        id: Number(rawUser.id),
        name: String(rawUser.name || 'Cliente').trim() || 'Cliente',
        email: String(rawUser.email || '').trim().toLowerCase(),
        role: String(rawUser.role || 'user').trim().toLowerCase(),
        isPremium: Boolean(rawUser.isPremium),
      };
    }

    readStoredUser() {
      try {
        const raw = localStorage.getItem(STORAGE_USER_KEY);
        if (!raw) return null;
        return this.normalizeUser(JSON.parse(raw));
      } catch (_error) {
        return null;
      }
    }

    persistUser(user) {
      const normalizedUser = this.normalizeUser(user);
      this.user = normalizedUser;

      try {
        if (!normalizedUser) {
          localStorage.removeItem(STORAGE_USER_KEY);
          localStorage.removeItem(STORAGE_EMAIL_KEY);
          localStorage.removeItem(STORAGE_PREMIUM_KEY);
          localStorage.removeItem(STORAGE_NORMAL_KEY);
          return;
        }

        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(normalizedUser));
        if (normalizedUser.email) localStorage.setItem(STORAGE_EMAIL_KEY, normalizedUser.email);
        localStorage.setItem(STORAGE_PREMIUM_KEY, this.isPremiumUser() ? 'true' : 'false');
        localStorage.setItem(STORAGE_NORMAL_KEY, this.isPremiumUser() ? 'false' : 'true');
      } catch (_error) {
        // Ignore storage errors.
      }
    }

    getAuthToken() {
      // Token storage removed: rely on HttpOnly cookie + server-side session
      return '';
    }

    setAuthToken(token) {
      // No-op: do not persist tokens in localStorage. Server should use HttpOnly cookies.
    }

    isAuthenticated() {
      return Boolean(this.user && this.user.id);
    }

    isPremiumUser() {
      return Boolean(this.user && (this.user.isPremium || this.user.role === 'admin'));
    }

    getCurrentUser() {
      return this.user ? { ...this.user } : null;
    }

    async fetchCurrentUser() {
      for (const base of this.getApiBaseCandidates()) {
        try {
          const response = await fetch(this.buildApiUrl(base, '/api/v1/me'), {
            credentials: 'include',
          });

          if (response.status === 401) {
            continue;
          }

          if (!response.ok) continue;

          const data = await response.json();
          if (data && data.user) return { user: data.user };
        } catch (_error) {
          // Try next API base.
        }
      }

      return { unauthorized: true };
    }

    async hydrate() {
      const result = await this.fetchCurrentUser();
      if (result.user) {
        this.persistUser(result.user);
      } else {
        this.clearSession({ emit: false });
      }

      this.render();
      this.emitSessionChange();
    }

    async handleAuthSuccess(user) {
      // Server sets HttpOnly cookie; client persists minimal public user info only.
      this.persistUser(user);
      this.render();
      this.emitSessionChange();
    }

    clearSession({ emit = true } = {}) {
      this.user = null;
      this.persistUser(null);
      this.render();
      if (emit) this.emitSessionChange();
    }

    async logout() {
      // Call server to clear HttpOnly auth cookie
      try {
        const bases = this.getApiBaseCandidates();
        for (const base of bases) {
          try {
            await fetch(this.buildApiUrl(base, '/api/v1/auth/logout'), {
              method: 'POST',
              credentials: 'include',
            });
            break;
          } catch (_e) { /* try next */ }
        }
      } catch (_error) { /* non-fatal */ }

      this.clearSession({ emit: true });
      document.body.style.overflow = '';
    }

    resolveCartCount() {
      if (window.cartManager && typeof window.cartManager.getItemCount === 'function') {
        return window.cartManager.getItemCount();
      }

      try {
        const cart = JSON.parse(localStorage.getItem('aurora_cart') || '[]');
        return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
      } catch (_error) {
        return 0;
      }
    }

    updateCartSummary(count = this.resolveCartCount()) {
      const label = `Carrito: ${count} producto${count === 1 ? '' : 's'}`;
      document.querySelectorAll('[data-auth-cart]').forEach((element) => {
        element.textContent = label;
      });
    }

    emitSessionChange() {
      document.dispatchEvent(
        new CustomEvent('ElRinconAzul:session-changed', {
          detail: {
            authenticated: this.isAuthenticated(),
            isPremium: this.isPremiumUser(),
            user: this.getCurrentUser(),
          },
        })
      );
    }

    handlePremiumRequest() {
      const message = 'Tu cuenta ya inicio sesion. Para activar Premium, contacta a soporte.';
      if (window.cartManager && typeof window.cartManager.showNotification === 'function') {
        window.cartManager.showNotification(message);
        return;
      }

      window.alert(message);
    }

    bindEvents() {
      document.addEventListener('ElRinconAzul:cart-updated', (event) => {
        const count = Number(event.detail && event.detail.count ? event.detail.count : 0);
        this.updateCartSummary(count);
      });

      document.addEventListener('click', (event) => {
        const logoutButton = event.target.closest('[data-auth-logout]');
        if (logoutButton) {
          event.preventDefault();
          this.logout();
          return;
        }

        const premiumButton = event.target.closest('[data-premium-cta]');
        if (!premiumButton) return;
        if (!this.isAuthenticated() || this.isPremiumUser()) return;
        if (premiumButton.classList.contains('premium-login')) return;

        event.preventDefault();
        this.handlePremiumRequest();
      });

      window.addEventListener('storage', (event) => {
        if (!event.key) return;
        if (![STORAGE_USER_KEY, STORAGE_PREMIUM_KEY, STORAGE_NORMAL_KEY].includes(event.key)) return;

        this.user = this.readStoredUser();
        this.render();
        this.emitSessionChange();
      });
    }

    renderPremiumCtas() {
      const authenticated = this.isAuthenticated();
      const isPremium = this.isPremiumUser();

      document.querySelectorAll('[data-premium-cta]').forEach((button) => {
        button.disabled = false;

        if (!authenticated) {
          button.textContent = 'Acceder como Premium';
          if (!button.classList.contains('premium-login')) button.classList.add('premium-login');
          return;
        }

        if (isPremium) {
          button.textContent = 'Premium activo';
          button.classList.remove('premium-login');
          button.disabled = true;
          return;
        }

        button.textContent = 'Hacerme Premium';
        button.classList.remove('premium-login');
      });

      document.querySelectorAll('[data-premium-upgrade]').forEach((button) => {
        button.hidden = !authenticated || isPremium;
      });
    }

    render() {
      const authenticated = this.isAuthenticated();
      const userName = authenticated ? this.user.name : 'Cliente';

      document.querySelectorAll('[data-auth-login]').forEach((element) => {
        element.hidden = authenticated;
      });

      document.querySelectorAll('[data-auth-panel]').forEach((element) => {
        element.hidden = !authenticated;
      });

      document.querySelectorAll('[data-auth-name]').forEach((element) => {
        element.textContent = userName;
      });

      this.updateCartSummary();
      this.renderPremiumCtas();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
  });
})();
