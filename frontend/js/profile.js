/* ============================================
   PROFILE PAGE LOGIC
   ============================================ */

const API_BASE = window.API_BASE || '';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  // Don't set Content-Type for FormData (file upload)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    window.location.href = 'index.html';
    return;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Error del servidor');
  }
  return data;
}

// ---- Toast ----
function notify(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? 'var(--danger)' : 'var(--toast-bg)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- Section Navigation ----
function switchSection(sectionName) {
  document.querySelectorAll('.profile-nav__item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionName);
  });
  document.querySelectorAll('.profile-section').forEach((section) => {
    section.classList.toggle('active', section.id === `section-${sectionName}`);
  });

  // Load data on section switch
  if (sectionName === 'favorites') loadFavorites();
  if (sectionName === 'recommendations') loadRecommendations();
  if (sectionName === 'orders') loadOrders();
}

function bindNavigation() {
  document.querySelectorAll('.profile-nav__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchSection(btn.dataset.section);
    });
  });
}

// ---- Profile Loading ----
async function loadProfile() {
  try {
    const data = await api('/api/v1/me/profile');
    if (!data || !data.user) return;

    const user = data.user;

    const nameInput = document.getElementById('profile-name');
    nameInput.value = user.name || '';
    if (user.name) nameInput.readOnly = true;

    const lastNameInput = document.getElementById('profile-lastname');
    lastNameInput.value = user.last_name || '';
    if (user.last_name) lastNameInput.readOnly = true;

    document.getElementById('profile-nickname').value = user.nickname || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-phone').value = user.phone || '';

    const addressInput = document.getElementById('profile-address');
    addressInput.value = user.address || '';
    if (user.address) addressInput.readOnly = true;

    // Sidebar
    const displayName = user.nickname || user.name || 'Usuario';
    document.getElementById('sidebar-username').textContent = displayName;
    document.getElementById('sidebar-email').textContent = user.email || '';

    // Avatar
    const avatarImg = document.getElementById('avatar-img');
    if (user.avatar_url) {
      // Avatar URL can be relative or absolute
      avatarImg.src = user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE}${user.avatar_url}`;
    } else {
      // Default avatar with user initial
      avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=0f6f7f&color=fff&size=128`;
    }
  } catch (error) {
    notify(error.message, true);
  }
}

// ---- Profile Update ----
function bindProfileForm() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const payload = {
        name: document.getElementById('profile-name').value.trim(),
        last_name: document.getElementById('profile-lastname').value.trim(),
        nickname: document.getElementById('profile-nickname').value.trim(),
        phone: document.getElementById('profile-phone').value.trim(),
        address: document.getElementById('profile-address').value.trim(),
      };

      await api('/api/v1/me/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      notify('Perfil actualizado correctamente');
      await loadProfile();
    } catch (error) {
      notify(error.message, true);
    }
  });
}

// ---- Phone Validation ----
function bindPhoneValidation() {
  const phoneInput = document.getElementById('profile-phone');
  if (!phoneInput) return;

  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value;
    const prefix = '+51 ';

    // Si el valor no empieza con el prefijo, lo forzamos
    if (!value.startsWith(prefix)) {
      // Extraemos solo los números y reconstruimos
      const numbers = value.replace(/\D/g, '');
      // Si los primeros números son 51, los omitimos para no duplicar
      const cleanNumbers = numbers.startsWith('51') ? numbers.substring(2) : numbers;
      value = prefix + cleanNumbers.substring(0, 9);
    } else {
      // Si ya tiene el prefijo, solo permitimos 9 números después
      const rest = value.substring(prefix.length).replace(/\D/g, '');
      value = prefix + rest.substring(0, 9);
    }

    e.target.value = value;
  });

  // Evitar que el cursor se mueva antes del prefijo o se borre parcialmente
  phoneInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.selectionStart <= 4) {
      e.preventDefault();
    }
  });

  phoneInput.addEventListener('click', (e) => {
    if (e.target.selectionStart < 4) {
      e.target.setSelectionRange(4, 4);
    }
  });
}

// ---- Password Change ----
function bindPasswordForm() {
  const form = document.getElementById('password-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      notify('Completa todos los campos', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      notify('Las nuevas contraseñas no coinciden', true);
      return;
    }

    try {
      await api('/api/v1/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      notify('Contrasena actualizada correctamente');
      form.reset();
    } catch (error) {
      notify(error.message, true);
    }
  });
}

