import { describe, expect, it } from 'vitest'
import { generateTerrainFeatures } from './TerrainGenerator'

describe('generateTerrainFeatures', () => {
  it('is fully deterministic for a given mission id', () => {
    const a = generateTerrainFeatures('mission_01', 3200, 1900, [])
    const b = generateTerrainFeatures('mission_01', 3200, 1900, [])

    expect(a).toEqual(b)
  })

  it('produces a different layout for a different mission id', () => {
    const a = generateTerrainFeatures('mission_01', 3200, 1900, [])
    const b = generateTerrainFeatures('mission_02', 3200, 1900, [])

    expect(a).not.toEqual(b)
  })

  it('never places a decoration or obstacle inside an avoid zone', () => {
    const avoidZones = [
      { x: 400, y: 400, radius: 300 },
      { x: 2800, y: 1500, radius: 300 },
      { x: 1600, y: 950, radius: 130 },
    ]
    const features = generateTerrainFeatures('mission_03', 3200, 1900, avoidZones)

    const insideAnyZone = (x: number, y: number) =>
      avoidZones.some((zone) => Math.hypot(x - zone.x, y - zone.y) < zone.radius)

    for (const decoration of features.decorations) {
      expect(insideAnyZone(decoration.x, decoration.y)).toBe(false)
    }
    for (const obstacle of features.obstacles) {
      expect(insideAnyZone(obstacle.x, obstacle.y)).toBe(false)
    }
  })

  it('always emits a matching decoration for every blocking obstacle', () => {
    const features = generateTerrainFeatures('mission_01', 3200, 1900, [])
    const blockingDecorations = features.decorations.filter((d) => d.blocking)

    expect(blockingDecorations.length).toBe(features.obstacles.length)
  })

  it('scales feature counts with map area', () => {
    const small = generateTerrainFeatures('mission_x', 1200, 900, [])
    const large = generateTerrainFeatures('mission_x', 4800, 3600, [])

    expect(large.decorations.length).toBeGreaterThan(small.decorations.length)
  })
})
