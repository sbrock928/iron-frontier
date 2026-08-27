import type { Unit } from '../entities/Unit'
import { SpatialHash } from '../core/SpatialHash'

/** Separation distance for ground units, in world pixels. */
const GROUND_SEPARATION = 40
/** Separation distance for air units, which stack more tightly. */
const AIR_SEPARATION = 34
/** Fraction of the overlap resolved per frame. Higher values jitter. */
const RESOLUTION_RATE = 0.12

/**
 * Keeps friendly units from occupying the same space.
 *
 * Uses a spatial hash so each unit only tests the neighbours sharing its cells
 * rather than the entire army. The bucket size matches the largest separation
 * distance so a single ring of cells always covers the query radius.
 */
export class LocalAvoidanceSystem {
  private readonly index = new SpatialHash<Unit>(GROUND_SEPARATION)

  update(units: Unit[]): void {
    const alive = units.filter((unit) => unit.alive)
    this.index.rebuild(alive)

    for (const a of alive) {
      const minimum = a.isFlying ? AIR_SEPARATION : GROUND_SEPARATION
      this.index.forEachNearby(a.x, a.y, minimum, (b) => {
        // Each pair is visited twice; resolving only one ordering keeps the
        // push symmetric and avoids double-applying the correction.
        if (b === a || b.id <= a.id) return
        if (a.team !== b.team || a.isFlying !== b.isFlying) return

        const dx = b.x - a.x
        const dy = b.y - a.y
        const distanceSq = dx * dx + dy * dy
        if (distanceSq <= 0.001 || distanceSq >= minimum * minimum) return

        const distance = Math.sqrt(distanceSq)
        const overlap = (minimum - distance) * RESOLUTION_RATE
        const nx = dx / distance
        const ny = dy / distance
        a.nudge(-nx * overlap, -ny * overlap)
        b.nudge(nx * overlap, ny * overlap)
      })
    }
  }
}
