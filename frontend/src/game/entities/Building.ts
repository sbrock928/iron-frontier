import Phaser from 'phaser'
import type { BuildingKind, Faction, SelectedEntity, Team } from '../../types'
import { BUILDING_STATS, BUILDING_TEXTURES, TEAM_TINT, buildingLabel } from '../config'
import type { Damageable } from './Damageable'

export class Building implements Damageable {
  readonly id: string
  readonly kind: BuildingKind
  readonly team: Team
  readonly faction: Faction
  readonly maxHp: number
  hp: number
  alive = true
  x: number
  y: number
  readonly size: number
  readonly body: Phaser.GameObjects.Image
  private readonly glow: Phaser.GameObjects.Image
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly label: Phaser.GameObjects.Text
  private readonly healthBack: Phaser.GameObjects.Rectangle
  private readonly healthFront: Phaser.GameObjects.Rectangle
  private readonly selection: Phaser.GameObjects.Ellipse
  lastShotAt = 0

  constructor(scene: Phaser.Scene, id: string, kind: BuildingKind, team: Team, faction: Faction, x: number, y: number) {
    const stats = BUILDING_STATS[kind]
    this.id = id
    this.kind = kind
    this.team = team
    this.faction = faction
    this.maxHp = stats.hp
    this.hp = stats.hp
    this.x = x
    this.y = y
    this.size = stats.size

    const texture = BUILDING_TEXTURES[faction][kind]
    const shadowWidth = stats.size * 1.08
    const shadowHeight = stats.size * 0.42
    this.shadow = scene.add.ellipse(x, y + stats.size * 0.26, shadowWidth, shadowHeight, 0x040505, 0.34)
    this.glow = scene.add.image(x, y, texture).setDisplaySize(stats.spriteSize.width, stats.spriteSize.height).setAlpha(0.20)
    this.body = scene.add.image(x, y, texture).setDisplaySize(stats.spriteSize.width, stats.spriteSize.height)
    this.glow.setTint(team === 'player' ? 0x6bfff2 : 0xaa63ff)
    this.body.setTint(team === 'player' ? TEAM_TINT.player : TEAM_TINT.enemy)
    this.selection = scene.add.ellipse(x, y + stats.size * 0.22, stats.size * 1.16, stats.size * 0.54)
      .setStrokeStyle(2, team === 'player' ? 0x9effc4 : 0xe295ff)
      .setVisible(false)
    this.label = scene.add.text(x, y + stats.size * 0.26, this.shortLabel(), {
      fontFamily: 'monospace', fontSize: '11px', color: '#ebf4f3', stroke: '#08100c', strokeThickness: 3,
    }).setOrigin(0.5)
    this.healthBack = scene.add.rectangle(x, y - stats.size * 0.44, stats.size * 0.72, 6, 0x060907)
    this.healthFront = scene.add.rectangle(x - stats.size * 0.36, y - stats.size * 0.44, stats.size * 0.72, 6, team === 'player' ? 0x7dde7d : 0xd987ff).setOrigin(0, 0.5)
    this.playSpawnTween(scene)
    scene.tweens.add({ targets: this.glow, alpha: { from: 0.10, to: kind === 'power' ? 0.32 : 0.22 }, duration: kind === 'power' ? 900 : 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.syncGraphics()
  }

  private shortLabel(): string {
    const names: Record<BuildingKind, string> = { conyard: 'CY', power: 'PWR', refinery: 'REF', barracks: 'BAR', warfactory: 'WF', turret: 'TUR' }
    return names[this.kind]
  }

  setSelected(selected: boolean): void { this.selection.setVisible(selected) }

  setFogVisible(visible: boolean): void {
    this.shadow.setVisible(visible)
    this.glow.setVisible(visible)
    this.body.setVisible(visible)
    this.label.setVisible(visible)
    this.healthBack.setVisible(visible)
    this.healthFront.setVisible(visible)
    if (!visible) this.selection.setVisible(false)
  }

  toSelectedEntity(): SelectedEntity {
    return { id: this.id, label: buildingLabel(this.kind, this.faction), kind: this.kind, hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp, team: this.team }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return
    this.hp -= amount
    if (this.hp <= 0) {
      this.alive = false
      this.destroy()
      return
    }
    this.healthFront.displayWidth = this.size * 0.72 * Math.max(0, this.hp / this.maxHp)
    this.body.scene.tweens.add({ targets: this.body, alpha: 0.62, duration: 90, yoyo: true, onComplete: () => this.body.setAlpha(1) })
  }

  contains(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.size / 2 && Math.abs(y - this.y) <= this.size * 0.39
  }

  private syncGraphics(): void {
    const depth = 120 + this.y * 0.1
    this.shadow.setPosition(this.x, this.y + this.size * 0.26).setDepth(depth - 2)
    this.glow.setPosition(this.x, this.y).setDepth(depth - 1)
    this.body.setPosition(this.x, this.y).setDepth(depth)
    this.selection.setPosition(this.x, this.y + this.size * 0.22).setDepth(depth - 3)
    this.label.setPosition(this.x, this.y + this.size * 0.26).setDepth(depth + 1)
    this.healthBack.setPosition(this.x, this.y - this.size * 0.44).setDepth(depth + 2)
    this.healthFront.setPosition(this.x - this.size * 0.36, this.y - this.size * 0.44).setDepth(depth + 3)
  }

  private playSpawnTween(scene: Phaser.Scene): void {
    this.body.setScale(0.8)
    this.glow.setScale(0.92)
    scene.tweens.add({ targets: this.body, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.Out' })
    scene.tweens.add({ targets: this.glow, alpha: { from: 0.35, to: 0.2 }, duration: 350, ease: 'Sine.Out' })
  }

  destroy(): void {
    const scene = this.body.scene
    scene.sound.play('sfx-explosion', { volume: this.kind === 'turret' ? 0.32 : 0.46 })
    const explosion = scene.add.image(this.x, this.y, 'fx-explosion').setScale(0.18).setDepth(10000)
    scene.tweens.add({ targets: explosion, scaleX: this.kind === 'turret' ? 0.8 : 1.1, scaleY: this.kind === 'turret' ? 0.8 : 1.1, alpha: 0, duration: 360, onComplete: () => explosion.destroy() })
    const wreck = scene.add.image(this.x, this.y + this.size * 0.14, 'wreck-building')
      .setDisplaySize(this.kind === 'turret' ? 78 : Math.max(104, this.size * 1.08), this.kind === 'turret' ? 78 : Math.max(104, this.size * 1.08))
      .setTint(this.team === 'player' ? 0xa4b4ae : 0x9b77b9)
      .setAlpha(0.76)
      .setDepth(88 + this.y * 0.1)
    scene.time.delayedCall(60000, () => {
      if (!wreck.active) return
      scene.tweens.add({ targets: wreck, alpha: 0, duration: 6000, onComplete: () => wreck.destroy() })
    })
    this.shadow.destroy(); this.glow.destroy(); this.body.destroy(); this.label.destroy(); this.healthBack.destroy(); this.healthFront.destroy(); this.selection.destroy()
  }
}
