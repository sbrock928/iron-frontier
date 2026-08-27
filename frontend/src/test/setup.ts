import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Shared setup for component tests.
 *
 * `cleanup` runs between tests because the game store is a module-level
 * singleton: a component left mounted from a previous test would keep its
 * subscription and react to state written by the next one.
 */
afterEach(() => {
  cleanup()
})

/*
 * jsdom implements neither of these, and both are used by the console UI:
 * `scrollTo` by the alert log when new alerts arrive, and the canvas 2D context
 * by the minimap. Stubbing them here keeps the stubs out of individual tests.
 */
Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => {})

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  scale: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  setTransform: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
})) as unknown as HTMLCanvasElement['getContext']
