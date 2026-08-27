import type { Building } from '../entities/Building'
import type { ResourcePatch } from '../entities/ResourcePatch'
import type { Unit } from '../entities/Unit'

export class HarvestingSystem {
  update(
    deltaMs: number,
    units: Unit[],
    buildings: Building[],
    patches: ResourcePatch[],
    addCredits: (amount: number) => void,
  ): void {
    const refineries = buildings.filter((building) => building.alive && building.team === 'player' && building.kind === 'refinery')
    if (refineries.length === 0) return

    for (const harvester of units.filter((unit) => unit.alive && unit.team === 'player' && (unit.kind === 'harvester' || unit.kind === 'drone'))) {
      const refinery = this.nearest(harvester, refineries)
      const patch = this.nearest(harvester, patches.filter((item) => item.amount > 0))
      if (!refinery || !patch) continue

      if (harvester.cargo >= 700) harvester.harvestState = 'returning'
      if (harvester.harvestState === 'returning') {
        if (harvester.distanceTo(refinery) > 65) {
          harvester.moveDirectlyToward(refinery, deltaMs)
        } else {
          addCredits(harvester.cargo)
          harvester.cargo = 0
          harvester.harvestState = 'seeking'
        }
        continue
      }

      if (harvester.distanceTo(patch) > 65) {
        harvester.harvestState = 'seeking'
        harvester.moveDirectlyToward(patch, deltaMs)
        continue
      }

      harvester.harvestState = 'harvesting'
      harvester.harvestTimer += deltaMs
      if (harvester.harvestTimer >= 450) {
        harvester.harvestTimer = 0
        harvester.cargo += patch.harvest(70)
      }
    }
  }

  private nearest<T extends { x: number; y: number }>(origin: { x: number; y: number }, items: T[]): T | undefined {
    return items.reduce<T | undefined>((best, item) => {
      if (!best) return item
      const current = (item.x - origin.x) ** 2 + (item.y - origin.y) ** 2
      const previous = (best.x - origin.x) ** 2 + (best.y - origin.y) ** 2
      return current < previous ? item : best
    }, undefined)
  }
}
