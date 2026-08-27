import type { Unit } from '../entities/Unit'

export class LocalAvoidanceSystem {
  update(units: Unit[]): void {
    const alive = units.filter((unit) => unit.alive)
    for (let i = 0; i < alive.length; i += 1) {
      const a = alive[i]
      if (!a) continue
      for (let j = i + 1; j < alive.length; j += 1) {
        const b = alive[j]
        if (!b || a.team !== b.team || a.isFlying !== b.isFlying) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distanceSq = dx * dx + dy * dy
        const minimum = a.isFlying ? 34 : 40
        if (distanceSq <= 0.001 || distanceSq >= minimum * minimum) continue
        const distance = Math.sqrt(distanceSq)
        const overlap = (minimum - distance) * 0.12
        const nx = dx / distance
        const ny = dy / distance
        a.nudge(-nx * overlap, -ny * overlap)
        b.nudge(nx * overlap, ny * overlap)
      }
    }
  }
}
