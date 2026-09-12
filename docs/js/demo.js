/* ============================================================
   Демо-бэкенд в браузере (localStorage) — без сервера
   ============================================================ */

const DemoStore = (() => {
  const KEY = 'foodbuket_demo_v2';

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
      { id: 1, code: 'FLOWERS10', percent: 10, active: 1, used: 14, max_uses: 0 },
      { id: 2, code: 'START10', percent: 10, active: 1, used: 5, max_uses: 0 },
    ],
    users: [
      { id: 1, first_name: 'Демо', username: 'demo', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 20 },
      { id: 2, first_name: 'Анна', username: 'anna_flowers', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 12 },
      { id: 3, first_name: 'Игорь', username: 'igor_k', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 9 },
      { id: 4, first_name: 'Мария', username: 'masha_rz', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 7 },
      { id: 5, first_name: 'Сергей', username: 'serg_pro', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 5 },
      { id: 6, first_name: 'Ольга', username: 'olya_b', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 3 },
      { id: 7, first_name: 'Дмитрий', username: 'dima88', photo_url: '', banned: 1, created_at: Date.now() - 86400000 * 15 },
      { id: 8, first_name: 'Елена', username: 'lena_home', photo_url: '', banned: 0, created_at: Date.now() - 86400000 * 2 },
    ],
    orders: (() => {
      const hour = 3600000;
      const day = 86400000;
      const now = Date.now();
      const ship = (name, phone, city, address) => ({
        name, phone, city, postal: '390000', address, comment: '',
      });
      return [
        {
          id: 1012, status: 'paid', user_id: 8, username: 'lena_home',
          items: [{ id: 1, name: 'Нежность', qty: 1, price: 4900 }],
          total: 4900, discount: 0, promo: null,
          shipping: ship('Елена Новикова', '+7 910 111-22-33', 'Рязань', 'ул. Ленина, 12'),
          pay_url: 'demo://pay', tracking: '', delivery: { status_key: 'paid_packing' },
          created_at: now - hour * 2,
        },
        {
          id: 1011, status: 'paid', user_id: 6, username: 'olya_b',
          items: [
            { id: 4, name: 'Коробка «Романтика»', qty: 1, price: 7900 },
            { id: 8, name: 'Набор «С заботой»', qty: 1, price: 5900 },
          ],
          total: 12420, discount: 1380, promo: 'FLOWERS10',
          shipping: ship('Ольга Белова', '+7 920 444-55-66', 'Рязань', 'пр. Первомайский, 45'),
          pay_url: 'demo://pay', tracking: '', delivery: { status_key: 'paid_packing' },
          created_at: now - hour * 5,
        },
        {
          id: 1010, status: 'shipped', user_id: 4, username: 'masha_rz',
          items: [{ id: 2, name: 'Классика 25', qty: 1, price: 6900 }],
          total: 6900, discount: 0, promo: null,
          shipping: ship('Мария Соколова', '+7 915 222-33-44', 'Рязань', 'ул. Свободы, 8'),
          pay_url: 'demo://pay', tracking: 'FB1010RZ', delivery: null,
          created_at: now - day,
        },
        {
          id: 1009, status: 'shipped', user_id: 5, username: 'serg_pro',
          items: [{ id: 6, name: 'Тюльпаны весны', qty: 2, price: 4200 }],
          total: 7560, discount: 840, promo: 'FLOWERS10',
          shipping: ship('Сергей Прохоров', '+7 953 777-88-99', 'Рязань', 'ул. Гагарина, 3'),
          pay_url: 'demo://pay', tracking: 'FB1009RZ', delivery: null,
          created_at: now - day - hour * 4,
        },
        {
          id: 1008, status: 'pending', user_id: 3, username: 'igor_k',
          items: [{ id: 5, name: 'Пудровые розы', qty: 1, price: 5400 }],
          total: 5400, discount: 0, promo: null,
          shipping: ship('Игорь Кузнецов', '+7 900 123-45-67', 'Рязань', 'ул. Новоселов, 21'),
          pay_url: 'demo://pay', tracking: '', delivery: null,
          created_at: now - day * 2,
        },
        {
          id: 1007, status: 'shipped', user_id: 2, username: 'anna_flowers',
          items: [
            { id: 3, name: 'Солнечный день', qty: 1, price: 3900 },
            { id: 9, name: 'Лавандовый сад', qty: 1, price: 3200 },
          ],
          total: 7100, discount: 0, promo: null,
          shipping: ship('Анна Цветкова', '+7 980 555-01-02', 'Рязань', 'ул. Почтовая, 17'),
          pay_url: 'demo://pay', tracking: 'FB1007RZ', delivery: null,
          created_at: now - day * 3,
        },
        {
          id: 1006, status: 'shipped', user_id: 4, username: 'masha_rz',
          items: [{ id: 8, name: 'Набор «С заботой»', qty: 1, price: 5900 }],
          total: 5310, discount: 590, promo: 'START10',
          shipping: ship('Мария Соколова', '+7 915 222-33-44', 'Рязань', 'ул. Свободы, 8'),
          pay_url: 'demo://pay', tracking: 'FB1006RZ', delivery: null,
          created_at: now - day * 4,
        },
        {
          id: 1005, status: 'expired', user_id: 7, username: 'dima88',
          items: [{ id: 7, name: 'Монстера в кашпо', qty: 1, price: 3500 }],
          total: 3500, discount: 0, promo: null,
          shipping: ship('Дмитрий Орлов', '+7 999 000-11-22', 'Рязань', 'ул. Касимовское ш., 5'),
          pay_url: 'demo://pay', tracking: '', delivery: null,
          created_at: now - day * 6,
        },
        {
          id: 1004, status: 'shipped', user_id: 2, username: 'anna_flowers',
          items: [{ id: 1, name: 'Нежность', qty: 1, price: 4900 }],
          total: 4900, discount: 0, promo: null,
          shipping: ship('Анна Цветкова', '+7 980 555-01-02', 'Рязань', 'ул. Почтовая, 17'),
          pay_url: 'demo://pay', tracking: 'FB1004RZ', delivery: null,
          created_at: now - day * 8,
        },
        {
          id: 1003, status: 'shipped', user_id: 5, username: 'serg_pro',
          items: [{ id: 2, name: 'Классика 25', qty: 1, price: 6900 }],
          total: 6900, discount: 0, promo: null,
          shipping: ship('Сергей Прохоров', '+7 953 777-88-99', 'Рязань', 'ул. Гагарина, 3'),
          pay_url: 'demo://pay', tracking: 'FB1003RZ', delivery: null,
          created_at: now - day * 10,
        },
      ];
    })(),
    nextIds: { product: 11, category: 6, promo: 3, order: 1013 },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    const data = JSON.parse(JSON.stringify(SEED));
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
      const revenueTotal = paid.reduce((s, o) => s + o.total, 0);
      const revenueToday = paid.filter((o) => o.created_at >= todayStart.getTime())
        .reduce((s, o) => s + o.total, 0);
      const top = [...db.products]
        .sort((a, b) => (b.sold || b.sales || 0) - (a.sold || a.sales || 0))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sales: p.sold || p.sales || 0,
          price: p.price,
          image: p.image,
          icon: p.icon,
        }));
      const recent = db.orders.slice(0, 8).map((o) => {
        const u = db.users.find((x) => x.id === o.user_id);
        return {
          ...o,
          username: o.username || (u && u.username) || '',
          user_id: o.user_id,
        };
      });
      return {
        revenue_total: revenueTotal,
        revenue_today: revenueToday,
        orders_paid: paid.length,
        orders_pending: db.orders.filter((o) => o.status === 'pending').length,
        orders_to_ship: db.orders.filter((o) => o.status === 'paid').length,
        orders_shipped: db.orders.filter((o) => o.status === 'shipped').length,
        users_count: db.users.length,
        products_count: db.products.length,
        stock_total: db.products.reduce((s, p) => s + (p.stock_left || p.stock_qty || 0), 0),
        top_products: top,
        recent_orders: recent,
      };
    }

    if (m === 'GET' && path === '/api/admin/products') {
      const products = db.products.map((p) => ({
        ...p,
        sales: p.sold || p.sales || 0,
        stock_qty: p.stock_left ?? p.stock_qty ?? 0,
        stock_left: p.stock_left ?? p.stock_qty ?? 0,
      }));
      return { products, categories: db.categories };
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
