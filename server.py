#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STICKERS — Telegram Mini App магазин виниловых наклеек.

Бэкенд на чистой стандартной библиотеке Python (без зависимостей):
  * ThreadingHTTPServer — статика мини-аппа + JSON API
  * SQLite — товары, категории, заказы, склад ключей, промокоды, юзеры
  * Валидация Telegram WebApp initData (HMAC-SHA256)
  * Crypto Pay API (@CryptoBot) — инвойсы и проверка оплаты
  * Админ-панель прямо в мини-аппе (доступ по ADMIN_IDS из .env)

Запуск:  python3 server.py
"""

import json
import os
import re
import ssl
import sys
import hmac
import time
import base64
import secrets
import hashlib
import sqlite3
import threading
import mimetypes
import urllib.request
import urllib.parse
import urllib.error
from contextvars import ContextVar
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.join(BASE_DIR, 'webapp')
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads', 'products')
DB_PATH = os.path.join(DATA_DIR, 'shop.db')

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 МБ
ALLOWED_IMAGE_EXT = {'jpg', 'jpeg', 'png', 'webp', 'gif'}


# ---------------------------------------------------------------------------
# Конфигурация из .env
# ---------------------------------------------------------------------------

def load_env():
    path = os.path.join(BASE_DIR, '.env')
    if not os.path.exists(path):
        return
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env()

def _parse_admin_ids(raw):
    ids = set()
    for x in raw.replace(' ', '').split(','):
        if not x or not x.isdigit():
            continue
        ids.add(int(x))
    return ids


BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
CRYPTO_TOKEN = os.environ.get('CRYPTOBOT_TOKEN', '')
CRYPTO_API = os.environ.get('CRYPTOBOT_API', 'https://pay.crypt.bot/api').rstrip('/')
ADMIN_IDS = _parse_admin_ids(os.environ.get('ADMIN_IDS', ''))
CURRENCY = os.environ.get('CURRENCY', 'USD')
PORT = int(os.environ.get('PORT', '8877'))
DEV_MODE = os.environ.get('DEV_MODE', '0') == '1'

INVOICE_TTL = 1800          # время жизни инвойса, сек
AUTH_MAX_AGE = 86400        # initData не старше суток

DELIVER_LOCK = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


# ---------------------------------------------------------------------------
# База данных
# ---------------------------------------------------------------------------

def db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY,
    username    TEXT,
    first_name  TEXT,
    photo_url   TEXT,
    is_banned   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    icon  TEXT NOT NULL DEFAULT 'folder',
    sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    subtitle      TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    price         REAL NOT NULL,
    old_price     REAL,
    icon          TEXT NOT NULL DEFAULT 'layers',
    image         TEXT NOT NULL DEFAULT '',
    badge         TEXT NOT NULL DEFAULT '',
    delivery_type TEXT NOT NULL DEFAULT 'physical',
    content       TEXT NOT NULL DEFAULT '',
    stock_qty     INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1,
    sort          INTEGER NOT NULL DEFAULT 0,
    sales         INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    sold_order_id INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    items_json    TEXT NOT NULL,
    subtotal      REAL NOT NULL,
    discount      REAL NOT NULL DEFAULT 0,
    total         REAL NOT NULL,
    promo_code    TEXT,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending | paid | shipped | expired
    invoice_id    INTEGER,
    pay_url       TEXT,
    delivery_json TEXT,
    shipping_json TEXT,
    tracking      TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL,
    paid_at       TEXT,
    shipped_at    TEXT
);

CREATE TABLE IF NOT EXISTS promos (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    code     TEXT NOT NULL UNIQUE,
    percent  INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 0,          -- 0 = без лимита
    used     INTEGER NOT NULL DEFAULT 0,
    active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

CATALOG_VERSION = 'stickers-1'

DEFAULT_SETTINGS = {
    'shop_name': 'STICKERS',
    'tagline': 'виниловые наклейки · доставка почтой',
    'currency_symbol': '$',
    'support': '@sdefgsdfsdfdsfbot',
    'shipping_note': 'Отправляем Почтой / СДЭК за 1–3 дня после оплаты. Трекинг появится в заказе.',
    # Публичный HTTPS-адрес мини-аппа — для кнопки в ответе на /start.
    # Заполняется через админку, scripts/setup_bot.py или WEBAPP_URL в .env.
    'webapp_url': os.environ.get('WEBAPP_URL', ''),
    'catalog_version': CATALOG_VERSION,
}

SEED_CATEGORIES = [
    ('Наборы', 'layers', 0),
    ('Одиночные', 'circle', 1),
    ('Для ноутбука', 'laptop', 2),
    ('Авто / мото', 'car', 3),
    ('Лимитки', 'sparkles', 4),
]

# (cat_idx, name, subtitle, description, price, old_price, icon, badge, stock_qty)
SEED_PRODUCTS = [
    (0, 'Stickers Pack · 12 шт', 'Маттовый винил, микс ч/б графики',
     'Набор из 12 виниловых наклеек: логотипы, типографика и иконки в чёрно-белой эстетике.\n\n'
     '• Водостойкий винил\n• Матовая ламинация\n• Размер микс 3–8 см\n• Легко клеятся на ноут, бутылку, скейт',
     14.00, 18.00, 'layers', 'ХИТ', 48),
    (0, 'Street Pack · 20 шт', 'Уличный сет: граффити и штрихи',
     'Плотный набор из 20 наклеек в street-стиле. Для скейта, шлема и чехла телефона.\n\n'
     '• Глянцевый винил\n• УФ-защита\n• Размеры 4–10 см',
     19.50, 24.00, 'spray-can', '-19%', 36),
    (1, 'Logo Mark', 'Фирменный знак STICKERS, 7 см',
     'Одна крупная наклейка с логотипом. Идеально на крышку ноутбука.\n\n• Матовый винил\n• Контурная резка\n• 7 × 7 см',
     4.50, None, 'gem', '', 120),
    (1, 'Wordmark Strip', 'Длинная полоска с названием',
     'Горизонтальный вордмарк для крышки ноутбука или панели авто.\n\n• 12 × 2.5 см\n• Матовый чёрный',
     3.90, None, 'type', '', 90),
    (2, 'Laptop Kit · 6 шт', 'Подобранный сет под Mac / Windows',
     'Шесть наклеек разного размера под ноутбук: не перекрывают вентили и логотип бренда.\n\n'
     '• Матовый винил\n• Легко снимаются без следов',
     11.00, 15.00, 'laptop', 'NEW', 40),
    (3, 'Helmet Decals', '3 шт для шлема / бака',
     'Толстый винил для мото и авто. Держит вибрацию и мойку.\n\n• 3 наклейки\n• Глянец + ламинация\n• 5–9 см',
     9.00, None, 'bike', '', 28),
    (4, 'Drop 01 · Numbered', 'Лимитка 100 шт, нумерованная',
     'Сезонная лимитка с номером на обороте упаковки. Повторного тиража не будет.\n\n'
     '• 1 крупная + 2 мини\n• Нумерация /100\n• Матовый винил',
     22.00, None, 'sparkles', 'LIMIT', 17),
    (4, 'Holo Slash', 'Голографическая полоска',
     'Голографический винил с переливами. Яркий акцент на чехол или бутылку.\n\n• 10 × 3 см\n• Holo-плёнка',
     6.50, 8.00, 'rainbow', '', 55),
]


def _table_cols(conn, table):
    return {r[1] for r in conn.execute(f'PRAGMA table_info({table})')}


def migrate_schema(conn):
    """Добавляет колонки для физических заказов на уже существующую БД."""
    pcols = _table_cols(conn, 'products')
    if 'stock_qty' not in pcols:
        conn.execute('ALTER TABLE products ADD COLUMN stock_qty INTEGER NOT NULL DEFAULT 0')
        # Переносим остаток со старого склада ключей
        for row in conn.execute('SELECT id FROM products'):
            left = conn.execute(
                'SELECT COUNT(*) c FROM stock WHERE product_id=? AND sold_order_id IS NULL',
                (row['id'],)).fetchone()['c']
            conn.execute('UPDATE products SET stock_qty=? WHERE id=?', (left, row['id']))
    if 'image' not in pcols:
        conn.execute("ALTER TABLE products ADD COLUMN image TEXT NOT NULL DEFAULT ''")
    ocols = _table_cols(conn, 'orders')
    if 'shipping_json' not in ocols:
        conn.execute('ALTER TABLE orders ADD COLUMN shipping_json TEXT')
    if 'tracking' not in ocols:
        conn.execute("ALTER TABLE orders ADD COLUMN tracking TEXT NOT NULL DEFAULT ''")
    if 'shipped_at' not in ocols:
        conn.execute('ALTER TABLE orders ADD COLUMN shipped_at TEXT')


def seed_catalog(conn):
    conn.execute('DELETE FROM stock')
    conn.execute('DELETE FROM products')
    conn.execute('DELETE FROM categories')
    cat_ids = []
    for name, icon, sort in SEED_CATEGORIES:
        cur = conn.execute('INSERT INTO categories(name, icon, sort) VALUES(?, ?, ?)',
                           (name, icon, sort))
        cat_ids.append(cur.lastrowid)
    for i, (ci, name, subtitle, descr, price, old, icon, badge, qty) in enumerate(SEED_PRODUCTS):
        conn.execute(
            'INSERT INTO products(category_id, name, subtitle, description, price, old_price, icon, badge,'
            " delivery_type, content, stock_qty, active, sort, sales, created_at)"
            " VALUES(?,?,?,?,?,?,?,?,'physical','',?,1,?,?,?)",
            (cat_ids[ci], name, subtitle, descr, price, old, icon, badge, qty, i,
             (7 - i) * 3, now_iso()))
    conn.execute("INSERT OR IGNORE INTO promos(code, percent, max_uses) VALUES('START10', 10, 0)")
    for key, value in DEFAULT_SETTINGS.items():
        if key == 'webapp_url':
            continue  # не затираем уже привязанный URL мини-аппа
        conn.execute('INSERT INTO settings(key, value) VALUES(?, ?) '
                     'ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, value))


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    conn = db()
    conn.executescript(SCHEMA)
    migrate_schema(conn)
    ver = conn.execute("SELECT value FROM settings WHERE key='catalog_version'").fetchone()
    product_count = conn.execute('SELECT COUNT(*) c FROM products').fetchone()['c']
    need_seed = (not ver or ver['value'] != CATALOG_VERSION or product_count == 0)
    for key, value in DEFAULT_SETTINGS.items():
        if key == 'catalog_version' and need_seed:
            continue  # выставим после seed_catalog
        conn.execute('INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)', (key, value))
    # Подтянуть WEBAPP_URL из .env, если в БД ещё пусто
    env_url = (os.environ.get('WEBAPP_URL') or '').strip()
    if env_url:
        cur = conn.execute("SELECT value FROM settings WHERE key='webapp_url'").fetchone()
        if not cur or not (cur['value'] or '').strip():
            conn.execute("INSERT INTO settings(key, value) VALUES('webapp_url', ?) "
                         'ON CONFLICT(key) DO UPDATE SET value=excluded.value', (env_url,))
    if need_seed:
        seed_catalog(conn)
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Внешние API: Telegram Bot API и Crypto Pay API
# ---------------------------------------------------------------------------

def make_ssl_context():
    """SSL-контекст с системными CA (у Python на macOS их часто нет из коробки)."""
    ctx = ssl.create_default_context()
    for cafile in ('/etc/ssl/cert.pem', '/usr/local/etc/openssl/cert.pem'):
        if os.path.exists(cafile):
            try:
                ctx.load_verify_locations(cafile)
            except Exception:
                pass
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except Exception:
        pass
    return ctx


SSL_CTX = make_ssl_context()


def http_json(url, payload=None, headers=None, timeout=15):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={
        'Content-Type': 'application/json',
        'User-Agent': 'NoirMarket/1.0',  # Cloudflare режет дефолтный UA urllib
        **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
        return json.loads(resp.read().decode())


def crypto_api(method, params=None):
    """Вызов Crypto Pay API (https://help.crypt.bot/crypto-pay-api)."""
    try:
        data = http_json(f'{CRYPTO_API}/{method}', params or {},
                         {'Crypto-Pay-API-Token': CRYPTO_TOKEN})
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read().decode())
        except Exception:
            raise ApiError(502, f'CryptoBot HTTP {e.code}')
    if not data.get('ok'):
        err = data.get('error') or {}
        raise ApiError(502, f"CryptoBot: {err.get('name', err)}")
    return data['result']


