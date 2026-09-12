/* ============================================================
   Food Букет — ядро мини-аппа
   ============================================================ */

const tg = window.Telegram ? window.Telegram.WebApp : null;
const IN_TG = !!(tg && tg.initData);

const state = {
  user: null,
  isAdmin: false,
  settings: {},
  categories: [],
  products: [],
  cart: [],
  promo: null,          // {code, percent}
  activeCat: 0,         // 0 = все
  search: '',
  view: 'home',
  myOrders: [],
  pollTimer: null,
};

/* ---------- утилиты ---------- */

const qs = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function money(v) {
  const sym = state.settings.currency_symbol || '₽';
  const n = Number(v || 0);
  if (sym === '₽') return Math.round(n).toLocaleString('ru-RU') + ' ' + sym;
  return sym + n.toFixed(2);
}

/** Фото товара или иконка-фолбэк */
function productMedia(p, size = 26, cls = 'p-photo') {
  if (p && p.image) {
    return `<img class="${cls}" src="${esc(p.image)}" alt="" loading="lazy" decoding="async">`;
  }
  return ic((p && p.icon) || 'layers', size);
}

function haptic(type = 'light') {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (type === 'success' || type === 'error' || type === 'warning') {
      tg.HapticFeedback.notificationOccurred(type);
    } else {
      tg.HapticFeedback.impactOccurred(type);
    }
  } catch (e) { /* не критично */ }
}

function toast(text, dark = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (dark ? ' dark' : '');
  el.innerHTML = `${dark ? ic('info', 16) : icDark('check', 16)}<span>${esc(text)}</span>`;
  qs('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 2400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  haptic('light');
  toast(t('copied'));
}

/* ---------- шторка ---------- */

let sheetCloseCb = null;

function openSheet(html, onClose) {
  sheetCloseCb = onClose || null;
  qs('#sheet-content').innerHTML = html;
  qs('#sheet').classList.remove('hidden');
  qs('#sheet-backdrop').classList.remove('hidden');
  if (IN_TG) { try { tg.BackButton.show(); } catch (e) {} }
  haptic('light');
}

function closeSheet() {
  qs('#sheet').classList.add('hidden');
  qs('#sheet-backdrop').classList.add('hidden');
  if (IN_TG) { try { tg.BackButton.hide(); } catch (e) {} }
  if (sheetCloseCb) { const cb = sheetCloseCb; sheetCloseCb = null; cb(); }
}

function confirmDialog(text, onYes) {
  openSheet(`
    <div class="center" style="padding:10px 4px">
      <div class="empty-icon" style="margin:0 auto 16px">${ic('circle-alert', 34)}</div>
      <div class="sheet-title" style="margin-bottom:18px">${esc(text)}</div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="cfNo">${esc(t('cancel'))}</button>
        <button class="btn" id="cfYes">${esc(t('yes'))}</button>
      </div>
    </div>`);
  qs('#cfNo').onclick = closeSheet;
  qs('#cfYes').onclick = () => { closeSheet(); onYes(); };
}

/* ---------- корзина (localStorage) ---------- */

function cartKey() { return 'foodbuket_cart_' + (state.user ? state.user.id : 'anon'); }

function loadCart() {
  try { state.cart = JSON.parse(localStorage.getItem(cartKey()) || '[]'); }
  catch (e) { state.cart = []; }
}

function saveCart() {
  localStorage.setItem(cartKey(), JSON.stringify(state.cart));
  updateNavDot();
}

function cartCount() { return state.cart.reduce((s, i) => s + i.qty, 0); }

function addToCart(productId, qty = 1) {
  const p = state.products.find((x) => x.id === productId);
  if (!p) return;
  const existing = state.cart.find((i) => i.id === productId);
  const max = p.stock_left ?? 50;
  if (existing) existing.qty = Math.min(existing.qty + qty, max);
  else state.cart.push({ id: productId, qty: Math.min(qty, max) });
  saveCart();
  haptic('medium');
  toast(t('added_cart'));
}

/* ---------- навигация ---------- */

const NAV = [
  { id: 'home', icon: 'flower-2', labelKey: 'nav_shop' },
  { id: 'cart', icon: 'shopping-cart', labelKey: 'nav_cart' },
  { id: 'profile', icon: 'user-round', labelKey: 'nav_profile' },
  { id: 'admin', icon: 'shield-half', labelKey: 'nav_admin', adminOnly: true },
];

function renderNav() {
  qs('#bottomnav').innerHTML = NAV
    .filter((n) => !n.adminOnly || state.isAdmin)
    .map((n) => `
      <button class="nav-item ${state.view === n.id ? 'active' : ''}" data-view="${n.id}">
        ${ic(n.icon, 22, state.view === n.id ? '#C23B5A' : '#8A9B90')}
        <span>${esc(t(n.labelKey))}</span>
        ${n.id === 'cart' && cartCount() ? `<b class="nav-dot">${cartCount()}</b>` : ''}
      </button>`)
    .join('');
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.onclick = () => switchView(btn.dataset.view);
  });
}

