import Phaser from 'phaser'
import type { Unit } from '../entities/Unit'

export class SupportSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  update(time: number, units: Unit[]): void {
    const friendlies = units.filter((item) => item.alive && item.team === 'player')
    for (const medic of friendlies.filter((item) => item.kind === 'medic')) {
      const target = friendlies
        .filter((ally) => ally.id !== medic.id && ally.hp < ally.maxHp)
        .filter((ally) => Phaser.Math.Distance.Between(medic.x, medic.y, ally.x, ally.y) <= 120)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (!target) continue
      if (time - medic.lastHealAt < 550) continue
      medic.lastHealAt = time
      target.heal(10)
      const beam = this.scene.add.line(0, 0, medic.x, medic.y - 4, target.x, target.y - 4, 0x7cf8ff, 0.65).setLineWidth(2, 2).setDepth(9200)
      this.scene.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() })
    }
  }
}
