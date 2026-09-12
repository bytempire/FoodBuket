/* ============================================================
   Food Букет — админ-панель (внутри мини-аппа)
   ============================================================ */

const Admin = {
  tab: 'dash',

  TABS: [
    { id: 'dash', icon: 'gauge', labelKey: 'a_dash' },
    { id: 'products', icon: 'package', labelKey: 'a_products' },
    { id: 'cats', icon: 'folder', labelKey: 'a_cats' },
    { id: 'orders', icon: 'receipt', labelKey: 'a_orders' },
    { id: 'promos', icon: 'ticket-percent', labelKey: 'a_promos' },
    { id: 'users', icon: 'users-round', labelKey: 'a_users' },
    { id: 'cast', icon: 'megaphone', labelKey: 'a_cast' },
    { id: 'settings', icon: 'settings-2', labelKey: 'a_settings' },
  ],

  render() {
    const view = qs('#view-admin');
    view.innerHTML = `
      <div class="chips admin-tabs" id="adminTabs">
        ${Admin.TABS.map((tab) => `
          <button class="chip ${Admin.tab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            ${ic(tab.icon, 15, Admin.tab === tab.id ? '#ffffff' : '#1A3A2F')} ${esc(t(tab.labelKey))}
          </button>`).join('')}
      </div>
      <div id="adminBody">
        <div class="skeleton" style="height:110px;margin-bottom:10px"></div>
        <div class="skeleton" style="height:110px"></div>
      </div>`;
    view.querySelectorAll('[data-tab]').forEach((chip) => {
      chip.onclick = () => { Admin.tab = chip.dataset.tab; haptic('light'); Admin.render(); };
    });
    Admin.renderTab().catch((e) => {
      qs('#adminBody').innerHTML = `<div class="empty-text muted center mt16">${esc(e.message)}</div>`;
    });
  },

  async renderTab() {
    const map = {
      dash: Admin.tabDash, products: Admin.tabProducts, cats: Admin.tabCats,
      orders: Admin.tabOrders, promos: Admin.tabPromos, users: Admin.tabUsers,
      cast: Admin.tabCast, settings: Admin.tabSettings,
    };
    await map[Admin.tab]();
  },

  /* ---------- дашборд ---------- */

  async tabDash() {
    const d = await API.get('/api/admin/overview');
    qs('#adminBody').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">${icMuted('banknote', 14)} ${esc(t('a_revenue'))}</div>
          <div class="stat-value">${money(d.revenue_total)}</div>
          <div class="stat-sub">${esc(t('a_today', { n: money(d.revenue_today) }))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icMuted('receipt', 14)} ${esc(t('a_orders_stat'))}</div>
          <div class="stat-value">${d.orders_paid}</div>
          <div class="stat-sub">${esc(t('a_to_ship', { a: d.orders_to_ship || 0, b: d.orders_shipped || 0 }))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icMuted('users-round', 14)} ${esc(t('a_users_stat'))}</div>
          <div class="stat-value">${d.users_count}</div>
          <div class="stat-sub">${esc(t('a_users_total'))}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icMuted('boxes', 14)} ${esc(t('a_stock'))}</div>
          <div class="stat-value">${d.stock_total}</div>
          <div class="stat-sub">${esc(t('a_stock_sub', { n: d.products_count }))}</div>
        </div>
      </div>

      ${d.top_products.length ? `
        <div class="section-title">${esc(t('a_top'))}</div>
        ${d.top_products.map((p, i) => `
          <div class="admin-row">
            <div class="ar-icon media">${p.image ? `<img src="${esc(p.image)}" alt="">` : ic(p.icon, 20)}</div>
            <div class="ar-main">
              <div class="ar-title">${i + 1}. ${esc(p.name)}</div>
              <div class="ar-sub">${money(p.price)}</div>
            </div>
            <div class="ar-side"><b>${p.sales}</b> <span class="muted small">${esc(t('a_sold'))}</span></div>
          </div>`).join('')}` : ''}

      <div class="section-title">${esc(t('a_recent'))}</div>
      ${d.recent_orders.length ? d.recent_orders.map((o) => `
        <div class="admin-row">
          <div class="ar-icon">${ic(o.status === 'shipped' ? 'truck' : o.status === 'paid' ? 'check' : o.status === 'pending' ? 'clock' : 'x', 18)}</div>
          <div class="ar-main">
            <div class="ar-title">#${o.id} · ${esc(o.username || o.user_id)}</div>
            <div class="ar-sub">${o.items.map((i) => esc(i.name)).join(', ')}</div>
          </div>
          <div class="ar-side">
            <div><b>${money(o.total)}</b></div>
            ${statusBadge(o.status)}
          </div>
        </div>`).join('') : `<div class="muted small center">${esc(t('a_no_orders'))}</div>`}
    `;
  },

  /* ---------- товары ---------- */

  async tabProducts() {
    const { products } = await API.get('/api/admin/products');
    Admin._products = products;
    qs('#adminBody').innerHTML = `
      ${products.map((p) => `
        <div class="admin-row ${p.active ? '' : 'inactive-row'}">
          <div class="ar-icon media">${p.image ? `<img src="${esc(p.image)}" alt="">` : ic(p.icon, 20)}</div>
          <div class="ar-main">
            <div class="ar-title">${esc(p.name)}</div>
            <div class="ar-sub">${money(p.price)} · ${esc(t('a_stock_line', { n: p.stock_left, s: p.sales }))}</div>
          </div>
          <div class="ar-actions">
            <button class="icon-btn" data-edit="${p.id}">${ic('pencil', 15)}</button>
            <button class="icon-btn" data-del="${p.id}">${ic('trash-2', 15)}</button>
          </div>
        </div>`).join('')}
      <button class="add-fab" id="addProduct">${icDark('plus', 26)}</button>
    `;
    qs('#addProduct').onclick = () => Admin.productEditor(null);
    document.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => Admin.productEditor(Admin._products.find((p) => p.id === Number(b.dataset.edit)));
    });
    document.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => confirmDialog(t('a_del_product'), async () => {
        await API.del('/api/admin/products/' + b.dataset.del);
        toast(t('a_product_deleted'));
        refreshShop();
        Admin.render();
      });
    });
  },

  productEditor(p) {
    const isNew = !p;
    p = p || { name: '', subtitle: '', description: '', price: '', old_price: '', icon: 'layers',
               image: '', badge: '', stock_qty: 10, active: 1, sort: 0, category_id: '' };
    let pendingImage = null; // data-URL до сохранения нового товара
    openSheet(`
      <div class="sheet-title mb16">${esc(isNew ? t('a_new_product') : t('a_edit_product'))}</div>
      <div class="field">
        <label>${esc(t('a_photo'))}</label>
        <div class="photo-upload">
          <div class="photo-preview" id="photoPrev">
            ${p.image
              ? `<img src="${esc(p.image)}" alt="">`
              : `<div class="photo-empty">${icMuted('image', 28)}<span>${esc(t('a_no_photo'))}</span></div>`}
          </div>
          <div class="photo-actions">
            <label class="btn btn-ghost btn-sm" style="width:auto;cursor:pointer">
              ${ic('upload', 14)} ${esc(t('a_choose'))}
              <input type="file" id="fPhoto" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
            </label>
            <button class="btn btn-ghost btn-sm" id="fPhotoClear" style="width:auto;${p.image || pendingImage ? '' : 'display:none'}">${ic('trash-2', 14)} ${esc(t('a_remove'))}</button>
          </div>
          <div class="hint">${esc(t('a_photo_hint'))}</div>
        </div>
      </div>
      <div class="field"><label>${esc(t('a_name'))}</label><input id="fName" value="${esc(p.name)}"></div>
      <div class="field"><label>${esc(t('a_subtitle'))}</label><input id="fSub" value="${esc(p.subtitle)}"></div>
      <div class="field"><label>${esc(t('a_desc'))}</label><textarea id="fDesc" style="font-family:var(--font-text)">${esc(p.description)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>${esc(t('a_price'))}</label><input id="fPrice" type="number" step="0.01" min="0.01" value="${p.price}"></div>
        <div class="field"><label>${esc(t('a_old_price'))}</label><input id="fOld" type="number" step="0.01" value="${p.old_price ?? ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>${esc(t('a_category'))}</label>
          <select id="fCat">
            <option value="">${esc(t('a_no_cat'))}</option>
            ${state.categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${esc(I18N.catName(c.name))}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>${esc(t('a_badge'))}</label><input id="fBadge" value="${esc(p.badge)}" placeholder="HIT / -50% / NEW"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>${esc(t('a_stock_qty'))}</label><input id="fStock" type="number" min="0" value="${p.stock_qty ?? p.stock_left ?? 0}"></div>
        <div class="field"><label>${esc(t('a_sort'))}</label><input id="fSort" type="number" value="${p.sort}"></div>
      </div>
      <div class="switch-row">
        <span>${esc(t('a_active'))}</span>
        <label class="switch"><input type="checkbox" id="fActive" ${p.active ? 'checked' : ''}><i></i></label>
      </div>
      <button class="btn" id="fSave">${icDark('save', 17)} ${esc(isNew ? t('a_create') : t('a_save'))}</button>
    `);

    const showClear = (on) => {
      const b = qs('#fPhotoClear');
      if (b) b.style.display = on ? '' : 'none';
    };
    const setPreview = (src) => {
      qs('#photoPrev').innerHTML = src
        ? `<img src="${esc(src)}" alt="">`
        : `<div class="photo-empty">${icMuted('image', 28)}<span>${esc(t('a_no_photo'))}</span></div>`;
      showClear(!!src);
    };

    qs('#fPhoto').onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast(t('a_file_big'), true);
        e.target.value = '';
        return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        toast(t('a_file_type'), true);
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingImage = reader.result;
        setPreview(pendingImage);
      };
      reader.readAsDataURL(file);
    };

    qs('#fPhotoClear').onclick = async () => {
      pendingImage = null;
      qs('#fPhoto').value = '';
      if (!isNew && p.image) {
        try {
          await API.del('/api/admin/products/' + p.id + '/image');
          p.image = '';
          toast(t('a_photo_deleted'));
        } catch (err) {
          toast(err.message, true);
          return;
        }
      }
      setPreview('');
    };

    qs('#fSave').onclick = async () => {
      const body = {
        name: qs('#fName').value,
        subtitle: qs('#fSub').value,
        description: qs('#fDesc').value,
        price: qs('#fPrice').value,
        old_price: qs('#fOld').value || null,
        category_id: qs('#fCat').value || null,
        badge: qs('#fBadge').value,
        icon: 'layers',
        stock_qty: qs('#fStock').value,
        sort: qs('#fSort').value,
        active: qs('#fActive').checked,
      };
      try {
        const saved = isNew
          ? await API.post('/api/admin/products', body)
          : await API.put('/api/admin/products/' + p.id, body);
        if (pendingImage) {
          await API.uploadProductImage(saved.id, pendingImage);
        }
        haptic('success');
        toast(isNew ? t('a_created') : t('a_saved'));
        closeSheet();
        refreshShop();
        Admin.render();
      } catch (e) {
        haptic('error');
        toast(e.message, true);
      }
    };
  },

  /* ---------- категории ---------- */

  async tabCats() {
    await refreshShop();
    qs('#adminBody').innerHTML = `
      ${state.categories.map((c) => `
        <div class="admin-row">
          <div class="ar-icon">${ic(c.icon, 20)}</div>
          <div class="ar-main">
            <div class="ar-title">${esc(I18N.catName(c.name))}</div>
            <div class="ar-sub">${esc(t('a_products_count', { n: c.count, s: c.sort }))}</div>
          </div>
          <div class="ar-actions">
            <button class="icon-btn" data-edit="${c.id}">${ic('pencil', 15)}</button>
            <button class="icon-btn" data-del="${c.id}">${ic('trash-2', 15)}</button>
          </div>
        </div>`).join('')}
      <button class="add-fab" id="addCat">${icDark('plus', 26)}</button>
    `;
    qs('#addCat').onclick = () => Admin.catEditor(null);
    document.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => Admin.catEditor(state.categories.find((c) => c.id === Number(b.dataset.edit)));
    });
    document.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => confirmDialog(t('a_del_cat'), async () => {
        await API.del('/api/admin/categories/' + b.dataset.del);
        toast(t('a_cat_deleted'));
        refreshShop();
        Admin.render();
      });
    });
  },

  catEditor(c) {
    const isNew = !c;
    c = c || { name: '', icon: 'folder', sort: 0 };
    openSheet(`
      <div class="sheet-title mb16">${esc(isNew ? t('a_new_cat') : t('a_cat'))}</div>
      <div class="field"><label>${esc(t('a_name'))}</label><input id="cName" value="${esc(c.name)}"></div>
      <div class="field-row">
        <div class="field"><label>${esc(t('a_icon'))}</label><input id="cIcon" value="${esc(c.icon)}"></div>
        <div class="field"><label>${esc(t('a_sort'))}</label><input id="cSort" type="number" value="${c.sort}"></div>
      </div>
      <div class="icon-preview mb16">
        <div class="ar-icon" id="cIconPrev">${ic(c.icon, 20)}</div>
        <div class="txt">SVG · api.iconify.design</div>
      </div>
      <button class="btn" id="cSave">${icDark('save', 17)} ${esc(t('a_save'))}</button>
    `);
    qs('#cIcon').oninput = () => { qs('#cIconPrev').innerHTML = ic(qs('#cIcon').value || 'folder', 20); };
    qs('#cSave').onclick = async () => {
      const body = { name: qs('#cName').value, icon: qs('#cIcon').value, sort: qs('#cSort').value };
      try {
        if (isNew) await API.post('/api/admin/categories', body);
        else await API.put('/api/admin/categories/' + c.id, body);
        toast(t('a_saved'));
        closeSheet();
        refreshShop();
        Admin.render();
      } catch (e) { toast(e.message, true); }
    };
  },

  /* ---------- заказы ---------- */

  async tabOrders() {
    const { orders } = await API.get('/api/admin/orders');
    Admin._orders = orders;
    qs('#adminBody').innerHTML = orders.length ? orders.map((o) => `
      <div class="admin-row" data-order="${o.id}" style="cursor:pointer">
        <div class="ar-icon">${ic(o.status === 'shipped' ? 'truck' : o.status === 'paid' ? 'badge-check' : o.status === 'pending' ? 'clock' : 'badge-x', 19)}</div>
        <div class="ar-main">
          <div class="ar-title">#${o.id} · ${esc(o.username || o.user_id)}</div>
          <div class="ar-sub">${new Date(o.created_at).toLocaleString(I18N.locale())} · ${o.items.length}</div>
        </div>
        <div class="ar-side">
          <div><b>${money(o.total)}</b></div>
          ${statusBadge(o.status)}
        </div>
      </div>`).join('')
      : `<div class="empty"><div class="empty-icon">${icMuted('receipt', 32)}</div>
         <div class="empty-text">${esc(t('a_no_orders'))}</div></div>`;
    document.querySelectorAll('[data-order]').forEach((row) => {
      row.onclick = () => Admin.orderSheet(Number(row.dataset.order));
    });
  },

  orderSheet(id) {
    const o = Admin._orders.find((x) => x.id === id);
    if (!o) return;
    const s = o.shipping || {};
    openSheet(`
      <div class="sheet-title">${esc(t('a_order'))} #${o.id} ${statusBadge(o.status)}</div>
      <div class="muted small mb16">${new Date(o.created_at).toLocaleString(I18N.locale())} ·
        ${esc(t('a_buyer'))}: ${esc(o.username || o.user_id)} (ID ${o.user_id})</div>
      <div class="totals">
        ${o.items.map((i) => `<div class="t-row"><span>${esc(i.name)} ×${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
        ${o.discount ? `<div class="t-row"><span>${esc(t('a_order_discount', { code: o.promo_code || '' }))}</span><span>−${money(o.discount)}</span></div>` : ''}
        <div class="t-row total"><span>${esc(t('total'))}</span><span>${money(o.total)}</span></div>
      </div>
      ${o.invoice_id ? `<div class="small muted mb8">${esc(t('a_invoice'))}: <span class="mono">${o.invoice_id}</span></div>` : ''}
      ${s.name ? `
        <div class="section-title">${esc(t('shipping'))}</div>
        <div class="delivery-box">
          <div class="ship-line">${esc(s.name)} · ${esc(s.phone || '')}</div>
          <div class="ship-line">${esc([s.postal, s.city].filter(Boolean).join(', '))}</div>
          <div class="ship-line">${esc(s.address || '')}</div>
          ${s.comment ? `<div class="ship-line muted">${esc(s.comment)}</div>` : ''}
        </div>` : ''}
      ${o.status === 'shipped' ? `
        <div class="section-title">${esc(t('track'))}</div>
        <div class="delivery-box"><div class="ship-line mono">${esc(o.tracking || '—')}</div></div>` : ''}
      ${o.status === 'paid' || o.status === 'shipped' ? `
        <div class="field mt16"><label>${esc(t('a_tracking'))}</label>
          <input id="ordTrack" value="${esc(o.tracking || '')}" placeholder="RF123456789RU"></div>
        <button class="btn" id="ordShip">${icDark('truck', 16)} ${esc(o.status === 'shipped' ? t('a_update_track') : t('a_mark_shipped'))}</button>` : ''}
      ${o.status === 'pending' ? `<button class="btn mt8" id="ordCheck">${icDark('refresh-cw', 16)} ${esc(t('a_check_pay'))}</button>` : ''}
    `);
    const check = qs('#ordCheck');
    if (check) {
      check.onclick = async () => {
        check.disabled = true;
        try {
          const updated = await API.post(`/api/admin/orders/${o.id}/check`);
          toast(updated.status === 'paid' ? t('a_pay_ok') : t('a_pay_no'), updated.status !== 'paid');
          closeSheet();
          Admin.render();
        } catch (e) { toast(e.message, true); check.disabled = false; }
      };
    }
    const ship = qs('#ordShip');
    if (ship) {
      ship.onclick = async () => {
        ship.disabled = true;
        try {
          await API.post(`/api/admin/orders/${o.id}/ship`, { tracking: qs('#ordTrack').value });
          haptic('success');
          toast(t('a_shipped_ok'));
          closeSheet();
          Admin.render();
        } catch (e) { toast(e.message, true); ship.disabled = false; }
      };
    }
  },

  /* ---------- промокоды ---------- */

  async tabPromos() {
    const { promos } = await API.get('/api/admin/promos');
    qs('#adminBody').innerHTML = `
      ${promos.length ? promos.map((p) => `
        <div class="admin-row ${p.active ? '' : 'inactive-row'}">
          <div class="ar-icon">${ic('ticket-percent', 19)}</div>
          <div class="ar-main">
            <div class="ar-title mono">${esc(p.code)}</div>
            <div class="ar-sub">−${p.percent}% · ${esc(t('a_used', { n: p.used }))}${p.max_uses ? ' / ' + p.max_uses : ''}</div>
          </div>
          <div class="ar-actions">
            <button class="icon-btn" data-toggle="${p.id}" data-active="${p.active}">${ic(p.active ? 'pause' : 'play', 15)}</button>
            <button class="icon-btn" data-del="${p.id}">${ic('trash-2', 15)}</button>
          </div>
        </div>`).join('')
        : `<div class="empty"><div class="empty-icon">${icMuted('ticket-percent', 32)}</div>
           <div class="empty-text">${esc(t('a_no_promos'))}</div></div>`}
      <button class="add-fab" id="addPromo">${icDark('plus', 26)}</button>
    `;
    qs('#addPromo').onclick = () => {
      openSheet(`
        <div class="sheet-title mb16">${esc(t('a_promo_new'))}</div>
        <div class="field"><label>${esc(t('a_code'))}</label><input id="prCode" placeholder="SALE20" style="text-transform:uppercase;font-family:var(--font-mono)"></div>
        <div class="field-row">
          <div class="field"><label>${esc(t('a_discount_pct'))}</label><input id="prPercent" type="number" min="1" max="100" value="10"></div>
          <div class="field"><label>${esc(t('a_limit'))}</label><input id="prMax" type="number" min="0" value="0"></div>
        </div>
        <button class="btn" id="prSave">${icDark('save', 17)} ${esc(t('a_create'))}</button>
      `);
      qs('#prSave').onclick = async () => {
        try {
          await API.post('/api/admin/promos', {
            code: qs('#prCode').value, percent: qs('#prPercent').value, max_uses: qs('#prMax').value,
          });
          toast(t('a_promo_created'));
          closeSheet();
          Admin.render();
        } catch (e) { toast(e.message, true); }
      };
    };
    document.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        await API.put('/api/admin/promos/' + b.dataset.toggle, { active: b.dataset.active !== '1' });
        Admin.render();
      };
    });
    document.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => confirmDialog(t('a_del_promo'), async () => {
        await API.del('/api/admin/promos/' + b.dataset.del);
        Admin.render();
      });
    });
  },

  /* ---------- пользователи ---------- */

  async tabUsers() {
    const { users } = await API.get('/api/admin/users');
    qs('#adminBody').innerHTML = users.length ? users.map((u) => `
      <div class="admin-row ${u.is_banned ? 'inactive-row' : ''}">
        <div class="ar-icon">${ic(u.is_banned ? 'user-x' : 'user-round', 19)}</div>
        <div class="ar-main">
          <div class="ar-title">${esc(u.first_name || t('guest'))} ${u.username ? '· @' + esc(u.username) : ''}</div>
          <div class="ar-sub">ID ${u.id} · ${u.orders_count} · ${money(u.spent)}</div>
        </div>
        <div class="ar-actions">
          <button class="icon-btn" data-ban="${u.id}" data-banned="${u.is_banned}">
            ${ic(u.is_banned ? 'lock-open' : 'ban', 15)}
          </button>
        </div>
      </div>`).join('')
      : `<div class="empty"><div class="empty-icon">${icMuted('users-round', 32)}</div>
         <div class="empty-text">${esc(t('a_no_users'))}</div></div>`;
    document.querySelectorAll('[data-ban]').forEach((b) => {
      const banned = b.dataset.banned === '1';
      b.onclick = () => confirmDialog(banned ? t('a_unban_q') : t('a_ban_q'), async () => {
        try {
          await API.post(`/api/admin/users/${b.dataset.ban}/ban`, { banned: !banned });
          toast(banned ? t('a_unbanned') : t('a_banned'));
          Admin.render();
        } catch (e) { toast(e.message, true); }
      });
    });
  },

  /* ---------- рассылка ---------- */

  async tabCast() {
    qs('#adminBody').innerHTML = `
      <div class="section-title">${esc(t('a_broadcast'))}</div>
      <div class="field">
        <label>${esc(t('a_broadcast'))}</label>
        <textarea id="castText" style="min-height:130px;font-family:var(--font-text)"></textarea>
        <div class="hint">${esc(t('a_broadcast_hint'))}</div>
      </div>
      <button class="btn" id="castSend">${icDark('send', 17)} ${esc(t('a_send'))}</button>
    `;
    qs('#castSend').onclick = () => {
      const text = qs('#castText').value.trim();
      if (!text) { toast(t('a_enter_text'), true); return; }
      confirmDialog(t('a_confirm_cast'), async () => {
        try {
          const r = await API.post('/api/admin/broadcast', { text });
          haptic('success');
          toast(t('a_cast_started', { n: r.recipients }));
          qs('#castText').value = '';
        } catch (e) { toast(e.message, true); }
      });
    };
  },

  /* ---------- настройки ---------- */

  async tabSettings() {
    const s = await API.get('/api/admin/settings');
    qs('#adminBody').innerHTML = `
      <div class="section-title">${esc(t('a_shop_settings'))}</div>
      <div class="field"><label>${esc(t('a_name'))}</label><input id="sName" value="${esc(s.shop_name)}"></div>
      <div class="field"><label>${esc(t('a_tagline'))}</label><input id="sTag" value="${esc(s.tagline)}"></div>
      <div class="field"><label>${esc(t('a_shipping_terms'))}</label>
        <input id="sShip" value="${esc(s.shipping_note || '')}" placeholder="${esc(t('default_shipping_note'))}">
      </div>
      <div class="field-row">
        <div class="field"><label>${esc(t('a_currency'))}</label><input id="sCur" value="${esc(s.currency_symbol)}"></div>
        <div class="field"><label>${esc(t('a_support_user'))}</label><input id="sSup" value="${esc(s.support)}"></div>
      </div>
      <div class="field">
        <label>${esc(t('a_webapp_url'))}</label>
        <input id="sWeb" value="${esc(s.webapp_url || '')}" placeholder="https://your-domain.com">
        <div class="hint">${esc(t('a_webapp_hint'))}</div>
      </div>
      <button class="btn" id="sSave">${icDark('save', 17)} ${esc(t('a_save'))}</button>
      <div class="section-title mt16">${esc(t('a_system'))}</div>
      <div class="admin-row">
        <div class="ar-icon">${ic('shield-check', 19)}</div>
        <div class="ar-main">
          <div class="ar-title">${esc(t('a_pay_sys'))}</div>
          <div class="ar-sub">${esc(t('a_pay_sys_sub'))}</div>
        </div>
      </div>
      <div class="admin-row">
        <div class="ar-icon">${ic('image', 19)}</div>
        <div class="ar-main">
          <div class="ar-title">${esc(t('a_photo_sys'))}</div>
          <div class="ar-sub">${esc(t('a_photo_sys_sub'))}</div>
        </div>
      </div>
    `;
    qs('#sSave').onclick = async () => {
      try {
        state.settings = await API.put('/api/admin/settings', {
          shop_name: qs('#sName').value, tagline: qs('#sTag').value,
          currency_symbol: qs('#sCur').value, support: qs('#sSup').value,
          webapp_url: qs('#sWeb').value, shipping_note: qs('#sShip').value,
        });
        applyBranding();
        haptic('success');
        toast(t('a_settings_saved'));
      } catch (e) { toast(e.message, true); }
    };
  },
};
