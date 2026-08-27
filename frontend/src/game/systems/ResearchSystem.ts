import type { Faction, Team, UpgradeKey } from '../../types'
import type { Building } from '../entities/Building'
import { UPGRADE_DEFS } from '../config'

type ResearchItem = {
  upgradeKey: UpgradeKey
  remainingMs: number
  totalMs: number
}

type ResearchQueue = {
  building: Building
  faction: Faction
  items: ResearchItem[]
}

export class ResearchSystem {
  private readonly queues = new Map<string, ResearchQueue>()

  enqueue(building: Building, faction: Faction, upgradeKey: UpgradeKey): void {
    const def = UPGRADE_DEFS[upgradeKey]
    const queue = this.queues.get(building.id) ?? { building, faction, items: [] }
    queue.items.push({ upgradeKey, remainingMs: def.researchMs, totalMs: def.researchMs })
    this.queues.set(building.id, queue)
  }

  isQueued(upgradeKey: UpgradeKey): boolean {
    return [...this.queues.values()].some((queue) => queue.items.some((item) => item.upgradeKey === upgradeKey))
  }

  update(deltaMs: number, speedMultiplier: (team: Team) => number, onComplete: (upgradeKey: UpgradeKey, team: Team) => void): void {
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
      onComplete(active.upgradeKey, queue.building.team)
      if (queue.items.length === 0) this.queues.delete(buildingId)
    }
  }

  getPlayerViews() {
    return [...this.queues.values()]
      .filter((queue) => queue.building.alive && queue.building.team === 'player')
      .flatMap((queue) => queue.items.map((item, index) => ({
        buildingId: queue.building.id,
        upgradeKey: item.upgradeKey,
        label: UPGRADE_DEFS[item.upgradeKey].label,
        progress: index === 0 ? Math.max(0, Math.min(1, 1 - item.remainingMs / item.totalMs)) : 0,
      })))
  }
}
