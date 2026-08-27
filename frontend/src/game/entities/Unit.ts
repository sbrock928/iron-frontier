import Phaser from 'phaser'
import type { SelectedEntity, Team, UnitKind } from '../../types'
import { TEAM_TINT, UNIT_SHEETS, UNIT_STATS, UNIT_TEXTURES } from '../config'
import type { Damageable } from './Damageable'

type HarvestState = 'seeking' | 'harvesting' | 'returning'

function footprintFor(kind: UnitKind): number {
  if (kind === 'tank' || kind === 'brute') return 46
  if (kind === 'artillery' || kind === 'harvester' || kind === 'gunship' || kind === 'wraith' || kind === 'drone') return 52
  if (kind === 'spitter') return 42
  if (kind === 'marauder') return 34
  return 26
}

function wreckScaleFor(kind: UnitKind): number {
  return kind === 'rifleman' || kind === 'medic' || kind === 'skitter' ? 54 : 100
}

export class Unit implements Damageable {
  readonly id: string
  readonly kind: UnitKind
  readonly team: Team
  readonly maxHp: number
  hp: number
  alive = true
  x: number
  y: number
  readonly body: Phaser.GameObjects.Sprite
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly glow: Phaser.GameObjects.Image
  private readonly selection: Phaser.GameObjects.Ellipse
  private readonly healthBack: Phaser.GameObjects.Rectangle
  private readonly healthFront: Phaser.GameObjects.Rectangle
  private readonly spriteWidth: number
  private readonly spriteHeight: number
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
  lastHealAt = 0

  constructor(scene: Phaser.Scene, id: string, kind: UnitKind, team: Team, x: number, y: number) {
    this.id = id
    this.kind = kind
    this.team = team
    this.x = x
    this.y = y
    const stats = UNIT_STATS[kind]
    this.maxHp = stats.hp
    this.hp = stats.hp
    this.spriteWidth = stats.spriteSize.width
    this.spriteHeight = stats.spriteSize.height

    const footprint = footprintFor(kind)
    this.shadow = scene.add.ellipse(x, y + (stats.isFlying ? 26 : 14), footprint + 24, footprint * 0.82, 0x020403, stats.isFlying ? 0.22 : 0.42)
    this.glow = scene.add.image(x, y, UNIT_TEXTURES[kind]).setDisplaySize(this.spriteWidth, this.spriteHeight).setAlpha(0.16)
    this.body = scene.add.sprite(x, y, UNIT_SHEETS[kind], 0).setDisplaySize(this.spriteWidth, this.spriteHeight)
    this.glow.setTint(team === 'player' ? 0x5deee0 : 0xae71ff)
    this.body.setTint(team === 'player' ? TEAM_TINT.player : TEAM_TINT.enemy)
    this.selection = scene.add.ellipse(x, y + 12, footprint + 34, footprint + 18).setStrokeStyle(2, team === 'player' ? 0x9effc4 : 0xe295ff).setVisible(false)
    this.healthBack = scene.add.rectangle(x, y - this.spriteHeight * 0.54, 42, 5, 0x0b0e0b).setOrigin(0.5)
    this.healthFront = scene.add.rectangle(x - 21, y - this.spriteHeight * 0.54, 42, 5, team === 'player' ? 0x78e985 : 0xd987ff).setOrigin(0, 0.5)
    this.playSpawnTween(scene)
    this.syncGraphics()
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
    return value
  }
  get range(): number {
    let value = this.baseStats.range
    if (this.siegeMode) value += 120
    if (this.acidBurstUntil > 0) value += 70
    return value
  }
  get acquireRange(): number {
    let value = this.baseStats.acquireRange
    if (this.siegeMode) value += 120
    if (this.acidBurstUntil > 0) value += 70
    return value
  }
  get vision(): number { return this.baseStats.vision + (this.isFlying ? 70 : 0) }
  get damage(): number {
    let value = this.baseStats.damage
    if (this.siegeMode) value += 18
    if (this.stimUntil > 0) value *= 1.20
    if (this.frenzyUntil > 0) value *= 1.24
    if (this.acidBurstUntil > 0) value *= 1.32
    return Math.round(value)
  }
  get cooldown(): number {
    let value = this.baseStats.cooldown
    if (this.stimUntil > 0) value *= 0.78
    if (this.frenzyUntil > 0) value *= 0.76
    if (this.acidBurstUntil > 0) value *= 0.86
    return Math.max(220, Math.round(value))
  }
  get hasMoveOrder(): boolean { return this.path.length > 0 }

