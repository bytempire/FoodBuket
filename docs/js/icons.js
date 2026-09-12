/* ============================================================
   Иконки: SVG по API (api.iconify.design)
   ============================================================ */

const ICON_API = 'https://api.iconify.design';
const ICON_DEFAULT_SET = 'lucide';

function iconUrl(name, color) {
  let set = ICON_DEFAULT_SET;
  let n = String(name || 'flower-2').trim() || 'flower-2';
  if (n.includes(':')) [set, n] = n.split(':');
  return `${ICON_API}/${encodeURIComponent(set)}/${encodeURIComponent(n)}.svg?color=${encodeURIComponent(color)}`;
}

function ic(name, size = 20, color = '#1A3A2F', cls = '') {
  const fallback = iconUrl('flower-2', color);
  return `<img class="ic ${cls}" src="${iconUrl(name, color)}" width="${size}" height="${size}" alt=""
    loading="lazy" draggable="false" onerror="this.onerror=null;this.src='${fallback}'">`;
}

/** Иконка на акцентной (розовой) кнопке */
function icDark(name, size = 20) {
  return ic(name, size, '#ffffff');
}

function icMuted(name, size = 20) {
  return ic(name, size, '#7A8B82');
}