function updateNavDot() { renderNav(); }

function switchView(view) {
  state.view = view;
  haptic('light');
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  qs('#view-' + view).classList.add('active');
  qs('#marquee').style.display = view === 'home' ? '' : 'none';
  qs('#searchBar').classList.toggle('hidden', view !== 'home' || !state.search);
  renderNav();
  if (view === 'home') renderHome();
  if (view === 'cart') renderCart();
  if (view === 'profile') renderProfile();
  if (view === 'admin' && state.isAdmin) Admin.render();
  window.scrollTo({ top: 0 });
}

function refreshCurrentView() {
  applyChromeI18n();
  applyBranding();
  renderNav();
  if (state.view === 'home') renderHome();
  else if (state.view === 'cart') renderCart();
  else if (state.view === 'profile') renderProfile();
  else if (state.view === 'admin' && state.isAdmin) Admin.render();
}

function applyChromeI18n() {
  const searchBtn = qs('#searchBtn');
  if (searchBtn) searchBtn.setAttribute('aria-label', t('search_aria'));
  const searchInput = qs('#searchInput');
  if (searchInput) searchInput.placeholder = t('search_ph');
  const lang = I18N.lang();
  document.querySelectorAll('#langSwitch [data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function initLangSwitch() {
  const root = qs('#langSwitch');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.onclick = () => {
      I18N.setLang(btn.dataset.lang);
      refreshCurrentView();
    };
  });
  I18N.onChange(() => refreshCurrentView());
  applyChromeI18n();
}

/* ---------- главная ---------- */

function visibleProducts() {
  let list = state.products;
  if (state.activeCat) list = list.filter((p) => p.category_id === state.activeCat);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((p) =>
      (p.name + ' ' + p.subtitle + ' ' + p.description).toLowerCase().includes(q));
  }
  return list;
}

function productCard(p) {
  const out = (p.stock_left ?? 0) === 0;
  const stockLabel = out
    ? `<div class="p-stock out">${esc(t('out_of_stock'))}</div>`
    : `<div class="p-stock">${esc(t('in_stock', { n: p.stock_left }))}</div>`;
  return `
    <div class="p-card" data-id="${p.id}" style="${out ? 'opacity:.45' : ''}">
      ${p.badge ? `<div class="p-badge">${esc(p.badge)}</div>` : ''}
      <div class="p-media">${productMedia(p, 26)}</div>
      <div>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-sub">${esc(p.subtitle)}</div>
      </div>
      <div class="p-bottom">
        <div class="p-price">${money(p.price)}</div>
        ${p.old_price ? `<div class="p-old">${money(p.old_price)}</div>` : ''}
      </div>
      ${stockLabel}
    </div>`;
}

