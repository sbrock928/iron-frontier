import { describe, expect, it } from 'vitest'
import { SpatialHash } from './SpatialHash'

type Marker = { id: string; x: number; y: number }

const marker = (id: string, x: number, y: number): Marker => ({ id, x, y })

describe('SpatialHash', () => {
  it('returns entities inside the query radius', () => {
    const index = new SpatialHash<Marker>(64)
    index.rebuild([marker('a', 10, 10), marker('b', 20, 15), marker('c', 900, 900)])

    const ids = index.queryNearby(12, 12, 40).map((item) => item.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('finds neighbours that sit across a cell boundary', () => {
    const index = new SpatialHash<Marker>(64)
    // 60 and 70 fall in adjacent cells but are only 10px apart.
    index.rebuild([marker('left', 60, 60), marker('right', 70, 60)])

    const ids = index.queryNearby(60, 60, 20).map((item) => item.id)
    expect(ids).toContain('left')
    expect(ids).toContain('right')
  })

  it('handles negative coordinates without key collisions', () => {
    const index = new SpatialHash<Marker>(64)
    index.rebuild([marker('negative', -200, -200), marker('positive', 200, 200)])

    expect(index.queryNearby(-200, -200, 30).map((item) => item.id)).toEqual(['negative'])
    expect(index.queryNearby(200, 200, 30).map((item) => item.id)).toEqual(['positive'])
  })

  it('rebuild discards the previous contents', () => {
    const index = new SpatialHash<Marker>(64)
    index.rebuild([marker('old', 10, 10)])
    index.rebuild([marker('new', 10, 10)])

    expect(index.queryNearby(10, 10, 30).map((item) => item.id)).toEqual(['new'])
  })

  it('agrees with a brute-force scan over random data', () => {
    const entities: Marker[] = Array.from({ length: 400 }, (_, i) =>
      marker(`e${i}`, Math.random() * 2000, Math.random() * 1200),
    )
    const index = new SpatialHash<Marker>(64)
    index.rebuild(entities)

    const radius = 90
    for (const probe of entities.slice(0, 25)) {
      const expected = entities
        .filter((item) => Math.hypot(item.x - probe.x, item.y - probe.y) <= radius)
        .map((item) => item.id)
        .sort()

      // The hash is a broad-phase filter, so narrow the result with an exact test.
      const actual = index
        .queryNearby(probe.x, probe.y, radius)
        .filter((item) => Math.hypot(item.x - probe.x, item.y - probe.y) <= radius)
        .map((item) => item.id)
        .sort()

      expect(actual).toEqual(expected)
    }
  })
})
