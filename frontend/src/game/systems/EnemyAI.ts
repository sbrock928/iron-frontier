import Phaser from 'phaser'
import type { Faction, UnitKind } from '../../types'
import type { Building } from '../entities/Building'
import type { Unit } from '../entities/Unit'

export class EnemyAI {
  private nextWaveAt: number
  private wave = 0
  private readonly intervalMs: number

  constructor(
    private readonly scene: Phaser.Scene,
    intervalSeconds: number,
    private readonly faction: Faction,
    private readonly spawnUnit: (kind: UnitKind, x: number, y: number) => Unit,
  ) {
    this.nextWaveAt = intervalSeconds * 1000
    this.intervalMs = intervalSeconds * 1000
  }

  update(time: number, _units: Unit[], buildings: Building[]): void {
    if (time < this.nextWaveAt) return
    this.nextWaveAt = time + this.intervalMs
    this.wave += 1
    const enemyFactory = buildings.find((building) => building.alive && building.team === 'enemy' && building.kind === 'warfactory')
      ?? buildings.find((building) => building.alive && building.team === 'enemy')
    const target = buildings.find((building) => building.alive && building.team === 'player' && building.kind === 'conyard')
      ?? buildings.find((building) => building.alive && building.team === 'player')
    if (!enemyFactory || !target) return

    const count = Math.min(14, 3 + Math.floor(this.wave / 2))
    const pattern: UnitKind[] = this.faction === 'noctis'
      ? this.wave < 3
        ? ['skitter', 'skitter', 'spitter']
        : this.wave < 6
          ? ['skitter', 'spitter', 'skitter', 'brute']
          : ['skitter', 'spitter', 'brute', 'wraith', 'skitter', 'spitter']
      : this.wave < 3
        ? ['rifleman', 'rifleman', 'marauder']
        : this.wave < 6
          ? ['rifleman', 'marauder', 'tank', 'rifleman']
          : ['rifleman', 'marauder', 'tank', 'gunship', 'artillery']

    for (let index = 0; index < count; index += 1) {
      this.scene.time.delayedCall(index * 300, () => {
        const kind = pattern[(this.wave + index) % pattern.length] ?? pattern[0] ?? 'rifleman'
        const unit = this.spawnUnit(kind, enemyFactory.x - 90 + index * 14, enemyFactory.y + 110 + (index % 2) * 26)
        unit.setAttackTarget(target)
      })
    }
  }
}
