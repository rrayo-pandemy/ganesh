/* ============================================
   SHOPPING CART MANAGEMENT
   ============================================ */

class ShoppingCart {
    constructor() {
        this.storageKey = 'aurora_cart';
        this.ownerKey = 'aurora_cart_owner';
        this.cart = this.loadCart();
        this.cartOwner = this.loadCartOwner();
        this.cartToggle = document.querySelector('.cart-toggle');
        this.cartSidebar = document.querySelector('.cart-sidebar');
        this.cartOverlay = document.querySelector('.cart-overlay');
        this.cartBadge = document.querySelector('.cart-badge');
        this.cartItemsContainer = document.querySelector('.cart-items');
        this.cartCloseBtn = document.querySelector('.cart-close');
        this.init();
    }

    hasSidebarUI() {
        return Boolean(this.cartSidebar || this.cartOverlay);
    }

    // Initialize cart functionality
    init() {
        this.setupEventListeners();
        this.updateCartUI();
        if (this.isAuthenticated()) {
            this.hydrateAuthenticatedCart();
        }
        log('Carrito inicializado');
    }

    setupEventListeners() {
        // Toggle cart sidebar
        if (this.cartToggle) {
            this.cartToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Close cart
        if (this.cartCloseBtn) {
            this.cartCloseBtn.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        if (this.cartOverlay) {
            this.cartOverlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
        });

        document.addEventListener('ElRinconAzul:session-changed', (event) => {
            const isAuthenticated = Boolean(event.detail && event.detail.authenticated);
            if (isAuthenticated) {
                this.hydrateAuthenticatedCart();
            } else {
                this.handleSessionLogout();
            }
        });
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    loadCartOwner() {
        try {
            return localStorage.getItem(this.ownerKey) || 'guest';
        } catch (error) {
            console.error('Error loading cart owner:', error);
            return 'guest';
        }
    }

    // Save cart to localStorage
    saveCart(owner = this.cartOwner || 'guest') {
        try {
            this.cartOwner = owner;
            localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
            localStorage.setItem(this.ownerKey, this.cartOwner);
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    getItemCount() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    emitCartUpdate() {
        document.dispatchEvent(
            new CustomEvent('ElRinconAzul:cart-updated', {
                detail: {
                    count: this.getItemCount(),
                    cart: this.getCart(),
                },
            })
        );
    }

    getApiBaseCandidates() {
        return window.ApiConfig ? window.ApiConfig.getBaseCandidates() : ['', 'http://localhost:5000', 'http://localhost:3000'];
    }

    buildApiUrl(base, path) {
        return window.ApiConfig ? window.ApiConfig.buildUrl(base, path) : (base ? `${base}${path}` : path);
    }

    getAuthToken() {
        try {
            return '';
        } catch (_error) {
            return '';
        }
    }

    getCurrentUserId() {
        if (window.sessionManager && typeof window.sessionManager.getCurrentUser === 'function') {
            const user = window.sessionManager.getCurrentUser();
            return user && user.id ? String(user.id) : '';
        }

        try {
            const raw = localStorage.getItem('ElRinconAzul_current_user');
            if (!raw) return '';
            const user = JSON.parse(raw);
            return user && user.id ? String(user.id) : '';
        } catch (_error) {
            return '';
        }
    }

    isAuthenticated() {
        return window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function'
            ? window.sessionManager.isAuthenticated()
            : Boolean(this.getCurrentUserId());
    }

    getAuthHeaders() {
        return {};
    }

    // Add item to cart
    addToCart(productId) {
        // Get product data from available source in current page
        const product = this.resolveProduct(productId);

        if (!product) {
            log('Producto no encontrado', 'error');
            this.showNotification('No se pudo añadir el producto al carrito');
            return;
        }

        // Check if it's a premium product and user is not premium logged in
        if (product.isPremium) {
            const isPremiumUser = localStorage.getItem('premiumLogged') === 'true';
            if (!isPremiumUser) {
                log('Acceso denegado: Solo usuarios Premium pueden comprar este producto', 'error');
                this.showPremiumModal(product);
                return;
            }
        }

        // Check if item already in cart
        const existingItem = this.cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image: product.image,
                isPremium: product.isPremium
            });
        }

        this.saveCart(this.isAuthenticated() ? this.getCurrentUserId() : 'guest');
        this.updateCartUI();
        if (this.isAuthenticated()) {
            this.addServerItem(product.id, 1);
        }
        this.showNotification(`${product.name} añadido al carrito`);
        log(`Producto ${product.name} añadido al carrito`);
    }

    resolveProduct(productId) {
        const normalizedId = Number(productId);
        if (!Number.isFinite(normalizedId)) return null;

        // Source 1: catalog manager (home page).
        if (window.productManager && Array.isArray(window.productManager.products)) {
            const productFromCatalog = window.productManager.products.find((p) => Number(p.id) === normalizedId);
            if (productFromCatalog) return this.normalizeProductData(productFromCatalog);
        }

        // Source 2: product detail manager (detail page).
        if (window.productDetail) {
            const current = window.productDetail.currentProduct;
            if (current && Number(current.id) === normalizedId) {
                return this.normalizeProductData(current);
            }

            if (Array.isArray(window.productDetail.products)) {
                const productFromDetailList = window.productDetail.products.find((p) => Number(p.id) === normalizedId);
                if (productFromDetailList) return this.normalizeProductData(productFromDetailList);
            }
        }

        return null;
    }

    normalizeProductData(rawProduct) {
        if (!rawProduct || typeof rawProduct !== 'object') return null;
        return {
            id: Number(rawProduct.id),
            name: String(rawProduct.name || 'Producto'),
            price: Number(rawProduct.price || 0),
            image: rawProduct.image || 'https://via.placeholder.com/80x80?text=Item',
            isPremium: Boolean(rawProduct.isPremium),
        };
    }

    async fetchWithAuth(path, options = {}) {
        for (const base of this.getApiBaseCandidates()) {
            try {
                const response = await fetch(this.buildApiUrl(base, path), {
                    ...options,
                    credentials: 'include',
                    headers: {
                        ...(options.headers || {}),
                    },
                });

                if (response.status === 401) return null;
                if (!response.ok) continue;
                return response;
            } catch (_error) {
                // Try next base candidate.
            }
        }

        return null;
    }

    async getCatalogProducts() {
        if (window.productManager && Array.isArray(window.productManager.products) && window.productManager.products.length) {
            return window.productManager.products;
        }

        if (window.productDetail && Array.isArray(window.productDetail.products) && window.productDetail.products.length) {
            return window.productDetail.products;
        }

        for (const base of this.getApiBaseCandidates()) {
            try {
                const response = await fetch(this.buildApiUrl(base, '/api/v1/products'));
                if (!response.ok) continue;

                const data = await response.json();
                const list = Array.isArray(data && data.data) ? data.data : Array.isArray(data) ? data : [];
                if (list.length) return list;
            } catch (_error) {
                // Try next base candidate.
            }
        }

        return [];
    }

    async mapServerCartToLocal(items) {
        const products = await this.getCatalogProducts();

        return (items || []).map((item) => {
            const productId = Number(item.productId);
            const product = products.find((entry) => Number(entry.id) === productId);

            if (product) {
                return {
                    id: productId,
                    name: product.name,
                    price: Number(product.price || 0),
                    quantity: Number(item.quantity || 0),
                    image: product.image || 'https://via.placeholder.com/80x80?text=Item',
                    isPremium: Boolean(product.isPremium),
                };
            }

            return {
                id: productId,
                name: `Producto ${productId}`,
                price: 0,
                quantity: Number(item.quantity || 0),
                image: 'https://via.placeholder.com/80x80?text=Item',
                isPremium: false,
            };
        }).filter((item) => item.quantity > 0);
    }

    async fetchServerCart() {
        const response = await this.fetchWithAuth('/api/v1/cart');
        if (!response) return null;

        const data = await response.json();
        return data && data.data ? data.data : null;
    }

    async addServerItem(productId, quantity) {
        await this.fetchWithAuth('/api/v1/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity }),
        });
    }

