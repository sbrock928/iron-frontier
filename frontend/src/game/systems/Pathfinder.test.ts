import { describe, expect, it } from 'vitest'
import { Pathfinder } from './Pathfinder'
import { GRID_SIZE } from '../config'
import type { Building } from '../entities/Building'

const fakeBuilding = (x: number, y: number, size = 96) =>
  ({ x, y, size, alive: true }) as unknown as Building

/** Building footprints are inflated by size/2 + 20 when blocking cells. */
const blockedHalfWidth = (size: number) => size / 2 + 20

const intersectsBuilding = (point: { x: number; y: number }, building: { x: number; y: number; size: number }) => {
  const half = blockedHalfWidth(building.size)
  return Math.abs(point.x - building.x) <= half && Math.abs(point.y - building.y) <= half
}

describe('Pathfinder', () => {
  it('finds a route around an obstacle', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath({ x: 50, y: 150 }, { x: 450, y: 150 }, [fakeBuilding(250, 150)], 600, 400)

    expect(path.length).toBeGreaterThan(1)
    expect(path.at(-1)?.x).toBeGreaterThan(400)
  })

  it('ends exactly on the requested destination', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath({ x: 50, y: 150 }, { x: 437, y: 291 }, [fakeBuilding(250, 150)], 600, 400)

    expect(path.at(-1)).toEqual({ x: 437, y: 291 })
  })

  it('never routes a waypoint through a blocked footprint', () => {
    const pathfinder = new Pathfinder()
    const building = { x: 250, y: 150, size: 96 }
    const path = pathfinder.findPath({ x: 50, y: 150 }, { x: 450, y: 150 }, [fakeBuilding(250, 150)], 600, 400)

    // The final point is the exact goal, which is deliberately allowed to sit
    // on a blocked cell; every intermediate waypoint must be clear.
    for (const point of path.slice(0, -1)) {
      expect(intersectsBuilding(point, building)).toBe(false)
    }
  })

  it('returns a direct order for flying units regardless of obstacles', () => {
    const pathfinder = new Pathfinder()
    const start = { x: 50, y: 150, isFlying: true }
    const path = pathfinder.findPath(start, { x: 450, y: 150 }, [fakeBuilding(250, 150)], 600, 400)

    expect(path).toEqual([{ x: 450, y: 150 }])
  })

  it('smooths an unobstructed route into a straight line', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath({ x: 50, y: 150 }, { x: 500, y: 150 }, [], 600, 400)

    // With nothing in the way, string-pulling should collapse the grid
    // staircase down to a single waypoint on the destination.
    expect(path).toEqual([{ x: 500, y: 150 }])
  })

  it('returns a direct order when the destination is unreachable', () => {
    const pathfinder = new Pathfinder()
    // A wall of structures spanning the full height of the map.
    const wall = Array.from({ length: 12 }, (_, i) => fakeBuilding(250, i * 40, 96))
    const path = pathfinder.findPath({ x: 50, y: 150 }, { x: 450, y: 150 }, wall, 600, 400)

    expect(path).toEqual([{ x: 450, y: 150 }])
  })

  it('reflects building changes once the cache is invalidated', () => {
    const pathfinder = new Pathfinder()
    const buildings: Building[] = []

    const openPath = pathfinder.findPath({ x: 50, y: 150 }, { x: 450, y: 150 }, buildings, 600, 400)
    expect(openPath).toEqual([{ x: 450, y: 150 }])

    buildings.push(fakeBuilding(250, 150))
    pathfinder.invalidate()

    const detour = pathfinder.findPath({ x: 50, y: 150 }, { x: 450, y: 150 }, buildings, 600, 400)
    expect(detour.length).toBeGreaterThan(1)
  })

  it('produces a path when the unit starts inside a building footprint', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath({ x: 250, y: 150 }, { x: 500, y: 150 }, [fakeBuilding(250, 150)], 600, 400)

    expect(path.at(-1)).toEqual({ x: 500, y: 150 })
  })

  it('clamps out-of-bounds requests into the world', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath({ x: -500, y: -500 }, { x: 300, y: 200 }, [], 600, 400)

    expect(path.at(-1)).toEqual({ x: 300, y: 200 })
  })

  it('handles a large map without exploding in cost', () => {
    const pathfinder = new Pathfinder()
    const buildings = Array.from({ length: 40 }, (_, i) =>
      fakeBuilding(400 + (i % 8) * GRID_SIZE * 3, 300 + Math.floor(i / 8) * GRID_SIZE * 3, 110),
    )

    const started = performance.now()
    for (let i = 0; i < 50; i += 1) {
      pathfinder.findPath({ x: 100, y: 100 }, { x: 3000, y: 1800 }, buildings, 3200, 1900)
    }
    const elapsed = performance.now() - started

    // 50 full-map queries stand in for a large selection being ordered at once.
    expect(elapsed).toBeLessThan(2000)
  })
})
