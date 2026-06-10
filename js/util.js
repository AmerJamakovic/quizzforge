// util.js, small shared DOM + formatting helpers used across views.

/** Escape text for safe insertion into innerHTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create an element. el('button.primary', { onclick }, 'Save')
 * Tag string supports `.class` and `#id` shorthand.
 */
export function el(tag, props = {}, ...children) {
  const m = tag.match(/^([a-z0-9]+)((?:[.#][\w-]+)*)$/i);
  const name = m ? m[1] : tag;
  const node = document.createElement(name);
  if (m && m[2]) {
    for (const token of m[2].match(/[.#][\w-]+/g)) {
      if (token[0] === '.') node.classList.add(token.slice(1));
      else node.id = token.slice(1);
    }
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node && k !== 'list') {
      node[k] = v;
    } else {
      node.setAttribute(k, v === true ? '' : v);
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Format an ISO timestamp as a short, locale-aware date. */
export function formatDate(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (isNaN(d)) return 'unknown';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

let toastTimer = null;
/** Show a transient status message. variant: 'info' | 'success' | 'error'. */
export function toast(message, variant = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  region.innerHTML = '';
  const node = el('div', { class: `toast toast-${variant}` }, message);
  region.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.add('toast-leaving');
    setTimeout(() => node.remove(), 300);
  }, variant === 'error' ? 6000 : 3000);
}

/** Confirm dialog wrapper (kept thin so it is easy to swap for a custom modal). */
export function confirmAction(message) {
  return window.confirm(message);
}

/**
 * A centered, bold instructions box. Pass an optional leading icon (text/SVG)
 * and any number of child nodes/strings for the message.
 * callout({}, 'Do ', el('strong', {}, 'this'), ' first.')
 */
export function callout(opts = {}, ...children) {
  const node = el('div', { class: 'callout' + (opts.tight ? ' tight' : '') });
  if (opts.icon) node.appendChild(el('span', { class: 'callout-icon', 'aria-hidden': 'true' }, opts.icon));
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
