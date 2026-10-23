import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// jsdom has no canvas; components check for a missing 2D context and skip drawing.
HTMLCanvasElement.prototype.getContext = () => null

window.matchMedia =
  window.matchMedia ||
  ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))

// Newer Node versions define their own (disabled) localStorage, which hides jsdom's.
if (!window.localStorage) {
  const store = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    },
  })
}

// By default the backend never answers; tests stub fetch when they need a response.
globalThis.fetch = vi.fn(() => new Promise(() => {}))
