import type { Team, UnitKind } from '../../types'
import type { Building } from '../entities/Building'
import { UNIT_STATS, buildingLabel } from '../config'
import type { Faction } from '../../types'

export type ProductionCompletion = {
  building: Building
  kind: UnitKind
  team: Team
}

type QueueItem = {
  kind: UnitKind
  remainingMs: number
  totalMs: number
}

type BuildingQueue = {
  building: Building
  faction: Faction
  items: QueueItem[]
}

export class ProductionSystem {
  private readonly queues = new Map<string, BuildingQueue>()

  enqueue(building: Building, faction: Faction, kind: UnitKind): void {
    const stats = UNIT_STATS[kind]
    const queue = this.queues.get(building.id) ?? { building, faction, items: [] }
    queue.items.push({ kind, remainingMs: stats.buildMs, totalMs: stats.buildMs })
    this.queues.set(building.id, queue)
  }

  queueLength(buildingId: string): number {
    return this.queues.get(buildingId)?.items.length ?? 0
  }

  totalQueued(team: Team): number {
    let count = 0
    for (const queue of this.queues.values()) {
      if (queue.building.team === team && queue.building.alive) count += queue.items.length
    }
    return count
  }

  cancelFirst(buildingId: string): UnitKind | null {
    const queue = this.queues.get(buildingId)
    if (!queue || queue.items.length === 0) return null
    const removed = queue.items.shift()
    if (queue.items.length === 0) this.queues.delete(buildingId)
    return removed?.kind ?? null
  }

  update(
    deltaMs: number,
    speedMultiplier: (team: Team) => number,
    onComplete: (completion: ProductionCompletion) => void,
  ): void {
    for (const [buildingId, queue] of [...this.queues.entries()]) {
      if (!queue.building.alive) {
        this.queues.delete(buildingId)
        continue
      }
      const active = queue.items[0]
      if (!active) {
        this.queues.delete(buildingId)
        continue
      }
      active.remainingMs -= deltaMs * speedMultiplier(queue.building.team)
      if (active.remainingMs > 0) continue
      queue.items.shift()
      onComplete({ building: queue.building, kind: active.kind, team: queue.building.team })
      if (queue.items.length === 0) this.queues.delete(buildingId)
    }
  }

  getPlayerViews() {
    return [...this.queues.values()]
      .filter((queue) => queue.building.alive && queue.building.team === 'player')
      .map((queue) => {
        const active = queue.items[0]
        return {
          buildingId: queue.building.id,
          buildingLabel: buildingLabel(queue.building.kind, queue.faction),
          activeKind: active?.kind ?? null,
          activeLabel: active ? UNIT_STATS[active.kind].label : 'Idle',
          progress: active ? Math.max(0, Math.min(1, 1 - active.remainingMs / active.totalMs)) : 0,
          queuedKinds: queue.items.slice(1).map((item) => item.kind),
        }
      })
  }
}
