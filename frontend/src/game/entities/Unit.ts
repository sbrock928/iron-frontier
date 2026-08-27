import Phaser from 'phaser'
import type { SelectedEntity, Team, UnitKind } from '../../types'
import { TEAM_TINT, UNIT_STATS, hasTurret, unitAtlasFrame, unitTurretAtlasFrame } from '../config'
import type { Damageable } from './Damageable'

type HarvestState = 'seeking' | 'harvesting' | 'returning'

/** Turret rotation lerp factor applied per frame when tracking a target. */
const TURRET_TURN_RATE = 8

/**
 * Extra downward offset applied to a flying unit's contact shadow, in world
 * pixels, so the gap between the aircraft and its shadow reads as altitude.
 * Ground units sit directly on their shadow (the drop offset is already baked
 * into the shadow texture) and so use no additional offset.
 */
const SHADOW_FLYER_DROP = 26

function footprintFor(kind: UnitKind): number {
  const stats = UNIT_STATS[kind]
  if (stats.role === 'air' || stats.role === 'worker') return 52
  if (stats.role === 'vehicle') return kind === 'colossus' ? 62 : 48
  if (kind === 'spitter' || kind === 'broodcaster') return 40
  if (kind === 'marauder' || kind === 'adept') return 34
  return 27
}

function wreckScaleFor(kind: UnitKind): number {
  const role = UNIT_STATS[kind].role
  return role === 'infantry' || role === 'support' ? 58 : 104
}