function renderHome() {
  const cats = state.categories.filter((c) => c.count > 0);
  const list = visibleProducts();
  qs('#view-home').innerHTML = `
    <div class="chips" id="chips">
      <button class="chip ${!state.activeCat ? 'active' : ''}" data-cat="0">
        ${ic('layout-grid', 15, !state.activeCat ? '#ffffff' : '#1A3A2F')} ${esc(t('all'))}
        <span class="count">${state.products.length}</span>
      </button>
      ${cats.map((c) => `
        <button class="chip ${state.activeCat === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${ic(c.icon, 15, state.activeCat === c.id ? '#ffffff' : '#1A3A2F')} ${esc(I18N.catName(c.name))}
          <span class="count">${c.count}</span>
        </button>`).join('')}
    </div>
    <div class="section-title">${esc(state.search ? t('search_results') : t('catalog'))}</div>
    ${list.length
      ? `<div class="grid">${list.map(productCard).join('')}</div>`
      : `<div class="empty">
           <div class="empty-icon">${icMuted('search-x', 36)}</div>
           <div class="empty-title">${esc(t('nothing_found'))}</div>
           <div class="empty-text">${esc(t('nothing_found_hint'))}</div>
         </div>`}
  `;
  document.querySelectorAll('#chips .chip').forEach((chip) => {
    chip.onclick = () => { state.activeCat = Number(chip.dataset.cat); haptic('light'); renderHome(); };
  });
  document.querySelectorAll('.p-card').forEach((card) => {
    card.onclick = () => openProduct(Number(card.dataset.id));
  });
}

/* ---------- карточка товара ---------- */

function openProduct(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const cat = state.categories.find((c) => c.id === p.category_id);
  const out = (p.stock_left ?? 0) === 0;
  const maxQty = Math.max(1, p.stock_left || 1);
  let qty = 1;

  const save = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  openSheet(`
    <div class="pd-head">
      <div class="pd-media">${productMedia(p, 32, 'pd-photo')}</div>
      <div>
        <div class="pd-cat">${esc(cat ? I18N.catName(cat.name) : t('stickers'))}</div>
        <div class="sheet-title">${esc(p.name)}</div>
      </div>
    </div>
    <div class="pd-price-row">
      <div class="pd-price">${money(p.price)}</div>
      ${p.old_price ? `<div class="pd-old">${money(p.old_price)}</div><div class="pd-save">−${save}%</div>` : ''}
    </div>
    <div class="pd-desc">${esc(p.description || p.subtitle)}</div>
    ${!out ? `
      <div class="qty-row">
        <div>
          <div style="font-weight:600;font-size:13.5px">${esc(t('qty'))}</div>
          <div class="small muted">${esc(t('in_stock', { n: p.stock_left }))}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" id="qMinus">−</button>
          <div class="qty-val" id="qVal">1</div>
          <button class="qty-btn" id="qPlus">+</button>
        </div>
      </div>` : ''}
    ${out
      ? `<button class="btn" disabled>${icDark('package-x', 17)} ${esc(t('out_of_stock'))}</button>`
      : `<div class="btn-row">
           <button class="btn btn-ghost" id="pdCart">${ic('shopping-cart', 17)} ${esc(t('add_cart'))}</button>
           <button class="btn" id="pdBuy">${icDark('truck', 17)} ${esc(t('buy'))} · <span id="pdTotal">${money(p.price)}</span></button>
         </div>`}
  `);

  if (!out) {
    const refresh = () => {
      const el = qs('#qVal'); if (el) el.textContent = qty;
      const totalEl = qs('#pdTotal'); if (totalEl) totalEl.textContent = money(p.price * qty);
    };
    const minus = qs('#qMinus'), plus = qs('#qPlus');
    if (minus) minus.onclick = () => { if (qty > 1) { qty--; haptic('light'); refresh(); } };
    if (plus) plus.onclick = () => { if (qty < maxQty) { qty++; haptic('light'); refresh(); } };
    qs('#pdCart').onclick = () => { addToCart(p.id, qty); closeSheet(); };
    qs('#pdBuy').onclick = () => buyNow(p.id, qty);
  }
}

/* ---------- оплата + доставка ---------- */

