import Phaser from 'phaser'
import type { BuildingKind, Faction, UnitKind } from '../../types'
import { FACTION_DATA } from '../config'
import type { Building } from '../entities/Building'
import type { Unit } from '../entities/Unit'

export class EnemyAI {
  private nextAttackAt: number
  private nextDecisionAt = 0
  private wave = 0
  private readonly intervalMs: number

  constructor(
    private readonly scene: Phaser.Scene,
    intervalSeconds: number,
    private readonly faction: Faction,
    private readonly queueUnit: (kind: UnitKind) => boolean,
    private readonly tryBuild: (kind: BuildingKind) => boolean,
  ) {
    this.nextAttackAt = intervalSeconds * 1000
    this.intervalMs = intervalSeconds * 1000
  }

  update(time: number, units: Unit[], buildings: Building[]): void {
    if (time >= this.nextDecisionAt) {
      this.nextDecisionAt = time + 1200
      this.manageEconomy(time, units, buildings)
    }
    if (time < this.nextAttackAt) return
    this.nextAttackAt = time + this.intervalMs
    this.launchAttack(units, buildings)
  }

  private manageEconomy(time: number, units: Unit[], buildings: Building[]): void {
    const enemyUnits = units.filter((unit) => unit.alive && unit.team === 'enemy')
    const enemyBuildings = buildings.filter((building) => building.alive && building.team === 'enemy')
    const workerKind = FACTION_DATA[this.faction].worker
    const workerCount = enemyUnits.filter((unit) => unit.kind === workerKind).length

    for (const required of ['power', 'refinery', 'barracks', 'warfactory'] as BuildingKind[]) {
      if (!enemyBuildings.some((building) => building.kind === required)) {
        this.tryBuild(required)
        return
      }
    }

    if (workerCount < 2) {
      this.queueUnit(workerKind)
      return
    }

    if (time > 35000 && enemyBuildings.filter((building) => building.kind === 'turret').length < 2) {
      if (this.tryBuild('turret')) return
    }
    if (time > 70000 && enemyBuildings.filter((building) => building.kind === 'refinery').length < 2) {
      if (this.tryBuild('refinery')) return
    }

    const combatCount = enemyUnits.filter((unit) => unit.kind !== 'harvester' && unit.kind !== 'drone' && unit.kind !== 'medic').length
    if (combatCount >= 26) return
    const pattern: UnitKind[] = this.faction === 'noctis'
      ? time < 60000
        ? ['skitter', 'spitter', 'skitter']
        : time < 120000
          ? ['skitter', 'spitter', 'brute', 'skitter']
          : ['skitter', 'spitter', 'brute', 'wraith']
      : time < 60000
        ? ['rifleman', 'marauder', 'rifleman']
        : time < 120000
          ? ['rifleman', 'marauder', 'tank', 'rifleman']
          : ['rifleman', 'marauder', 'tank', 'artillery', 'gunship']
    const pick = pattern[Math.floor(time / 1200) % pattern.length] ?? pattern[0] ?? 'rifleman'
    this.queueUnit(pick)
  }

  private launchAttack(units: Unit[], buildings: Building[]): void {
    const target = buildings.find((building) => building.alive && building.team === 'player' && building.kind === 'conyard')
      ?? buildings.find((building) => building.alive && building.team === 'player')
    if (!target) return

    this.wave += 1
    const available = units
      .filter((unit) => unit.alive && unit.team === 'enemy')
      .filter((unit) => unit.kind !== 'harvester' && unit.kind !== 'drone' && unit.kind !== 'medic')
      .filter((unit) => !unit.attackTarget)
    const count = Math.min(12, 4 + Math.floor(this.wave / 2), available.length)
    available.slice(0, count).forEach((unit, index) => {
      this.scene.time.delayedCall(index * 120, () => {
        if (unit.alive && target.alive) unit.setAttackTarget(target)
      })
    })
  }
}
