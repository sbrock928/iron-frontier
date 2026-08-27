import Phaser from 'phaser'
import type { Unit } from '../entities/Unit'

export class SupportSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  update(time: number, units: Unit[]): void {
    for (const medic of units.filter((item) => item.alive && item.kind === 'medic')) {
      const allies = units.filter((item) => item.alive && item.team === medic.team)
      const target = allies
        .filter((ally) => ally.id !== medic.id && ally.hp < ally.maxHp)
        .filter((ally) => Phaser.Math.Distance.Between(medic.x, medic.y, ally.x, ally.y) <= 120)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (!target || time - medic.lastHealAt < 550) continue
      medic.lastHealAt = time
      target.heal(10)
      const color = medic.team === 'player' ? 0x7cf8ff : 0xd284ff
      const beam = this.scene.add.line(0, 0, medic.x, medic.y - 4, target.x, target.y - 4, color, 0.65).setLineWidth(2, 2).setDepth(9200)
      this.scene.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() })
    }
  }
}
