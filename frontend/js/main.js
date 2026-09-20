/* ============================================
   Ganesh FRONTEND APP
   ============================================ */

// Productos se cargan desde la API. Este array se usa solo como fallback vacío.
const APP_PRODUCTS = [];

const PRODUCTS_CACHE_KEY = 'ElRinconAzul_products_cache';

const PRODUCTS_SYNC_KEY = 'ElRinconAzul_products_updated_at';

const CATEGORY_LABELS = {
  skincare: 'Skincare',
  wellness: 'Wellness',
  home: 'Home',
  lifestyle: 'Lifestyle',
  streaming: 'Streaming',
  pescados: 'Pescados',
};

function safeCurrency(value) {
  if (typeof formatCurrency === 'function') return formatCurrency(value);
  return `S/ ${Number(value).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function validateImageUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/uploads\//.test(s)) return s; // allow local uploads path
  if (/^data:image\//i.test(s)) return s;
  // fallback to placeholder
  return 'https://via.placeholder.com/500x400?text=Product';
}

function safeLog(message, type = 'info') {
  if (typeof log === 'function') {
    log(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

function getProductBadgeClass(badge) {
  const normalized = String(badge || '').trim().toLowerCase();
  if (normalized === 'nuevo') return 'product-badge-nuevo';
  if (normalized === 'edicion') return 'product-badge-edicion';
  return '';
}

function normalizeBadgeLabel(badge) {
  const normalized = String(badge || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'nuevo') return 'Nuevo';
  if (normalized === 'edicion') return 'Edicion';
  return String(badge).trim();
}

function normalizeCategoryId(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatCategoryName(category) {
  const normalized = normalizeCategoryId(category);
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];

  return String(category || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

class ProductManager {
  constructor() {
    // Intentar cargar desde caché para evitar parpadeo
    const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (cached) {
      try {
        this.products = JSON.parse(cached);
      } catch (e) {
        this.products = APP_PRODUCTS.map((p) => ({ ...p }));
      }
    } else {
      this.products = APP_PRODUCTS.map((p) => ({ ...p }));
    }

    this.activeFilter = 'all';
    this.apiBase = '';
    this.isLoadingProducts = false;
    this.categories = [];
    this.apiCategories = [];
    this.init().catch(() => {
      safeLog('No se pudo inicializar la carga del catalogo o categorias desde API.', 'warning');
    });
  }

  getVisibleProducts() {
    if (this.activeFilter === 'all') return this.products;
    return this.products.filter((product) => normalizeCategoryId(product.category) === this.activeFilter);
  }

  getApiBaseCandidates() {
    return window.ApiConfig ? window.ApiConfig.getBaseCandidates() : [''];
  }

  buildApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return this.apiBase ? `${this.apiBase}${path}` : path;
  }

  normalizeProduct(rawProduct) {
    if (!rawProduct || typeof rawProduct !== 'object') return null;
    return {
      ...rawProduct,
      id: Number(rawProduct.id),
      price: Number(rawProduct.price || 0),
      stock: Number(rawProduct.stock || 0),
      isPremium: Boolean(rawProduct.isPremium),
      badge: normalizeBadgeLabel(rawProduct.badge),
    };
  }

  async loadProductsFromApi() {
    const bases = this.getApiBaseCandidates();

    for (const base of bases) {
      try {
        this.apiBase = base;
        const response = await fetch(this.buildApiUrl('/api/v1/products'), {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Error loading products');

        const data = await response.json();
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        return list.map((product) => this.normalizeProduct(product)).filter(Boolean);
      } catch (_error) {
        // Try with next API base.
      }
    }

    return null;
  }

  async loadCategoriesFromApi() {
    const bases = this.getApiBaseCandidates();
    for (const base of bases) {
      try {
        const response = await fetch(`${base}/api/v1/categories`, { credentials: 'include' });
        if (!response.ok) throw new Error('Error loading categories');
        const data = await response.json();
        return Array.isArray(data?.data) ? data.data : [];
      } catch (_error) {
        // next
      }
    }
    return [];
  }

  getCategoriesFromProducts() {
    const categoriesById = new Map();

    this.products.forEach((product) => {
      const id = normalizeCategoryId(product.category);
      if (!id || categoriesById.has(id)) return;
      categoriesById.set(id, {
        id,
        name: formatCategoryName(product.category),
      });
    });

    return Array.from(categoriesById.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  normalizeCategories(categories) {
    return categories
      .map((category) => {
        const rawId = category?.id || category?.name;
        const id = normalizeCategoryId(rawId);
        if (!id) return null;
        return {
          id,
          name: formatCategoryName(category?.name || rawId),
        };
      })
      .filter(Boolean);
  }

  updateCategories(apiCategories = []) {
    const categoriesById = new Map();

    this.normalizeCategories(apiCategories).forEach((category) => {
      categoriesById.set(category.id, category);
    });

    this.getCategoriesFromProducts().forEach((category) => {
      if (!categoriesById.has(category.id)) categoriesById.set(category.id, category);
    });

    this.categories = Array.from(categoriesById.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (this.activeFilter !== 'all' && !this.categories.some((category) => category.id === this.activeFilter)) {
      this.activeFilter = 'all';
    }
  }

  async refreshProductsFromApi({ silent = false } = {}) {
    if (this.isLoadingProducts) return;

    this.isLoadingProducts = true;
    try {
      const apiProducts = await this.loadProductsFromApi();
      if (!apiProducts) {
        if (!silent) safeLog('API no disponible. Se mantiene el catalogo local.', 'warning');
        return;
      }

      this.products = apiProducts;
      
      // Guardar en caché para la próxima carga
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(this.products));

      this.updateCategories(this.apiCategories);
      this.initFilters();
      this.renderProducts();
      if (!silent) safeLog(`Catalogo sincronizado desde API (${apiProducts.length} productos).`, 'success');
    } finally {
      this.isLoadingProducts = false;
    }
  }

  bindProductSync() {
    window.addEventListener('storage', (event) => {
      if (event.key !== PRODUCTS_SYNC_KEY) return;
      this.refreshProductsFromApi({ silent: true });
    });
  }

  renderProducts() {
    const container = document.getElementById('products-container');
    if (!container) return;

    const visibleProducts = this.getVisibleProducts();

    // Build DOM nodes safely to avoid XSS from product data
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    visibleProducts.forEach((product, index) => {
      const art = document.createElement('article');
      art.className = `product-card scroll-reveal ${product.isPremium ? 'product-card--premium' : ''}`;
      art.dataset.productId = String(product.id);
      art.style.setProperty('--reveal-delay', `${index * 0.06}s`);

      const imgWrap = document.createElement('div');
      imgWrap.className = 'product-image';
      if (product.badge) {
        const span = document.createElement('span');
        span.className = `product-badge-premium ${getProductBadgeClass(product.badge)}`;
        span.textContent = product.badge;
        imgWrap.appendChild(span);
      }
      if (product.isPremium) {
        const spanP = document.createElement('span');
        spanP.className = 'product-badge-premium';
        spanP.textContent = 'Premium';
        imgWrap.appendChild(spanP);
      }
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = String(product.name || '');
      img.src = validateImageUrl(product.image);
      imgWrap.appendChild(img);

      const content = document.createElement('div');
      content.className = 'product-content';
      const h3 = document.createElement('h3');
      h3.className = 'product-name';
      h3.textContent = product.name || '';
      const p = document.createElement('p');
      p.className = 'product-description';
      p.textContent = product.description || '';
      const priceWrap = document.createElement('div');
      priceWrap.className = 'product-price';
      const priceSpan = document.createElement('span');
      priceSpan.className = 'product-price-current';
      priceSpan.textContent = safeCurrency(product.price);
      priceWrap.appendChild(priceSpan);

      const actions = document.createElement('div');
      actions.className = 'product-actions';
      const btnAdd = document.createElement('button');
      btnAdd.className = 'btn-add-cart';
      btnAdd.dataset.productId = String(product.id);
      btnAdd.textContent = product.isPremium ? 'Solo Premium' : 'Anadir al carrito';
      btnAdd.addEventListener('click', () => { if (window.cartManager) window.cartManager.addToCart(product.id); });

      const aDetail = document.createElement('a');
      aDetail.className = 'btn-product-detail';
      aDetail.href = `product-detail.html?id=${encodeURIComponent(String(product.id))}`;
      aDetail.setAttribute('aria-label', `Ver detalle de ${product.name}`);
      aDetail.textContent = 'Detalle';

      const btnWish = document.createElement('button');
      btnWish.className = 'btn-wishlist';
      btnWish.dataset.wishlist = String(product.id);
      btnWish.title = 'Añadir a favoritos';
      btnWish.setAttribute('aria-label', `Añadir ${product.name} a favoritos`);
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.textContent = '♡';
      btnWish.appendChild(heart);

      actions.appendChild(btnAdd);
      actions.appendChild(aDetail);
      actions.appendChild(btnWish);

      content.appendChild(h3);
      content.appendChild(p);
      content.appendChild(priceWrap);
      content.appendChild(actions);

      art.appendChild(imgWrap);
      art.appendChild(content);
      frag.appendChild(art);
    });

    container.appendChild(frag);

    if (window.scrollAnimations && typeof window.scrollAnimations.observeElements === 'function') {
      window.scrollAnimations.observeElements();
    }

    safeLog(`Productos visibles: ${visibleProducts.length}`);
  }

  setFilter(filter) {
    this.activeFilter = filter;

    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
      btn.setAttribute('aria-pressed', btn.dataset.filter === filter ? 'true' : 'false');
    });

    this.renderProducts();
  }

  initFilters() {
    const filterToolbar = document.querySelector('.filter-toolbar');
    const dropdownMenu = document.querySelector('.nav__dropdown');

    if (filterToolbar) {
      filterToolbar.innerHTML = '';
      const allButton = document.createElement('button');
      allButton.className = 'filter-btn';
      allButton.dataset.filter = 'all';
      allButton.setAttribute('aria-pressed', this.activeFilter === 'all' ? 'true' : 'false');
      allButton.textContent = 'Todos';
      allButton.classList.toggle('active', this.activeFilter === 'all');
      allButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.setFilter('all');
      });
      filterToolbar.appendChild(allButton);

      this.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.filter = cat.id;
        btn.setAttribute('aria-pressed', this.activeFilter === cat.id ? 'true' : 'false');
        btn.textContent = cat.name;
        btn.classList.toggle('active', this.activeFilter === cat.id);
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          this.setFilter(cat.id);
        });
        filterToolbar.appendChild(btn);
      });
    }

    if (dropdownMenu) {
      dropdownMenu.innerHTML = '<li><a href="#productos" class="nav__dropdown-link" data-filter="all">Todos los Productos</a></li>';
      this.categories.forEach(cat => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#productos';
        link.className = 'nav__dropdown-link';
        link.dataset.filter = cat.id;
        link.textContent = cat.name;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.setFilter(cat.id);
          const productsSection = document.getElementById('productos');
          if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        li.appendChild(link);
        dropdownMenu.appendChild(li);
      });

      // Bind 'Todos' in dropdown
      dropdownMenu.querySelector('[data-filter="all"]').addEventListener('click', (event) => {
        event.preventDefault();
        this.setFilter('all');
        const productsSection = document.getElementById('productos');
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  async init() {
    this.apiCategories = await this.loadCategoriesFromApi();
    this.updateCategories(this.apiCategories);
    this.initFilters();
    this.bindProductSync();
    this.renderProducts();
    await this.refreshProductsFromApi();
  }
}

class Navigation {
  constructor() {
    this.menuToggle = document.querySelector('.menu-toggle');
    this.nav = document.querySelector('.nav');
    this.dropdownToggle = document.querySelector('.nav__item--dropdown > .nav__link');
    this.dropdownItem = document.querySelector('.nav__item--dropdown');
    this.hoverMediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.init();
  }

  isDesktopHoverMode() {
    return Boolean(this.hoverMediaQuery && this.hoverMediaQuery.matches);
  }

  setDropdownOpen(isOpen) {
    if (!this.dropdownItem) return;
    this.dropdownItem.classList.toggle('active', Boolean(isOpen));
    if (this.dropdownToggle) {
      this.dropdownToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }

  init() {
    if (this.menuToggle && this.nav) {
      this.menuToggle.addEventListener('click', () => {
        this.menuToggle.classList.toggle('open');
        this.nav.classList.toggle('open');
        this.menuToggle.setAttribute('aria-expanded', this.nav.classList.contains('open') ? 'true' : 'false');
      });
    }

    if (this.dropdownToggle && this.dropdownItem) {
      this.dropdownToggle.addEventListener('click', (event) => {
        if (!this.isDesktopHoverMode()) {
          event.preventDefault();
          const willOpen = !this.dropdownItem.classList.contains('active');
          this.setDropdownOpen(willOpen);
        } else {
          this.setDropdownOpen(false);
        }
      });

      this.dropdownItem.addEventListener('mouseenter', () => {
        if (this.isDesktopHoverMode()) this.setDropdownOpen(true);
      });

      this.dropdownItem.addEventListener('mouseleave', () => {
        if (this.isDesktopHoverMode()) this.setDropdownOpen(false);
      });

      document.addEventListener('click', (event) => {
        if (!this.dropdownItem.contains(event.target)) {
          this.setDropdownOpen(false);
        }
      });

      if (this.hoverMediaQuery && typeof this.hoverMediaQuery.addEventListener === 'function') {
        this.hoverMediaQuery.addEventListener('change', () => this.setDropdownOpen(false));
      }
    }
  }
}

class CTAHandler {
  init() {
    document.querySelectorAll('[data-action="scroll-products"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById('productos');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('[data-action="continue-shopping"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.cartManager) cartManager.closeSidebar();
        const productosSection = document.getElementById('productos');
        if (productosSection) {
          setTimeout(() => {
            productosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      });
    });

    document.querySelectorAll('[data-action="checkout"]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleCheckout());
    });
  }

  handleCheckout() {
    if (!window.cartManager) return;

    // Verificar si el usuario está autenticado
    const isAuthenticated = window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function'
      ? window.sessionManager.isAuthenticated()
      : false;

    if (!isAuthenticated) {
      if (window.cartManager && typeof window.cartManager.showNotification === 'function') {
        window.cartManager.showNotification('Por favor, inicia sesión para proceder al pago.');
      }
      if (window.premiumLogin && typeof window.premiumLogin.open === 'function') {
        window.premiumLogin.open();
      }
      return;
    }

    const cart = cartManager.getCart();
    if (!cart.length) {
      alert('Tu carrito esta vacio');
      return;
    }

    const total = cartManager.calculateTotal();
    const message = `Pedido listo:\n\nItems: ${cart.length}\nTotal: ${safeCurrency(total)}\n\nContinuar al checkout?`;

    if (window.confirm(message)) {
      alert('Pedido confirmado. Recibiras el detalle por correo.');
      cartManager.clearCart();
      cartManager.closeSidebar();
    }
  }
}

class ScrollAnimations {
  constructor() {
    this.observer = null;
    this.init();
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.scroll-reveal').forEach((el) => el.classList.add('visible'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    this.observeElements();
  }

  observeElements() {
    if (!this.observer) return;

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!el.classList.contains('visible')) {
        this.observer.observe(el);
      }
    });
  }
}

class PremiumLogin {
  constructor() {
    this.modal = document.getElementById('premium-login-modal');
    this.openButtons = Array.from(document.querySelectorAll('.premium-login'));
    this.signupLinks = Array.from(document.querySelectorAll('.open-signup'));
    if (!this.modal) return;

    this.overlay = this.modal.querySelector('.modal__overlay');
    this.closeBtn = this.modal.querySelector('.modal__close');
    this.form = this.modal.querySelector('#premium-login-form');
    this.messageEl = this.modal.querySelector('.modal__message');
    this.emailEl = this.modal.querySelector('#premium-email');
    this.passwordEl = this.modal.querySelector('#premium-password');

    this.bindEvents();
  }

  bindEvents() {
    this.openButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });
    });

    this.signupLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.close();
        if (window.signupModal && typeof window.signupModal.open === 'function') {
          window.signupModal.open();
        }
      });
    });

    if (this.overlay) this.overlay.addEventListener('click', () => this.close());
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

    if (this.form) {
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleSubmit();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });
  }

  open() {
    if (window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function' && window.sessionManager.isAuthenticated()) {
      return;
    }

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (this.messageEl) this.messageEl.textContent = '';
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async handleSubmit() {
    const email = this.emailEl ? this.emailEl.value.trim() : '';
    const password = this.passwordEl ? this.passwordEl.value : '';

    if (!email || !password) {
      this.showMessage('Completa email y password.', 'error');
      return;
    }

    const API_BASE = window.API_BASE || (window.location.port === '8000' ? (window.location.protocol + '//' + window.location.hostname + ':5000') : '');

    try {
      this.showMessage('Validando acceso...', 'success');
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        this.showMessage(data.message || 'Credenciales invalidas', 'error');
        return;
      }

      const isPremium = Boolean(data.user?.isPremium) || data.user?.role === 'admin';
      if (window.sessionManager && typeof window.sessionManager.handleAuthSuccess === 'function') {
        await window.sessionManager.handleAuthSuccess(data.user, data.token);
      } else {
        // Fallback: persist minimal flags
        localStorage.setItem('premiumLogged', isPremium ? 'true' : 'false');
        localStorage.setItem('normalLogged', isPremium ? 'false' : 'true');
        if (data.user?.email) {
          localStorage.setItem('userEmail', data.user.email);
        }
      }

      this.showMessage(isPremium ? 'Acceso premium concedido.' : 'Acceso de cliente activado.', 'success');
      setTimeout(() => this.close(), 650);
    } catch (error) {
      this.showMessage('No se pudo conectar con la API.', 'error');
    }
  }

  showMessage(text, type) {
    if (!this.messageEl) return;
    this.messageEl.textContent = text;
    this.messageEl.className = `modal__message ${type === 'error' ? 'error' : 'success'}`;
  }
}

class SignupModal {
  constructor() {
    this.modal = document.getElementById('signup-modal');
    if (!this.modal) return;

    this.overlay = this.modal.querySelector('.modal__overlay');
    this.closeBtn = this.modal.querySelector('.modal__close');
    this.backBtn = this.modal.querySelector('.modal__back');
    this.form = this.modal.querySelector('#signup-form');
    this.messageEl = this.modal.querySelector('.modal__message');
    this.nameEl = this.modal.querySelector('#signup-name');
    this.lastNameEl = this.modal.querySelector('#signup-last-name');
    this.phoneEl = this.modal.querySelector('#signup-phone');
    this.addressEl = this.modal.querySelector('#signup-address');
    this.emailEl = this.modal.querySelector('#signup-email');
    this.passwordEl = this.modal.querySelector('#signup-password');
    this.confirmPasswordEl = this.modal.querySelector('#signup-confirm-password');

    this.bindEvents();
  }

  bindEvents() {
    if (this.overlay) this.overlay.addEventListener('click', () => this.close());
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => {
        this.close();
        if (window.premiumLogin && typeof window.premiumLogin.open === 'function') {
          window.premiumLogin.open();
        }
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleSubmit();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });
  }

  open() {
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (this.messageEl) this.messageEl.textContent = '';
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async handleSubmit() {
    const name = this.nameEl ? this.nameEl.value.trim() : '';
    const last_name = this.lastNameEl ? this.lastNameEl.value.trim() : '';
    const phone = this.phoneEl ? this.phoneEl.value.trim() : '';
    const address = this.addressEl ? this.addressEl.value.trim() : '';
    const email = this.emailEl ? this.emailEl.value.trim() : '';
    const password = this.passwordEl ? this.passwordEl.value : '';
    const confirm = this.confirmPasswordEl ? this.confirmPasswordEl.value : '';

    if (!name || !last_name || !phone || !address || !email || !password || !confirm) {
      this.showMessage('Completa todos los campos obligatorios.', 'error');
      return;
    }

    if (password !== confirm) {
      this.showMessage('Las contraseñas no coinciden.', 'error');
      return;
    }

    const API_BASE = window.API_BASE || (window.location.port === '8000' ? (window.location.protocol + '//' + window.location.hostname + ':5000') : '');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, last_name, phone, address, email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        this.showMessage(data.message || 'No se pudo registrar la cuenta.', 'error');
        return;
      }

      if (window.sessionManager && typeof window.sessionManager.handleAuthSuccess === 'function') {
        await window.sessionManager.handleAuthSuccess(data.user, data.token);
      } else {
        localStorage.setItem('normalLogged', 'true');
        localStorage.setItem('premiumLogged', 'false');
        localStorage.setItem('userEmail', email);
      }
      this.showMessage('Cuenta creada correctamente. Sesion iniciada.', 'success');
      setTimeout(() => this.close(), 700);
    } catch (error) {
      this.showMessage('No se pudo conectar con la API.', 'error');
    }
  }

  showMessage(text, type) {
    if (!this.messageEl) return;
    this.messageEl.textContent = text;
    this.messageEl.className = `modal__message ${type === 'error' ? 'error' : 'success'}`;
  }
}

function setupWishlist() {
  const API = window.API_BASE || '';

  async function loadUserFavorites() {
    try {
      const response = await fetch(`${API}/api/v1/me/favorites`, {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      const favIds = new Set((data.data || []).map((p) => String(p.id)));

      document.querySelectorAll('.btn-wishlist').forEach((btn) => {
        const productId = btn.dataset.wishlist;
        const isFav = favIds.has(productId);
        btn.classList.toggle('active', isFav);
        const heart = btn.querySelector('.heart');
        if (heart) heart.textContent = isFav ? '♥' : '♡';
      });
    } catch {
      // Silently fail
    }
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.btn-wishlist');
    if (!button) return;

    event.preventDefault();
    const isAuth = window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function'
      ? window.sessionManager.isAuthenticated()
      : false;
    if (!isAuth) {
      if (window.premiumLogin) window.premiumLogin.open();
      return;
    }

    const productId = button.dataset.wishlist;
    const isActive = button.classList.contains('active');

    try {
      if (isActive) {
        await fetch(`${API}/api/v1/me/favorites/${productId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        button.classList.remove('active');
        const heart = button.querySelector('.heart');
        if (heart) heart.textContent = '♡';
      } else {
        await fetch(`${API}/api/v1/me/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ productId: Number(productId) }),
        });
        button.classList.add('active');
        const heart = button.querySelector('.heart');
        if (heart) heart.textContent = '♥';
      }
    } catch {
      // Silently fail
    }
  });

  // Load favorites state after products render
  document.addEventListener('ElRinconAzul:session-changed', () => {
    setTimeout(loadUserFavorites, 500);
  });

  // Also try to load on initial render
  setTimeout(loadUserFavorites, 1000);
}

let productManager;
let navigation;
let ctaHandler;
let scrollAnimations;
let premiumLogin;
let signupModal;

document.addEventListener('DOMContentLoaded', () => {
  productManager = new ProductManager();
  navigation = new Navigation();
  ctaHandler = new CTAHandler();
  ctaHandler.init();
  scrollAnimations = new ScrollAnimations();
  premiumLogin = new PremiumLogin();
  signupModal = new SignupModal();
  setupWishlist();

  window.productManager = productManager;
  window.navigation = navigation;
  window.scrollAnimations = scrollAnimations;
  window.premiumLogin = premiumLogin;
  window.signupModal = signupModal;

  // Control de transparencia del header al hacer scroll
  const header = document.querySelector('.header');
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Ejecutar al inicio por si ya hay scroll
  }

  safeLog('Frontend inicializado correctamente', 'success');
});
