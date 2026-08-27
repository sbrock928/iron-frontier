export interface SpatialEntity {
  x: number
  y: number
}

/**
 * Uniform-grid spatial hash for broad-phase proximity queries.
 *
 * Both local avoidance and combat target acquisition previously walked every
 * entity for every entity, which is O(n^2) per frame and becomes the dominant
 * cost well before a StarCraft-sized army of ~200 units. Bucketing entities by
 * cell reduces those queries to the handful of neighbours that can actually be
 * in range.
 *
 * The index is rebuilt each frame rather than incrementally maintained: units
 * move every tick, so a rebuild is both simpler and cheaper than tracking
 * per-entity cell transitions. Buckets are reused between rebuilds so steady
 * state allocates nothing.
 */
export class SpatialHash<T extends SpatialEntity> {
  private readonly buckets = new Map<number, T[]>()
  private readonly inverseCellSize: number

  constructor(private readonly cellSize = 64) {
    this.inverseCellSize = 1 / cellSize
  }

  /** Empties every bucket while retaining the arrays for reuse. */
  clear(): void {
    for (const bucket of this.buckets.values()) bucket.length = 0
  }

  rebuild(entities: readonly T[]): void {
    this.clear()
    for (const entity of entities) this.insert(entity)
  }

  insert(entity: T): void {
    const key = this.keyFor(entity.x, entity.y)
    const bucket = this.buckets.get(key)
    if (bucket) bucket.push(entity)
    else this.buckets.set(key, [entity])
  }

  /**
   * Invokes `visit` for every entity in the cells overlapping the circle at
   * (x, y). Callers must still perform an exact distance test: this is a
   * broad-phase filter, so results may lie slightly outside `radius`.
   */
  forEachNearby(x: number, y: number, radius: number, visit: (entity: T) => void): void {
    const minCol = Math.floor((x - radius) * this.inverseCellSize)
    const maxCol = Math.floor((x + radius) * this.inverseCellSize)
    const minRow = Math.floor((y - radius) * this.inverseCellSize)
    const maxRow = Math.floor((y + radius) * this.inverseCellSize)

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const bucket = this.buckets.get(this.hash(col, row))
        if (bucket === undefined) continue
        for (let index = 0; index < bucket.length; index += 1) visit(bucket[index] as T)
      }
    }
  }

  /** Convenience wrapper that collects nearby entities into a fresh array. */
  queryNearby(x: number, y: number, radius: number): T[] {
    const result: T[] = []
    this.forEachNearby(x, y, radius, (entity) => result.push(entity))
    return result
  }

  private keyFor(x: number, y: number): number {
    return this.hash(Math.floor(x * this.inverseCellSize), Math.floor(y * this.inverseCellSize))
  }

  /**
   * Cantor-style pairing into a single number key. Coordinates are offset into
   * the positive range first so negative world positions stay collision-free.
   */
  private hash(col: number, row: number): number {
    return (col + 0x8000) * 0x10000 + (row + 0x8000)
  }
}
