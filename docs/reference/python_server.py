import json
import os
import re
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import bcrypt
import jwt
from flask import Flask, g, jsonify, make_response, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
DB_PATH = DATA_DIR / 'ElRinconAzul_app.sqlite3'
FRONTEND_DIR = (BASE_DIR.parent / 'frontend').resolve()
UPLOADS_DIR = FRONTEND_DIR / 'uploads' / 'avatars'
ALLOWED_AVATAR_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

JWT_SECRET = os.getenv('JWT_SECRET', 'change_this_secret_in_production')
JWT_ALGORITHM = 'HS256'
JWT_EXP_HOURS = 8
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').strip().lower() == 'true'

ALLOWED_ORIGINS = {
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
}

LOGIN_ATTEMPTS = {}
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 12

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path='')


# -------------------------
# Database helpers
# -------------------------
def open_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    # Este entorno bloquea archivos de journal en disco; usamos journal en memoria.
    conn.execute('PRAGMA journal_mode = MEMORY')
    conn.execute('PRAGMA synchronous = NORMAL')
    conn.execute('PRAGMA busy_timeout = 5000')
    return conn


def get_db():
    if 'db' not in g:
        conn = open_db_connection()
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_error):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def validate_email(value):
    if not isinstance(value, str):
        return False
    return re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value.strip()) is not None


def validate_password(value):
    if not isinstance(value, str) or len(value) < 8:
        return False
    has_upper = any(ch.isupper() for ch in value)
    has_digit = any(ch.isdigit() for ch in value)
    return has_upper and has_digit


def safe_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'si'}
    return False


def user_to_public(row):
    data = {
        'id': row['id'],
        'name': row['name'],
        'email': row['email'],
        'role': row['role_name'],
        'isPremium': bool(row['is_premium']),
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }
    # Include extended profile fields when available
    for field in ('last_name', 'nickname', 'phone', 'avatar_url', 'address'):
        try:
            data[field] = row[field] or ''
        except (IndexError, KeyError):
            pass
    return data


def product_to_public(row):
    return {
        'id': row['id'],
        'sku': row['sku'],
        'name': row['name'],
        'description': row['description'],
        'category': row['category'],
        'price': float(row['price']),
        'stock': int(row['stock']),
        'isPremium': bool(row['is_premium']),
        'image': row['image'],
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
    }


def get_product_by_id(product_id):
    db = get_db()
    return db.execute(
        '''
        SELECT id, sku, name, description, category, price, stock, is_premium, image, created_at, updated_at
        FROM products
        WHERE id = ?
        ''',
        (product_id,),
    ).fetchone()


def get_role_id(role_name):
    db = get_db()
    row = db.execute('SELECT id FROM roles WHERE name = ?', (role_name,)).fetchone()
    return row['id'] if row else None


def get_user_by_email(email):
    db = get_db()
    return db.execute(
        '''
        SELECT u.id, u.name, u.last_name, u.nickname, u.phone, u.avatar_url, u.address,
               u.email, u.password_hash, u.is_premium, u.created_at, u.updated_at,
               r.name AS role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.email = ?
        ''',
        (email,),
    ).fetchone()


def get_user_by_id(user_id):
    db = get_db()
    return db.execute(
        '''
        SELECT u.id, u.name, u.last_name, u.nickname, u.phone, u.avatar_url, u.address,
               u.email, u.password_hash, u.is_premium, u.created_at, u.updated_at,
               r.name AS role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = ?
        ''',
        (user_id,),
    ).fetchone()


def create_token(user_row):
    payload = {
        'sub': str(user_row['id']),
        'email': user_row['email'],
        'role': user_row['role_name'],
        'isPremium': bool(user_row['is_premium']),
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_bearer_token():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1].strip()
    cookie_token = request.cookies.get('auth_token')
    if cookie_token:
        return cookie_token
    return None


