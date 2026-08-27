import type { Team } from '../../types'
import type { Building } from '../entities/Building'
import type { ResourcePatch } from '../entities/ResourcePatch'
import type { Unit } from '../entities/Unit'

export class HarvestingSystem {
  update(
    deltaMs: number,
    units: Unit[],
    buildings: Building[],
    patches: ResourcePatch[],
    addCredits: (team: Team, amount: number) => void,
    harvestMultiplier: (team: Team) => number = () => 1,
  ): void {
    const workers = units.filter((unit) => unit.alive && (unit.kind === 'harvester' || unit.kind === 'drone'))
    for (const harvester of workers) {
      const refineries = buildings.filter((building) => building.alive && building.team === harvester.team && building.kind === 'refinery')
      if (refineries.length === 0) continue
      const refinery = this.nearest(harvester, refineries)
      const patch = this.nearest(harvester, patches.filter((item) => item.amount > 0))
      if (!refinery || !patch) continue

      if (harvester.cargo >= 700) harvester.harvestState = 'returning'
      if (harvester.harvestState === 'returning') {
        if (harvester.distanceTo(refinery) > 65) {
          harvester.moveDirectlyToward(refinery, deltaMs)
        } else {
          addCredits(harvester.team, harvester.cargo)
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
        harvester.cargo += patch.harvest(Math.round(70 * harvestMultiplier(harvester.team)))
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
