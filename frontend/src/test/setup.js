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

// By default the backend never answers; tests stub fetch when they need a response.
globalThis.fetch = vi.fn(() => new Promise(() => {}))
