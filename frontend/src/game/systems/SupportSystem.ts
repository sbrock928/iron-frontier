import Phaser from 'phaser'
import type { Team, UnitKind } from '../../types'
import type { Unit } from '../entities/Unit'

export class SupportSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  update(time: number, units: Unit[], multiplier: (team: Team, kind: UnitKind) => number = () => 1): void {
    for (const medic of units.filter((item) => item.alive && item.kind === 'medic')) {
      const allies = units.filter((item) => item.alive && item.team === medic.team)
      const target = allies
        .filter((ally) => ally.id !== medic.id && ally.hp < ally.maxHp)
        .filter((ally) => Phaser.Math.Distance.Between(medic.x, medic.y, ally.x, ally.y) <= 130)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (!target || time - medic.lastHealAt < 550 / multiplier(medic.team, medic.kind)) continue
      medic.lastHealAt = time
      target.heal(10 * multiplier(medic.team, medic.kind))
      this.flashBeam(medic, target, medic.team === 'player' ? 0x7cf8ff : 0xd284ff)
    }

    for (const seer of units.filter((item) => item.alive && item.kind === 'seer')) {
      const allies = units.filter((item) => item.alive && item.team === seer.team && item.maxShield > 0 && item.shield < item.maxShield)
      const target = allies
        .filter((ally) => ally.id !== seer.id && Phaser.Math.Distance.Between(seer.x, seer.y, ally.x, ally.y) <= 155)
        .sort((a, b) => a.shield / Math.max(1, a.maxShield) - b.shield / Math.max(1, b.maxShield))[0]
      if (!target || time - seer.lastHealAt < 480) continue
      seer.lastHealAt = time
      target.rechargeShield(16 * multiplier(seer.team, seer.kind))
      this.flashBeam(seer, target, 0xc28cff)
    }

    for (const caster of units.filter((item) => item.alive && item.kind === 'broodcaster')) {
      const allies = units.filter((item) => item.alive && item.team === caster.team && item.hp < item.maxHp)
      const target = allies
        .filter((ally) => ally.id !== caster.id && Phaser.Math.Distance.Between(caster.x, caster.y, ally.x, ally.y) <= 125)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (!target || time - caster.lastHealAt < 900) continue
      caster.lastHealAt = time
      target.heal(6)
      this.flashBeam(caster, target, 0x8cff9d)
    }
  }

  private flashBeam(from: Unit, to: Unit, color: number): void {
    const beam = this.scene.add.line(0, 0, from.x, from.y - 4, to.x, to.y - 4, color, 0.65).setLineWidth(2, 2).setDepth(9200)
    this.scene.tweens.add({ targets: beam, alpha: 0, duration: 160, onComplete: () => beam.destroy() })
  }
}
