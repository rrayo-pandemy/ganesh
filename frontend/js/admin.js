const API_BASE = window.API_BASE || 'http://localhost:5000';

const state = {
  token: '',
  currentUser: null,
  users: [],
  products: [],
  categories: [],
};

const els = {
  loginCard: document.getElementById('login-card'),
  adminPanel: document.getElementById('admin-panel'),
  loginForm: document.getElementById('admin-login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  logoutBtn: document.getElementById('logout-btn'),
  refreshUsers: document.getElementById('refresh-users'),
  usersTbody: document.getElementById('users-tbody'),
  createForm: document.getElementById('create-user-form'),
  createName: document.getElementById('create-name'),
  createLastName: document.getElementById('create-last-name'),
  createNickname: document.getElementById('create-nickname'),
  createEmail: document.getElementById('create-email'),
  createPhone: document.getElementById('create-phone'),
  createAddress: document.getElementById('create-address'),
  createAvatarUrl: document.getElementById('create-avatar-url'),
  createPassword: document.getElementById('create-password'),
  createRole: document.getElementById('create-role'),
  createPremium: document.getElementById('create-premium'),
  editForm: document.getElementById('edit-user-form'),
  editId: document.getElementById('edit-id'),
  editName: document.getElementById('edit-name'),
  editLastName: document.getElementById('edit-last-name'),
  editNickname: document.getElementById('edit-nickname'),
  editEmail: document.getElementById('edit-email'),
  editPhone: document.getElementById('edit-phone'),
  editAddress: document.getElementById('edit-address'),
  editAvatarUrl: document.getElementById('edit-avatar-url'),
  editPassword: document.getElementById('edit-password'),
  editRole: document.getElementById('edit-role'),
  editPremium: document.getElementById('edit-premium'),
  cancelEdit: document.getElementById('cancel-edit'),
  refreshProducts: document.getElementById('refresh-products'),
  createProductForm: document.getElementById('create-product-form'),
  createProductSku: document.getElementById('create-product-sku'),
  createProductName: document.getElementById('create-product-name'),
  createProductDescription: document.getElementById('create-product-description'),
  createProductCategory: document.getElementById('create-product-category'),
  createProductPrice: document.getElementById('create-product-price'),
  createProductStock: document.getElementById('create-product-stock'),
  createProductImage: document.getElementById('create-product-image'),
  createProductPremium: document.getElementById('create-product-premium'),
  createProductBadgeNuevo: document.getElementById('create-product-badge-nuevo'),
  createProductBadgeEdicion: document.getElementById('create-product-badge-edicion'),
  productsTbody: document.getElementById('products-tbody'),
  editProductForm: document.getElementById('edit-product-form'),
  productEditId: document.getElementById('product-edit-id'),
  productEditSku: document.getElementById('product-edit-sku'),
  productEditName: document.getElementById('product-edit-name'),
  productEditDescription: document.getElementById('product-edit-description'),
  productEditCategory: document.getElementById('product-edit-category'),
  productEditPrice: document.getElementById('product-edit-price'),
  productEditStock: document.getElementById('product-edit-stock'),
  productEditImage: document.getElementById('product-edit-image'),
  productEditPremium: document.getElementById('product-edit-premium'),
  productEditBadgeNuevo: document.getElementById('product-edit-badge-nuevo'),
  productEditBadgeEdicion: document.getElementById('product-edit-badge-edicion'),
  cancelProductEdit: document.getElementById('cancel-product-edit'),
  refreshCategories: document.getElementById('refresh-categories'),
  categoryForm: document.getElementById('category-form'),
  categoryFormTitle: document.getElementById('category-form-title'),
  categoryIdHidden: document.getElementById('category-id-hidden'),
  categoryId: document.getElementById('category-id'),
  categoryName: document.getElementById('category-name'),
  categorySubmit: document.getElementById('category-submit'),
  cancelCategoryEdit: document.getElementById('cancel-category-edit'),
  categoriesTbody: document.getElementById('categories-tbody'),
  toast: document.getElementById('toast'),
};

function removeUnexpectedProductDetailEditor() {
  const nodes = [
    document.getElementById('admin-product-editor'),
    document.getElementById('admin-edit-form'),
    document.getElementById('admin-edit-status'),
  ].filter(Boolean);

  nodes.forEach((node) => {
    if (node && typeof node.remove === 'function') {
      node.remove();
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function notify(message, isError = false) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.style.background = isError ? 'var(--danger)' : 'var(--toast-bg)';
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 2600);
}

async function api(path, options = {}, useAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Authentication is performed via HttpOnly cookie (credentials). Do not add Authorization header here.

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload.message || payload.error || 'Error de servidor';
    throw new Error(message);
  }

  return payload;
}

function setAuthenticatedUI(isAuthenticated) {
  if (els.loginCard) els.loginCard.classList.toggle('hidden', isAuthenticated);
  if (els.adminPanel) els.adminPanel.classList.toggle('hidden', !isAuthenticated);
  if (els.logoutBtn) {
    els.logoutBtn.classList.toggle('hidden', !isAuthenticated);
  }
}

function persistToken(token) {
  state.token = token || '';
}

async function loadDashboardData() {
  await Promise.all([loadUsers(), loadProducts(), loadCategories()]);
}

async function login(email, password) {
  const data = await api(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false
  );

  if (!data.user || data.user.role !== 'admin') {
    throw new Error('Este panel es solo para administradores');
  }

  // Server sets HttpOnly auth cookie. Persist minimal client state.
  persistToken('');
  state.currentUser = data.user;
  setAuthenticatedUI(true);
  notify('Sesion iniciada como admin');
  await loadDashboardData();
}

async function logout() {
  try {
    await api('/api/v1/auth/logout', { method: 'POST' }, false);
  } catch {
    // ignore
  }
  persistToken('');
  state.currentUser = null;
  setAuthenticatedUI(false);
  clearEditForm();
  clearCreateProductForm();
  clearProductEditForm();
  notify('Sesion cerrada');
}

async function bootstrapAuth() {
  try {
    const data = await api('/api/v1/me', {}, false);
    if (!data.user || data.user.role !== 'admin') {
      throw new Error('Sin permisos de admin');
    }
    state.currentUser = data.user;
    setAuthenticatedUI(true);
    await loadDashboardData();
  } catch {
    persistToken('');
    setAuthenticatedUI(false);
  }
}

function renderUsers() {
  if (!els.usersTbody) return;
  els.usersTbody.innerHTML = '';

  state.users.forEach((user) => {
    const tr = document.createElement('tr');
    const safeName = escapeHtml(user.name);
    const safeEmail = escapeHtml(user.email);
    const safeRole = escapeHtml(user.role);

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${safeName}</td>
      <td>${safeEmail}</td>
      <td>${safeRole}</td>
      <td><span class="badge ${user.isPremium ? 'premium' : 'normal'}">${user.isPremium ? 'Premium' : 'Normal'}</span></td>
      <td>${new Date(user.createdAt).toLocaleString()}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${user.id}">Editar</button>
          <button type="button" data-action="premium" data-id="${user.id}">${user.isPremium ? 'Quitar premium' : 'Hacer premium'}</button>
          <button type="button" class="delete" data-action="delete" data-id="${user.id}">Eliminar</button>
        </div>
      </td>
    `;

    els.usersTbody.appendChild(tr);
  });
}

async function loadUsers() {
  const data = await api('/api/v1/users');
  state.users = data.data || [];
  renderUsers();
}

function clearEditForm() {
  if (!els.editForm) return;
  els.editForm.classList.add('hidden');
  els.editId.value = '';
  els.editName.value = '';
  els.editLastName.value = '';
  els.editNickname.value = '';
  els.editEmail.value = '';
  els.editPhone.value = '';
  els.editAddress.value = '';
  els.editAvatarUrl.value = '';
  els.editPassword.value = '';
  els.editRole.value = 'user';
  els.editPremium.checked = false;
}

function normalizeProductBadge(badge) {
  const normalized = String(badge || '').trim().toLowerCase();
  if (normalized === 'nuevo') return 'nuevo';
  if (normalized === 'edicion') return 'edicion';
  return '';
}

function syncBadgeChecks(nuevoEl, edicionEl, activeBadge = '') {
  const normalized = normalizeProductBadge(activeBadge);
  if (nuevoEl) nuevoEl.checked = normalized === 'nuevo';
  if (edicionEl) edicionEl.checked = normalized === 'edicion';
}

function syncProductBadgeChecks(activeBadge = '') {
  syncBadgeChecks(els.productEditBadgeNuevo, els.productEditBadgeEdicion, activeBadge);
}

function syncCreateProductBadgeChecks(activeBadge = '') {
  syncBadgeChecks(els.createProductBadgeNuevo, els.createProductBadgeEdicion, activeBadge);
}

function getSelectedBadgeValue(nuevoEl, edicionEl) {
  if (nuevoEl && nuevoEl.checked) return 'Nuevo';
  if (edicionEl && edicionEl.checked) return 'Edicion';
  return null;
}

function getSelectedProductBadge() {
  return getSelectedBadgeValue(els.productEditBadgeNuevo, els.productEditBadgeEdicion);
}

function getSelectedCreateProductBadge() {
  return getSelectedBadgeValue(els.createProductBadgeNuevo, els.createProductBadgeEdicion);
}

function clearCreateProductForm() {
  if (!els.createProductForm) return;
  els.createProductForm.reset();
  syncCreateProductBadgeChecks('');
}

function attachExclusiveBadgeBehavior(primaryEl, secondaryEl) {
  if (!primaryEl) return;
  primaryEl.addEventListener('change', () => {
    if (primaryEl.checked && secondaryEl) {
      secondaryEl.checked = false;
    }
  });
}

function startEditUser(userId) {
  const user = state.users.find((u) => u.id === Number(userId));
  if (!user || !els.editForm) return;

  els.editId.value = String(user.id);
  els.editName.value = user.name;
  els.editLastName.value = user.last_name || '';
  els.editNickname.value = user.nickname || '';
  els.editEmail.value = user.email;
  els.editPhone.value = user.phone || '';
  els.editAddress.value = user.address || '';
  els.editAvatarUrl.value = user.avatar_url || '';
  els.editPassword.value = '';
  els.editRole.value = user.role;
  els.editPremium.checked = !!user.isPremium;
  els.editForm.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function createUser(event) {
  event.preventDefault();

  const payload = {
    name: els.createName.value.trim(),
    last_name: els.createLastName.value.trim(),
    nickname: els.createNickname.value.trim(),
    email: els.createEmail.value.trim(),
    phone: els.createPhone.value.trim(),
    address: els.createAddress.value.trim(),
    avatar_url: els.createAvatarUrl.value.trim(),
    password: els.createPassword.value,
    role: els.createRole.value,
    isPremium: els.createPremium.checked,
  };

  await api('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  event.target.reset();
  notify('Usuario creado');
  await loadUsers();
}

async function updateUser(event) {
  event.preventDefault();

  const id = Number(els.editId.value);
  const payload = {
    name: els.editName.value.trim(),
    last_name: els.editLastName.value.trim(),
    nickname: els.editNickname.value.trim(),
    email: els.editEmail.value.trim(),
    phone: els.editPhone.value.trim(),
    address: els.editAddress.value.trim(),
    avatar_url: els.editAvatarUrl.value.trim(),
    role: els.editRole.value,
    isPremium: els.editPremium.checked,
  };

  const newPassword = els.editPassword.value.trim();
  if (newPassword) {
    payload.password = newPassword;
  }

  await api(`/api/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  clearEditForm();
  notify('Usuario actualizado');
  await loadUsers();
}

async function togglePremium(userId) {
  const user = state.users.find((u) => u.id === Number(userId));
  if (!user) return;

  await api(`/api/v1/users/${user.id}/premium`, {
    method: 'PATCH',
    body: JSON.stringify({ isPremium: !user.isPremium }),
  });

  notify('Estado premium actualizado');
  await loadUsers();
}

async function deleteUser(userId) {
  const user = state.users.find((u) => u.id === Number(userId));
  if (!user) return;

  if (!window.confirm(`Eliminar a ${user.name}?`)) return;

  await api(`/api/v1/users/${user.id}`, { method: 'DELETE' });
  notify('Usuario eliminado');
  await loadUsers();
}

function renderProducts() {
  if (!els.productsTbody) return;
  els.productsTbody.innerHTML = '';

  state.products.forEach((product) => {
    const tr = document.createElement('tr');
    const categoryObj = state.categories.find(c => c.id === product.category);
    const categoryName = categoryObj ? categoryObj.name : (product.category || '');

    tr.innerHTML = `
      <td>${product.id}</td>
      <td>${escapeHtml(product.sku || '')}</td>
      <td>${escapeHtml(product.name || '')}</td>
      <td>${escapeHtml(categoryName)}</td>
      <td>S/. ${Number(product.price || 0).toFixed(2)}</td>
      <td>${Number(product.stock || 0)}</td>
      <td><span class="badge ${product.isPremium ? 'premium' : 'normal'}">${product.isPremium ? 'Premium' : 'Normal'}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit-product" data-id="${product.id}">Editar</button>
        </div>
      </td>
    `;
    els.productsTbody.appendChild(tr);
  });
}

function updateCategorySelects() {
  const selects = [els.createProductCategory, els.productEditCategory];
  selects.forEach(select => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Seleccione categoría...</option>';
    state.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
    select.value = currentValue;
  });
}

function renderCategories() {
  if (!els.categoriesTbody) return;
  els.categoriesTbody.innerHTML = '';

  state.categories.forEach((cat) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cat.id)}</td>
      <td>${escapeHtml(cat.name)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit-category" data-id="${cat.id}">Editar</button>
          <button type="button" class="delete" data-action="delete-category" data-id="${cat.id}">Eliminar</button>
        </div>
      </td>
    `;
    els.categoriesTbody.appendChild(tr);
  });

  updateCategorySelects();
}

async function loadCategories() {
  const data = await api('/api/v1/categories', {}, false);
  state.categories = data.data || [];
  renderCategories();
}

function clearCategoryForm() {
  if (!els.categoryForm) return;
  els.categoryForm.reset();
  els.categoryIdHidden.value = '';
  els.categoryId.disabled = false;
  els.categoryFormTitle.textContent = 'Crear Categoría';
  els.categorySubmit.textContent = 'Crear';
  els.cancelCategoryEdit.classList.add('hidden');
}

function startEditCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  els.categoryIdHidden.value = cat.id;
  els.categoryId.value = cat.id;
  els.categoryId.disabled = true;
  els.categoryName.value = cat.name;
  els.categoryFormTitle.textContent = 'Editar Categoría';
  els.categorySubmit.textContent = 'Guardar';
  els.cancelCategoryEdit.classList.remove('hidden');
  
  switchTab('categories');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveCategory(event) {
  event.preventDefault();
  const hiddenId = els.categoryIdHidden.value;
  const id = els.categoryId.value.trim();
  const name = els.categoryName.value.trim();

  if (hiddenId) {
    // Update
    await api(`/api/v1/categories/${hiddenId}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
    notify('Categoría actualizada');
  } else {
    // Create
    await api('/api/v1/categories', {
      method: 'POST',
      body: JSON.stringify({ id, name })
    });
    notify('Categoría creada');
  }

  clearCategoryForm();
  await loadCategories();
}

async function deleteCategory(catId) {
  if (!window.confirm(`¿Eliminar la categoría "${catId}"?`)) return;
  await api(`/api/v1/categories/${catId}`, { method: 'DELETE' });
  notify('Categoría eliminada');
  await loadCategories();
}

async function loadProducts() {
  const data = await api('/api/v1/products', {}, false);
  state.products = data.data || [];
  renderProducts();
}

async function createProduct(event) {
  event.preventDefault();

  const payload = {
    sku: els.createProductSku.value.trim() || undefined,
    name: els.createProductName.value.trim(),
    description: els.createProductDescription.value.trim(),
    category: els.createProductCategory.value.trim(),
    price: Number(els.createProductPrice.value),
    stock: Number(els.createProductStock.value),
    image: els.createProductImage.value.trim() || undefined,
    isPremium: els.createProductPremium.checked,
    badge: getSelectedCreateProductBadge(),
  };

  await api('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  clearCreateProductForm();
  notify('Producto agregado');
  try {
    localStorage.setItem('ElRinconAzul_products_updated_at', String(Date.now()));
  } catch {
    // ignore
  }
  await loadProducts();
}

function clearProductEditForm() {
  if (!els.editProductForm) return;
  els.editProductForm.classList.add('hidden');
  els.productEditId.value = '';
  els.productEditSku.value = '';
  els.productEditName.value = '';
  els.productEditDescription.value = '';
  els.productEditCategory.value = '';
  els.productEditPrice.value = '';
  els.productEditStock.value = '';
  els.productEditImage.value = '';
  els.productEditPremium.checked = false;
  syncProductBadgeChecks('');
}

function startEditProduct(productId) {
  const product = state.products.find((p) => p.id === Number(productId));
  if (!product || !els.editProductForm) return;

  els.productEditId.value = String(product.id);
  els.productEditSku.value = product.sku || '';
  els.productEditName.value = product.name || '';
  els.productEditDescription.value = product.description || '';
  els.productEditCategory.value = product.category || '';
  els.productEditPrice.value = Number(product.price || 0);
  els.productEditStock.value = Number(product.stock || 0);
  els.productEditImage.value = product.image || '';
  els.productEditPremium.checked = !!product.isPremium;
  syncProductBadgeChecks(product.badge);

  els.editProductForm.classList.remove('hidden');
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function updateProduct(event) {
  event.preventDefault();

  const id = Number(els.productEditId.value);
  const payload = {
    sku: els.productEditSku.value.trim(),
    name: els.productEditName.value.trim(),
    description: els.productEditDescription.value.trim(),
    category: els.productEditCategory.value.trim(),
    price: Number(els.productEditPrice.value),
    stock: Number(els.productEditStock.value),
    image: els.productEditImage.value.trim(),
    isPremium: els.productEditPremium.checked,
    badge: getSelectedProductBadge(),
  };

  await api(`/api/v1/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  clearProductEditForm();
  notify('Producto actualizado');
  try {
    localStorage.setItem('ElRinconAzul_products_updated_at', String(Date.now()));
  } catch {
    // ignore
  }
  await loadProducts();
}

function bindEvents() {
  if (els.loginForm) {
    els.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await login(els.loginEmail.value.trim(), els.loginPassword.value);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      await logout();
    });
  }

  if (els.refreshUsers) {
    els.refreshUsers.addEventListener('click', async () => {
      try {
        await loadUsers();
        notify('Usuarios actualizados');
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.refreshProducts) {
    els.refreshProducts.addEventListener('click', async () => {
      try {
        await loadProducts();
        notify('Productos actualizados');
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.createForm) {
    els.createForm.addEventListener('submit', async (event) => {
      try {
        await createUser(event);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.createProductForm) {
    els.createProductForm.addEventListener('submit', async (event) => {
      try {
        await createProduct(event);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.refreshCategories) {
    els.refreshCategories.addEventListener('click', async () => {
      try {
        await loadCategories();
        notify('Categorías actualizadas');
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.categoryForm) {
    els.categoryForm.addEventListener('submit', async (event) => {
      try {
        await saveCategory(event);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.cancelCategoryEdit) {
    els.cancelCategoryEdit.addEventListener('click', () => {
      clearCategoryForm();
    });
  }

  if (els.editForm) {
    els.editForm.addEventListener('submit', async (event) => {
      try {
        await updateUser(event);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.editProductForm) {
    els.editProductForm.addEventListener('submit', async (event) => {
      try {
        await updateProduct(event);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.cancelEdit) {
    els.cancelEdit.addEventListener('click', () => {
      clearEditForm();
    });
  }

  if (els.cancelProductEdit) {
    els.cancelProductEdit.addEventListener('click', () => {
      clearProductEditForm();
    });
  }

  attachExclusiveBadgeBehavior(els.productEditBadgeNuevo, els.productEditBadgeEdicion);
  attachExclusiveBadgeBehavior(els.productEditBadgeEdicion, els.productEditBadgeNuevo);
  attachExclusiveBadgeBehavior(els.createProductBadgeNuevo, els.createProductBadgeEdicion);
  attachExclusiveBadgeBehavior(els.createProductBadgeEdicion, els.createProductBadgeNuevo);

  if (els.usersTbody) {
    els.usersTbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const userId = Number(btn.dataset.id);

      try {
        if (action === 'edit') startEditUser(userId);
        if (action === 'premium') await togglePremium(userId);
        if (action === 'delete') await deleteUser(userId);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  if (els.productsTbody) {
    els.productsTbody.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;

      if (btn.dataset.action === 'edit-product') {
        startEditProduct(Number(btn.dataset.id));
      }
    });
  }

  if (els.categoriesTbody) {
    els.categoriesTbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const catId = btn.dataset.id;

      try {
        if (action === 'edit-category') startEditCategory(catId);
        if (action === 'delete-category') await deleteCategory(catId);
      } catch (error) {
        notify(error.message, true);
      }
    });
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.admin-tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

function bindTabEvents() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });
}

(async function init() {
  removeUnexpectedProductDetailEditor();
  bindEvents();
  bindTabEvents();
  await bootstrapAuth();
})();

