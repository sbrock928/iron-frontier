import { describe, expect, it } from 'vitest'
import { Pathfinder } from './Pathfinder'

const fakeBuilding = (x: number, y: number, size = 96) => ({ x, y, size, alive: true })

describe('Pathfinder', () => {
  it('finds a route around an obstacle', () => {
    const pathfinder = new Pathfinder()
    const path = pathfinder.findPath(
      { x: 50, y: 150 },
      { x: 450, y: 150 },
      [fakeBuilding(250, 150) as never],
      600,
      400,
    )
    expect(path.length).toBeGreaterThan(1)
    expect(path.at(-1)?.x).toBeGreaterThan(400)
  })
})