  setSelected(selected: boolean): void { this.selection.setVisible(selected) }

  setFogVisible(visible: boolean): void {
    this.shadow.setVisible(visible)
    this.glow.setVisible(visible)
    this.body.setVisible(visible)
    this.healthBack.setVisible(visible)
    this.healthFront.setVisible(visible)
    if (!visible) this.selection.setVisible(false)
  }

  toSelectedEntity(): SelectedEntity {
    return { id: this.id, label: UNIT_STATS[this.kind].label, kind: this.kind, hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp, team: this.team }
  }

  setPath(points: Phaser.Math.Vector2[]): void {
    this.path = points
    this.clearAttackTarget()
  }

  setAttackTarget(target: Damageable): void {
    this.path = []
    this.attackTarget = target
    this.attackTargetMode = 'manual'
  }

  setAutoAttackTarget(target: Damageable): void {
    this.attackTarget = target
    this.attackTargetMode = 'auto'
  }

  clearAttackTarget(): void {
    this.attackTarget = null
    this.attackTargetMode = null
  }

  stop(): void {
    this.path = []
    this.clearAttackTarget()
    this.setMoving(false)
  }

  distanceTo(target: { x: number; y: number }): number {
    return Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y)
  }

  updateMovement(deltaMs: number): void {
    if (!this.alive) return
    this.expireTransientEffects(this.body.scene.time.now)
    if (this.path.length === 0 || this.speed <= 0) {
      this.setMoving(false)
      return
    }
    const next = this.path[0]
    if (!next) {
      this.setMoving(false)
      return
    }
    const distance = this.distanceTo(next)
    if (distance < 7) {
      this.path.shift()
      if (this.path.length === 0) this.setMoving(false)
      return
    }
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
    if (distance < 1) {
      this.setMoving(false)
      return
    }
    this.setMoving(true)
    const step = Math.min(distance, (this.speed * deltaMs) / 1000)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y)
    this.body.rotation = angle
    this.glow.rotation = angle
    this.x += ((target.x - this.x) / distance) * step
    this.y += ((target.y - this.y) / distance) * step
    this.syncGraphics()
  }

  heal(amount: number): void {
    if (!this.alive) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
    this.healthFront.displayWidth = 42 * Math.max(0, this.hp / this.maxHp)
    this.glow.setAlpha(0.22)
    this.body.scene.tweens.add({ targets: this.glow, alpha: 0.16, duration: 120 })
  }

  activateStim(now: number): boolean {
    if ((this.kind !== 'rifleman' && this.kind !== 'marauder') || this.hp <= 16 || now < this.abilityReadyAt) return false
    this.hp = Math.max(1, this.hp - 10)
    this.stimUntil = now + 8000
    this.abilityReadyAt = now + 16000
    this.healthFront.displayWidth = 42 * Math.max(0, this.hp / this.maxHp)
    return true
  }

  toggleSiege(now: number): boolean {
    if (this.kind !== 'artillery' || now < this.abilityReadyAt) return false
    this.siegeMode = !this.siegeMode
    this.abilityReadyAt = now + 700
    return true
  }

  activateAfterburners(now: number): boolean {
    if (this.kind !== 'gunship' || now < this.abilityReadyAt) return false
    this.afterburnerUntil = now + 6000
    this.abilityReadyAt = now + 15000
    return true
  }


  activateFrenzy(now: number): boolean {
    if ((this.kind !== 'skitter' && this.kind !== 'brute') || now < this.abilityReadyAt) return false
    this.frenzyUntil = now + 7500
    this.abilityReadyAt = now + 15000
    return true
  }

  activateAcidBurst(now: number): boolean {
    if (this.kind !== 'spitter' || now < this.abilityReadyAt) return false
    this.acidBurstUntil = now + 6500
    this.abilityReadyAt = now + 15000
    return true
  }

  activatePhase(now: number): boolean {
    if (this.kind !== 'wraith' || now < this.abilityReadyAt) return false
    this.phaseUntil = now + 6000
    this.abilityReadyAt = now + 14500
    this.body.setAlpha(0.58)
    this.glow.setAlpha(0.28)
    return true
  }

  expireTransientEffects(now: number): void {
    if (this.stimUntil && now > this.stimUntil) this.stimUntil = 0
    if (this.afterburnerUntil && now > this.afterburnerUntil) this.afterburnerUntil = 0
    if (this.frenzyUntil && now > this.frenzyUntil) this.frenzyUntil = 0
    if (this.acidBurstUntil && now > this.acidBurstUntil) this.acidBurstUntil = 0
    if (this.phaseUntil && now > this.phaseUntil) {
      this.phaseUntil = 0
      this.body.setAlpha(1)
      this.glow.setAlpha(0.16)
    }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return
    this.hp -= amount
    if (this.hp <= 0) {
      this.alive = false
      this.destroy()
      return
    }
    this.healthFront.displayWidth = 42 * Math.max(0, this.hp / this.maxHp)
    this.glow.setAlpha(0.28)
    this.body.scene.tweens.add({ targets: this.body, alpha: 0.58, duration: 80, yoyo: true, onComplete: () => this.body.setAlpha(1) })
    this.body.scene.tweens.add({ targets: this.glow, alpha: 0.14, duration: 80, yoyo: true, onComplete: () => this.glow.setAlpha(0.16) })
  }

  private setMoving(moving: boolean): void {
    const key = `${this.kind}-move`
    if (moving) {
      if (!this.body.anims.isPlaying || this.body.anims.currentAnim?.key !== key) this.body.play(key)
      return
    }
    if (this.body.anims.isPlaying) {
      this.body.stop()
      this.body.setFrame(0)
    }
  }

  private syncGraphics(): void {
    const lift = this.isFlying ? -18 : 0
    const baseDepth = 200 + this.y * 0.1 + (this.isFlying ? 120 : 0)
    this.shadow.setPosition(this.x, this.y + (this.isFlying ? 28 : 14)).setDepth(baseDepth - 3)
    this.glow.setPosition(this.x, this.y + lift).setDepth(baseDepth - 1)
    this.body.setPosition(this.x, this.y + lift).setDepth(baseDepth)
    this.selection.setPosition(this.x, this.y + 12).setDepth(baseDepth - 4)
    this.healthBack.setPosition(this.x, this.y - this.spriteHeight * 0.54 + lift).setDepth(baseDepth + 2)
    this.healthFront.setPosition(this.x - 21, this.y - this.spriteHeight * 0.54 + lift).setDepth(baseDepth + 3)
  }

  private playSpawnTween(scene: Phaser.Scene): void {
    this.body.setScale(0.72)
    this.glow.setScale(0.84)
    scene.tweens.add({ targets: [this.body], scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.Out' })
    scene.tweens.add({ targets: [this.glow], scaleX: 1, scaleY: 1, duration: 260, ease: 'Sine.Out' })
  }

  destroy(): void {
    const scene = this.body.scene
    scene.sound.play('sfx-explosion', { volume: this.kind === 'rifleman' || this.kind === 'medic' || this.kind === 'skitter' ? 0.18 : 0.32 })
    const explosion = scene.add.image(this.x, this.y, 'fx-explosion').setScale(0.1).setDepth(10000)
    scene.tweens.add({
      targets: explosion,
      scaleX: this.kind === 'rifleman' || this.kind === 'medic' || this.kind === 'skitter' ? 0.4 : 0.7,
      scaleY: this.kind === 'rifleman' || this.kind === 'medic' || this.kind === 'skitter' ? 0.4 : 0.7,
      alpha: 0,
      duration: 280,
      onComplete: () => explosion.destroy(),
    })
    const wreckKey = this.kind === 'rifleman' || this.kind === 'medic' || this.kind === 'skitter' ? 'wreck-infantry' : 'wreck-vehicle'
    const wreckSize = wreckScaleFor(this.kind)
    const wreck = scene.add.image(this.x, this.y + 8, wreckKey)
      .setDisplaySize(wreckSize, wreckSize)
      .setTint(this.team === 'player' ? 0x9fa8ab : 0x9b72bf)
      .setAlpha(0.78)
      .setDepth(90 + this.y * 0.1)
    scene.time.delayedCall(42000, () => {
      if (!wreck.active) return
      scene.tweens.add({ targets: wreck, alpha: 0, duration: 4500, onComplete: () => wreck.destroy() })
    })
    this.shadow.destroy(); this.glow.destroy(); this.body.destroy(); this.selection.destroy(); this.healthBack.destroy(); this.healthFront.destroy()
  }
}