// ---- Avatar Upload & Management ----
function bindAvatarUpload() {
  const input = document.getElementById('avatar-input');
  const btnChange = document.getElementById('btn-change-avatar');
  const btnView = document.getElementById('btn-view-avatar');
  const btnDelete = document.getElementById('btn-delete-avatar');
  const avatarImg = document.getElementById('avatar-img');
  const photoModal = document.getElementById('photo-modal');
  const photoModalImg = document.getElementById('photo-modal-img');
  const photoModalClose = document.querySelector('.photo-modal__close');

  if (!input) return;

  if (btnChange) {
    btnChange.addEventListener('click', () => input.click());
  }

  // Cierra el modal de la foto
  if (photoModal && photoModalClose) {
    const closeModal = () => photoModal.classList.remove('active');
    photoModalClose.addEventListener('click', closeModal);
    photoModal.querySelector('.photo-modal__overlay').addEventListener('click', closeModal);
  }

  if (btnView && avatarImg && photoModal && photoModalImg) {
    btnView.addEventListener('click', () => {
      // Solo abrimos si no es la foto por defecto
      if (avatarImg.src && !avatarImg.src.includes('ui-avatars.com')) {
        photoModalImg.src = avatarImg.src;
        photoModal.classList.add('active');
      } else {
        notify('No has subido una foto de perfil personalizada', true);
      }
    });
  }

  if (btnDelete && avatarImg) {
    btnDelete.addEventListener('click', async () => {
      if (avatarImg.src.includes('ui-avatars.com')) {
        notify('No tienes una foto personalizada para eliminar');
        return;
      }

      if (!confirm('¿Seguro que deseas eliminar tu foto de perfil?')) return;

      try {
        const data = await api('/api/v1/me/avatar', {
          method: 'DELETE',
        });

        if (data.success) {
          const userName = document.getElementById('profile-name').value || 'U';
          avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0f6f7f&color=fff&size=128`;
          notify('Foto de perfil eliminada');
        }
      } catch (error) {
        notify(error.message, true);
      }
    });
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      notify('Imagen muy grande. Máximo 10MB.', true);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
      const base64Data = e.target.result;

      try {
        const data = await api('/api/v1/me/avatar', {
          method: 'POST',
          body: JSON.stringify({ avatar: base64Data }),
        });

        if (data.avatar_url) {
          avatarImg.src = `${API_BASE}${data.avatar_url}?t=${Date.now()}`;
        }
        notify('Avatar actualizado');
        // Cerrar menú si está abierto
        const avatarMenu = document.getElementById('avatar-menu');
        if (avatarMenu) avatarMenu.classList.remove('active');
      } catch (error) {
        notify(error.message, true);
      }
    };
  });
}

// ---- Avatar Menu (Mobile) ----
function bindAvatarMenu() {
  const avatarWrapper = document.getElementById('avatar-wrapper');
  const avatarMenu = document.getElementById('avatar-menu');
  const avatarMenuOverlay = avatarMenu?.querySelector('.avatar-menu__overlay');
  const avatarMenuCancel = avatarMenu?.querySelector('.avatar-menu__cancel');
  
  if (!avatarWrapper || !avatarMenu) return;

  const closeMenu = () => {
    avatarMenu.classList.remove('active');
    setTimeout(() => {
      if (!avatarMenu.classList.contains('active')) {
        avatarMenu.style.display = 'none';
      }
    }, 250);
  };

  const openMenu = () => {
    avatarMenu.style.display = 'block';
    setTimeout(() => {
      avatarMenu.classList.add('active');
    }, 10);
  };

  const openMenuHandler = (e) => {
    // Si estamos en móvil (detectado por ancho de pantalla)
    if (window.innerWidth <= 860) {
      e.stopPropagation();
      openMenu();
    }
  };

  avatarWrapper.addEventListener('click', openMenuHandler);
  document.getElementById('avatar-badge')?.addEventListener('click', openMenuHandler);

  if (avatarMenuOverlay) avatarMenuOverlay.addEventListener('click', closeMenu);
  if (avatarMenuCancel) avatarMenuCancel.addEventListener('click', closeMenu);

  // Link menu items to existing buttons logic
  document.getElementById('menu-view-avatar')?.addEventListener('click', () => {
    closeMenu();
    setTimeout(() => {
      document.getElementById('btn-view-avatar')?.click();
    }, 250);
  });

  document.getElementById('menu-change-avatar')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('avatar-input')?.click();
  });

  document.getElementById('menu-delete-avatar')?.addEventListener('click', () => {
    closeMenu();
    setTimeout(() => {
      document.getElementById('btn-delete-avatar')?.click();
    }, 250);
  });
}

// ---- Favorites ----
async function loadFavorites() {
  const grid = document.getElementById('favorites-grid');
  const empty = document.getElementById('favorites-empty');
  if (!grid) return;

  try {
    const data = await api('/api/v1/me/favorites');
    const products = data.data || [];

    if (products.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

      if (empty) empty.style.display = 'none';
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      (products || []).forEach((p) => {
        const card = document.createElement('div');
        card.className = 'product-mini-card';

        const img = document.createElement('img');
        img.className = 'product-mini-card__img';
        img.loading = 'lazy';
        img.alt = p.name || '';
        img.src = p.image && (p.image.startsWith('http') || p.image.startsWith('/')) ? p.image : 'https://via.placeholder.com/80x80?text=Img';

        const info = document.createElement('div');
        info.className = 'product-mini-card__body';
        const name = document.createElement('div');
        name.className = 'product-mini-card__name';
        name.textContent = p.name || '';
        const price = document.createElement('div');
        price.className = 'product-mini-card__price';
        price.textContent = p.price ? 'S/ ' + Number(p.price).toFixed(2) : '';
        const actions = document.createElement('div');
        actions.className = 'product-mini-card__actions';

        const link = document.createElement('a');
        link.href = `product-detail.html?id=${encodeURIComponent(String(p.id))}`;
        link.className = 'btn btn--secondary';
        link.textContent = 'Ver';

        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn--danger';
        removeButton.textContent = 'Quitar';
        removeButton.onclick = () => removeFavorite(p.id);

        actions.appendChild(link);
        actions.appendChild(removeButton);
        info.appendChild(name);
        info.appendChild(price);
        info.appendChild(actions);
        card.appendChild(img);
        card.appendChild(info);
        frag.appendChild(card);
      });
      grid.appendChild(frag);
  } catch (error) {
    notify(error.message, true);
  }
}

async function removeFavorite(productId) {
  try {
    await api(`/api/v1/me/favorites/${productId}`, { method: 'DELETE' });
    notify('Eliminado de favoritos');
    await loadFavorites();
  } catch (error) {
    notify(error.message, true);
  }
}

// ---- Recommendations ----
async function loadRecommendations() {
  const grid = document.getElementById('recommendations-grid');
  const empty = document.getElementById('recommendations-empty');
  if (!grid) return;

  try {
    const data = await api('/api/v1/me/recommendations');
    const products = data.data || [];

    if (products.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = products.map((p) => `
      <div class="product-mini-card">
        <img class="product-mini-card__img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
        <div class="product-mini-card__body">
          <div class="product-mini-card__name">${escapeHtml(p.name)}</div>
          <div class="product-mini-card__price">S/ ${Number(p.price).toFixed(2)}</div>
          <div class="product-mini-card__actions">
            <a href="product-detail.html?id=${p.id}" class="btn btn--secondary">Ver</a>
            <button class="btn btn--primary" onclick="addFavoriteFromRec(${p.id})">♡ Favorito</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    notify(error.message, true);
  }
}

async function addFavoriteFromRec(productId) {
  try {
    await api('/api/v1/me/favorites', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
    notify('Agregado a favoritos');
    await loadRecommendations();
  } catch (error) {
    notify(error.message, true);
  }
}

// ---- Orders ----
async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  const empty = document.getElementById('orders-empty');
  const tableWrap = document.getElementById('orders-table-wrap');
  if (!tbody) return;

  try {
    const data = await api('/api/v1/me/orders');
    const orders = data.data || [];

    if (orders.length === 0) {
      if (tableWrap) tableWrap.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = orders.map((order) => {
      const itemsSummary = Array.isArray(order.items)
        ? order.items.map((i) => `${escapeHtml(i.name || 'Producto')} x${i.quantity || 1}`).join(', ')
        : 'Productos';
      const statusClass = order.status === 'completado' ? 'completado' : 'pendiente';
      const date = new Date(order.createdAt).toLocaleString('es-PE');

      return `
        <tr>
          <td>#${order.id}</td>
          <td>${itemsSummary}</td>
          <td>S/ ${Number(order.total).toFixed(2)}</td>
          <td><span class="order-status order-status--${statusClass}">${order.status}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    notify(error.message, true);
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  bindNavigation();
  bindProfileForm();
  bindPasswordForm();
  bindAvatarUpload();
  bindPhoneValidation();
  bindAvatarMenu();

  await loadProfile();
});