    async updateServerItem(productId, quantity) {
        await this.fetchWithAuth(`/api/v1/cart/items/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity }),
        });
    }

    async removeServerItem(productId) {
        await this.fetchWithAuth(`/api/v1/cart/items/${productId}`, {
            method: 'DELETE',
        });
    }

    async clearServerCart() {
        await this.fetchWithAuth('/api/v1/cart', {
            method: 'DELETE',
        });
    }

    async hydrateAuthenticatedCart() {
        if (!this.isAuthenticated()) return;

        const userId = this.getCurrentUserId();
        if (!userId) return;

        if (this.cartOwner === 'guest' && this.cart.length) {
            for (const item of this.cart) {
                await this.addServerItem(item.id, item.quantity);
            }
        }

        const serverCart = await this.fetchServerCart();
        if (!serverCart) return;

        this.cart = await this.mapServerCartToLocal(serverCart.items || []);
        this.saveCart(userId);
        this.updateCartUI();
    }

    async handleSessionLogout() {
        this.cart = [];
        this.saveCart('guest');
        this.updateCartUI();
    }

    // Remove item from cart
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart(this.isAuthenticated() ? this.getCurrentUserId() : 'guest');
        this.updateCartUI();
        if (this.isAuthenticated()) {
            this.removeServerItem(productId);
        }
        log('Producto removido del carrito');
    }

    // Update item quantity
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        const parsedQuantity = Number.parseInt(quantity, 10);

        if (item && Number.isFinite(parsedQuantity)) {
            if (parsedQuantity <= 0) {
                this.removeFromCart(productId);
            } else {
                item.quantity = parsedQuantity;
                this.saveCart(this.isAuthenticated() ? this.getCurrentUserId() : 'guest');
                this.updateCartUI();
                if (this.isAuthenticated()) {
                    this.updateServerItem(productId, parsedQuantity);
                }
                log(`Cantidad actualizada a ${parsedQuantity}`);
            }
        }
    }

    // Keep only digits while typing in the quantity input.
    handleQuantityInput(inputEl) {
        if (!inputEl) return;
        inputEl.value = String(inputEl.value || '').replace(/[^\d]/g, '');
    }

    // Commit quantity when the input loses focus or user presses Enter.
    commitQuantity(productId, inputEl) {
        const item = this.cart.find((entry) => entry.id === productId);
        if (!item || !inputEl) return;

        const parsed = Number.parseInt(inputEl.value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            inputEl.value = String(item.quantity);
            return;
        }

        this.updateQuantity(productId, parsed);
    }

    // Get complete cart
    getCart() {
        return this.cart;
    }

    // Clear entire cart
    clearCart() {
        this.cart = [];
        this.saveCart(this.isAuthenticated() ? this.getCurrentUserId() : 'guest');
        this.updateCartUI();
        if (this.isAuthenticated()) {
            this.clearServerCart();
        }
        log('Carrito vaciado');
    }

    // Calculate subtotal
    calculateSubtotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Calculate total (with shipping)
    calculateTotal() {
        const subtotal = this.calculateSubtotal();
        const shipping = subtotal > 200 ? 0 : 10; // Free shipping over S/. 200
        return subtotal + shipping;
    }

    // Update UI
    updateCartUI() {
        this.updateBadge();
        this.renderCartItems();
        this.updateCartSummary();
        this.emitCartUpdate();
    }

    // Update badge with item count
    updateBadge() {
        if (!this.cartBadge) return;

        const count = this.getItemCount();
        this.cartBadge.textContent = count;

        if (count > 0) {
            this.cartBadge.style.display = 'flex';
        } else {
            this.cartBadge.style.display = 'none';
        }
    }

    // Render cart items
    renderCartItems() {
        if (!this.cartItemsContainer) return;

        if (this.cart.length === 0) {
            this.cartItemsContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--color-text-light);">
                    <p style="font-size: 3rem; margin-bottom: 1rem;">🛒</p>
                    <p>Tu carrito está vacío</p>
                    <p style="font-size: 0.875rem;">Agrega productos para comenzar</p>
                </div>
            `;
            return;
        }
            // Build DOM nodes safely for each cart item
            this.cartItemsContainer.innerHTML = '';
            const frag = document.createDocumentFragment();
            this.cart.forEach((item) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'cart-item';

                const imgWrap = document.createElement('div');
                imgWrap.className = 'cart-item-image';
                // Use an <img> to avoid CSS url injection
                const img = document.createElement('img');
                img.alt = item.name || '';
                img.src = (item.image && (String(item.image).startsWith('http') || String(item.image).startsWith('/'))) ? item.image : 'https://via.placeholder.com/80x80?text=Img';
                img.style.width = '80px';
                img.style.height = '80px';
                img.style.objectFit = 'cover';
                imgWrap.appendChild(img);

                const detail = document.createElement('div');
                detail.className = 'cart-item-detail';

                const title = document.createElement('h4');
                title.textContent = item.name || '';

                const price = document.createElement('div');
                price.className = 'cart-item-price';
                price.textContent = formatCurrency(item.price);

                const actions = document.createElement('div');
                actions.className = 'cart-item-actions';

                const qtyControl = document.createElement('div');
                qtyControl.className = 'qty-control';

                const btnDec = document.createElement('button');
                btnDec.textContent = '−';
                btnDec.addEventListener('click', () => this.updateQuantity(item.id, Math.max(0, item.quantity - 1)));

                const input = document.createElement('input');
                input.type = 'text';
                input.inputMode = 'numeric';
                input.pattern = '[0-9]*';
                input.value = String(item.quantity);
                input.setAttribute('aria-label', `Cantidad de ${item.name}`);
                input.addEventListener('input', () => this.handleQuantityInput(input));
                input.addEventListener('blur', () => this.commitQuantity(item.id, input));
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        input.blur();
                    }
                });

                const btnInc = document.createElement('button');
                btnInc.textContent = '+';
                btnInc.addEventListener('click', () => this.updateQuantity(item.id, item.quantity + 1));

                qtyControl.appendChild(btnDec);
                qtyControl.appendChild(input);
                qtyControl.appendChild(btnInc);

                const btnRemove = document.createElement('button');
                btnRemove.title = 'Eliminar';
                btnRemove.style.background = 'none';
                btnRemove.style.color = 'var(--color-text-light)';
                btnRemove.style.fontSize = '1.2rem';
                btnRemove.style.cursor = 'pointer';
                btnRemove.textContent = '🗑️';
                btnRemove.addEventListener('click', () => this.removeFromCart(item.id));

                actions.appendChild(qtyControl);
                actions.appendChild(btnRemove);

                detail.appendChild(title);
                detail.appendChild(price);
                detail.appendChild(actions);

                wrapper.appendChild(imgWrap);
                wrapper.appendChild(detail);
                frag.appendChild(wrapper);
            });

            this.cartItemsContainer.appendChild(frag);
    }

    // Update cart summary
    updateCartSummary() {
        const subtotal = this.calculateSubtotal();
        const shipping = subtotal > 200 ? 0 : (subtotal === 0 ? 0 : 10);
        const total = subtotal + shipping;

        const subtotalEl = document.querySelector('.subtotal');
        const shippingEl = document.querySelector('.shipping');
        const totalEl = document.querySelector('.total-price');

        if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
        if (shippingEl) {
            if (shipping === 0 && subtotal > 0) {
                shippingEl.innerHTML = '<span style="color: var(--color-success);">¡GRATIS!</span>';
            } else {
                shippingEl.textContent = formatCurrency(shipping);
            }
        }
        if (totalEl) totalEl.textContent = formatCurrency(total);
    }

    // Toggle sidebar visibility
    toggleSidebar() {
        if (!this.hasSidebarUI()) {
            this.showNotification('El carrito lateral no está disponible en esta página.');
            return;
        }

        if (this.cartSidebar && this.cartSidebar.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    // Open sidebar
    openSidebar() {
        if (!this.hasSidebarUI()) return;

        if (this.cartSidebar) this.cartSidebar.classList.add('open');
        if (this.cartOverlay) this.cartOverlay.classList.add('open');
        if (this.cartToggle) this.cartToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    // Close sidebar
    closeSidebar() {
        if (this.cartSidebar) this.cartSidebar.classList.remove('open');
        if (this.cartOverlay) this.cartOverlay.classList.remove('open');
        if (this.cartToggle) this.cartToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    // Show notification (simple toast)
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--color-success);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 2000;
            animation: slideInUp 0.3s ease-out;
            max-width: 400px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto remove
        setTimeout(() => {
            notification.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Show Premium modal when user tries to buy premium product without premium access
    showPremiumModal(product) {
        const modal = document.getElementById('premium-upgrade-modal');
        if (!modal) return;

        const productName = modal.querySelector('.premium-modal-product-name');
        const upgradeBtn = modal.querySelector('[data-action="upgrade-premium"]');
        const closeBtn = modal.querySelector('.modal__close');
        const closeActionBtn = modal.querySelector('[data-modal-close]');
        const overlay = modal.querySelector('.modal__overlay');

        const closeModal = () => {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        if (productName) {
            productName.textContent = product.name;
        }

        // Open modal
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Close button handler
        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }

        // Secondary close button handler (data-modal-close)
        if (closeActionBtn) {
            closeActionBtn.onclick = closeModal;
        }

        // Upgrade button handler - opens premium login
        if (upgradeBtn) {
            upgradeBtn.onclick = () => {
                closeModal();
                // Trigger premium login modal
                const premiumLoginBtn = document.querySelector('.premium-login');
                if (premiumLoginBtn) {
                    premiumLoginBtn.click();
                }
            };
        }

        // Close on overlay click
        if (overlay) {
            overlay.onclick = closeModal;
        }
    }
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideOutDown {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(20px);
        }
    }
`;
document.head.appendChild(style);

/* ============================================
   GLOBAL CART INSTANCE
   ============================================ */

// Global instance
window.cartManager = null;
document.addEventListener('DOMContentLoaded', () => {
    window.cartManager = new ShoppingCart();
});