def tg_api(method, params=None, timeout=15):
    try:
        return http_json(f'https://api.telegram.org/bot{BOT_TOKEN}/{method}', params or {},
                         timeout=timeout)
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def notify_admins(text):
    def run():
        for admin_id in ADMIN_IDS:
            tg_api('sendMessage', {'chat_id': admin_id, 'text': text, 'parse_mode': 'HTML'})
    threading.Thread(target=run, daemon=True).start()


# ---------------------------------------------------------------------------
# Бот: единственная задача — по /start прислать кнопку открытия мини-аппа
# ---------------------------------------------------------------------------

def send_welcome(chat_id, user_id):
    conn = db()
    try:
        settings = get_settings(conn)
    finally:
        conn.close()
    url = (settings.get('webapp_url') or '').strip()
    text = (f"▪ <b>{settings.get('shop_name', 'STICKERS')}</b>\n"
            f"{settings.get('tagline', '')}\n\n"
            "▪ Каталог, корзина и оплата — в мини-аппе\n"
            "▪ Оплата криптой через @CryptoBot (USDT, TON, BTC…)\n"
            "▪ После оплаты собираем посылку и шлём трек-номер")
    params = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
    if url.startswith('https://'):
        params['reply_markup'] = {'inline_keyboard': [[
            {'text': '🛍 Открыть магазин', 'web_app': {'url': url}}]]}
        params['text'] += '\n\nЖми кнопку ниже 👇'
    elif user_id in ADMIN_IDS:
        params['text'] += ('\n\n⚙️ <i>Кнопка мини-аппа появится, когда укажешь публичный '
                           'HTTPS-адрес: админка → Настройки → URL мини-аппа '
                           '(или scripts/setup_bot.py).</i>')
    else:
        params['text'] += '\n\n⏳ Магазин скоро откроется — загляни чуть позже.'
    resp = tg_api('sendMessage', params)
    if not resp.get('ok') and 'reply_markup' in params:
        # например, невалидный web_app URL — шлём без кнопки, чтобы юзер не остался без ответа
        params.pop('reply_markup')
        tg_api('sendMessage', params)


