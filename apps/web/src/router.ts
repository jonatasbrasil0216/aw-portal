type RouteHandler = (params: Record<string, string>) => void

interface Route {
  pattern: RegExp
  keys: string[]
  handler: RouteHandler
}

const routes: Route[] = []

function addRoute(path: string, handler: RouteHandler) {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' + path.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$'
  )
  routes.push({ pattern, keys, handler })
}

function navigate(hash: string) {
  const path = (hash.replace(/^#/, '') || '/').split('?')[0]
  for (const route of routes) {
    const m = path.match(route.pattern)
    if (m) {
      const params: Record<string, string> = {}
      route.keys.forEach((k, i) => { params[k] = m[i + 1] })
      route.handler(params)
      return
    }
  }
}

export function initRouter(routeMap: Record<string, RouteHandler>) {
  for (const [path, handler] of Object.entries(routeMap)) {
    addRoute(path, handler)
  }
  window.addEventListener('hashchange', () => navigate(location.hash))
  navigate(location.hash)
}

export function go(path: string) {
  location.hash = path
}
