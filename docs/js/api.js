/* ============================================================
   API-клиент: демо (localStorage) или живой бэкенд
   ============================================================ */

const API = {
  initData: (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '',

  get isDemo() {
    return !!(window.FOODBUKET && window.FOODBUKET.demo);
  },

  base() {
    const cfg = window.FOODBUKET || {};
    return (cfg.apiBase || '').replace(/\/$/, '');
  },

  async request(method, path, body) {
    if (API.isDemo) {
      try {
        return await DemoAPI.handle(method, path, body);
      } catch (e) {
        if (e.status) throw e;
        throw new Error(e.message || 'Demo error');
      }
    }

    const url = API.base() + path;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Data': API.initData,
          'X-Lang': (typeof I18N !== 'undefined' ? I18N.lang() : 'ru'),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error(typeof t === 'function' ? t('fatal_conn') : 'Нет соединения с сервером');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* пустой ответ */ }
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body ?? {}),
  put: (path, body) => API.request('PUT', path, body ?? {}),
  del: (path) => API.request('DELETE', path),

  uploadProductImage(productId, dataUrl) {
    return API.post(`/api/admin/products/${productId}/image`, { image: dataUrl });
  },
};