def handle_update(update):
    msg = update.get('message') or {}
    chat = msg.get('chat') or {}
    sender = msg.get('from') or {}
    if chat.get('type') != 'private' or not sender.get('id'):
        return
    # регистрируем в базе — попадёт в рассылки и статистику ещё до первой покупки
    conn = db()
    try:
        upsert_user(conn, {'id': sender['id'], 'username': sender.get('username', ''),
                           'first_name': sender.get('first_name', ''), 'photo_url': ''})
        conn.commit()
    finally:
        conn.close()
    # бот отвечает одним и тем же на любое сообщение: вся жизнь — в мини-аппе
    send_welcome(chat['id'], sender['id'])


def bot_loop():
    tg_api('deleteWebhook', {'drop_pending_updates': False})
    offset = 0
    print('[bot] long-polling запущен: жду /start', flush=True)
    while True:
        resp = tg_api('getUpdates', {'offset': offset, 'timeout': 25,
                                     'allowed_updates': ['message']}, timeout=35)
        if not resp.get('ok'):
            time.sleep(3)
            continue
        for update in resp.get('result', []):
            offset = update['update_id'] + 1
            try:
                handle_update(update)
            except Exception as e:
                sys.stderr.write(f'[bot] ошибка обработки апдейта: {e}\n')


# ---------------------------------------------------------------------------
# Авторизация: Telegram WebApp initData
# ---------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# Request language (from X-Lang) for API error messages
_request_lang = ContextVar('request_lang', default='ru')

ERR = {
    'auth_invalid': {
        'ru': 'Невалидная авторизация Telegram',
        'en': 'Invalid Telegram authorization',
    },
    'banned': {
        'ru': 'Вы заблокированы в этом магазине',
        'en': 'You are banned from this shop',
    },
    'admin_only': {
        'ru': 'Доступ только для администратора',
        'en': 'Admin access only',
    },
    'image_too_big': {
        'ru': 'Фото слишком большое (макс. {n} МБ)',
        'en': 'Image too large (max {n} MB)',
    },
    'image_type': {
        'ru': 'Нужен JPEG, PNG, WebP или GIF',
        'en': 'Need JPEG, PNG, WebP or GIF',
    },
    'image_missing': {
        'ru': 'Нет файла изображения',
        'en': 'No image file',
    },
    'image_data_url': {
        'ru': 'Некорректный data-URL',
        'en': 'Invalid data-URL',
    },
    'image_base64_url': {
        'ru': 'Ожидается base64 data-URL',
        'en': 'Expected base64 data-URL',
    },
    'image_base64': {
        'ru': 'Некорректный base64',
        'en': 'Invalid base64',
    },
    'promo_not_found': {
        'ru': 'Промокод не найден',
        'en': 'Promo code not found',
    },
    'promo_exhausted': {
        'ru': 'Промокод исчерпан',
        'en': 'Promo code exhausted',
    },
    'promo_required': {
        'ru': 'Укажите промокод',
        'en': 'Enter a promo code',
    },
    'ship_required': {
        'ru': 'Укажите адрес доставки',
        'en': 'Enter shipping address',
    },
    'ship_name': {
        'ru': 'Укажите ФИО получателя',
        'en': 'Enter recipient name',
    },
    'ship_phone': {
        'ru': 'Укажите корректный телефон',
        'en': 'Enter a valid phone number',
    },
    'ship_city': {
        'ru': 'Укажите город',
        'en': 'Enter city',
    },
    'ship_address': {
        'ru': 'Укажите улицу и дом',
        'en': 'Enter street and building',
    },
    'ship_postal': {
        'ru': 'Некорректный индекс',
        'en': 'Invalid postal code',
    },
    'cart_empty': {
        'ru': 'Корзина пуста',
        'en': 'Cart is empty',
    },
    'product_unavailable': {
        'ru': 'Товар недоступен',
        'en': 'Product unavailable',
    },
    'stock_low': {
        'ru': '«{name}»: недостаточно на складе',
        'en': '«{name}»: not enough in stock',
    },
    'pay_unavailable': {
        'ru': 'Оплата временно недоступна — попробуйте позже',
        'en': 'Payments temporarily unavailable — try again later',
    },
    'tracking_required': {
        'ru': 'Укажите трек-номер',
        'en': 'Enter tracking number',
    },
    'order_not_found': {
        'ru': 'Заказ не найден',
        'en': 'Order not found',
    },
    'ship_paid_only': {
        'ru': 'Отправить можно только оплаченный заказ',
        'en': 'Only paid orders can be shipped',
    },
    'name_required': {
        'ru': 'Название обязательно',
        'en': 'Name is required',
    },
    'price_invalid': {
        'ru': 'Некорректная цена',
        'en': 'Invalid price',
    },
    'price_positive': {
        'ru': 'Цена должна быть больше нуля',
        'en': 'Price must be greater than zero',
    },
    'stock_invalid': {
        'ru': 'Некорректный остаток на складе',
        'en': 'Invalid stock quantity',
    },
    'stock_too_big': {
        'ru': 'Слишком большой остаток',
        'en': 'Stock quantity too large',
    },
    'product_not_found': {
        'ru': 'Товар не найден',
        'en': 'Product not found',
    },
    'qty_required': {
        'ru': 'Укажите количество',
        'en': 'Enter quantity',
    },
    'qty_invalid': {
        'ru': 'Некорректное количество',
        'en': 'Invalid quantity',
    },
    'promo_code_format': {
        'ru': 'Код: 2–32 символа, латиница/цифры',
        'en': 'Code: 2–32 chars, Latin letters/digits',
    },
    'promo_percent': {
        'ru': 'Скидка: от 1 до 100%',
        'en': 'Discount: 1 to 100%',
    },
    'promo_exists': {
        'ru': 'Такой код уже существует',
        'en': 'This code already exists',
    },
    'ban_admin': {
        'ru': 'Нельзя забанить администратора',
        'en': 'Cannot ban an administrator',
    },
    'broadcast_empty': {
        'ru': 'Пустое сообщение',
        'en': 'Empty message',
    },
    'request_too_big': {
        'ru': 'Слишком большой запрос',
        'en': 'Request too large',
    },
    'json_invalid': {
        'ru': 'Некорректный JSON',
        'en': 'Invalid JSON',
    },
    'api_unknown': {
        'ru': 'Неизвестный метод API',
        'en': 'Unknown API method',
    },
    'internal': {
        'ru': 'Внутренняя ошибка сервера',
        'en': 'Internal server error',
    },
}


