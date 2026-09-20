/* ============================================
   SHARED THEME MANAGER
   ============================================ */

(function initSharedThemeManager() {
  const STORAGE_KEY = 'theme';
  const DEFAULT_THEME = 'light';
  const VALID_THEMES = new Set(['light', 'dark']);
  const META_THEME_COLOR = {
    light: '#0b3c5d',
    dark: '#111821',
  };

  const MOON_ICON_PATH =
    '<path d="M21 12.79A9 9 0 0111.21 3c0 .34.02.67.05 1A7 7 0 1019 19.74c.33.03.66.05 1 .05z" fill="currentColor"/>';
  const SUN_ICON_PATH =
    '<circle cx="12" cy="12" r="5" fill="currentColor"/>' +
    '<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

  class ThemeManager {
    constructor() {
      this.currentTheme = this.resolveInitialTheme();
      this.pendingBodySync = false;
      this.observer = null;
      this.applyTheme(this.currentTheme, { persist: false, emit: false });
      this.bindExistingToggles();
      this.observeForNewToggles();
    }

    resolveInitialTheme() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (VALID_THEMES.has(stored)) return stored;
      } catch (error) {
        // Ignore storage read errors and fallback to default.
      }
      return DEFAULT_THEME;
    }

    normalizeTheme(theme) {
      return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
    }

    getToggleButtons() {
      return Array.from(document.querySelectorAll('.theme-toggle'));
    }

    bindExistingToggles() {
      this.getToggleButtons().forEach((button) => this.bindToggle(button));
      this.syncToggleState();
    }

    bindToggle(button) {
      if (!button || button.dataset.themeBound === 'true') return;

      button.dataset.themeBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.toggleTheme();
      });

      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.toggleTheme();
        }
      });
    }

    observeForNewToggles() {
      if (!('MutationObserver' in window)) return;

      this.observer = new MutationObserver((mutations) => {
        let hasNewToggle = false;

        for (const mutation of mutations) {
          for (const addedNode of mutation.addedNodes) {
            if (!(addedNode instanceof Element)) continue;
            if (addedNode.matches('.theme-toggle') || addedNode.querySelector('.theme-toggle')) {
              hasNewToggle = true;
              break;
            }
          }

          if (hasNewToggle) break;
        }

        if (hasNewToggle) {
          this.bindExistingToggles();
        }
      });

      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    syncBodyClass(theme) {
      if (document.body) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        return;
      }

      if (this.pendingBodySync) return;

      this.pendingBodySync = true;
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          this.pendingBodySync = false;
          document.body.classList.toggle('dark-theme', this.currentTheme === 'dark');
        },
        { once: true }
      );
    }

    updateMetaThemeColor(theme) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) return;
      meta.setAttribute('content', META_THEME_COLOR[theme] || META_THEME_COLOR.light);
    }

    syncToggleState() {
      this.getToggleButtons().forEach((button) => {
        this.bindToggle(button);
        button.setAttribute('aria-pressed', this.currentTheme === 'dark' ? 'true' : 'false');
        button.setAttribute('aria-label', this.currentTheme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro');
        button.setAttribute('data-theme-glyph', this.currentTheme === 'dark' ? '☀' : '☾');
        this.updateToggleIcon(button, this.currentTheme);
      });
    }

    updateToggleIcon(button, theme) {
      const icon = this.ensureIcon(button);
      if (!icon) return;

      icon.setAttribute('viewBox', '0 0 24 24');
      icon.innerHTML = theme === 'dark' ? SUN_ICON_PATH : MOON_ICON_PATH;
    }

    ensureIcon(button) {
      let icon = button.querySelector('svg');
      if (icon) return icon;

      icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('width', '20');
      icon.setAttribute('height', '20');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      button.appendChild(icon);
      return icon;
    }

    applyTheme(theme, options = {}) {
      const { persist = true, emit = true } = options;
      const normalizedTheme = this.normalizeTheme(theme);

      this.currentTheme = normalizedTheme;
      document.documentElement.setAttribute('data-theme', normalizedTheme);
      this.syncBodyClass(normalizedTheme);

      if (persist) {
        try {
          localStorage.setItem(STORAGE_KEY, normalizedTheme);
        } catch (error) {
          // Ignore storage write errors.
        }
      }

      this.updateMetaThemeColor(normalizedTheme);
      this.syncToggleState();

      if (emit) {
        document.dispatchEvent(
          new CustomEvent('theme:change', {
            detail: { theme: normalizedTheme },
          })
        );
      }
    }

    setTheme(theme) {
      this.applyTheme(theme);
    }

    toggleTheme() {
      this.applyTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
    }
  }

  if (window.themeManager && typeof window.themeManager.toggleTheme === 'function') {
    window.themeManager.bindExistingToggles();
    return;
  }

  window.ThemeManager = ThemeManager;
  window.themeManager = new ThemeManager();
})();