function loadShipping() {
  try { return JSON.parse(localStorage.getItem('foodbuket_shipping') || '{}'); }
  catch (e) { return {}; }
}

function saveShipping(s) {
  localStorage.setItem('foodbuket_shipping', JSON.stringify(s));
}

async function buyNow(productId, qty) {
  openShippingSheet([{ id: productId, qty }], null);
}

function openShippingSheet(items, promoCode) {
  const prev = loadShipping();
  let note = (state.settings.shipping_note || '').trim();
  const ruShipDefault = 'Доставляем курьером по городу за 1–3 часа после оплаты. Трекинг появится в заказе.';
  if (!note) {
    note = t('shipping_default');
  } else if (I18N.lang() === 'en' && note === ruShipDefault) {
    note = t('default_shipping_note');
  }
  openSheet(`
    <div class="sheet-title mb16">${esc(t('shipping'))}</div>
    <div class="muted small mb16">${esc(note)}</div>
    <div class="field"><label>${esc(t('ship_name'))}</label><input id="shName" value="${esc(prev.name || '')}" autocomplete="name"></div>
    <div class="field"><label>${esc(t('ship_phone'))}</label><input id="shPhone" type="tel" value="${esc(prev.phone || '')}" placeholder="${esc(t('phone_ph'))}" autocomplete="tel"></div>
    <div class="field-row">
      <div class="field"><label>${esc(t('ship_city'))}</label><input id="shCity" value="${esc(prev.city || '')}" autocomplete="address-level2"></div>
      <div class="field"><label>${esc(t('ship_postal'))}</label><input id="shPostal" value="${esc(prev.postal || '')}" autocomplete="postal-code"></div>
    </div>
    <div class="field"><label>${esc(t('ship_address'))}</label><input id="shAddr" value="${esc(prev.address || '')}" autocomplete="street-address"></div>
    <div class="field"><label>${esc(t('ship_comment'))}</label><input id="shComment" value="${esc(prev.comment || '')}" placeholder="${esc(t('ship_comment_ph'))}"></div>
    <button class="btn" id="shNext">${icDark('wallet', 17)} ${esc(t('to_payment'))}</button>
  `);
  qs('#shNext').onclick = () => {
    const shipping = {
      name: qs('#shName').value.trim(),
      phone: qs('#shPhone').value.trim(),
      city: qs('#shCity').value.trim(),
      postal: qs('#shPostal').value.trim(),
      address: qs('#shAddr').value.trim(),
      comment: qs('#shComment').value.trim(),
    };
    if (!shipping.name || !shipping.phone || !shipping.city || !shipping.address) {
      toast(t('fill_required'), true);
      return;
    }
    saveShipping(shipping);
    checkout(items, promoCode, shipping);
  };
}

async function checkout(items, promoCode, shipping) {
  openSheet(`
    <div class="pay-wait">
      <div class="spinner"></div>
      <div class="sheet-title">${esc(t('creating_invoice'))}</div>
      <div class="muted small">${API.isDemo ? esc(t('demo_pay_hint')) : 'Crypto Pay · @CryptoBot'}</div>
    </div>`);
  let order;
  try {
    order = await API.post('/api/orders', { items, promo: promoCode, shipping });
  } catch (e) {
    closeSheet();
    haptic('error');
    toast(e.message, true);
    return;
  }
  if (order.status === 'paid' || order.status === 'shipped') {
    afterPaid(order);
    return;
  }
  showPaymentSheet(order);
}

function openPayUrl(url) {
  if (IN_TG && /^https:\/\/t\.me\//.test(url)) {
    try { tg.openTelegramLink(url); return; } catch (e) { /* fallback ниже */ }
  }
  window.open(url, '_blank');
}