def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def auth_required(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        token = get_bearer_token()
        if not token:
            return jsonify({'success': False, 'message': 'Token requerido'}), 401
        try:
            payload = decode_token(token)
        except Exception:
            return jsonify({'success': False, 'message': 'Token invalido'}), 401

        user = get_user_by_id(int(payload.get('sub', 0)))
        if not user:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 401

        g.current_user = user
        return handler(*args, **kwargs)

    return wrapper


def admin_required(handler):
    @wraps(handler)
    @auth_required
    def wrapper(*args, **kwargs):
        if g.current_user['role_name'] != 'admin':
            return jsonify({'success': False, 'message': 'Solo administradores'}), 403
        return handler(*args, **kwargs)

    return wrapper


def login_rate_limited(ip):
    now = time.time()
    attempts = LOGIN_ATTEMPTS.get(ip, [])
    attempts = [ts for ts in attempts if now - ts < LOGIN_WINDOW_SECONDS]

    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        LOGIN_ATTEMPTS[ip] = attempts
        return True

    attempts.append(now)
    LOGIN_ATTEMPTS[ip] = attempts
    return False


def reset_login_attempts(ip):
    LOGIN_ATTEMPTS.pop(ip, None)


def set_auth_cookie(response, token):
    response.set_cookie(
        'auth_token',
        token,
        httponly=True,
        samesite='Lax',
        secure=COOKIE_SECURE,
        max_age=JWT_EXP_HOURS * 3600,
    )


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    conn = open_db_connection()

    conn.executescript(
        '''
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role_id INTEGER NOT NULL,
            is_premium INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            is_premium INTEGER NOT NULL DEFAULT 0,
            image TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(user_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            items TEXT NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'completado',
            created_at TEXT NOT NULL
        );
        '''
    )

    # Add profile columns if missing (safe ALTER TABLE)
    for col, col_def in [
        ('last_name', "TEXT NOT NULL DEFAULT ''"),
        ('nickname', "TEXT NOT NULL DEFAULT ''"),
        ('phone', "TEXT NOT NULL DEFAULT ''"),
        ('avatar_url', "TEXT NOT NULL DEFAULT ''"),
        ('address', "TEXT NOT NULL DEFAULT ''"),
    ]:
        try:
            conn.execute(f'ALTER TABLE users ADD COLUMN {col} {col_def}')
        except Exception:
            pass  # Column already exists

    conn.execute('INSERT OR IGNORE INTO roles(name) VALUES (?)', ('admin',))
    conn.execute('INSERT OR IGNORE INTO roles(name) VALUES (?)', ('user',))

    admin_role_id = conn.execute('SELECT id FROM roles WHERE name = ?', ('admin',)).fetchone()[0]
    user_role_id = conn.execute('SELECT id FROM roles WHERE name = ?', ('user',)).fetchone()[0]

    admin_email = 'admin@elrinconazul.com'
    user_email = 'cliente@elrinconazul.com'

    exists_admin = conn.execute('SELECT id FROM users WHERE email = ?', (admin_email,)).fetchone()
    if not exists_admin:
        password_hash = bcrypt.hashpw('Admin1234'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        now = now_iso()
        conn.execute(
            '''
            INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            ('Administrador Ganesh', admin_email, password_hash, admin_role_id, 1, now, now),
        )

    exists_user = conn.execute('SELECT id FROM users WHERE email = ?', (user_email,)).fetchone()
    if not exists_user:
        password_hash = bcrypt.hashpw('Cliente1234'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        now = now_iso()
        conn.execute(
            '''
            INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            ('Cliente Demo', user_email, password_hash, user_role_id, 0, now, now),
        )

    products_count = conn.execute('SELECT COUNT(1) AS total FROM products').fetchone()['total']
    if products_count == 0:
        now = now_iso()
        seed_products = [
            ('AURA-ESSENCE-01', 'Auroral Essence', 'Serum luminoso con extractos botanicos del norte.', 'skincare', 49.99, 45, 0, 'https://via.placeholder.com/500x400/0f6f7f/f3efe5?text=Auroral+Essence', now, now),
            ('AURA-RELAX-02', 'Linen Calm Diffuser', 'Difusor con notas limpias y acabado premium.', 'home', 79.00, 20, 0, 'https://via.placeholder.com/500x400/0b3c5d/f7f1e3?text=Linen+Calm', now, now),
            ('AURA-DIGI-03', 'Teal Smart Bottle', 'Botella termica conectada con recordatorio inteligente.', 'lifestyle', 64.50, 32, 1, 'https://via.placeholder.com/500x400/1f9e9b/f8efe1?text=Smart+Bottle', now, now),
            ('AURA-APR-04', 'Apricot Balance Set', 'Kit de cuidado diario para piel mixta.', 'wellness', 92.00, 15, 1, 'https://via.placeholder.com/500x400/f59f72/faf7ef?text=Balance+Set', now, now),
        ]

        conn.executemany(
            '''
            INSERT INTO products(sku, name, description, category, price, stock, is_premium, image, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            seed_products,
        )

    conn.commit()
    conn.close()


# -------------------------
# CORS + generic responses
# -------------------------
@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        response = make_response('', 204)
        return response
    return None


@app.after_request
def apply_cors(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin

    response.headers['Vary'] = 'Origin'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


# -------------------------
# API routes
# -------------------------
@app.get('/api/health')
def api_health():
    return jsonify({'success': True, 'message': 'API online', 'timestamp': now_iso()})


@app.post('/api/v1/auth/register')
def auth_register():
    data = request.get_json(silent=True) or {}

    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if len(name) < 2:
        return jsonify({'success': False, 'message': 'Nombre invalido'}), 400
    if not validate_email(email):
        return jsonify({'success': False, 'message': 'Email invalido'}), 400
    if not validate_password(password):
        return jsonify({'success': False, 'message': 'Password debe tener minimo 8 caracteres, una mayuscula y un numero'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({'success': False, 'message': 'El usuario ya existe'}), 409

    role_id = get_role_id('user')
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    now = now_iso()

    cursor = db.execute(
        '''
        INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (name, email, password_hash, role_id, 0, now, now),
    )
    db.commit()

    user = get_user_by_id(cursor.lastrowid)
    token = create_token(user)

    response = jsonify({
        'success': True,
        'message': 'Usuario registrado',
        'token': token,
        'user': user_to_public(user),
    })
    set_auth_cookie(response, token)
    return response, 201


@app.post('/api/v1/auth/login')
def auth_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not validate_email(email) or not password:
        return jsonify({'success': False, 'message': 'Credenciales invalidas'}), 400

    ip = request.remote_addr or 'unknown'
    if login_rate_limited(ip):
        return jsonify({'success': False, 'message': 'Demasiados intentos. Espera unos minutos.'}), 429

    user = get_user_by_email(email)
    if not user:
        return jsonify({'success': False, 'message': 'Credenciales invalidas'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'success': False, 'message': 'Credenciales invalidas'}), 401

    reset_login_attempts(ip)
    token = create_token(user)

    response = jsonify({
        'success': True,
        'message': 'Login exitoso',
        'token': token,
        'user': user_to_public(user),
    })
    set_auth_cookie(response, token)
    return response


@app.post('/api/v1/auth/logout')
def auth_logout():
    response = jsonify({'success': True, 'message': 'Sesion cerrada'})
    response.set_cookie('auth_token', '', expires=0)
    return response


@app.get('/api/v1/me')
@auth_required
def auth_me():
    return jsonify({'success': True, 'user': user_to_public(g.current_user)})


@app.get('/api/v1/products')
def products_list():
    category = str(request.args.get('category', '')).strip().lower()
    term = str(request.args.get('q', '')).strip().lower()

    db = get_db()
    rows = db.execute(
        '''
        SELECT id, sku, name, description, category, price, stock, is_premium, image, created_at, updated_at
        FROM products
        ORDER BY id ASC
        '''
    ).fetchall()

    products = [product_to_public(row) for row in rows]

    if category:
        products = [p for p in products if p['category'].lower() == category]

    if term:
        products = [p for p in products if term in p['name'].lower() or term in p['description'].lower()]

    return jsonify({'success': True, 'count': len(products), 'data': products})


@app.get('/api/v1/products/<int:product_id>')
def products_detail(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404
    return jsonify({'success': True, 'data': product_to_public(product)})


@app.put('/api/v1/products/<int:product_id>')
@admin_required
def products_update(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404

    data = request.get_json(silent=True) or {}

    name = str(data.get('name', product['name'])).strip()
    description = str(data.get('description', product['description'])).strip()
    category = str(data.get('category', product['category'])).strip().lower()
    sku = str(data.get('sku', product['sku'])).strip().upper()
    image = str(data.get('image', product['image'])).strip()
    is_premium = 1 if safe_bool(data.get('isPremium', bool(product['is_premium']))) else 0

    try:
        price = float(data.get('price', product['price']))
    except Exception:
        return jsonify({'success': False, 'message': 'Precio invalido'}), 400

    try:
        stock = int(data.get('stock', product['stock']))
    except Exception:
        return jsonify({'success': False, 'message': 'Stock invalido'}), 400

    if len(name) < 2:
        return jsonify({'success': False, 'message': 'Nombre invalido'}), 400
    if len(description) < 5:
        return jsonify({'success': False, 'message': 'Descripcion invalida'}), 400
    if len(category) < 2:
        return jsonify({'success': False, 'message': 'Categoria invalida'}), 400
    if len(sku) < 3:
        return jsonify({'success': False, 'message': 'SKU invalido'}), 400
    if price < 0:
        return jsonify({'success': False, 'message': 'Precio invalido'}), 400
    if stock < 0:
        return jsonify({'success': False, 'message': 'Stock invalido'}), 400

    db = get_db()
    conflict = db.execute(
        'SELECT id FROM products WHERE sku = ? AND id <> ?',
        (sku, product_id),
    ).fetchone()
    if conflict:
        return jsonify({'success': False, 'message': 'SKU ya en uso'}), 409

    db.execute(
        '''
        UPDATE products
        SET sku = ?, name = ?, description = ?, category = ?, price = ?, stock = ?, is_premium = ?, image = ?, updated_at = ?
        WHERE id = ?
        ''',
        (sku, name, description, category, price, stock, is_premium, image or product['image'], now_iso(), product_id),
    )
    db.commit()

    updated = get_product_by_id(product_id)
    return jsonify({'success': True, 'message': 'Producto actualizado', 'data': product_to_public(updated)})


@app.get('/api/v1/users')
@admin_required
def users_list():
    db = get_db()
    rows = db.execute(
        '''
        SELECT u.id, u.name, u.email, u.is_premium, u.created_at, u.updated_at, r.name AS role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        ORDER BY u.id ASC
        '''
    ).fetchall()

    users = [user_to_public(row) for row in rows]
    return jsonify({'success': True, 'count': len(users), 'data': users})


@app.post('/api/v1/users')
@admin_required
def users_create():
    data = request.get_json(silent=True) or {}

    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    role_name = str(data.get('role', 'user')).strip().lower()
    is_premium = 1 if safe_bool(data.get('isPremium', False)) else 0

    if len(name) < 2:
        return jsonify({'success': False, 'message': 'Nombre invalido'}), 400
    if not validate_email(email):
        return jsonify({'success': False, 'message': 'Email invalido'}), 400
    if not validate_password(password):
        return jsonify({'success': False, 'message': 'Password insegura'}), 400
    if role_name not in {'admin', 'user'}:
        return jsonify({'success': False, 'message': 'Rol invalido'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({'success': False, 'message': 'El usuario ya existe'}), 409

    role_id = get_role_id(role_name)
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    now = now_iso()

    cursor = db.execute(
        '''
        INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (name, email, password_hash, role_id, is_premium, now, now),
    )
    db.commit()

    user = get_user_by_id(cursor.lastrowid)
    return jsonify({'success': True, 'message': 'Usuario creado', 'data': user_to_public(user)}), 201


@app.put('/api/v1/users/<int:user_id>')
@admin_required
def users_update(user_id):
    data = request.get_json(silent=True) or {}

    db = get_db()
    existing = get_user_by_id(user_id)
    if not existing:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

    name = str(data.get('name', existing['name'])).strip()
    email = str(data.get('email', existing['email'])).strip().lower()
    role_name = str(data.get('role', existing['role_name'])).strip().lower()
    is_premium = 1 if safe_bool(data.get('isPremium', bool(existing['is_premium']))) else 0
    new_password = str(data.get('password', '')).strip()

    if len(name) < 2:
        return jsonify({'success': False, 'message': 'Nombre invalido'}), 400
    if not validate_email(email):
        return jsonify({'success': False, 'message': 'Email invalido'}), 400
    if role_name not in {'admin', 'user'}:
        return jsonify({'success': False, 'message': 'Rol invalido'}), 400

    conflict = db.execute('SELECT id FROM users WHERE email = ? AND id <> ?', (email, user_id)).fetchone()
    if conflict:
        return jsonify({'success': False, 'message': 'Email ya en uso'}), 409

    role_id = get_role_id(role_name)
    password_hash = existing['password_hash']
    if new_password:
        if not validate_password(new_password):
            return jsonify({'success': False, 'message': 'Nueva password insegura'}), 400
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    db.execute(
        '''
        UPDATE users
        SET name = ?, email = ?, password_hash = ?, role_id = ?, is_premium = ?, updated_at = ?
        WHERE id = ?
        ''',
        (name, email, password_hash, role_id, is_premium, now_iso(), user_id),
    )
    db.commit()

    updated = get_user_by_id(user_id)
    return jsonify({'success': True, 'message': 'Usuario actualizado', 'data': user_to_public(updated)})


@app.delete('/api/v1/users/<int:user_id>')
@admin_required
def users_delete(user_id):
    if g.current_user['id'] == user_id:
        return jsonify({'success': False, 'message': 'No puedes eliminar tu propio usuario'}), 400

    db = get_db()
    cursor = db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

    return jsonify({'success': True, 'message': 'Usuario eliminado'})


@app.patch('/api/v1/users/<int:user_id>/premium')
@admin_required
def users_update_premium(user_id):
    data = request.get_json(silent=True) or {}
    if 'isPremium' not in data:
        return jsonify({'success': False, 'message': 'Campo isPremium requerido'}), 400

    db = get_db()
    existing = get_user_by_id(user_id)
    if not existing:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

    is_premium = 1 if safe_bool(data.get('isPremium')) else 0
    db.execute('UPDATE users SET is_premium = ?, updated_at = ? WHERE id = ?', (is_premium, now_iso(), user_id))
    db.commit()

    updated = get_user_by_id(user_id)
    return jsonify({'success': True, 'message': 'Estado premium actualizado', 'data': user_to_public(updated)})


# -------------------------
# Profile API routes
# -------------------------
@app.get('/api/v1/me/profile')
@auth_required
def me_profile():
    return jsonify({'success': True, 'user': user_to_public(g.current_user)})


@app.put('/api/v1/me/profile')
@auth_required
def me_profile_update():
    data = request.get_json(silent=True) or {}
    user = g.current_user
    db = get_db()

    name = str(data.get('name', user['name'])).strip()
    last_name = str(data.get('last_name', user['last_name'])).strip()
    nickname = str(data.get('nickname', user['nickname'])).strip()
    phone = str(data.get('phone', user['phone'])).strip()
    address = str(data.get('address', user['address'])).strip()

    if len(name) < 2:
        return jsonify({'success': False, 'message': 'Nombre invalido'}), 400

    db.execute(
        '''
        UPDATE users SET name = ?, last_name = ?, nickname = ?, phone = ?, address = ?, updated_at = ?
        WHERE id = ?
        ''',
        (name, last_name, nickname, phone, address, now_iso(), user['id']),
    )
    db.commit()

    updated = get_user_by_id(user['id'])
    return jsonify({'success': True, 'message': 'Perfil actualizado', 'user': user_to_public(updated)})


@app.put('/api/v1/me/password')
@auth_required
def me_password_update():
    data = request.get_json(silent=True) or {}
    user = g.current_user

    current_password = str(data.get('currentPassword', ''))
    new_password = str(data.get('newPassword', ''))

    if not current_password or not new_password:
        return jsonify({'success': False, 'message': 'Contrasena actual y nueva requeridas'}), 400

    if not bcrypt.checkpw(current_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'success': False, 'message': 'Contrasena actual incorrecta'}), 400

    if not validate_password(new_password):
        return jsonify({'success': False, 'message': 'Nueva contrasena debe tener minimo 8 caracteres, una mayuscula y un numero'}), 400

    db = get_db()
    password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', (password_hash, now_iso(), user['id']))
    db.commit()

    return jsonify({'success': True, 'message': 'Contrasena actualizada'})


@app.post('/api/v1/me/avatar')
@auth_required
def me_avatar_upload():
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'message': 'No se envio archivo'}), 400

    file = request.files['avatar']
    if not file.filename:
        return jsonify({'success': False, 'message': 'Archivo vacio'}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        return jsonify({'success': False, 'message': 'Formato no permitido. Usa JPG, PNG, GIF o WebP'}), 400

    filename = f'{g.current_user["id"]}_{uuid.uuid4().hex[:8]}{ext}'
    filepath = UPLOADS_DIR / filename
    file.save(str(filepath))

    avatar_url = f'/uploads/avatars/{filename}'
    db = get_db()
    db.execute('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?', (avatar_url, now_iso(), g.current_user['id']))
    db.commit()

    return jsonify({'success': True, 'message': 'Avatar actualizado', 'avatar_url': avatar_url})


@app.get('/api/v1/me/favorites')
@auth_required
def me_favorites_list():
    db = get_db()
    rows = db.execute(
        '''
        SELECT p.id, p.sku, p.name, p.description, p.category, p.price, p.stock, p.is_premium, p.image, p.created_at, p.updated_at
        FROM favorites f
        JOIN products p ON p.id = f.product_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        ''',
        (g.current_user['id'],),
    ).fetchall()

    products = [product_to_public(row) for row in rows]
    return jsonify({'success': True, 'data': products})


@app.post('/api/v1/me/favorites')
@auth_required
def me_favorites_add():
    data = request.get_json(silent=True) or {}
    product_id = data.get('productId')

    if not product_id:
        return jsonify({'success': False, 'message': 'productId requerido'}), 400

    product = get_product_by_id(int(product_id))
    if not product:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404

    db = get_db()
    try:
        db.execute(
            'INSERT INTO favorites(user_id, product_id, created_at) VALUES (?, ?, ?)',
            (g.current_user['id'], int(product_id), now_iso()),
        )
        db.commit()
    except Exception:
        pass  # Already favorited

    return jsonify({'success': True, 'message': 'Agregado a favoritos'})


@app.delete('/api/v1/me/favorites/<int:product_id>')
@auth_required
def me_favorites_remove(product_id):
    db = get_db()
    db.execute('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', (g.current_user['id'], product_id))
    db.commit()
    return jsonify({'success': True, 'message': 'Eliminado de favoritos'})


@app.get('/api/v1/me/orders')
@auth_required
def me_orders_list():
    db = get_db()
    rows = db.execute(
        'SELECT id, items, total, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        (g.current_user['id'],),
    ).fetchall()

    orders = []
    for row in rows:
        try:
            items = json.loads(row['items'])
        except Exception:
            items = []
        orders.append({
            'id': row['id'],
            'items': items,
            'total': float(row['total']),
            'status': row['status'],
            'createdAt': row['created_at'],
        })

    return jsonify({'success': True, 'data': orders})


@app.post('/api/v1/me/orders')
@auth_required
def me_orders_create():
    data = request.get_json(silent=True) or {}
    items = data.get('items', [])
    total = float(data.get('total', 0))

    if not items or total <= 0:
        return jsonify({'success': False, 'message': 'Pedido invalido'}), 400

    db = get_db()
    cursor = db.execute(
        'INSERT INTO orders(user_id, items, total, status, created_at) VALUES (?, ?, ?, ?, ?)',
        (g.current_user['id'], json.dumps(items), total, 'completado', now_iso()),
    )
    db.commit()

    return jsonify({'success': True, 'message': 'Pedido registrado', 'orderId': cursor.lastrowid}), 201


@app.get('/api/v1/me/recommendations')
@auth_required
def me_recommendations():
    db = get_db()

    # Get categories from user favorites
    fav_categories = db.execute(
        '''
        SELECT DISTINCT p.category
        FROM favorites f
        JOIN products p ON p.id = f.product_id
        WHERE f.user_id = ?
        ''',
        (g.current_user['id'],),
    ).fetchall()

    fav_cat_set = {row['category'] for row in fav_categories}

    # Get favorited product IDs to exclude
    fav_ids = db.execute(
        'SELECT product_id FROM favorites WHERE user_id = ?',
        (g.current_user['id'],),
    ).fetchall()
    fav_id_set = {row['product_id'] for row in fav_ids}

    all_products = db.execute(
        'SELECT id, sku, name, description, category, price, stock, is_premium, image, created_at, updated_at FROM products'
    ).fetchall()

    # Prioritize same categories, then others
    recommended = []
    others = []
    for row in all_products:
        if row['id'] in fav_id_set:
            continue
        if row['category'] in fav_cat_set:
            recommended.append(product_to_public(row))
        else:
            others.append(product_to_public(row))

    recommended.extend(others)
    return jsonify({'success': True, 'data': recommended[:8]})


# -------------------------
# Legacy compatibility routes
# -------------------------
@app.post('/api/login')
def legacy_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not validate_email(email) or not password:
        return jsonify({'status': 'error', 'message': 'Faltan credenciales'}), 400

    user = get_user_by_email(email)
    if not user:
        return jsonify({'status': 'error', 'message': 'Credenciales invalidas'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'status': 'error', 'message': 'Credenciales invalidas'}), 401

    token = create_token(user)
    user_type = 'premium' if user['role_name'] == 'admin' or bool(user['is_premium']) else 'normal'

    response = jsonify({
        'status': 'ok',
        'type': user_type,
        'token': token,
        'user': {'id': user['id'], 'email': user['email']},
    })
    set_auth_cookie(response, token)
    return response


@app.get('/api/premium-users')
def legacy_premium_users():
    db = get_db()
    rows = db.execute(
        '''
        SELECT u.id, u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.is_premium = 1 OR r.name = 'admin'
        ORDER BY u.id ASC
        '''
    ).fetchall()
    return jsonify([{'id': row['id'], 'email': row['email']} for row in rows])


@app.get('/api/normal-users')
def legacy_normal_users():
    db = get_db()
    rows = db.execute(
        '''
        SELECT u.id, u.email
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.is_premium = 0 AND r.name = 'user'
        ORDER BY u.id ASC
        '''
    ).fetchall()
    return jsonify([{'id': row['id'], 'email': row['email']} for row in rows])


@app.post('/api/normal-users')
def legacy_create_normal_user():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', 'Usuario Normal')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not validate_email(email) or not validate_password(password):
        return jsonify({'error': 'Datos invalidos'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({'error': 'User exists'}), 409

    role_id = get_role_id('user')
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    now = now_iso()
    cursor = db.execute(
        'INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (name, email, password_hash, role_id, 0, now, now),
    )
    db.commit()

    return jsonify({'id': cursor.lastrowid, 'email': email}), 201


@app.post('/api/premium-users')
@admin_required
def legacy_create_premium_user():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name', 'Usuario Premium')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not validate_email(email) or not validate_password(password):
        return jsonify({'error': 'Datos invalidos'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({'error': 'User exists'}), 409

    role_id = get_role_id('user')
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    now = now_iso()
    cursor = db.execute(
        'INSERT INTO users(name, email, password_hash, role_id, is_premium, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (name, email, password_hash, role_id, 1, now, now),
    )
    db.commit()

    return jsonify({'id': cursor.lastrowid, 'email': email}), 201


@app.delete('/api/normal-users/<int:user_id>')
@admin_required
def legacy_delete_normal_user(user_id):
    db = get_db()
    cursor = db.execute(
        '''
        DELETE FROM users
        WHERE id = ? AND id NOT IN (SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin')
        ''',
        (user_id,),
    )
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'status': 'ok'})


@app.delete('/api/premium-users/<int:user_id>')
@admin_required
def legacy_delete_premium_user(user_id):
    db = get_db()
    cursor = db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()

    if cursor.rowcount == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'status': 'ok'})


# -------------------------
# Static frontend (localhost:3000)
# -------------------------
@app.get('/')
def root_page():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.get('/admin')
def admin_page_alias():
    return send_from_directory(FRONTEND_DIR, 'admin.html')


@app.get('/<path:filepath>')
def static_files(filepath):
    if filepath.startswith('api/'):
        return jsonify({'success': False, 'message': 'Ruta no encontrada'}), 404

    target = FRONTEND_DIR / filepath
    if target.exists() and target.is_file():
        return send_from_directory(FRONTEND_DIR, filepath)
    return jsonify({'success': False, 'message': 'Ruta no encontrada'}), 404


if __name__ == '__main__':
    init_db()
    port = int(os.getenv('PORT', '3000'))
    app.run(host='0.0.0.0', port=port, debug=False)
