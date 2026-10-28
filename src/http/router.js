function compilePath(path) {
  const names = [];
  const pattern = path.split('/').map((part) => {
    if (part.startsWith(':')) {
      names.push(part.slice(1));
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { names, regex: new RegExp(`^${pattern}/?$`) };
}

export function createRouter() {
  const routes = [];
  return {
    add(method, path, handler) {
      if (typeof handler !== 'function') throw new TypeError('Route handler must be a function');
      routes.push({ method: method.toUpperCase(), ...compilePath(path), handler });
      return this;
    },
    get(path, handler) { return this.add('GET', path, handler); },
    post(path, handler) { return this.add('POST', path, handler); },
    match(method, path) {
      for (const route of routes) {
        if (route.method !== method.toUpperCase()) continue;
        const match = route.regex.exec(path);
        if (!match) continue;
        const params = {};
        try {
          route.names.forEach((name, index) => { params[name] = decodeURIComponent(match[index + 1]); });
        } catch {
          return { error: 'BAD_PATH' };
        }
        return { handler: route.handler, params };
      }
      return null;
    },
  };
}