function showPaymentSheet(order) {
  const demo = API.isDemo || (order.pay_url && String(order.pay_url).startsWith('demo:'));
  openSheet(`
    <div class="pay-wait">
      ${demo ? '' : '<div class="spinner"></div>'}
      <div class="sheet-title">${esc(t('waiting_payment'))}</div>
      <div class="muted small">${esc(t('order_n'))} <span class="mono">#${order.id}</span> · ${money(order.total)}<br>
      ${esc(demo ? t('demo_pay_hint') : t('invoice_ttl'))}</div>
      <button class="btn" id="payOpen">${icDark(demo ? 'check' : 'wallet', 17)} ${esc(demo ? t('demo_pay') : t('open_cryptobot'))}</button>
      <button class="btn btn-ghost btn-sm" id="payLater">${esc(t('pay_later'))}</button>
    </div>`,
    () => stopPolling());
  qs('#payOpen').onclick = async () => {
    haptic('medium');
    if (demo) {
      try {
        const paid = await API.post('/api/orders/demo-pay', { id: order.id });
        afterPaid(paid);
      } catch (e) { toast(e.message, true); }
      return;
    }
    openPayUrl(order.pay_url);
  };
  qs('#payLater').onclick = () => { closeSheet(); switchView('profile'); };
  if (!demo) {
    openPayUrl(order.pay_url);
    startPolling(order.id);
  }
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

function startPolling(orderId) {
  stopPolling();
  state.pollTimer = setInterval(async () => {
    let order;
    try { order = await API.get('/api/orders/' + orderId); }
    catch (e) { return; }
    if (order.status === 'paid' || order.status === 'shipped') {
      stopPolling();
      afterPaid(order);
    } else if (order.status === 'expired') {
      stopPolling();
      closeSheet();
      haptic('warning');
      toast(t('invoice_expired'), true);
    }
  }, 3000);
}

function shippingBlock(order) {
  const s = order.shipping;
  if (!s) return '';
  return `
    <div class="delivery-box">
      <div class="dl-name">${ic('map-pin', 13, '#7A8B82')} ${esc(t('ship_address_title'))}</div>
      <div class="ship-line">${esc(s.name)} · ${esc(s.phone)}</div>
      <div class="ship-line">${esc(s.postal ? s.postal + ', ' : '')}${esc(s.city)}</div>
      <div class="ship-line">${esc(s.address)}</div>
      ${s.comment ? `<div class="ship-line muted">${esc(s.comment)}</div>` : ''}
    </div>`;
}

function orderStatusBlock(order) {
  if (order.status === 'shipped') {
    return `
      <div class="delivery-box">
        <div class="dl-name">${ic('truck', 13, '#7A8B82')} ${esc(t('shipped'))}</div>
        <div class="dl-key">
          <span>${esc(t('track'))}: ${esc(order.tracking || '—')}</span>
          ${order.tracking ? `<button class="dl-copy" data-copy="${esc(order.tracking)}">${ic('copy', 14)}</button>` : ''}
        </div>
      </div>`;
  }
  if (order.status === 'paid') {
    const key = (order.delivery && order.delivery.status_key) || 'paid_packing';
    const text = t(key);
    return `
      <div class="delivery-box">
        <div class="dl-name">${ic('package', 13, '#7A8B82')} ${esc(t('status'))}</div>
        <div class="ship-line">${esc(text)}</div>
      </div>`;
  }
  return '';
}

function afterPaid(order) {
  state.cart = [];
  state.promo = null;
  saveCart();
  haptic('success');
  refreshShop();
  openSheet(`
    <div class="pay-wait" style="padding-bottom:8px">
      <div class="success-burst">${icDark('check', 40)}</div>
      <div class="sheet-title">${esc(t('paid_ok'))}</div>
      <div class="muted small">${esc(t('order_n'))} <span class="mono">#${order.id}</span> · ${money(order.total)}<br>
      ${esc(t('packing_note'))}</div>
    </div>
    <div id="successDelivery">${orderStatusBlock(order)}${shippingBlock(order)}</div>
    <button class="btn mt16" id="successOk">${icDark('check', 17)} ${esc(t('great'))}</button>
  `);
  bindCopyButtons(qs('#successDelivery'));
  qs('#successOk').onclick = () => { closeSheet(); switchView('profile'); };
}

function bindCopyButtons(root) {
  (root || document).querySelectorAll('[data-copy]').forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); copyText(btn.dataset.copy); };
  });
}