def err(code, **kwargs):
    lang = _request_lang.get() or 'ru'
    if lang not in ('ru', 'en'):
        lang = 'ru'
    entry = ERR.get(code) or {}
    msg = entry.get(lang) or entry.get('ru') or code
    if kwargs:
        try:
            msg = msg.format(**kwargs)
        except (KeyError, ValueError):
            pass
    return msg


def validate_init_data(raw):
    """Проверка подписи initData по алгоритму Telegram (HMAC-SHA256)."""
    if not raw:
        return None
    try:
        pairs = urllib.parse.parse_qsl(raw, keep_blank_values=True)
    except Exception:
        return None
    data = dict(pairs)
    received_hash = data.pop('hash', None)
    if not received_hash:
        return None
    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(data.items()))
    secret = hmac.new(b'WebAppData', BOT_TOKEN.encode(), hashlib.sha256).digest()
    calc_hash = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, received_hash):
        return None
    try:
        if time.time() - int(data.get('auth_date', '0')) > AUTH_MAX_AGE:
            return None
        user = json.loads(data.get('user', '{}'))
        return user if user.get('id') else None
    except Exception:
        return None


def resolve_user(init_data):
    user = validate_init_data(init_data)
    if user is None and DEV_MODE and not init_data:
        # Демо-режим для обычного браузера: даём первого админа
        dev_id = next(iter(ADMIN_IDS), 1)
        user = {'id': dev_id, 'first_name': 'Dev', 'username': 'dev_mode', 'photo_url': ''}
    if user is None:
        raise ApiError(401, err('auth_invalid'))
    return user


def upsert_user(conn, user):
    now = now_iso()
    conn.execute(
        'INSERT INTO users(id, username, first_name, photo_url, created_at, last_seen)'
        ' VALUES(?,?,?,?,?,?)'
        ' ON CONFLICT(id) DO UPDATE SET username=excluded.username,'
        ' first_name=excluded.first_name, photo_url=excluded.photo_url, last_seen=excluded.last_seen',
        (user['id'], user.get('username', ''), user.get('first_name', ''),
         user.get('photo_url', ''), now, now))


def check_banned(conn, user_id):
    row = conn.execute('SELECT is_banned FROM users WHERE id=?', (user_id,)).fetchone()
    if row and row['is_banned']:
        raise ApiError(403, err('banned'))


def require_admin(user):
    if user['id'] not in ADMIN_IDS:
        raise ApiError(403, err('admin_only'))


# ---------------------------------------------------------------------------
# Бизнес-логика: заказы, доставка, оплата
# ---------------------------------------------------------------------------

def get_settings(conn):
    return {r['key']: r['value'] for r in conn.execute('SELECT key, value FROM settings')}


def stock_left(conn, product_id):
    row = conn.execute('SELECT stock_qty FROM products WHERE id=?', (product_id,)).fetchone()
    return max(0, int(row['stock_qty'])) if row else 0


def product_public(conn, row, with_content=False):
    p = dict(row)
    p['stock_left'] = stock_left(conn, p['id'])
    p['delivery_type'] = 'physical'
    p['image'] = (p.get('image') or '').strip()
    if not with_content:
        p.pop('content', None)
    return p


def detect_image(data):
    if len(data) < 12:
        return None, None
    if data[:3] == b'\xff\xd8\xff':
        return 'jpg', 'image/jpeg'
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png', 'image/png'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif', 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp', 'image/webp'
    return None, None


def image_disk_path(image_url):
    """Безопасный путь к файлу фото по публичному URL /media/products/..."""
    if not image_url:
        return None
    name = os.path.basename(image_url)
    if not re.fullmatch(r'[a-f0-9]{32}\.(jpg|jpeg|png|webp|gif)', name, re.I):
        return None
    path = os.path.normpath(os.path.join(UPLOADS_DIR, name))
    if not path.startswith(UPLOADS_DIR):
        return None
    return path


def delete_product_image_file(image_url):
    path = image_disk_path(image_url)
    if path and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


