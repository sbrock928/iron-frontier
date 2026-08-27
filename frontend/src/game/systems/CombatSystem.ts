import Phaser from 'phaser'
import type { Team } from '../../types'
import type { Building } from '../entities/Building'
import type { Damageable } from '../entities/Damageable'
import type { Unit } from '../entities/Unit'
import { UNIT_STATS } from '../config'
import { BUILDING_STATS } from '../config'
import { FxPool } from '../core/FxPool'
import { SpatialHash } from '../core/SpatialHash'

type VisibilityCheck = (team: Team, target: Damageable) => boolean

/** Bucket size for the target-acquisition index, in world pixels. */
const ACQUISITION_CELL_SIZE = 128
/** Scoring penalty that biases auto-acquire toward units over structures. */
const STRUCTURE_TARGET_PENALTY = 35
/** Scoring bonus that biases auto-acquire toward air targets at equal range. */
const AIR_TARGET_BONUS = 10

function isFlying(target: Damageable): boolean {
  return 'isFlying' in target && Boolean((target as Unit).isFlying)
}

export class CombatSystem {
  private readonly fx: FxPool
  private readonly unitIndex = new SpatialHash<Unit>(ACQUISITION_CELL_SIZE)
  private readonly buildingIndex = new SpatialHash<Building>(ACQUISITION_CELL_SIZE)

  constructor(private readonly scene: Phaser.Scene) {
    this.fx = new FxPool(scene)
  }

  update(
    time: number,
    delta: number,
    units: Unit[],
    buildings: Building[],
    canEngage: VisibilityCheck = () => true,
  ): void {
    // Rebuilt once per tick and shared by every acquisition query below.
    this.unitIndex.rebuild(units.filter((item) => item.alive))
    this.buildingIndex.rebuild(buildings.filter((item) => item.alive))

    const combatUnits = units.filter((item) => item.alive && UNIT_STATS[item.kind].damage > 0)

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

    for (const structure of buildings) {
      if (!structure.alive) continue
      const weapon = BUILDING_STATS[structure.kind].weapon
      if (!weapon) continue
      if (time - structure.lastShotAt < weapon.cooldown) continue
      const target = this.findStructureTarget(structure, weapon.range, canEngage)
      if (!target) continue
      structure.lastShotAt = time
      this.fire(structure.x, structure.y, target, weapon.damage, structure.team === 'player' ? 0x8cf5ff : 0xbf86ff)
    }
  }

  /** Nearest visible enemy within a structure's weapon range, air or ground. */
  private findStructureTarget(structure: Building, range: number, canEngage: VisibilityCheck): Damageable | null {
    let best: Damageable | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    const consider = (candidate: Damageable) => {
      if (!candidate.alive || candidate.team === structure.team) return
      const distance = Phaser.Math.Distance.Between(structure.x, structure.y, candidate.x, candidate.y)
      if (distance > range || distance >= bestDistance) return
      if (!canEngage(structure.team, candidate)) return
      best = candidate
      bestDistance = distance
    }

    this.unitIndex.forEachNearby(structure.x, structure.y, range, consider)
    this.buildingIndex.forEachNearby(structure.x, structure.y, range, consider)
    return best
  }

  private canUnitEngageTarget(unit: Unit, target: Damageable): boolean {
    const airborne = isFlying(target)
    if (airborne && !unit.canAttackAir) return false
    if (!airborne && !unit.canAttackGround) return false
    return true
  }

  private findProximityTarget(attacker: Unit, _units: Unit[], _buildings: Building[], canEngage: VisibilityCheck): Damageable | null {
    if (attacker.acquireRange <= 0) return null

    let best: Damageable | null = null
    let bestScore = Number.POSITIVE_INFINITY

    const consider = (candidate: Damageable, penalty: number) => {
      if (!candidate.alive || candidate.team === attacker.team) return
      const distance = attacker.distanceTo(candidate)
      if (distance > attacker.acquireRange) return
      const score = distance + penalty
      if (score >= bestScore) return
      if (!this.canUnitEngageTarget(attacker, candidate)) return
      if (!canEngage(attacker.team, candidate)) return
      best = candidate
      bestScore = score
    }

    this.unitIndex.forEachNearby(attacker.x, attacker.y, attacker.acquireRange, (enemy) => {
      consider(enemy, enemy.isFlying ? -AIR_TARGET_BONUS : 0)
    })
    this.buildingIndex.forEachNearby(attacker.x, attacker.y, attacker.acquireRange, (enemy) => {
      consider(enemy, STRUCTURE_TARGET_PENALTY)
    })

    return best
  }

  private fire(x: number, y: number, target: Damageable, damage: number, color: number): void {
    if (!target.alive) return
    const targetY = target.y + (isFlying(target) ? -14 : 0)
    const angle = Phaser.Math.Angle.Between(x, y, target.x, targetY)
    this.scene.sound.play('sfx-fire', { volume: damage >= 30 ? 0.24 : 0.13, rate: damage >= 30 ? 0.82 : 1.15 })

    this.fx.flash(
      'effects',
      'muzzle_flash',
      x + Math.cos(angle) * 14,
      y + Math.sin(angle) * 14,
      (image) => {
        image.setScale(0.38).setRotation(angle).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(9000)
      },
      { alpha: 0, scaleX: 0.6, scaleY: 0.6, duration: 110 },
    )
    this.flashLight(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 90, color, 1.3, 120)

    const projectile = this.fx.lease('effects', 'projectile_bolt', x, y)
    projectile
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
        this.fx.release(projectile)
        this.fx.flash(
          'effects',
          'explosion_impact',
          target.x,
          targetY,
          (image) => {
            image.setScale(0.15).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(8900)
          },
          { scaleX: 0.42, scaleY: 0.42, alpha: 0, duration: 180 },
        )
        this.flashLight(target.x, targetY, 130, color, 1.8, 220)
        if (target.alive) target.takeDamage(damage)
      },
    })
  }

  /**
   * Adds a short-lived point light for muzzle flashes and impacts, fading out
   * and removing itself automatically. Lets combat visibly light up nearby
   * Light2D-shaded units, buildings and terrain instead of only playing a
   * flat unlit sprite flash.
   */
  private flashLight(x: number, y: number, radius: number, color: number, intensity: number, duration: number): void {
    const light = this.scene.lights.addLight(x, y, radius, color, intensity)
    this.scene.tweens.add({
      targets: light,
      intensity: 0,
      duration,
      onComplete: () => this.scene.lights.removeLight(light),
    })
  }
}