/* ---------- корзина ---------- */

function renderCart() {
  const view = qs('#view-cart');
  if (!state.cart.length) {
    view.innerHTML = `
      <div class="empty" style="padding-top:90px">
        <div class="empty-icon">${icMuted('shopping-cart', 36)}</div>
        <div class="empty-title">${esc(t('cart_empty'))}</div>
        <div class="empty-text">${esc(t('cart_empty_hint'))}</div>
        <button class="btn btn-sm" id="goShop" style="width:auto">${icDark('store', 15)} ${esc(t('to_catalog'))}</button>
      </div>`;
    qs('#goShop').onclick = () => switchView('home');
    return;
  }

  const rows = state.cart.map((item) => {
    const p = state.products.find((x) => x.id === item.id);
    if (!p) return '';
    return `
      <div class="cart-item" data-id="${p.id}">
        <div class="ci-media">${productMedia(p, 22, 'ci-photo')}</div>
        <div class="ci-info">
          <div class="ci-name">${esc(p.name)}</div>
          <div class="ci-price">${money(p.price)} · ${esc(t('pcs'))}</div>
        </div>
        <div class="ci-actions">
          <button class="ci-btn" data-act="minus">−</button>
          <div class="ci-qty">${item.qty}</div>
          <button class="ci-btn" data-act="plus">+</button>
          <button class="ci-btn" data-act="remove">${ic('trash-2', 13)}</button>
        </div>
      </div>`;
  }).join('');

  const subtotal = state.cart.reduce((s, item) => {
    const p = state.products.find((x) => x.id === item.id);
    return s + (p ? p.price * item.qty : 0);
  }, 0);
  const percent = state.promo ? state.promo.percent : 0;
  const discount = subtotal * percent / 100;
  const total = subtotal - discount;

  view.innerHTML = `
    <div class="section-title">${esc(t('cart_title', { n: cartCount() }))}</div>
    ${rows}
    <div class="promo-row">
      <input type="text" id="promoInput" placeholder="${esc(t('promo_ph'))}"
        value="${state.promo ? esc(state.promo.code) : ''}" ${state.promo ? 'disabled' : ''}>
      <button class="btn btn-sm" id="promoBtn" style="width:auto">
        ${state.promo ? icDark('x', 15) : icDark('ticket-percent', 15)} ${esc(state.promo ? t('promo_remove') : t('promo_apply'))}
      </button>
    </div>
    <div class="totals">
      <div class="t-row"><span>${esc(t('items'))}</span><span>${money(subtotal)}</span></div>
      ${percent ? `<div class="t-row"><span>${esc(t('discount', { n: percent, code: state.promo.code }))}</span><span>−${money(discount)}</span></div>` : ''}
      <div class="t-row total"><span>${esc(t('total'))}</span><span>${money(total)}</span></div>
    </div>
    <button class="btn" id="checkoutBtn">${icDark('truck', 17)} ${esc(t('checkout'))}</button>
    <div class="center small muted mt8">${esc(t('pay_hint'))}</div>
  `;

  document.querySelectorAll('.cart-item').forEach((row) => {
    const id = Number(row.dataset.id);
    row.querySelectorAll('.ci-btn').forEach((btn) => {
      btn.onclick = () => {
        const item = state.cart.find((i) => i.id === id);
        const p = state.products.find((x) => x.id === id);
        if (!item) return;
        if (btn.dataset.act === 'plus') item.qty = Math.min(item.qty + 1, p?.stock_left ?? 50);
        if (btn.dataset.act === 'minus') item.qty = Math.max(1, item.qty - 1);
        if (btn.dataset.act === 'remove') state.cart = state.cart.filter((i) => i.id !== id);
        haptic('light');
        saveCart();
        renderCart();
      };
    });
  });

  qs('#promoBtn').onclick = async () => {
    if (state.promo) {
      state.promo = null;
      renderCart();
      return;
    }
    const code = qs('#promoInput').value.trim();
    if (!code) { toast(t('enter_promo'), true); return; }
    try {
      state.promo = await API.post('/api/promo/check', { code });
      haptic('success');
      toast(t('promo_applied', { n: state.promo.percent }));
      renderCart();
    } catch (e) {
      haptic('error');
      toast(e.message, true);
    }
  };

  qs('#checkoutBtn').onclick = () => {
    openShippingSheet(state.cart.map((i) => ({ id: i.id, qty: i.qty })),
                      state.promo ? state.promo.code : null);
  };
}

