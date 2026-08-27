import Phaser from 'phaser'

export class ResourcePatch {
  amount = 12000
  readonly body: Phaser.GameObjects.Image
  private readonly glow: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, public readonly x: number, public readonly y: number) {
    this.glow = scene.add.image(x, y, 'ore-patch').setDisplaySize(142, 142).setAlpha(0.22).setTint(0x6ff7ff)
    this.body = scene.add.image(x, y, 'ore-patch').setDisplaySize(142, 142)
    this.body.setDepth(80 + y * 0.1)
    this.glow.setDepth(79 + y * 0.1)
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.12, to: 0.28 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  }

  harvest(amount: number): number {
    const taken = Math.min(this.amount, amount)
    this.amount -= taken
    const alpha = Math.max(0.18, this.amount / 12000)
    this.body.setAlpha(alpha)
    this.glow.setAlpha(0.08 + alpha * 0.18)
    return taken
  }
}
