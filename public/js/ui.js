export function el(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name in element && !name.startsWith('aria-') && !name.startsWith('data-')) {
      element[name] = value;
    } else {
      element.setAttribute(name, String(value));
    }
  }

  const append = (child) => {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(append);
    } else if (typeof child === 'object' && 'nodeType' in child) {
      element.append(child);
    } else {
      element.append(document.createTextNode(String(child)));
    }
  };
  append(children);

  return element;
}

export function formatPrice(priceCents) {
  return `₦${(priceCents / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function formatEventDate(value) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value));
}