/* ---------- профиль ---------- */

function statusBadge(s) {
  const map = {
    paid: t('status_paid'),
    pending: t('status_pending'),
    expired: t('status_expired'),
    shipped: t('status_shipped'),
  };
  return `<span class="status ${s}">${esc(map[s] || s)}</span>`;
}

async function renderProfile() {
  const view = qs('#view-profile');
  const u = state.user || {};
  const initial = (u.first_name || 'U').slice(0, 1).toUpperCase();
  view.innerHTML = `
    <div class="profile-card">
      <div class="avatar">${u.photo_url ? `<img src="${esc(u.photo_url)}" alt="">` : initial}</div>
      <div>
        <div class="profile-name">${esc(u.first_name || t('guest'))} ${state.isAdmin ? ic('badge-check', 16) : ''}</div>
        <div class="profile-sub">${u.username ? '@' + esc(u.username) : 'ID ' + u.id}</div>
      </div>
    </div>
    <div class="section-title">${esc(t('my_orders'))}</div>
    <div id="ordersList"><div class="skeleton" style="height:74px;margin-bottom:9px"></div>
    <div class="skeleton" style="height:74px"></div></div>
    <div class="section-title">${esc(t('support'))}</div>
    <button class="btn btn-ghost" id="supportBtn">${ic('message-circle', 17)} ${esc(t('write_support'))}</button>
  `;

  qs('#supportBtn').onclick = () => {
    const support = (state.settings.support || '').replace('@', '');
    if (support) openPayUrl('https://t.me/' + support);
  };

  let orders = [];
  try {
    orders = (await API.get('/api/my/orders')).orders;
    state.myOrders = orders;
  } catch (e) {
    qs('#ordersList').innerHTML = `<div class="empty-text muted center">${esc(e.message)}</div>`;
    return;
  }

  if (!orders.length) {
    qs('#ordersList').innerHTML = `
      <div class="empty" style="padding:28px 20px">
        <div class="empty-icon">${icMuted('package-open', 32)}</div>
        <div class="empty-text">${esc(t('no_orders'))}</div>
      </div>`;
    return;
  }

  qs('#ordersList').innerHTML = orders.map((o) => `
    <div class="order-card" data-id="${o.id}">
      <div class="oc-head">
        <div>
          <span class="oc-id">#${o.id} · ${new Date(o.created_at).toLocaleString(I18N.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          <div class="oc-total">${money(o.total)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
      <div class="oc-items">${o.items.map((i) => `${esc(i.name)} ×${i.qty}`).join(' · ')}</div>
      <div class="oc-body" data-body="${o.id}">
        ${(o.status === 'paid' || o.status === 'shipped') ? orderStatusBlock(o) + shippingBlock(o) : ''}
        ${o.status === 'pending' && o.pay_url ? `
          <div class="btn-row mt8">
            <button class="btn btn-ghost btn-sm" data-check="${o.id}">${ic('refresh-cw', 14)} ${esc(t('check'))}</button>
            <button class="btn btn-sm" data-pay="${esc(o.pay_url)}">${icDark('wallet', 14)} ${esc(t('pay'))}</button>
          </div>` : ''}
      </div>
    </div>`).join('');

  bindCopyButtons(qs('#ordersList'));
  document.querySelectorAll('[data-pay]').forEach((btn) => {
    btn.onclick = () => openPayUrl(btn.dataset.pay);
  });
  document.querySelectorAll('[data-check]').forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const order = await API.get('/api/orders/' + btn.dataset.check);
        if (order.status === 'paid' || order.status === 'shipped') { afterPaid(order); renderProfile(); }
        else { toast(order.status === 'expired' ? t('invoice_expired_short') : t('payment_pending'), true); renderProfile(); }
      } catch (e) { toast(e.message, true); btn.disabled = false; }
    };
  });
}