def save_product_image_bytes(data):
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ApiError(400, err('image_too_big', n=MAX_IMAGE_BYTES // (1024 * 1024)))
    ext, _ctype = detect_image(data)
    if not ext:
        raise ApiError(400, err('image_type'))
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    name = secrets.token_hex(16) + '.' + ext
    path = os.path.join(UPLOADS_DIR, name)
    with open(path, 'wb') as f:
        f.write(data)
    return f'/media/products/{name}'


def decode_image_payload(body):
    """Принимает data-URL или чистый base64."""
    raw = body.get('image') or body.get('data') or ''
    if not isinstance(raw, str) or not raw.strip():
        raise ApiError(400, err('image_missing'))
    raw = raw.strip()
    if raw.startswith('data:'):
        try:
            header, b64 = raw.split(',', 1)
        except ValueError:
            raise ApiError(400, err('image_data_url'))
        if ';base64' not in header:
            raise ApiError(400, err('image_base64_url'))
    else:
        b64 = raw
    try:
        data = base64.b64decode(b64, validate=True)
    except Exception:
        raise ApiError(400, err('image_base64'))
    return data


def find_promo(conn, code):
    if not code:
        return None
    promo = conn.execute('SELECT * FROM promos WHERE code=? COLLATE NOCASE AND active=1',
                         (code.strip(),)).fetchone()
    if not promo:
        raise ApiError(400, err('promo_not_found'))
    if promo['max_uses'] and promo['used'] >= promo['max_uses']:
        raise ApiError(400, err('promo_exhausted'))
    return promo


def parse_shipping(body):
    raw = body.get('shipping') or {}
    if not isinstance(raw, dict):
        raise ApiError(400, err('ship_required'))
    name = (raw.get('name') or '').strip()
    phone = (raw.get('phone') or '').strip()
    city = (raw.get('city') or '').strip()
    address = (raw.get('address') or '').strip()
    postal = (raw.get('postal') or '').strip()
    comment = (raw.get('comment') or '').strip()
    if not name or len(name) < 2:
        raise ApiError(400, err('ship_name'))
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) < 10 or len(phone) > 32:
        raise ApiError(400, err('ship_phone'))
    if not city or len(city) < 2:
        raise ApiError(400, err('ship_city'))
    if not address or len(address) < 5:
        raise ApiError(400, err('ship_address'))
    if postal and (len(postal) > 16 or not postal.replace('-', '').replace(' ', '').isalnum()):
        raise ApiError(400, err('ship_postal'))
    return {
        'name': name[:120],
        'phone': phone[:32],
        'city': city[:80],
        'address': address[:240],
        'postal': postal[:16],
        'comment': comment[:240],
    }


def create_order(conn, user, body):
    items_req = body.get('items') or []
    if not items_req:
        raise ApiError(400, err('cart_empty'))
    shipping = parse_shipping(body)
    items, subtotal = [], 0.0
    for it in items_req:
        product = conn.execute('SELECT * FROM products WHERE id=? AND active=1',
                               (int(it.get('id', 0)),)).fetchone()
        if not product:
            raise ApiError(400, err('product_unavailable'))
        qty = max(1, min(int(it.get('qty', 1)), 50))
        if stock_left(conn, product['id']) < qty:
            raise ApiError(400, err('stock_low', name=product['name']))
        items.append({'id': product['id'], 'name': product['name'], 'price': product['price'],
                      'qty': qty, 'icon': product['icon'], 'delivery_type': 'physical'})
        subtotal += product['price'] * qty

    promo = find_promo(conn, body.get('promo'))
    percent = promo['percent'] if promo else 0
    subtotal = round(subtotal, 2)
    discount = round(subtotal * percent / 100, 2)
    total = round(subtotal - discount, 2)

    cur = conn.execute(
        'INSERT INTO orders(user_id, items_json, subtotal, discount, total, promo_code, status,'
        ' shipping_json, created_at) VALUES(?,?,?,?,?,?,\'pending\',?,?)',
        (user['id'], json.dumps(items, ensure_ascii=False), subtotal, discount, total,
         promo['code'] if promo else None, json.dumps(shipping, ensure_ascii=False), now_iso()))
    order_id = cur.lastrowid

    if total <= 0:
        conn.commit()
        order = conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
        deliver_order(conn, order)
        return order_row(conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone())

    if not CRYPTO_TOKEN or CRYPTO_TOKEN.startswith('PASTE_'):
        raise ApiError(503, err('pay_unavailable'))

    settings = get_settings(conn)
    invoice = crypto_api('createInvoice', {
        'currency_type': 'fiat',
        'fiat': CURRENCY,
        'amount': f'{total:.2f}',
        'description': f"{settings.get('shop_name', 'Shop')} — заказ #{order_id}"[:1024],
        'payload': str(order_id),
        'expires_in': INVOICE_TTL,
    })
    pay_url = (invoice.get('mini_app_invoice_url') or invoice.get('bot_invoice_url')
               or invoice.get('pay_url'))
    conn.execute('UPDATE orders SET invoice_id=?, pay_url=? WHERE id=?',
                 (invoice['invoice_id'], pay_url, order_id))
    conn.commit()
    return order_row(conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone())


def deliver_order(conn, order):
    """Оплата подтверждена: резервируем склад и ставим заказ в сборку."""
    with DELIVER_LOCK:
        fresh = conn.execute('SELECT status FROM orders WHERE id=?', (order['id'],)).fetchone()
        if not fresh or fresh['status'] != 'pending':
            return
        shipping = json.loads(order['shipping_json'] or '{}')
        summary = []
        for it in json.loads(order['items_json']):
            left = stock_left(conn, it['id'])
            if left < it['qty']:
                # частичный дефицит — всё равно фиксируем оплату, админ разберётся
                pass
            conn.execute(
                'UPDATE products SET stock_qty=MAX(0, stock_qty-?), sales=sales+? WHERE id=?',
                (it['qty'], it['qty'], it['id']))
            summary.append({'product_id': it['id'], 'name': it['name'], 'qty': it['qty'],
                            'icon': it['icon']})
        note = {
            'status_key': 'paid_packing',
            'status_text': 'Заказ оплачен. Собираем посылку — трек появится здесь.',
            'items': summary,
            'shipping': shipping,
        }
        conn.execute("UPDATE orders SET status='paid', paid_at=?, delivery_json=? WHERE id=?",
                     (now_iso(), json.dumps(note, ensure_ascii=False), order['id']))
        if order['promo_code']:
            conn.execute('UPDATE promos SET used=used+1 WHERE code=? COLLATE NOCASE', (order['promo_code'],))
        conn.commit()

    buyer = conn.execute('SELECT username, first_name FROM users WHERE id=?', (order['user_id'],)).fetchone()
    who = ('@' + buyer['username']) if buyer and buyer['username'] else (buyer['first_name'] if buyer else order['user_id'])
    names = ', '.join(f"{d['name']} ×{d['qty']}" for d in summary)
    ship = f"{shipping.get('city', '')}, {shipping.get('address', '')}"
    notify_admins(f'💰 <b>Оплачен заказ #{order["id"]}</b>\n'
                  f'Сумма: <b>${order["total"]:.2f}</b>\nПокупатель: {who}\n'
                  f'Состав: {names}\nДоставка: {ship}\n📞 {shipping.get("phone", "")}')


def ship_order(conn, order_id, tracking):
    tracking = (tracking or '').strip()[:120]
    if not tracking:
        raise ApiError(400, err('tracking_required'))
    order = conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not order:
        raise ApiError(404, err('order_not_found'))
    if order['status'] not in ('paid', 'shipped'):
        raise ApiError(400, err('ship_paid_only'))
    conn.execute("UPDATE orders SET status='shipped', tracking=?, shipped_at=? WHERE id=?",
                 (tracking, now_iso(), order_id))
    conn.commit()
    tg_api('sendMessage', {
        'chat_id': order['user_id'],
        'text': (f'📦 Order <b>#{order_id}</b> shipped!\n'
                 f'Tracking: <code>{tracking}</code>\n\n'
                 f'📦 Заказ <b>#{order_id}</b> отправлен!\n'
                 f'Трек-номер: <code>{tracking}</code>'),
        'parse_mode': 'HTML',
    })
    return order_row(conn.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone())


def check_order_payment(conn, order):
    """Опрос Crypto Pay API по pending-заказу; при оплате — сборка."""
    if order['status'] != 'pending' or not order['invoice_id']:
        return order
    try:
        result = crypto_api('getInvoices', {'invoice_ids': str(order['invoice_id'])})
    except ApiError:
        return order
    invoices = result.get('items', result) if isinstance(result, dict) else result
    if not invoices:
        return order
    status = invoices[0].get('status')
    if status == 'paid':
        deliver_order(conn, order)
    elif status == 'expired':
        conn.execute("UPDATE orders SET status='expired' WHERE id=? AND status='pending'", (order['id'],))
        conn.commit()
    return conn.execute('SELECT * FROM orders WHERE id=?', (order['id'],)).fetchone()


def order_row(row, include_user=False, conn=None):
    o = dict(row)
    o['items'] = json.loads(o.pop('items_json') or '[]')
    o['delivery'] = json.loads(o.pop('delivery_json') or 'null')
    o['shipping'] = json.loads(o.pop('shipping_json') or 'null')
    if include_user and conn is not None:
        u = conn.execute('SELECT username, first_name FROM users WHERE id=?', (o['user_id'],)).fetchone()
        o['username'] = (u['username'] or u['first_name']) if u else str(o['user_id'])
    return o


# ---------------------------------------------------------------------------
# API-маршруты
# ---------------------------------------------------------------------------

def api_auth(conn, user, body, m):
    upsert_user(conn, user)
    conn.commit()
    check_banned(conn, user['id'])
    return {'user': {'id': user['id'], 'first_name': user.get('first_name', ''),
                     'username': user.get('username', ''), 'photo_url': user.get('photo_url', '')},
            'is_admin': user['id'] in ADMIN_IDS,
            'settings': get_settings(conn)}


def api_shop(conn, user, body, m):
    check_banned(conn, user['id'])
    categories = [dict(r) for r in conn.execute(
        'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1) AS count'
        ' FROM categories c ORDER BY sort, id')]
    products = [product_public(conn, r) for r in conn.execute(
        'SELECT * FROM products WHERE active=1 ORDER BY sort, id DESC')]
    return {'categories': categories, 'products': products, 'settings': get_settings(conn)}


def api_promo_check(conn, user, body, m):
    promo = find_promo(conn, body.get('code'))
    if not promo:
        raise ApiError(400, err('promo_required'))
    return {'code': promo['code'], 'percent': promo['percent']}


def api_order_create(conn, user, body, m):
    upsert_user(conn, user)
    check_banned(conn, user['id'])
    return create_order(conn, user, body)


def api_order_get(conn, user, body, m):
    order = conn.execute('SELECT * FROM orders WHERE id=? AND user_id=?',
                         (int(m.group(1)), user['id'])).fetchone()
    if not order:
        raise ApiError(404, err('order_not_found'))
    order = check_order_payment(conn, order)
    return order_row(order)


def api_my_orders(conn, user, body, m):
    rows = conn.execute('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100',
                        (user['id'],)).fetchall()
    return {'orders': [order_row(r) for r in rows]}


# --- админ ---

def api_admin_overview(conn, user, body, m):
    require_admin(user)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    q = lambda sql, *a: conn.execute(sql, a).fetchone()[0]
    recent = [order_row(r, include_user=True, conn=conn) for r in conn.execute(
        'SELECT * FROM orders ORDER BY id DESC LIMIT 8')]
    top = [dict(r) for r in conn.execute(
        'SELECT name, icon, image, sales, price FROM products WHERE sales>0 ORDER BY sales DESC LIMIT 5')]
    return {
        'revenue_total': q("SELECT COALESCE(SUM(total),0) FROM orders WHERE status IN ('paid','shipped')"),
        'revenue_today': q("SELECT COALESCE(SUM(total),0) FROM orders WHERE status IN ('paid','shipped') AND paid_at LIKE ?", today + '%'),
        'orders_paid': q("SELECT COUNT(*) FROM orders WHERE status IN ('paid','shipped')"),
        'orders_pending': q("SELECT COUNT(*) FROM orders WHERE status='pending'"),
        'users_count': q('SELECT COUNT(*) FROM users'),
        'products_count': q('SELECT COUNT(*) FROM products'),
        'stock_total': q('SELECT COALESCE(SUM(stock_qty),0) FROM products'),
        'orders_shipped': q("SELECT COUNT(*) FROM orders WHERE status='shipped'"),
        'orders_to_ship': q("SELECT COUNT(*) FROM orders WHERE status='paid'"),
        'top_products': top,
        'recent_orders': recent,
    }


def api_admin_products(conn, user, body, m):
    require_admin(user)
    return {'products': [product_public(conn, r, with_content=True) for r in conn.execute(
        'SELECT * FROM products ORDER BY sort, id DESC')]}


PRODUCT_FIELDS = ('name', 'subtitle', 'description', 'price', 'old_price', 'icon', 'badge',
                  'delivery_type', 'content', 'stock_qty', 'active', 'sort', 'category_id')


def clean_product(body):
    name = (body.get('name') or '').strip()
    if not name:
        raise ApiError(400, err('name_required'))
    try:
        price = round(float(body.get('price', 0)), 2)
    except (TypeError, ValueError):
        raise ApiError(400, err('price_invalid'))
    if price <= 0:
        raise ApiError(400, err('price_positive'))
    old_price = body.get('old_price')
    try:
        old_price = round(float(old_price), 2) if old_price not in (None, '', 0) else None
    except (TypeError, ValueError):
        old_price = None
    try:
        stock_qty = max(0, int(body.get('stock_qty', 0) or 0))
    except (TypeError, ValueError):
        raise ApiError(400, err('stock_invalid'))
    if stock_qty > 100000:
        raise ApiError(400, err('stock_too_big'))
    cat = body.get('category_id')
    return {
        'name': name[:120],
        'subtitle': (body.get('subtitle') or '').strip()[:160],
        'description': (body.get('description') or '').strip()[:4000],
        'price': price, 'old_price': old_price,
        'icon': ((body.get('icon') or 'layers').strip() or 'layers')[:80],
        'badge': (body.get('badge') or '').strip()[:20],
        'delivery_type': 'physical',
        'content': '',
        'stock_qty': stock_qty,
        'active': 1 if body.get('active', True) else 0,
        'sort': int(body.get('sort') or 0),
        'category_id': int(cat) if cat else None,
    }


def api_admin_product_create(conn, user, body, m):
    require_admin(user)
    p = clean_product(body)
    cur = conn.execute(
        'INSERT INTO products(name, subtitle, description, price, old_price, icon, badge, delivery_type,'
        ' content, stock_qty, active, sort, category_id, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (*[p[f] for f in PRODUCT_FIELDS], now_iso()))
    conn.commit()
    return product_public(conn, conn.execute('SELECT * FROM products WHERE id=?', (cur.lastrowid,)).fetchone(), True)


def api_admin_product_update(conn, user, body, m):
    require_admin(user)
    pid = int(m.group(1))
    if not conn.execute('SELECT id FROM products WHERE id=?', (pid,)).fetchone():
        raise ApiError(404, err('product_not_found'))
    p = clean_product(body)
    conn.execute(f"UPDATE products SET {', '.join(f'{f}=?' for f in PRODUCT_FIELDS)} WHERE id=?",
                 (*[p[f] for f in PRODUCT_FIELDS], pid))
    conn.commit()
    return product_public(conn, conn.execute('SELECT * FROM products WHERE id=?', (pid,)).fetchone(), True)


def api_admin_product_delete(conn, user, body, m):
    require_admin(user)
    pid = int(m.group(1))
    row = conn.execute('SELECT image FROM products WHERE id=?', (pid,)).fetchone()
    conn.execute('DELETE FROM products WHERE id=?', (pid,))
    conn.commit()
    if row:
        delete_product_image_file(row['image'])
    return {'ok': True}


def api_admin_product_image(conn, user, body, m):
    """Загрузить / заменить фото товара (admin)."""
    require_admin(user)
    pid = int(m.group(1))
    row = conn.execute('SELECT image FROM products WHERE id=?', (pid,)).fetchone()
    if not row:
        raise ApiError(404, err('product_not_found'))
    data = decode_image_payload(body)
    url = save_product_image_bytes(data)
    old = row['image']
    conn.execute('UPDATE products SET image=? WHERE id=?', (url, pid))
    conn.commit()
    if old and old != url:
        delete_product_image_file(old)
    return product_public(conn, conn.execute('SELECT * FROM products WHERE id=?', (pid,)).fetchone(), True)


def api_admin_product_image_delete(conn, user, body, m):
    require_admin(user)
    pid = int(m.group(1))
    row = conn.execute('SELECT image FROM products WHERE id=?', (pid,)).fetchone()
    if not row:
        raise ApiError(404, err('product_not_found'))
    conn.execute("UPDATE products SET image='' WHERE id=?", (pid,))
    conn.commit()
    delete_product_image_file(row['image'])
    return product_public(conn, conn.execute('SELECT * FROM products WHERE id=?', (pid,)).fetchone(), True)


def api_admin_stock_add(conn, user, body, m):
    """Увеличить / выставить остаток наклейки на складе."""
    require_admin(user)
    pid = int(m.group(1))
    if not conn.execute('SELECT id FROM products WHERE id=?', (pid,)).fetchone():
        raise ApiError(404, err('product_not_found'))
    try:
        if 'stock_qty' in body and body.get('add') is None:
            qty = max(0, int(body.get('stock_qty', 0)))
            conn.execute('UPDATE products SET stock_qty=? WHERE id=?', (qty, pid))
        else:
            add = int(body.get('add') or body.get('qty') or 0)
            if add == 0:
                raise ApiError(400, err('qty_required'))
            conn.execute('UPDATE products SET stock_qty=MAX(0, stock_qty+?) WHERE id=?', (add, pid))
    except (TypeError, ValueError):
        raise ApiError(400, err('qty_invalid'))
    conn.commit()
    return {'stock_left': stock_left(conn, pid)}


def api_admin_order_ship(conn, user, body, m):
    require_admin(user)
    return ship_order(conn, int(m.group(1)), body.get('tracking'))


def api_admin_categories_create(conn, user, body, m):
    require_admin(user)
    name = (body.get('name') or '').strip()
    if not name:
        raise ApiError(400, err('name_required'))
    conn.execute('INSERT INTO categories(name, icon, sort) VALUES(?,?,?)',
                 (name[:60], (body.get('icon') or 'folder').strip()[:80], int(body.get('sort') or 0)))
    conn.commit()
    return {'ok': True}


def api_admin_categories_update(conn, user, body, m):
    require_admin(user)
    conn.execute('UPDATE categories SET name=?, icon=?, sort=? WHERE id=?',
                 ((body.get('name') or '').strip()[:60], (body.get('icon') or 'folder').strip()[:80],
                  int(body.get('sort') or 0), int(m.group(1))))
    conn.commit()
    return {'ok': True}


def api_admin_categories_delete(conn, user, body, m):
    require_admin(user)
    conn.execute('DELETE FROM categories WHERE id=?', (int(m.group(1)),))
    conn.commit()
    return {'ok': True}


def api_admin_orders(conn, user, body, m):
    require_admin(user)
    return {'orders': [order_row(r, include_user=True, conn=conn) for r in conn.execute(
        'SELECT * FROM orders ORDER BY id DESC LIMIT 200')]}


def api_admin_order_check(conn, user, body, m):
    require_admin(user)
    order = conn.execute('SELECT * FROM orders WHERE id=?', (int(m.group(1)),)).fetchone()
    if not order:
        raise ApiError(404, err('order_not_found'))
    return order_row(check_order_payment(conn, order), include_user=True, conn=conn)


def api_admin_promos(conn, user, body, m):
    require_admin(user)
    return {'promos': [dict(r) for r in conn.execute('SELECT * FROM promos ORDER BY id DESC')]}


def api_admin_promo_create(conn, user, body, m):
    require_admin(user)
    code = (body.get('code') or '').strip().upper()
    percent = int(body.get('percent') or 0)
    if not re.fullmatch(r'[A-Z0-9_-]{2,32}', code):
        raise ApiError(400, err('promo_code_format'))
    if not 1 <= percent <= 100:
        raise ApiError(400, err('promo_percent'))
    try:
        conn.execute('INSERT INTO promos(code, percent, max_uses) VALUES(?,?,?)',
                     (code, percent, int(body.get('max_uses') or 0)))
    except sqlite3.IntegrityError:
        raise ApiError(400, err('promo_exists'))
    conn.commit()
    return {'ok': True}


def api_admin_promo_update(conn, user, body, m):
    require_admin(user)
    conn.execute('UPDATE promos SET active=? WHERE id=?',
                 (1 if body.get('active') else 0, int(m.group(1))))
    conn.commit()
    return {'ok': True}


def api_admin_promo_delete(conn, user, body, m):
    require_admin(user)
    conn.execute('DELETE FROM promos WHERE id=?', (int(m.group(1)),))
    conn.commit()
    return {'ok': True}


def api_admin_users(conn, user, body, m):
    require_admin(user)
    rows = conn.execute(
        'SELECT u.*, COUNT(o.id) AS orders_count, COALESCE(SUM(o.total), 0) AS spent'
        " FROM users u LEFT JOIN orders o ON o.user_id=u.id AND o.status='paid'"
        ' GROUP BY u.id ORDER BY spent DESC, u.last_seen DESC LIMIT 500').fetchall()
    return {'users': [dict(r) for r in rows]}


def api_admin_user_ban(conn, user, body, m):
    require_admin(user)
    uid = int(m.group(1))
    if uid in ADMIN_IDS:
        raise ApiError(400, err('ban_admin'))
    conn.execute('UPDATE users SET is_banned=? WHERE id=?', (1 if body.get('banned') else 0, uid))
    conn.commit()
    return {'ok': True}


def api_admin_broadcast(conn, user, body, m):
    require_admin(user)
    text = (body.get('text') or '').strip()
    if not text:
        raise ApiError(400, err('broadcast_empty'))
    ids = [r['id'] for r in conn.execute('SELECT id FROM users WHERE is_banned=0')]

    def run():
        sent = 0
        for uid in ids:
            if tg_api('sendMessage', {'chat_id': uid, 'text': text, 'parse_mode': 'HTML'}).get('ok'):
                sent += 1
            time.sleep(0.06)
        notify_admins(f'📣 Рассылка завершена: доставлено {sent} из {len(ids)}')
    threading.Thread(target=run, daemon=True).start()
    return {'started': True, 'recipients': len(ids)}


def api_admin_settings_get(conn, user, body, m):
    require_admin(user)
    return get_settings(conn)


def api_admin_settings_put(conn, user, body, m):
    require_admin(user)
    for key in DEFAULT_SETTINGS:
        if key in body:
            conn.execute('INSERT INTO settings(key, value) VALUES(?, ?)'
                         ' ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                         (key, str(body[key]).strip()[:300]))
    conn.commit()
    return get_settings(conn)


ROUTES = [
    ('POST', r'/api/auth$', api_auth),
    ('GET', r'/api/shop$', api_shop),
    ('POST', r'/api/promo/check$', api_promo_check),
    ('POST', r'/api/orders$', api_order_create),
    ('GET', r'/api/orders/(\d+)$', api_order_get),
    ('GET', r'/api/my/orders$', api_my_orders),
    ('GET', r'/api/admin/overview$', api_admin_overview),
    ('GET', r'/api/admin/products$', api_admin_products),
    ('POST', r'/api/admin/products$', api_admin_product_create),
    ('PUT', r'/api/admin/products/(\d+)$', api_admin_product_update),
    ('DELETE', r'/api/admin/products/(\d+)$', api_admin_product_delete),
    ('POST', r'/api/admin/products/(\d+)/image$', api_admin_product_image),
    ('DELETE', r'/api/admin/products/(\d+)/image$', api_admin_product_image_delete),
    ('POST', r'/api/admin/products/(\d+)/stock$', api_admin_stock_add),
    ('POST', r'/api/admin/categories$', api_admin_categories_create),
    ('PUT', r'/api/admin/categories/(\d+)$', api_admin_categories_update),
    ('DELETE', r'/api/admin/categories/(\d+)$', api_admin_categories_delete),
    ('GET', r'/api/admin/orders$', api_admin_orders),
    ('POST', r'/api/admin/orders/(\d+)/check$', api_admin_order_check),
    ('POST', r'/api/admin/orders/(\d+)/ship$', api_admin_order_ship),
    ('GET', r'/api/admin/promos$', api_admin_promos),
    ('POST', r'/api/admin/promos$', api_admin_promo_create),
    ('PUT', r'/api/admin/promos/(\d+)$', api_admin_promo_update),
    ('DELETE', r'/api/admin/promos/(\d+)$', api_admin_promo_delete),
    ('GET', r'/api/admin/users$', api_admin_users),
    ('POST', r'/api/admin/users/(\d+)/ban$', api_admin_user_ban),
    ('POST', r'/api/admin/broadcast$', api_admin_broadcast),
    ('GET', r'/api/admin/settings$', api_admin_settings_get),
    ('PUT', r'/api/admin/settings$', api_admin_settings_put),
]


# ---------------------------------------------------------------------------
# HTTP-сервер
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = 'NoirMarket/1.0'

    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (datetime.now().strftime('%H:%M:%S'), fmt % args))

    # --- ответы ---

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path, cache='no-store'):
        try:
            with open(path, 'rb') as f:
                body = f.read()
        except OSError:
            self.send_json({'error': 'Not found'}, 404)
            return
        ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if path.lower().endswith('.webp'):
            ctype = 'image/webp'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
            ctype += '; charset=utf-8'
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    # --- обработка ---

    def handle_api(self, method):
        lang = (self.headers.get('X-Lang') or 'ru').strip().lower()
        if lang not in ('ru', 'en'):
            lang = 'ru'
        _request_lang.set(lang)
        parsed = urllib.parse.urlparse(self.path)
        body = {}
        if method in ('POST', 'PUT'):
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_IMAGE_BYTES * 2 + 4096 and '/image' in parsed.path:
                raise ApiError(400, err('request_too_big'))
            if length:
                raw = self.rfile.read(length)
                try:
                    body = json.loads(raw.decode())
                except Exception:
                    raise ApiError(400, err('json_invalid'))
        for route_method, pattern, func in ROUTES:
            if route_method != method:
                continue
            match = re.match(pattern, parsed.path)
            if match:
                user = resolve_user(self.headers.get('X-Init-Data', ''))
                conn = db()
                try:
                    result = func(conn, user, body, match)
                finally:
                    conn.close()
                self.send_json(result)
                return
        raise ApiError(404, err('api_unknown'))

    def handle_media(self):
        path = urllib.parse.urlparse(self.path).path
        # /media/products/<file>
        m = re.fullmatch(r'/media/products/([a-f0-9]{32}\.(?:jpg|jpeg|png|webp|gif))', path, re.I)
        if not m:
            self.send_json({'error': 'Not found'}, 404)
            return
        target = os.path.normpath(os.path.join(UPLOADS_DIR, m.group(1)))
        if not target.startswith(UPLOADS_DIR) or not os.path.isfile(target):
            self.send_json({'error': 'Not found'}, 404)
            return
        self.send_file(target, cache='public, max-age=86400')

    def handle_static(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ('/', '/index.html'):
            path = '/index.html'
        target = os.path.normpath(os.path.join(WEBAPP_DIR, path.lstrip('/')))
        if not target.startswith(WEBAPP_DIR):
            self.send_json({'error': 'Forbidden'}, 403)
            return
        if not os.path.isfile(target):
            # SPA-фолбэк: любые пути отдают index.html
            target = os.path.join(WEBAPP_DIR, 'index.html')
        self.send_file(target)

    def dispatch(self, method):
        try:
            path = urllib.parse.urlparse(self.path).path
            if path.startswith('/api/'):
                self.handle_api(method)
            elif path.startswith('/media/'):
                if method != 'GET':
                    self.send_json({'error': 'Method not allowed'}, 405)
                else:
                    self.handle_media()
            elif method == 'GET':
                self.handle_static()
            else:
                self.send_json({'error': 'Method not allowed'}, 405)
        except ApiError as e:
            self.send_json({'error': e.message}, e.status)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            sys.stderr.write(f'[ERROR] {type(e).__name__}: {e}\n')
            self.send_json({'error': err('internal')}, 500)

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def do_PUT(self):
        self.dispatch('PUT')

    def do_DELETE(self):
        self.dispatch('DELETE')


def main():
    if not BOT_TOKEN or BOT_TOKEN.startswith('PASTE_'):
        sys.exit('Заполни BOT_TOKEN в .env')
    if not CRYPTO_TOKEN or CRYPTO_TOKEN.startswith('PASTE_'):
        print('[warn] CRYPTOBOT_TOKEN не задан — оплата через CryptoBot недоступна', flush=True)
    init_db()
    threading.Thread(target=bot_loop, daemon=True).start()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'╔══════════════════════════════════════════╗')
    print(f'║  STICKERS · http://localhost:{PORT}       ║')
    print(f'║  Админы: {(", ".join(map(str, sorted(ADMIN_IDS))) or "—"):<32}║')
    print(f'║  DEV_MODE: {"ON (браузер = админ!)" if DEV_MODE else "off":<30}║')
    print(f'╚══════════════════════════════════════════╝', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
