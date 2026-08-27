import Phaser from 'phaser'
import type { Team } from '../../types'
import type { Building } from '../entities/Building'
import type { Damageable } from '../entities/Damageable'
import type { Unit } from '../entities/Unit'

type VisibilityCheck = (team: Team, target: Damageable) => boolean

function isFlying(target: Damageable): boolean {
  return 'isFlying' in target && Boolean((target as Unit).isFlying)
}

export class CombatSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  update(
    time: number,
    delta: number,
    units: Unit[],
    buildings: Building[],
    canEngage: VisibilityCheck = () => true,
  ): void {
    const combatUnits = units.filter((item) => item.alive && item.kind !== 'harvester' && item.kind !== 'drone' && item.kind !== 'medic')

    for (const unit of combatUnits) {
      unit.expireTransientEffects(time)
      let target = unit.attackTarget

      if (!target || !target.alive || target.team === unit.team || !canEngage(unit.team, target) || !this.canUnitEngageTarget(unit, target)) {
        unit.clearAttackTarget()
        target = null
      }

      if (!target) {
        const acquired = this.findProximityTarget(unit, units, buildings, canEngage)
        if (acquired) {
          unit.setAutoAttackTarget(acquired)
          target = acquired
        }
      }

      if (!target) continue
      const distance = unit.distanceTo(target)

      if (unit.attackTargetMode === 'auto' && distance > unit.acquireRange * 1.25) {
        unit.clearAttackTarget()
        continue
      }

      if (distance > unit.range) {
        if (unit.attackTargetMode === 'manual' || !unit.hasMoveOrder || unit.attackMoveActive) {
          unit.moveDirectlyToward(target, delta)
        }
        continue
      }

      if (time - unit.lastShotAt >= unit.cooldown) {
        unit.lastShotAt = time
        this.fire(unit.x, unit.y + (unit.isFlying ? -14 : 0), target, unit.damage, unit.team === 'player' ? 0x8cf5ff : 0xbf86ff)
      }
    }

    for (const turret of buildings.filter((item) => item.alive && item.kind === 'turret')) {
      const enemies: Damageable[] = [
        ...units.filter((unit) => unit.alive && unit.team !== turret.team),
        ...buildings.filter((building) => building.alive && building.team !== turret.team),
      ]
      const target = enemies
        .filter((enemy) => canEngage(turret.team, enemy))
        .filter((enemy) => Phaser.Math.Distance.Between(turret.x, turret.y, enemy.x, enemy.y) <= 260)
        .sort((a, b) => Phaser.Math.Distance.Between(turret.x, turret.y, a.x, a.y) - Phaser.Math.Distance.Between(turret.x, turret.y, b.x, b.y))[0]
      if (target && time - turret.lastShotAt >= 850) {
        turret.lastShotAt = time
        this.fire(turret.x, turret.y, target, 28, turret.team === 'player' ? 0x8cf5ff : 0xbf86ff)
      }
    }
  }

  private canUnitEngageTarget(unit: Unit, target: Damageable): boolean {
    const airborne = isFlying(target)
    if (airborne && !unit.canAttackAir) return false
    if (!airborne && !unit.canAttackGround) return false
    return true
  }

  private findProximityTarget(attacker: Unit, units: Unit[], buildings: Building[], canEngage: VisibilityCheck): Damageable | null {
    if (attacker.acquireRange <= 0) return null

    const candidates: Array<{ target: Damageable; score: number }> = []

    for (const enemy of units) {
      if (!enemy.alive || enemy.team === attacker.team || !canEngage(attacker.team, enemy) || !this.canUnitEngageTarget(attacker, enemy)) continue
      const distance = attacker.distanceTo(enemy)
      if (distance <= attacker.acquireRange) candidates.push({ target: enemy, score: distance - (enemy.isFlying ? 10 : 0) })
    }

    for (const enemy of buildings) {
      if (!enemy.alive || enemy.team === attacker.team || !canEngage(attacker.team, enemy) || !this.canUnitEngageTarget(attacker, enemy)) continue
      const distance = attacker.distanceTo(enemy)
      if (distance <= attacker.acquireRange) candidates.push({ target: enemy, score: distance + 35 })
    }

    candidates.sort((a, b) => a.score - b.score)
    return candidates[0]?.target ?? null
  }

  private fire(x: number, y: number, target: Damageable, damage: number, color: number): void {
    if (!target.alive) return
    const targetY = target.y + (isFlying(target) ? -14 : 0)
    const angle = Phaser.Math.Angle.Between(x, y, target.x, targetY)
    this.scene.sound.play('sfx-fire', { volume: damage >= 30 ? 0.24 : 0.13, rate: damage >= 30 ? 0.82 : 1.15 })
    const muzzle = this.scene.add.image(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 'fx-muzzle')
      .setScale(0.38)
      .setRotation(angle)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9000)
    this.scene.tweens.add({ targets: muzzle, alpha: 0, scaleX: 0.6, scaleY: 0.6, duration: 110, onComplete: () => muzzle.destroy() })

    const projectile = this.scene.add.image(x, y, 'fx-projectile')
      .setScale(isFlying(target) ? 0.42 : 0.5)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8800)
    const distance = Phaser.Math.Distance.Between(x, y, target.x, targetY)
    const duration = Math.max(80, Math.min(350, distance * 1.25))
    this.scene.tweens.add({
      targets: projectile,
      x: target.x,
      y: targetY,
      duration,
      onComplete: () => {
        projectile.destroy()
        const impact = this.scene.add.image(target.x, targetY, 'fx-explosion')
          .setScale(0.15)
          .setTint(color)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(8900)
        this.scene.tweens.add({ targets: impact, scaleX: 0.42, scaleY: 0.42, alpha: 0, duration: 180, onComplete: () => impact.destroy() })
        if (target.alive) target.takeDamage(damage)
      },
    })
  }
}
