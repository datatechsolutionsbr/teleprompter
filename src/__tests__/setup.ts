import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement matchMedia — supply a stub so prefers-reduced-motion
// hooks don't crash in tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom 29 + vitest 4 ship a Storage wrapper without the standard methods on
// the prototype — `localStorage.clear is not a function` blows up every test
// that touches it. Replace with a minimal in-memory Storage shim.
if (typeof window !== 'undefined') {
  const stores = new WeakMap<object, Map<string, string>>()
  const make = () => {
    const store = new Map<string, string>()
    const api = {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null
      },
      setItem(key: string, value: string) {
        store.set(key, String(value))
      },
      removeItem(key: string) {
        store.delete(key)
      },
      clear() {
        store.clear()
      },
      key(i: number) {
        return [...store.keys()][i] ?? null
      },
      get length() {
        return store.size
      },
    }
    stores.set(api, store)
    return api
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: make() })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: make() })
  // Ensure global symbol matches window's so `localStorage.clear()` works
  // without needing `window.` prefix in test code. Using defineProperty
  // since `globalThis.localStorage` is read-only when set by jsdom.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: window.localStorage,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: window.sessionStorage,
  })
}