/* ---------- поиск ---------- */

function initSearch() {
  qs('#searchBtn').innerHTML = ic('search', 19);
  qs('#searchIcon').innerHTML = icMuted('search', 17);
  qs('#searchBtn').onclick = () => {
    if (state.view !== 'home') switchView('home');
    const bar = qs('#searchBar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) qs('#searchInput').focus();
    else { state.search = ''; qs('#searchInput').value = ''; renderHome(); }
  };
  qs('#searchInput').oninput = (e) => {
    state.search = e.target.value.trim();
    qs('#searchClear').classList.toggle('hidden', !state.search);
    renderHome();
  };
  qs('#searchClear').onclick = () => {
    state.search = '';
    qs('#searchInput').value = '';
    qs('#searchClear').classList.add('hidden');
    renderHome();
  };
}

/* ---------- данные ---------- */

async function refreshShop() {
  const shop = await API.get('/api/shop');
  state.categories = shop.categories;
  state.products = shop.products;
  state.settings = shop.settings;
  applyBranding();
  if (state.view === 'home') renderHome();
}

function applyBranding() {
  const s = state.settings;
  const ruDefault = 'свежие цветы · доставка в день заказа';
  let tagline = s.tagline || '';
  if (I18N.lang() === 'en' && (tagline.includes('виниловые') || tagline === ruDefault || !tagline)) {
    tagline = t('default_tagline');
  }
  qs('#brandName').textContent = s.shop_name || 'Food Букет';
  qs('#brandTag').textContent = tagline;
  qs('#brandMark').innerHTML = icDark('flower-2', 20);
  const words = `${s.shop_name || 'Food Букет'} ✦ ${tagline} ✦ ${t('marquee_extra')} ✦ `;
  qs('#marqueeTrack').textContent = words.repeat(4);
  document.title = s.shop_name || 'Food Букет';
}

/* ---------- запуск ---------- */

function fatal(icon, title, text) {
  qs('#splash').classList.add('done');
  qs('#fatal').classList.remove('hidden');
  qs('#fatalIcon').innerHTML = `<div class="empty-icon">${icMuted(icon, 38)}</div>`;
  qs('#fatalTitle').textContent = title;
  qs('#fatalText').textContent = text;
}

async function boot() {
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#E8F0EA');
      tg.setBackgroundColor('#E8F0EA');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      tg.BackButton.onClick(closeSheet);
    } catch (e) { /* старые клиенты */ }
  }
  qs('#sheet-backdrop').onclick = closeSheet;
  initLangSwitch();
  applyChromeI18n();
  initSearch();

  let auth;
  try {
    auth = await API.post('/api/auth');
  } catch (e) {
    if (e.status === 403) fatal('ban', t('fatal_banned'), e.message);
    else fatal('plug-zap', t('fatal_conn'), e.message + '. ' + t('fatal_conn_hint'));
    return;
  }
  state.user = auth.user;
  state.isAdmin = auth.is_admin;
  state.settings = auth.settings;
  loadCart();

  try {
    await refreshShop();
  } catch (e) {
    fatal('server-off', t('fatal_load'), e.message);
    return;
  }

  applyChromeI18n();
  applyBranding();
  renderNav();
  renderHome();
  if (API.isDemo) {
    const b = qs('#demoBanner');
    if (b) b.classList.remove('hidden');
  }
  setTimeout(() => qs('#splash').classList.add('done'), 350);
}

boot();
