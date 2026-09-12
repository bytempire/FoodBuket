/* ============================================================
   Демо-бэкенд в браузере (localStorage) — без сервера
   ============================================================ */

const DemoStore = (() => {
  const KEY = 'foodbuket_demo_v1';

  const SEED = {
    settings: {
      shop_name: 'Food Букет',
      tagline: 'свежие цветы · доставка в день заказа',
      currency_symbol: '₽',
      support: '',
      webapp_url: '',
      shipping_note: 'Доставляем курьером по городу за 1–3 часа после оплаты. Трекинг появится в заказе.',
      catalog_version: 'flowers-1',
    },
    categories: [
      { id: 1, name: 'Букеты', icon: 'flower-2', sort: 1 },
      { id: 2, name: 'Розы', icon: 'heart', sort: 2 },
      { id: 3, name: 'Композиции', icon: 'sparkles', sort: 3 },
      { id: 4, name: 'Комнатные', icon: 'leaf', sort: 4 },
      { id: 5, name: 'Подарки', icon: 'gift', sort: 5 },
    ],
    products: [
      {
        id: 1, category_id: 1, name: 'Нежность',
        subtitle: 'Пионы и эустома · 11 стеблей',
        description: 'Воздушный букет из пионов и эустомы в пастельных тонах. Идеален для признаний и тёплых встреч.',
        price: 4900, old_price: 5600, badge: 'хит', icon: 'flower-2',
        image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&q=80',
        stock_left: 12, sort: 1, active: 1, sold: 48,
      },
      {
        id: 2, category_id: 2, name: 'Классика 25',
        subtitle: 'Красные розы · 25 шт',
        description: 'Классический букет из свежих красных роз премиум-класса. Долго стоят в вазе.',
        price: 6900, old_price: null, badge: '', icon: 'heart',
        image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&q=80',
        stock_left: 20, sort: 2, active: 1, sold: 91,
      },
      {
        id: 3, category_id: 1, name: 'Солнечный день',
        subtitle: 'Подсолнухи и зелень',
        description: 'Яркий букет с подсолнухами — для настроения и летнего настроения круглый год.',
        price: 3900, old_price: 4500, badge: '−13%', icon: 'sun',
        image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=600&q=80',
        stock_left: 8, sort: 3, active: 1, sold: 33,
      },
      {
        id: 4, category_id: 3, name: 'Коробка «Романтика»',
        subtitle: 'Цветы в шляпной коробке',
        description: 'Композиция из роз и сезонных цветов в фирменной шляпной коробке Food Букет.',
        price: 7900, old_price: null, badge: 'new', icon: 'package',
        image: 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=600&q=80',
        stock_left: 6, sort: 4, active: 1, sold: 22,
      },
      {
        id: 5, category_id: 2, name: 'Пудровые розы',
        subtitle: 'Розы кустовые · 15 шт',
        description: 'Нежные кустовые розы пудрового оттенка. Мягкий аромат и долгая свежесть.',
        price: 5400, old_price: null, badge: '', icon: 'flower',
        image: 'https://images.unsplash.com/photo-1496062031456-07b8f162a322?w=600&q=80',
        stock_left: 14, sort: 5, active: 1, sold: 40,
      },
      {
        id: 6, category_id: 1, name: 'Тюльпаны весны',
        subtitle: 'Микс тюльпанов · 21 шт',
        description: 'Сезонный микс тюльпанов — свежие, крепкие стебли, яркая палитра.',
        price: 4200, old_price: 4800, badge: 'сезон', icon: 'flower-2',
        image: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600&q=80',
        stock_left: 18, sort: 6, active: 1, sold: 55,
      },
      {
        id: 7, category_id: 4, name: 'Монстера в кашпо',
        subtitle: 'Комнатное растение',
        description: 'Здоровая монстера в керамическом кашпо. Уход в комплекте.',
        price: 3500, old_price: null, badge: '', icon: 'leaf',
        image: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=600&q=80',
        stock_left: 5, sort: 7, active: 1, sold: 12,
      },
      {
        id: 8, category_id: 5, name: 'Набор «С заботой»',
        subtitle: 'Букет + открытка + шоколад',
        description: 'Готовый подарочный набор: мини-букет, открытка и плитка бельгийского шоколада.',
        price: 5900, old_price: 6500, badge: 'набор', icon: 'gift',
        image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=600&q=80',
        stock_left: 10, sort: 8, active: 1, sold: 27,
      },
      {
        id: 9, category_id: 3, name: 'Лавандовый сад',
        subtitle: 'Сухоцветы в вазе',
        description: 'Композиция из лаванды и сухоцветов — стоит месяцами, лёгкий аромат.',
        price: 3200, old_price: null, badge: '', icon: 'sparkles',
        image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=600&q=80',
        stock_left: 9, sort: 9, active: 1, sold: 19,
      },
      {
        id: 10, category_id: 2, name: 'Белые розы 11',
        subtitle: 'Эквадор · 11 шт',
        description: 'Белоснежные эквадорские розы на длинном стебле. Символ чистоты и уважения.',
        price: 5100, old_price: null, badge: '', icon: 'heart',
        image: 'https://images.unsplash.com/photo-1559563362-c667ba5f5480?w=600&q=80',
        stock_left: 0, sort: 10, active: 1, sold: 61,
      },
    ],
    promos: [
      { id: 1, code: 'FLOWERS10', percent: 10, active: 1, used: 3, max_uses: 0 },
      { id: 2, code: 'START10', percent: 10, active: 1, used: 0, max_uses: 0 },
    ],
    orders: [],
    users: [
      { id: 1, first_name: 'Демо', username: 'demo', photo_url: '', banned: 0, created_at: Date.now() },
    ],
    nextIds: { product: 11, category: 6, promo: 3, order: 1001 },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    const data = structuredClone(SEED);
    save(data);
    return data;
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  return { load, save, reset, SEED };
})();

const DemoAPI = {
  _delay(ms = 180) {
    return new Promise((r) => setTimeout(r, ms));
  },

  async handle(method, path, body) {
    await this._delay();
    const db = DemoStore.load();
    const m = method.toUpperCase();

    if (m === 'POST' && path === '/api/auth') {
      return {
        user: { id: 1, first_name: 'Демо', username: 'demo', photo_url: '' },
        is_admin: true,
        settings: db.settings,
      };
    }

    if (m === 'GET' && path === '/api/shop') {
      const products = db.products.filter((p) => p.active).sort((a, b) => a.sort - b.sort);
      const categories = db.categories.map((c) => ({
        ...c,
        count: products.filter((p) => p.category_id === c.id).length,
      })).filter((c) => c.count > 0).sort((a, b) => a.sort - b.sort);
      return { categories, products, settings: db.settings };
    }

    if (m === 'POST' && path === '/api/promo/check') {
      const code = String(body?.code || '').trim().toUpperCase();
      const promo = db.promos.find((p) => p.code === code && p.active);
      if (!promo) throw Object.assign(new Error('Промокод не найден'), { status: 404 });
      if (promo.max_uses && promo.used >= promo.max_uses) {
        throw Object.assign(new Error('Промокод исчерпан'), { status: 400 });
      }
      return { code: promo.code, percent: promo.percent };
    }

    if (m === 'POST' && path === '/api/orders') {
      const items = (body?.items || []).map((it) => {
        const p = db.products.find((x) => x.id === it.id);
        if (!p) throw Object.assign(new Error('Товар не найден'), { status: 400 });
        return {
          id: p.id, name: p.name, qty: it.qty, price: p.price,
          image: p.image, icon: p.icon,
        };
      });
      let subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      let discount = 0;
      let promoCode = null;
      if (body?.promo) {
        const promo = db.promos.find((p) => p.code === String(body.promo).toUpperCase() && p.active);
        if (promo) {
          discount = subtotal * promo.percent / 100;
          promoCode = promo.code;
          promo.used += 1;
        }
      }
      const order = {
        id: db.nextIds.order++,
        status: 'pending',
        items,
        total: Math.round((subtotal - discount) * 100) / 100,
        discount,
        promo: promoCode,
        shipping: body?.shipping || null,
        pay_url: 'demo://pay',
        tracking: '',
        delivery: null,
        created_at: Date.now(),
        user_id: 1,
      };
      db.orders.unshift(order);
      DemoStore.save(db);
      return order;
    }

    const orderMatch = path.match(/^\/api\/orders\/(\d+)$/);
    if (m === 'GET' && orderMatch) {
      const order = db.orders.find((o) => o.id === Number(orderMatch[1]));
      if (!order) throw Object.assign(new Error('Заказ не найден'), { status: 404 });
      return order;
    }

    if (m === 'POST' && path === '/api/orders/demo-pay') {
      const order = db.orders.find((o) => o.id === Number(body?.id));
      if (!order) throw Object.assign(new Error('Заказ не найден'), { status: 404 });
      order.status = 'paid';
      order.delivery = { status_key: 'paid_packing' };
      order.items.forEach((it) => {
        const p = db.products.find((x) => x.id === it.id);
        if (p) {
          p.stock_left = Math.max(0, (p.stock_left || 0) - it.qty);
          p.sold = (p.sold || 0) + it.qty;
        }
      });
      DemoStore.save(db);
      return order;
    }

    if (m === 'GET' && path === '/api/my/orders') {
      return { orders: db.orders.filter((o) => o.user_id === 1) };
    }

    /* ---- admin ---- */
    if (m === 'GET' && path === '/api/admin/overview') {
      const paid = db.orders.filter((o) => o.status === 'paid' || o.status === 'shipped');
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const revenue = paid.reduce((s, o) => s + o.total, 0);
      const revenueToday = paid.filter((o) => o.created_at >= todayStart.getTime())
        .reduce((s, o) => s + o.total, 0);
      const toShip = db.orders.filter((o) => o.status === 'paid').length;
      const shipped = db.orders.filter((o) => o.status === 'shipped').length;
      const stock = db.products.reduce((s, p) => s + (p.stock_left || 0), 0);
      const top = [...db.products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, sold: p.sold || 0, image: p.image, icon: p.icon }));
      return {
        revenue, revenue_today: revenueToday,
        orders_total: db.orders.length,
        to_ship: toShip, shipped,
        users: db.users.length,
        stock, sku: db.products.length,
        top, recent: db.orders.slice(0, 8),
      };
    }

    if (m === 'GET' && path === '/api/admin/products') {
      return { products: db.products, categories: db.categories };
    }

    if (m === 'POST' && path === '/api/admin/products') {
      const p = {
        id: db.nextIds.product++,
        category_id: body.category_id || null,
        name: body.name || 'Букет',
        subtitle: body.subtitle || '',
        description: body.description || '',
        price: Number(body.price) || 0,
        old_price: body.old_price ? Number(body.old_price) : null,
        badge: body.badge || '',
        icon: body.icon || 'flower-2',
        image: body.image || '',
        stock_left: Number(body.stock_left ?? 10),
        sort: Number(body.sort ?? 99),
        active: body.active === false || body.active === 0 ? 0 : 1,
        sold: 0,
      };
      db.products.push(p);
      DemoStore.save(db);
      return p;
    }

    const prodMatch = path.match(/^\/api\/admin\/products\/(\d+)$/);
    if (prodMatch) {
      const id = Number(prodMatch[1]);
      const idx = db.products.findIndex((p) => p.id === id);
      if (idx < 0) throw Object.assign(new Error('Не найдено'), { status: 404 });
      if (m === 'PUT') {
        Object.assign(db.products[idx], {
          ...body,
          price: body.price !== undefined ? Number(body.price) : db.products[idx].price,
          old_price: body.old_price !== undefined ? (body.old_price ? Number(body.old_price) : null) : db.products[idx].old_price,
          stock_left: body.stock_left !== undefined ? Number(body.stock_left) : db.products[idx].stock_left,
          sort: body.sort !== undefined ? Number(body.sort) : db.products[idx].sort,
          active: body.active !== undefined ? (body.active ? 1 : 0) : db.products[idx].active,
        });
        DemoStore.save(db);
        return db.products[idx];
      }
      if (m === 'DELETE') {
        db.products.splice(idx, 1);
        DemoStore.save(db);
        return { ok: true };
      }
    }

    const imgMatch = path.match(/^\/api\/admin\/products\/(\d+)\/image$/);
    if (imgMatch) {
      const p = db.products.find((x) => x.id === Number(imgMatch[1]));
      if (!p) throw Object.assign(new Error('Не найдено'), { status: 404 });
      if (m === 'POST') { p.image = body?.image || ''; DemoStore.save(db); return p; }
      if (m === 'DELETE') { p.image = ''; DemoStore.save(db); return p; }
    }

    if (path.startsWith('/api/admin/categories')) {
      if (m === 'GET') return { categories: db.categories };
      if (m === 'POST' && path === '/api/admin/categories') {
        const c = {
          id: db.nextIds.category++,
          name: body.name || 'Категория',
          icon: body.icon || 'flower-2',
          sort: Number(body.sort ?? 99),
        };
        db.categories.push(c);
        DemoStore.save(db);
        return c;
      }
      const catMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
      if (catMatch) {
        const id = Number(catMatch[1]);
        const idx = db.categories.findIndex((c) => c.id === id);
        if (idx < 0) throw Object.assign(new Error('Не найдено'), { status: 404 });
        if (m === 'PUT') {
          Object.assign(db.categories[idx], body);
          DemoStore.save(db);
          return db.categories[idx];
        }
        if (m === 'DELETE') {
          db.categories.splice(idx, 1);
          DemoStore.save(db);
          return { ok: true };
        }
      }
    }

    if (m === 'GET' && path === '/api/admin/orders') {
      return { orders: db.orders };
    }

    const shipMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/ship$/);
    if (m === 'POST' && shipMatch) {
      const order = db.orders.find((o) => o.id === Number(shipMatch[1]));
      if (!order) throw Object.assign(new Error('Не найдено'), { status: 404 });
      order.status = 'shipped';
      order.tracking = body?.tracking || ('FB' + order.id);
      DemoStore.save(db);
      return order;
    }

    const checkMatch = path.match(/^\/api\/admin\/orders\/(\d+)\/check$/);
    if (m === 'POST' && checkMatch) {
      const order = db.orders.find((o) => o.id === Number(checkMatch[1]));
      if (!order) throw Object.assign(new Error('Не найдено'), { status: 404 });
      if (order.status === 'pending') {
        order.status = 'paid';
        order.delivery = { status_key: 'paid_packing' };
        DemoStore.save(db);
      }
      return order;
    }

    if (path.startsWith('/api/admin/promos')) {
      if (m === 'GET') return { promos: db.promos };
      if (m === 'POST' && path === '/api/admin/promos') {
        const promo = {
          id: db.nextIds.promo++,
          code: String(body.code || '').toUpperCase(),
          percent: Number(body.percent) || 10,
          active: 1,
          used: 0,
          max_uses: Number(body.max_uses) || 0,
        };
        db.promos.push(promo);
        DemoStore.save(db);
        return promo;
      }
      const prMatch = path.match(/^\/api\/admin\/promos\/(\d+)$/);
      if (prMatch) {
        const id = Number(prMatch[1]);
        const idx = db.promos.findIndex((p) => p.id === id);
        if (idx < 0) throw Object.assign(new Error('Не найдено'), { status: 404 });
        if (m === 'PUT') {
          if (body.active !== undefined) db.promos[idx].active = body.active ? 1 : 0;
          DemoStore.save(db);
          return db.promos[idx];
        }
        if (m === 'DELETE') {
          db.promos.splice(idx, 1);
          DemoStore.save(db);
          return { ok: true };
        }
      }
    }

    if (m === 'GET' && path === '/api/admin/users') {
      return { users: db.users };
    }

    const banMatch = path.match(/^\/api\/admin\/users\/(\d+)\/ban$/);
    if (m === 'POST' && banMatch) {
      const u = db.users.find((x) => x.id === Number(banMatch[1]));
      if (!u) throw Object.assign(new Error('Не найдено'), { status: 404 });
      u.banned = body?.banned ? 1 : 0;
      DemoStore.save(db);
      return u;
    }

    if (m === 'POST' && path === '/api/admin/broadcast') {
      return { ok: true, sent: db.users.filter((u) => !u.banned).length };
    }

    if (path === '/api/admin/settings') {
      if (m === 'GET') return db.settings;
      if (m === 'PUT') {
        Object.assign(db.settings, body || {});
        DemoStore.save(db);
        return db.settings;
      }
    }

    throw Object.assign(new Error('Demo API: ' + method + ' ' + path), { status: 404 });
  },
};
