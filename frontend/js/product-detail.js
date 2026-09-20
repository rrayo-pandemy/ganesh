/**
 * PRODUCT DETAIL PAGE - JavaScript
 * Handles product detail, recommendations, cart actions, and admin editing.
 */

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

class ProductDetailManager {
    constructor() {
        this.productId = this.getProductIdFromURL();
        this.products = [];
        this.currentProduct = null;
        this.reviews = [];
        this.quantity = 1;
        this.apiBase = '';
        this.apiAvailable = false;
        this.isAdminSession = this.hasAdminRole();
        this.isUserAuthenticated = this.isAuthenticated();
        this.init();
    }

    getProductIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('id'), 10) || 1;
    }

    getApiBaseCandidates() {
        return window.ApiConfig ? window.ApiConfig.getBaseCandidates() : ['', 'http://localhost:5000', 'http://localhost:3000'];
    }

    buildApiUrl(path) {
        if (/^https?:\/\//i.test(path)) return path;
        return this.apiBase ? `${this.apiBase}${path}` : path;
    }

    getAuthToken() {
        return '';
    }

    getAuthHeaders() {
        return {};
    }

    decodeJwtPayload(token) {
        try {
            const payloadBase64 = token.split('.')[1];
            if (!payloadBase64) return null;

            const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
            const jsonText = atob(padded);
            return JSON.parse(jsonText);
        } catch (_error) {
            return null;
        }
    }

    isAuthenticated() {
        return window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function'
            ? window.sessionManager.isAuthenticated()
            : false;
    }

    getUserInfo() {
        // Intentar obtener datos del sessionManager global primero
        if (window.sessionManager && typeof window.sessionManager.getCurrentUser === 'function') {
            const user = window.sessionManager.getCurrentUser();
            if (user) return { id: user.id, name: user.name, email: user.email };
        }

        // Fallback a localStorage si el sessionManager no está listo
        try {
            const storedUser = JSON.parse(localStorage.getItem('ElRinconAzul_current_user') || 'null');
            if (storedUser) return { id: storedUser.id, name: storedUser.name, email: storedUser.email };
        } catch (e) {}

        const token = this.getAuthToken();
        if (!token) return { name: 'Invitado' };
        
        return {
            id: 0,
            name: localStorage.getItem('userEmail')?.split('@')[0] || 'Usuario',
            email: localStorage.getItem('userEmail') || ''
        };
    }

    hasAdminRole() {
        const token = this.getAuthToken();
        if (!token) return false;

        const payload = this.decodeJwtPayload(token);
        return payload && payload.role === 'admin';
    }

    async init() {
        try {
            await this.loadProducts();
            await this.detectAdminSession();
            this.loadProductDetail();
            this.loadReviews();
            this.setupEventListeners();
            this.setupReviewForm();
        } catch (error) {
            console.error('Error initializing ProductDetailManager:', error);
        }
    }

    async loadProducts() {
        const bases = this.getApiBaseCandidates();

        for (const base of bases) {
            try {
                this.apiBase = base;
                const response = await fetch(this.buildApiUrl('/api/v1/products'), {
                    credentials: 'include',
                });
                if (!response.ok) throw new Error('Failed loading products');

                const data = await response.json();
                this.products = data.data || data;
                this.apiAvailable = true;
                return;
            } catch (_error) {
                this.apiAvailable = false;
            }
        }

        console.warn('API unavailable, using mock product data');
        this.products = this.getMockProducts();
        this.apiAvailable = false;
        this.apiBase = '';
    }

    async detectAdminSession() {
        if (window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function' && window.sessionManager.isAuthenticated()) {
            const user = window.sessionManager.getCurrentUser();
            if (user && user.role === 'admin') {
                this.isAdminSession = true;
                return true;
            }
        }

        const bases = this.getApiBaseCandidates();
        for (const base of bases) {
            try {
                const meUrl = base ? `${base}/api/v1/me` : '/api/v1/me';
                const response = await fetch(meUrl, {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!response.ok) continue;
                const data = await response.json();
                if (data && data.user && data.user.role === 'admin') {
                    this.isAdminSession = true;
                    this.apiBase = base;
                    return true;
                }
            } catch (_error) {
                // Keep trying with next base candidate.
            }
        }

        this.isAdminSession = false;
        return false;
    }

    getMockProducts() {
        // Intentar usar el caché global si existe
        try {
            const cached = localStorage.getItem('ElRinconAzul_products_cache');
            if (cached) {
                const list = JSON.parse(cached);
                if (Array.isArray(list) && list.length > 0) return list;
            }
        } catch (e) {}

        // Productos se cargan desde la API. Array vacío como fallback.
        return [];
    }

    loadProductDetail() {
        this.currentProduct = this.products.find((p) => p.id === this.productId);

        if (!this.currentProduct) {
            document.querySelector('main').innerHTML = `
                <div class="error-message">
                    <h2>Producto no encontrado</h2>
                    <p>Lo sentimos, el producto que buscas no existe.</p>
                    <a href="index.html" class="btn btn--primary">Volver al catalogo</a>
                </div>
            `;
            return;
        }

        document.title = `${this.currentProduct.name} - Ganesh`;
        document.getElementById('breadcrumb-product').textContent = this.currentProduct.name;
        document.getElementById('main-image').src = this.currentProduct.image;
        document.getElementById('thumb-0').src = this.currentProduct.image;
        document.getElementById('product-name').textContent = this.currentProduct.name;
        document.getElementById('product-price').textContent = `S/. ${Number(this.currentProduct.price || 0).toFixed(2)}`;

        const description = this.currentProduct.detailedDescription || this.currentProduct.description || 'Sin descripcion disponible.';
        document.getElementById('product-description').textContent = description;

        const wishlistBtn = document.getElementById('btn-wishlist');
        if (wishlistBtn) {
            wishlistBtn.dataset.wishlist = this.productId;
            // Force wishlist re-evaluation from main.js
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('ElRinconAzul:session-changed'));
            }, 100);
        }

        this.renderRating(Number(this.currentProduct.rating || 4.5), Number(this.currentProduct.reviews || 0));
        this.renderStockStatus(Number(this.currentProduct.stock || 0));
        this.renderSpecs(this.currentProduct.specs);
        this.loadRecommendations();
        this.renderAdminEditor();

        console.log(`Product page loaded: ${this.currentProduct.name} (ID:${this.productId})`);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // REVIEWS MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════════

    async loadReviews() {
        try {
            const response = await fetch(this.buildApiUrl(`/api/v1/reviews/${this.productId}`));
            if (!response.ok) throw new Error('Error al cargar reseñas');
            
            const data = await response.json();
            this.reviews = data.data || [];
            this.renderReviews();
            this.updateRatingSummary();
        } catch (error) {
            console.error('Error loading reviews:', error);
            // Fallback a localStorage si el servidor falla (opcional, pero mejor centralizado)
            this.renderReviews();
        }
    }

    // Ya no usamos saveReviews() localmente, el servidor se encarga.
    saveReviews() {
        // Obsoleto: las reseñas ahora son centralizadas.
    }

    renderReviews() {
        const listContainer = document.getElementById('reviews-list');
        if (!listContainer) return;

        if (this.reviews.length === 0) {
            listContainer.innerHTML = '<p class="no-reviews">Aún no hay reseñas para este producto. ¡Sé el primero en calificarlo!</p>';
            return;
        }

        listContainer.innerHTML = this.reviews
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(review => `
                <div class="review-item" id="review-${review.id}">
                    <div class="review-meta">
                        <div class="review-author">
                            <span class="review-user">${escapeHtml(review.userName)}</span>
                            ${review.userRole === 'admin' ? '<span class="admin-badge">Moderador</span>' : ''}
                        </div>
                        <span class="review-date">${new Date(review.date).toLocaleDateString()}</span>
                    </div>
                    <div class="review-stars stars">
                        ${this.generateStarsHTML(review.rating)}
                    </div>
                    <p class="review-comment">${escapeHtml(review.comment)}</p>
                    ${this.isAdminSession ? `
                        <div class="admin-review-actions">
                            <button class="btn-delete-review" onclick="productDetail.deleteReview(${review.id})">
                                <span class="icon">🗑</span> Eliminar Comentario
                            </button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
    }

    generateStarsHTML(rating, total = 5) {
        let html = '';
        for (let i = 1; i <= total; i++) {
            html += i <= Math.round(rating) ? '<span class="star active">★</span>' : '<span class="star">☆</span>';
        }
        return html;
    }

    updateRatingSummary() {
        const avgStarsContainer = document.getElementById('avg-rating-stars');
        const avgValueEl = document.getElementById('avg-rating-value');
        const countEl = document.getElementById('total-reviews-count');
        const mainRatingStars = document.getElementById('product-rating');
        const mainRatingText = document.getElementById('rating-text');

        if (this.reviews.length === 0) {
            const emptyStars = this.generateStarsHTML(0);
            if (avgStarsContainer) avgStarsContainer.innerHTML = emptyStars;
            if (avgValueEl) avgValueEl.textContent = '0.0';
            if (countEl) countEl.textContent = '(0 reseñas)';
            if (mainRatingStars) mainRatingStars.innerHTML = emptyStars;
            if (mainRatingText) mainRatingText.textContent = '(0 reseñas)';
            return;
        }

        const totalRating = this.reviews.reduce((acc, rev) => acc + rev.rating, 0);
        const avgRating = totalRating / this.reviews.length;

        const starsHTML = this.generateStarsHTML(avgRating);
        
        if (avgStarsContainer) avgStarsContainer.innerHTML = starsHTML;
        if (avgValueEl) avgValueEl.textContent = avgRating.toFixed(1);
        if (countEl) countEl.textContent = `(${this.reviews.length} reseñas)`;
        
        if (mainRatingStars) mainRatingStars.innerHTML = starsHTML;
        if (mainRatingText) mainRatingText.textContent = `${avgRating.toFixed(1)} (${this.reviews.length} reseñas)`;
    }

    setupReviewForm() {
        const authContainer = document.getElementById('review-form-auth');
        const guestContainer = document.getElementById('review-form-guest');
        const form = document.getElementById('review-form');

        // Usar el SessionManager global si está disponible, de lo contrario usar localStorage directamente
        let authenticated = false;
        if (window.sessionManager && typeof window.sessionManager.isAuthenticated === 'function') {
            authenticated = window.sessionManager.isAuthenticated();
        } else {
            authenticated = this.isAuthenticated();
        }

        if (authContainer) authContainer.hidden = !authenticated;
        if (guestContainer) guestContainer.hidden = authenticated;

        if (form && !form.dataset.bound) {
            form.addEventListener('submit', (e) => this.handleReviewSubmit(e));
            form.dataset.bound = 'true';
        }
    }

    async handleReviewSubmit(e) {
        e.preventDefault();
        const statusEl = document.getElementById('review-form-status');
        const form = e.target;
        const rating = parseInt(form.querySelector('input[name="rating"]:checked')?.value || 0);
        const comment = document.getElementById('review-comment').value.trim();

        if (rating === 0 || !comment) {
            this.setReviewStatus('Por favor selecciona una calificación y escribe un comentario.', 'error');
            return;
        }

        const userInfo = this.getUserInfo();
        
        const newReview = {
            id: Date.now(),
            userId: userInfo.id,
            userName: userInfo.name,
            rating: rating,
            comment: comment,
            date: new Date().toISOString()
        };

        this.setReviewStatus('Publicando...', '');
        
        try {
            const response = await fetch(this.buildApiUrl('/api/v1/reviews'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({
                    productId: this.productId,
                    rating: rating,
                    comment: comment
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al publicar reseña');

            this.reviews.push(data.data);
            this.renderReviews();
            this.updateRatingSummary();
            
            form.reset();
            this.setReviewStatus('¡Gracias por tu reseña!', 'success');
            
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 3000);
        } catch (error) {
            this.setReviewStatus(error.message, 'error');
        }
    }

    async deleteReview(reviewId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

        try {
            const response = await fetch(this.buildApiUrl(`/api/v1/reviews/${reviewId}`), {
                method: 'DELETE',
                headers: {
                    ...this.getAuthHeaders()
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Error al eliminar');
            }

            // Eliminar del array local y re-renderizar
            this.reviews = this.reviews.filter(r => r.id !== reviewId);
            this.renderReviews();
            this.updateRatingSummary();
            
            console.log(`Review ${reviewId} deleted by admin`);
        } catch (error) {
            alert('Error al eliminar la reseña: ' + error.message);
        }
    }

    setReviewStatus(message, type = '') {
        const statusEl = document.getElementById('review-form-status');
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `form-status ${type}`;
    }

    renderRating(rating, reviews) {
        const ratingEl = document.getElementById('product-rating');
        if (!ratingEl) return;

        const roundedStars = Math.round(Math.max(0, Math.min(5, rating)));
        let starsHTML = '';

        for (let i = 0; i < 5; i++) {
            starsHTML += i < roundedStars ? '<span class="star active">★</span>' : '<span class="star">☆</span>';
        }

        ratingEl.innerHTML = starsHTML;
        document.getElementById('rating-text').textContent = `${rating.toFixed(1)} (${reviews} reseñas)`;
    }

    renderStockStatus(stock) {
        const statusEl = document.getElementById('stock-status');
        const countEl = document.getElementById('stock-count');
        if (!statusEl || !countEl) return;

        statusEl.classList.remove('in-stock', 'low-stock', 'out-of-stock');

        if (stock > 10) {
            statusEl.classList.add('in-stock');
            countEl.textContent = `${stock} unidades disponibles`;
        } else if (stock > 0) {
            statusEl.classList.add('low-stock');
            countEl.textContent = `${stock} unidades (compra pronta recomendada)`;
        } else {
            statusEl.classList.add('out-of-stock');
            countEl.textContent = 'Agotado';
        }
    }

    renderSpecs(specs) {
        const specsEl = document.getElementById('product-specs');
        if (!specsEl) return;

        const normalizedSpecs = Array.isArray(specs) && specs.length > 0
            ? specs
            : [
                `Categoria: ${this.currentProduct.category || 'general'}`,
                `SKU: ${this.currentProduct.sku || 'N/A'}`,
            ];

        specsEl.innerHTML = normalizedSpecs.map((spec) => `<li>${escapeHtml(spec)}</li>`).join('');
    }

    loadRecommendations() {
        const recommendations = this.products
            .filter((p) => p.category === this.currentProduct.category && p.id !== this.currentProduct.id)
            .slice(0, 3);

        const grid = document.getElementById('recommendations-grid');
        if (!grid) return;

        grid.innerHTML = recommendations
            .map((product) => `
                <a href="product-detail.html?id=${product.id}" class="product-card scroll-reveal" style="text-decoration: none; color: inherit;">
                    <div class="product-image">
                        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                    </div>
                    <div class="product-content">
                        <h3 class="product-name">${escapeHtml(product.name)}</h3>
                        <p class="product-description">${escapeHtml(product.description || '')}</p>
                        <div class="product-price">
                            <span class="product-price-current">S/. ${Number(product.price || 0).toFixed(2)}</span>
                        </div>
                        <div class="product-actions">
                            <button class="btn-add-cart" onclick="event.preventDefault(); productDetail.addToCartFromCard(${product.id})">Añadir</button>
                        </div>
                    </div>
                </a>
            `)
            .join('');
    }

    setupEventListeners() {
        const qtyMinus = document.getElementById('qty-minus');
        const qtyPlus = document.getElementById('qty-plus');
        const qtyInput = document.getElementById('quantity');
        const addCartBtn = document.getElementById('btn-add-cart');
        const wishlistBtn = document.getElementById('btn-wishlist');

        if (qtyMinus) qtyMinus.addEventListener('click', () => this.changeQuantity(-1));
        if (qtyPlus) qtyPlus.addEventListener('click', () => this.changeQuantity(1));

        if (qtyInput) {
            qtyInput.addEventListener('change', (event) => {
                this.quantity = Math.max(1, parseInt(event.target.value, 10) || 1);
                qtyInput.value = this.quantity;
            });
        }

        if (addCartBtn) addCartBtn.addEventListener('click', () => this.addToCart());

        // Escuchar cambios de sesión para desbloquear el formulario de reseñas dinámicamente
        document.addEventListener('ElRinconAzul:session-changed', () => {
            this.setupReviewForm();
        });
    }

    changeQuantity(change) {
        this.quantity = Math.max(1, this.quantity + change);
        const input = document.getElementById('quantity');
        if (input) input.value = this.quantity;
    }

    addToCart() {
        const qtyInput = document.getElementById('quantity');
        if (qtyInput) {
            this.quantity = parseInt(qtyInput.value, 10) || 1;
        }

        const manager = window.cartManager;
        
        if (!manager) {
            console.error('CartManager unavailable');
            return;
        }

        if (!this.currentProduct) {
            console.error('No product loaded');
            return;
        }

        // Add to cart N times based on quantity
        for (let i = 0; i < this.quantity; i++) {
            manager.addToCart(this.currentProduct.id);
        }

        const btn = document.getElementById('btn-add-cart');
        if (!btn) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Añadido al carrito';
        btn.style.background = 'var(--color-success, #2ecc71)';

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    }

    addToCartFromCard(productId) {
        if (!window.cartManager) return;
        cartManager.addToCart(productId);
    }




    renderAdminEditor() {
        const editor = document.getElementById('admin-product-editor');
        if (!editor) return;

        this.isAdminSession = this.isAdminSession || this.hasAdminRole();
        if (!this.isAdminSession) {
            editor.hidden = true;
            return;
        }

        editor.hidden = false;
        this.populateAdminEditor();

        const form = document.getElementById('admin-edit-form');
        if (form && !form.dataset.bound) {
            form.addEventListener('submit', (event) => this.handleAdminSave(event));
            form.dataset.bound = 'true';
        }

        if (!this.apiAvailable) {
            this.setAdminStatus('Sin conexion API. Inicia backend (puerto 5000 o 3000) para guardar cambios.', 'error');
        } else {
            this.setAdminStatus('Modo admin activo. Puedes editar y guardar el producto.', 'success');
        }
    }

    populateAdminEditor() {
        const product = this.currentProduct;
        if (!product) return;

        const description = product.detailedDescription || product.description || '';

        document.getElementById('admin-edit-name').value = product.name || '';
        document.getElementById('admin-edit-description').value = description;
        document.getElementById('admin-edit-price').value = Number(product.price || 0);
        document.getElementById('admin-edit-stock').value = Number(product.stock || 0);
        document.getElementById('admin-edit-category').value = product.category || '';
        document.getElementById('admin-edit-image').value = product.image || '';
    }

    buildAdminPayload() {
        const name = document.getElementById('admin-edit-name').value.trim();
        const description = document.getElementById('admin-edit-description').value.trim();
        const price = Number.parseFloat(document.getElementById('admin-edit-price').value);
        const stock = Number.parseInt(document.getElementById('admin-edit-stock').value, 10);
        const category = document.getElementById('admin-edit-category').value.trim();
        const image = document.getElementById('admin-edit-image').value.trim();

        return {
            name,
            description,
            detailedDescription: description,
            price: Number.isFinite(price) ? price : 0,
            stock: Number.isFinite(stock) ? stock : 0,
            category,
            image,
        };
    }

    setAdminStatus(message, type = '') {
        const statusEl = document.getElementById('admin-edit-status');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `admin-edit-status ${type}`.trim();
    }

    async handleAdminSave(event) {
        event.preventDefault();

        if (!this.isAdminSession) {
            this.setAdminStatus('Solo administradores pueden editar productos.', 'error');
            return;
        }

        const payload = this.buildAdminPayload();
        if (!payload.name || !payload.description || !payload.category) {
            this.setAdminStatus('Completa nombre, descripcion y categoria.', 'error');
            return;
        }

        this.setAdminStatus('Guardando cambios...', '');

        try {
            const response = await fetch(this.buildApiUrl(`/api/v1/products/${this.currentProduct.id}`), {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'No fue posible guardar el producto.');
            }

            const updatedProduct = data.data || {
                ...this.currentProduct,
                ...payload,
            };

            this.products = this.products.map((product) => (
                product.id === this.currentProduct.id ? { ...product, ...updatedProduct } : product
            ));

            this.currentProduct = { ...this.currentProduct, ...updatedProduct };
            this.loadProductDetail();
            this.setAdminStatus('Producto actualizado correctamente.', 'success');
        } catch (error) {
            this.setAdminStatus(error.message || 'Error guardando producto.', 'error');
        }
    }
}

let productDetail;
document.addEventListener('DOMContentLoaded', () => {
    if (window.themeManager && typeof window.themeManager.bindExistingToggles === 'function') {
        window.themeManager.bindExistingToggles();
    }

    productDetail = new ProductDetailManager();
    window.productDetail = productDetail;
});
