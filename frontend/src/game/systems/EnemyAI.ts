import Phaser from 'phaser'
import type { BuildingKind, Faction, UnitKind } from '../../types'
import { FACTION_DATA, UNIT_STATS } from '../config'
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
      this.nextDecisionAt = time + 1050
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

    if (time > 30000 && enemyBuildings.filter((building) => building.kind === 'turret').length < 2) {
      if (this.tryBuild('turret')) return
    }
    if (time > 45000 && !enemyBuildings.some((building) => building.kind === 'techlab')) {
      if (this.tryBuild('techlab')) return
    }
    if (time > 55000 && !enemyBuildings.some((building) => building.kind === 'airfield')) {
      if (this.tryBuild('airfield')) return
    }
    if (time > 65000 && !enemyBuildings.some((building) => building.kind === 'detector')) {
      if (this.tryBuild('detector')) return
    }
    if (time > 75000 && enemyBuildings.filter((building) => building.kind === 'refinery').length < 2) {
      if (this.tryBuild('refinery')) return
    }

    const combatCount = enemyUnits.filter((unit) => UNIT_STATS[unit.kind].role !== 'worker' && UNIT_STATS[unit.kind].role !== 'support').length
    if (combatCount >= 32) return
    const pattern = this.patternForTime(time)
    const pick = pattern[Math.floor(time / 1100) % pattern.length] ?? pattern[0]
    if (pick) this.queueUnit(pick)
  }

  private patternForTime(time: number): UnitKind[] {
    const data = FACTION_DATA[this.faction]
    if (time < 50000) return data.infantry.slice(0, Math.min(2, data.infantry.length))
    if (time < 100000) return [...data.infantry.slice(0, 3), ...data.factory.filter((kind) => UNIT_STATS[kind].role !== 'worker').slice(0, 2)]
    return [...data.infantry, ...data.factory.filter((kind) => UNIT_STATS[kind].role !== 'worker'), ...data.air]
  }

  private launchAttack(units: Unit[], buildings: Building[]): void {
    const target = buildings.find((building) => building.alive && building.team === 'player' && building.kind === 'conyard')
      ?? buildings.find((building) => building.alive && building.team === 'player')
    if (!target) return

    this.wave += 1
    const available = units
      .filter((unit) => unit.alive && unit.team === 'enemy')
      .filter((unit) => UNIT_STATS[unit.kind].role !== 'worker' && UNIT_STATS[unit.kind].role !== 'support')
      .filter((unit) => !unit.attackTarget)
    const count = Math.min(16, 5 + Math.floor(this.wave / 2), available.length)
    available.slice(0, count).forEach((unit, index) => {
      this.scene.time.delayedCall(index * 110, () => {
        if (unit.alive && target.alive) unit.setAttackTarget(target)
      })
    })
  }
}