export class Unit implements Damageable {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
  readonly maxHp: number
  readonly maxShield: number
  hp: number
  shield: number
  alive = true
  x: number
  y: number
  readonly body: Phaser.GameObjects.Sprite
  private readonly turret: Phaser.GameObjects.Sprite | null
  private readonly shadow: Phaser.GameObjects.Image
  private readonly glow: Phaser.GameObjects.Image
  private readonly selection: Phaser.GameObjects.Ellipse
  private readonly healthBack: Phaser.GameObjects.Rectangle
  private readonly healthFront: Phaser.GameObjects.Rectangle
  private readonly shieldBack: Phaser.GameObjects.Rectangle
  private readonly shieldFront: Phaser.GameObjects.Rectangle
  private readonly spriteWidth: number
  private readonly spriteHeight: number
  /** Uniform scale factor `setDisplaySize` computed for this unit's atlas frame. All later scale tweens (spawn/idle/walk/recoil) must multiply against this instead of using absolute scale values: the art pipeline rasterises each frame at the unit's configured `spriteSize` times a 2x supersample for zoom/HiDPI headroom, so `baseScale` sits near 0.5 rather than 1, and an absolute target would snap the sprite to twice its intended size. */
  private baseScale = 1
  private path: Phaser.Math.Vector2[] = []
  attackTarget: Damageable | null = null
  attackTargetMode: 'manual' | 'auto' | null = null
  lastShotAt = 0
  cargo = 0
  harvestState: HarvestState = 'seeking'
  harvestTimer = 0
  stimUntil = 0
  abilityReadyAt = 0
  siegeMode = false
  afterburnerUntil = 0
  frenzyUntil = 0
  acidBurstUntil = 0
  phaseUntil = 0
  resonanceUntil = 0
  overchargeUntil = 0
  lastHealAt = 0
  attackMoveActive = false
  attackMoveGoal: Phaser.Math.Vector2 | null = null
  private speedModifier = 1
  private damageModifier = 1
  private cooldownModifier = 1
  private visionBonus = 0
  private rangeBonus = 0
  private damageReduction = 0
  private shieldRegenModifier = 1
  private lastDamagedAt = -100000
  private isMovingState = false
  private loopTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, id: string, kind: UnitKind, team: Team, x: number, y: number) {
    this.id = id
    this.kind = kind
    this.team = team
    this.x = x
    this.y = y
    const stats = UNIT_STATS[kind]
    this.maxHp = stats.hp
    this.hp = stats.hp
    this.maxShield = stats.shield ?? 0
    this.shield = this.maxShield
    this.spriteWidth = stats.spriteSize.width
    this.spriteHeight = stats.spriteSize.height

    const footprint = footprintFor(kind)
    // Silhouette-matched contact shadow baked by the art pipeline onto a canvas
    // the same size as the colour frame, so it registers by sharing the body's
    // position and display size. Flyers cast theirs further down and fainter to
    // read as altitude. It is never lit — it is an occlusion layer, not a surface.
    this.shadow = scene.add.image(x, y + (stats.isFlying ? SHADOW_FLYER_DROP : 0), 'units-shadow', `${unitAtlasFrame(kind)}_shadow`)
      .setDisplaySize(this.spriteWidth, this.spriteHeight)
      .setAlpha(stats.isFlying ? 0.5 : 1)
    this.glow = scene.add.image(x, y, 'units', unitAtlasFrame(kind)).setDisplaySize(this.spriteWidth, this.spriteHeight).setAlpha(this.maxShield > 0 ? 0.23 : 0.16)
    this.body = scene.add.sprite(x, y, 'units', unitAtlasFrame(kind)).setDisplaySize(this.spriteWidth, this.spriteHeight).setLighting(true)
    this.turret = hasTurret(kind)
      ? scene.add.sprite(x, y, 'units', unitTurretAtlasFrame(kind)).setDisplaySize(this.spriteWidth, this.spriteHeight).setLighting(true)
      : null
    this.glow.setTint(this.maxShield > 0 ? 0xb78cff : team === 'player' ? 0x5deee0 : 0xae71ff)
    this.body.setTint(team === 'player' ? TEAM_TINT.player : TEAM_TINT.enemy)
    this.turret?.setTint(team === 'player' ? TEAM_TINT.player : TEAM_TINT.enemy)
    this.selection = scene.add.ellipse(x, y + 12, footprint + 34, footprint + 18).setStrokeStyle(2, this.maxShield > 0 ? 0xc79aff : team === 'player' ? 0x9effc4 : 0xe295ff).setVisible(false)
    this.healthBack = scene.add.rectangle(x, y - this.spriteHeight * 0.54, 42, 5, 0x0b0e0b).setOrigin(0.5)
    this.healthFront = scene.add.rectangle(x - 21, y - this.spriteHeight * 0.54, 42, 5, team === 'player' ? 0x78e985 : 0xd987ff).setOrigin(0, 0.5)
    this.shieldBack = scene.add.rectangle(x, y - this.spriteHeight * 0.54 - 6, 42, 4, 0x10101b).setOrigin(0.5).setVisible(this.maxShield > 0)
    this.shieldFront = scene.add.rectangle(x - 21, y - this.spriteHeight * 0.54 - 6, 42, 4, 0xa67cff).setOrigin(0, 0.5).setVisible(this.maxShield > 0)
    this.baseScale = this.body.scaleX
    this.playSpawnTween(scene)
    this.syncGraphics()
    scene.time.delayedCall(230, () => { if (this.alive) this.setMoving(false) })
  }

  get baseStats() { return UNIT_STATS[this.kind] }
  get isFlying(): boolean { return Boolean(this.baseStats.isFlying) }
  get canAttackAir(): boolean { return Boolean(this.baseStats.canAttackAir) }
  get canAttackGround(): boolean { return Boolean(this.baseStats.canAttackGround) }
  get speed(): number {
    let value = this.baseStats.speed
    if (this.siegeMode) value = 0
    if (this.afterburnerUntil > 0) value *= 1.55
    if (this.phaseUntil > 0) value *= 1.48
    if (this.stimUntil > 0) value *= 1.28
    if (this.frenzyUntil > 0) value *= 1.32
    if (this.resonanceUntil > 0) value *= 1.22
    return value * this.speedModifier
  }
  get range(): number {
    let value = this.baseStats.range
    if (this.siegeMode) value += 120
    if (this.acidBurstUntil > 0) value += 70
    if (this.overchargeUntil > 0) value += 30
    return value + this.rangeBonus
  }
  get acquireRange(): number {
    let value = this.baseStats.acquireRange
    if (this.siegeMode) value += 120
    if (this.acidBurstUntil > 0) value += 70
    if (this.overchargeUntil > 0) value += 30
    return value + this.rangeBonus
  }
  get vision(): number { return this.baseStats.vision + (this.isFlying ? 70 : 0) + this.visionBonus }
  get damage(): number {
    let value = this.baseStats.damage
    if (this.siegeMode) value += 18
    if (this.stimUntil > 0) value *= 1.20
    if (this.frenzyUntil > 0) value *= 1.24
    if (this.acidBurstUntil > 0) value *= 1.32
    if (this.overchargeUntil > 0) value *= 1.28
    return Math.round(value * this.damageModifier)
  }
  get cooldown(): number {
    let value = this.baseStats.cooldown
    if (this.stimUntil > 0) value *= 0.78
    if (this.frenzyUntil > 0) value *= 0.76
    if (this.acidBurstUntil > 0) value *= 0.86
    if (this.overchargeUntil > 0) value *= 0.82
    return Math.max(220, Math.round(value * this.cooldownModifier))
  }
  get hasMoveOrder(): boolean { return this.path.length > 0 }

  setSelected(selected: boolean): void { this.selection.setVisible(selected) }

  setFogVisible(visible: boolean): void {
    this.shadow.setVisible(visible)
    this.glow.setVisible(visible)
    this.body.setVisible(visible)
    this.turret?.setVisible(visible)
    this.healthBack.setVisible(visible)
    this.healthFront.setVisible(visible)
    this.shieldBack.setVisible(visible && this.maxShield > 0)
    this.shieldFront.setVisible(visible && this.maxShield > 0)
    if (!visible) this.selection.setVisible(false)
  }

  toSelectedEntity(): SelectedEntity {
    return {
      id: this.id,
      label: UNIT_STATS[this.kind].label,
      kind: this.kind,
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      shield: this.maxShield > 0 ? Math.max(0, Math.round(this.shield)) : undefined,
      maxShield: this.maxShield > 0 ? this.maxShield : undefined,
      team: this.team,
    }
  }

  setPath(points: Phaser.Math.Vector2[]): void {
    this.path = points
    this.attackMoveActive = false
    this.attackMoveGoal = null
    this.clearAttackTarget()
  }

  setAttackMovePath(points: Phaser.Math.Vector2[], goal: Phaser.Math.Vector2): void {
    this.path = points
    this.attackMoveActive = true
    this.attackMoveGoal = goal.clone()
    this.clearAttackTarget()
  }

  resumeAttackMove(points: Phaser.Math.Vector2[]): void { if (this.attackMoveActive) this.path = points }
  clearAttackMove(): void { this.attackMoveActive = false; this.attackMoveGoal = null }

  setAttackTarget(target: Damageable): void {
    this.path = []
    this.attackMoveActive = false
    this.attackMoveGoal = null
    this.attackTarget = target
    this.attackTargetMode = 'manual'
  }

  setAutoAttackTarget(target: Damageable): void { this.attackTarget = target; this.attackTargetMode = 'auto' }
  clearAttackTarget(): void { this.attackTarget = null; this.attackTargetMode = null }

  stop(): void {
    this.path = []
    this.attackMoveActive = false
    this.attackMoveGoal = null
    this.clearAttackTarget()
    this.setMoving(false)
  }

  nudge(dx: number, dy: number): void { if (this.alive && !this.isFlying) { this.x += dx; this.y += dy; this.syncGraphics() } }

  applyUpgradeModifiers(modifiers: { speed?: number; damage?: number; cooldown?: number; visionBonus?: number; rangeBonus?: number; damageReduction?: number; shieldRegen?: number }): void {
    this.speedModifier = modifiers.speed ?? 1
    this.damageModifier = modifiers.damage ?? 1
    this.cooldownModifier = modifiers.cooldown ?? 1
    this.visionBonus = modifiers.visionBonus ?? 0
    this.rangeBonus = modifiers.rangeBonus ?? 0
    this.damageReduction = modifiers.damageReduction ?? 0
    this.shieldRegenModifier = modifiers.shieldRegen ?? 1
  }

  distanceTo(target: { x: number; y: number }): number { return Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) }

  updateMovement(deltaMs: number): void {
    if (!this.alive) return
    const now = this.body.scene.time.now
    this.expireTransientEffects(now)
    this.regenerateShield(deltaMs, now)
    if (this.turret) this.updateTurretRotation(deltaMs)
    if (this.path.length === 0 || this.speed <= 0) { this.setMoving(false); return }
    const next = this.path[0]
    if (!next) { this.setMoving(false); return }
    const distance = this.distanceTo(next)
    if (distance < 7) { this.path.shift(); if (this.path.length === 0) this.setMoving(false); return }
    this.setMoving(true)
    const step = (this.speed * deltaMs) / 1000
    const ratio = Math.min(1, step / Math.max(distance, 0.001))
    const angle = Phaser.Math.Angle.Between(this.x, this.y, next.x, next.y)
    this.x += (next.x - this.x) * ratio
    this.y += (next.y - this.y) * ratio
    this.body.rotation = angle
    this.glow.rotation = angle
    this.syncGraphics()
  }

  moveDirectlyToward(target: { x: number; y: number }, deltaMs: number): void {
    if (this.speed <= 0) return
    const distance = this.distanceTo(target)
    if (distance < 1) { this.setMoving(false); return }
    this.setMoving(true)
    const step = Math.min(distance, (this.speed * deltaMs) / 1000)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y)
    this.body.rotation = angle
    this.glow.rotation = angle
    this.x += ((target.x - this.x) / distance) * step
    this.y += ((target.y - this.y) / distance) * step
    this.syncGraphics()
  }

  /** Rotates the turret layer toward the current attack target, or eases it back to the hull's facing when idle. */
  private updateTurretRotation(deltaMs: number): void {
    if (!this.turret) return
    const target = this.attackTarget && this.attackTarget.alive !== false ? this.attackTarget : null
    const desired = target && 'x' in target && 'y' in target
      ? Phaser.Math.Angle.Between(this.x, this.y, (target as { x: number }).x, (target as { y: number }).y)
      : this.body.rotation
    const t = Math.min(1, (TURRET_TURN_RATE * deltaMs) / 1000)
    this.turret.rotation = Phaser.Math.Angle.RotateTo(this.turret.rotation, desired, t)
  }

  heal(amount: number): void {
    if (!this.alive) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
    this.refreshBars()
    this.glow.setAlpha(0.22)
    this.body.scene.tweens.add({ targets: this.glow, alpha: this.maxShield > 0 ? 0.23 : 0.16, duration: 120 })
  }

  rechargeShield(amount: number): void {
    if (!this.alive || this.maxShield <= 0) return
    this.shield = Math.min(this.maxShield, this.shield + amount)
    this.refreshBars()
  }

  activateStim(now: number): boolean {
    if ((this.kind !== 'rifleman' && this.kind !== 'marauder') || this.hp <= 16 || now < this.abilityReadyAt) return false
    this.hp = Math.max(1, this.hp - 10); this.stimUntil = now + 8000; this.abilityReadyAt = now + 16000; this.refreshBars(); return true
  }
  toggleSiege(now: number): boolean { if (this.kind !== 'artillery' || now < this.abilityReadyAt) return false; this.siegeMode = !this.siegeMode; this.abilityReadyAt = now + 700; return true }
  activateAfterburners(now: number): boolean { if (this.kind !== 'gunship' && this.kind !== 'interceptor' || now < this.abilityReadyAt) return false; this.afterburnerUntil = now + 6000; this.abilityReadyAt = now + 15000; return true }
  activateFrenzy(now: number): boolean { if (!['skitter','brute','ravager'].includes(this.kind) || now < this.abilityReadyAt) return false; this.frenzyUntil = now + 7500; this.abilityReadyAt = now + 15000; return true }
  activateAcidBurst(now: number): boolean { if (this.kind !== 'spitter' && this.kind !== 'broodcaster' || now < this.abilityReadyAt) return false; this.acidBurstUntil = now + 6500; this.abilityReadyAt = now + 15000; return true }
  activatePhase(now: number): boolean { if (this.kind !== 'wraith' && this.kind !== 'devourer' || now < this.abilityReadyAt) return false; this.phaseUntil = now + 6000; this.abilityReadyAt = now + 14500; this.body.setAlpha(0.58); this.glow.setAlpha(0.28); this.turret?.setAlpha(0.58); return true }
  activateShieldSurge(now: number): boolean { if (this.maxShield <= 0 || now < this.abilityReadyAt) return false; this.rechargeShield(Math.max(30, this.maxShield * 0.32)); this.abilityReadyAt = now + 12000; return true }
  activatePhaseStride(now: number): boolean { if (!['lancer','adept','seer'].includes(this.kind) || now < this.abilityReadyAt) return false; this.resonanceUntil = now + 7000; this.abilityReadyAt = now + 14500; return true }
  activateOvercharge(now: number): boolean { if (!['sentinel','colossus','seraph','arbiter'].includes(this.kind) || now < this.abilityReadyAt) return false; this.overchargeUntil = now + 6500; this.abilityReadyAt = now + 15000; return true }

  expireTransientEffects(now: number): void {
    if (this.stimUntil && now > this.stimUntil) this.stimUntil = 0
    if (this.afterburnerUntil && now > this.afterburnerUntil) this.afterburnerUntil = 0
    if (this.frenzyUntil && now > this.frenzyUntil) this.frenzyUntil = 0
    if (this.acidBurstUntil && now > this.acidBurstUntil) this.acidBurstUntil = 0
    if (this.resonanceUntil && now > this.resonanceUntil) this.resonanceUntil = 0
    if (this.overchargeUntil && now > this.overchargeUntil) this.overchargeUntil = 0
    if (this.phaseUntil && now > this.phaseUntil) { this.phaseUntil = 0; this.body.setAlpha(1); this.turret?.setAlpha(1); this.glow.setAlpha(this.maxShield > 0 ? 0.23 : 0.16) }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return
    let incoming = amount * (1 - this.damageReduction)
    this.lastDamagedAt = this.body.scene.time.now
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, incoming)
      this.shield -= absorbed
      incoming -= absorbed
    }
    if (incoming > 0) this.hp -= incoming
    if (this.hp <= 0) { this.alive = false; this.destroy(); return }
    this.refreshBars()
    this.glow.setAlpha(0.34)
    const flashTargets = this.turret ? [this.body, this.turret] : [this.body]
    this.body.scene.tweens.add({ targets: flashTargets, alpha: 0.58, duration: 80, yoyo: true, onComplete: () => flashTargets.forEach((t) => t.setAlpha(1)) })
    this.body.scene.tweens.add({ targets: this.glow, alpha: this.maxShield > 0 ? 0.23 : 0.16, duration: 100 })
  }

  private regenerateShield(deltaMs: number, now: number): void {
    if (this.maxShield <= 0 || this.shield >= this.maxShield || now - this.lastDamagedAt < 3500) return
    const rate = (this.baseStats.shieldRegen ?? 0) * this.shieldRegenModifier
    if (rate <= 0) return
    this.shield = Math.min(this.maxShield, this.shield + rate * (deltaMs / 1000))
    this.refreshBars()
  }

  private refreshBars(): void {
    this.healthFront.displayWidth = 42 * Math.max(0, this.hp / this.maxHp)
    if (this.maxShield > 0) this.shieldFront.displayWidth = 42 * Math.max(0, this.shield / this.maxShield)
  }

  private setMoving(moving: boolean): void {
    // No sprite-sheet walk cycles exist for the realistic atlas art, so
    // movement/idle "life" is conveyed procedurally via a looping squash
    // tween on the hull sprite (turret/glow are reserved for attack recoil
    // and shield-hit flashes respectively, so no tween properties overlap).
    // All scale targets are multiples of `baseScale` (never absolute values)
    // since the underlying atlas frame is a much larger untrimmed canvas.
    if (this.isMovingState === moving) return
    this.isMovingState = moving
    this.loopTween?.stop()
    this.body.setScale(this.baseScale)
    const scene = this.body.scene
    this.loopTween = moving
      ? scene.tweens.add({ targets: this.body, scaleX: this.baseScale * 0.93, scaleY: this.baseScale * 1.07, duration: Math.max(90, 220 - this.speed * 0.35), yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      : scene.tweens.add({ targets: this.body, scaleY: this.baseScale * 1.025, duration: 1500 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Math.random() * 400 })
  }

  /** Brief procedural "muzzle kick" played whenever this unit fires. Targets the turret when present so it never fights the idle/walk loop tween running on the hull. */
  playAttackRecoil(): void {
    const scene = this.body.scene
    if (this.turret) {
      scene.tweens.add({ targets: this.turret, scaleX: this.baseScale * 0.86, scaleY: this.baseScale * 0.86, duration: 70, yoyo: true, ease: 'Quad.Out' })
    } else {
      const restingAlpha = this.maxShield > 0 ? 0.23 : 0.16
      scene.tweens.add({ targets: this.glow, scaleX: this.baseScale * 1.2, scaleY: this.baseScale * 1.2, alpha: Math.min(1, restingAlpha + 0.35), duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => this.glow.setAlpha(restingAlpha) })
    }
  }

  private syncGraphics(): void {
    const lift = this.isFlying ? -18 : 0
    const baseDepth = 200 + this.y * 0.1 + (this.isFlying ? 120 : 0)
    this.shadow.setPosition(this.x, this.y + (this.isFlying ? SHADOW_FLYER_DROP : 0)).setDepth(baseDepth - 3)
    this.glow.setPosition(this.x, this.y + lift).setDepth(baseDepth - 1)
    this.body.setPosition(this.x, this.y + lift).setDepth(baseDepth)
    this.turret?.setPosition(this.x, this.y + lift).setDepth(baseDepth + 1)
    this.selection.setPosition(this.x, this.y + 12).setDepth(baseDepth - 4)
    this.shieldBack.setPosition(this.x, this.y - this.spriteHeight * 0.54 - 6 + lift).setDepth(baseDepth + 2)
    this.shieldFront.setPosition(this.x - 21, this.y - this.spriteHeight * 0.54 - 6 + lift).setDepth(baseDepth + 3)
    this.healthBack.setPosition(this.x, this.y - this.spriteHeight * 0.54 + lift).setDepth(baseDepth + 2)
    this.healthFront.setPosition(this.x - 21, this.y - this.spriteHeight * 0.54 + lift).setDepth(baseDepth + 3)
  }

  private playSpawnTween(scene: Phaser.Scene): void {
    this.body.setScale(this.baseScale * 0.72); this.glow.setScale(this.baseScale * 0.84); this.turret?.setScale(this.baseScale * 0.72)
    const bodyTargets = this.turret ? [this.body, this.turret] : [this.body]
    scene.tweens.add({ targets: bodyTargets, scaleX: this.baseScale, scaleY: this.baseScale, duration: 220, ease: 'Back.Out' })
    scene.tweens.add({ targets: [this.glow], scaleX: this.baseScale, scaleY: this.baseScale, duration: 260, ease: 'Sine.Out' })
  }

  destroy(): void {
    this.loopTween?.stop()
    const scene = this.body.scene
    scene.sound.play('sfx-explosion', { volume: this.baseStats.role === 'infantry' || this.baseStats.role === 'support' ? 0.18 : 0.32 })
    const explosion = scene.add.image(this.x, this.y, 'effects', 'explosion_large').setScale(0.1).setDepth(10000)
    scene.tweens.add({ targets: explosion, scaleX: this.baseStats.role === 'infantry' || this.baseStats.role === 'support' ? 0.4 : 0.7, scaleY: this.baseStats.role === 'infantry' || this.baseStats.role === 'support' ? 0.4 : 0.7, alpha: 0, duration: 280, onComplete: () => explosion.destroy() })
    if (scene.lights) {
      const light = scene.lights.addLight(this.x, this.y, 150, 0xffb27a, 2)
      scene.tweens.add({ targets: light, intensity: 0, duration: 320, onComplete: () => scene.lights.removeLight(light) })
    }
    const wreckKey = this.baseStats.role === 'infantry' || this.baseStats.role === 'support' ? 'wreck-infantry' : 'wreck-vehicle'
    const wreckSize = wreckScaleFor(this.kind)
    const wreck = scene.add.image(this.x, this.y + 8, wreckKey).setDisplaySize(wreckSize, wreckSize).setTint(this.maxShield > 0 ? 0xb59cd8 : this.team === 'player' ? 0x9fa8ab : 0x9b72bf).setAlpha(0.78).setDepth(90 + this.y * 0.1)
    scene.time.delayedCall(42000, () => { if (!wreck.active) return; scene.tweens.add({ targets: wreck, alpha: 0, duration: 4500, onComplete: () => wreck.destroy() }) })
    this.shadow.destroy(); this.glow.destroy(); this.body.destroy(); this.turret?.destroy(); this.selection.destroy(); this.healthBack.destroy(); this.healthFront.destroy(); this.shieldBack.destroy(); this.shieldFront.destroy()
  }
}
