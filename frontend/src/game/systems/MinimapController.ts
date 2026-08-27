import Phaser from 'phaser'
import type { Building } from '../entities/Building'
import type { ResourcePatch } from '../entities/ResourcePatch'
import type { Unit } from '../entities/Unit'

/**
 * Owns the minimap: its dedicated Phaser camera, the fixed screen-space
 * border, and a live world-space blips layer (units/buildings/resource
 * patches) that is redrawn periodically and only rendered by the minimap
 * camera. Pointer interaction (click-to-jump, edge-pan suppression) is
 * exposed via `containsScreenPoint`/`handleClick` for BattleScene's input
 * handlers to call into.
 */
export class MinimapController {
  readonly rect: Phaser.Geom.Rectangle
  private readonly camera: Phaser.Cameras.Scene2D.Camera
  private readonly blips: Phaser.GameObjects.Graphics
  private readonly border: Phaser.GameObjects.Rectangle

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    x = 16,
    y = 16,
    width = 188,
    height = 110,
  ) {
    this.rect = new Phaser.Geom.Rectangle(x, y, width, height)
    this.camera = scene.cameras.add(x, y, width, height, false, 'minimap')
    this.camera.setBounds(0, 0, worldWidth, worldHeight)
    this.camera.centerOn(worldWidth / 2, worldHeight / 2)
    this.camera.setZoom(Math.min(width / worldWidth, height / worldHeight))
    this.camera.setBackgroundColor(0x0b120e)

    this.border = scene.add.rectangle(x + width / 2, y + height / 2, width + 6, height + 6, 0x0b0e0c, 0.2)
      .setStrokeStyle(2, 0xb8c5ba)
      .setScrollFactor(0)
      .setDepth(9999)
    this.camera.ignore(this.border)

    // World-space overlay: only the minimap camera should render it, so the
    // main game camera is told to ignore it.
    this.blips = scene.add.graphics().setDepth(9998)
    scene.cameras.main.ignore(this.blips)
  }

  containsScreenPoint(screenX: number, screenY: number): boolean {
    return this.rect.contains(screenX, screenY)
  }

  /** Converts a minimap-local click into a world point and recenters the main camera on it. Returns false if the point was outside the minimap. */
  handleClick(screenX: number, screenY: number, mainCamera: Phaser.Cameras.Scene2D.Camera): boolean {
    if (!this.rect.contains(screenX, screenY)) return false
    const u = Phaser.Math.Clamp((screenX - this.rect.x) / this.rect.width, 0, 1)
    const v = Phaser.Math.Clamp((screenY - this.rect.y) / this.rect.height, 0, 1)
    mainCamera.centerOn(u * this.worldWidth, v * this.worldHeight)
    return true
  }

  /** Redraws unit/building/patch blips and the main camera's viewport box. Enemy entities are only drawn where `isVisible` reports fog visibility. */
  redraw(units: Unit[], buildings: Building[], patches: ResourcePatch[], isVisible: (x: number, y: number) => boolean, mainCamera: Phaser.Cameras.Scene2D.Camera): void {
    const g = this.blips
    g.clear()

    g.fillStyle(0xc9a15c, 0.85)
    for (const patch of patches) {
      if (patch.amount <= 0) continue
      g.fillCircle(patch.x, patch.y, 5)
    }

    for (const building of buildings) {
      if (!building.alive) continue
      const visible = building.team === 'player' || isVisible(building.x, building.y)
      if (!visible) continue
      g.fillStyle(building.team === 'player' ? 0x6df0d0 : 0xd987ff, 1)
      g.fillRect(building.x - 5, building.y - 5, 10, 10)
    }

    for (const unit of units) {
      if (!unit.alive) continue
      const visible = unit.team === 'player' || isVisible(unit.x, unit.y)
      if (!visible) continue
      g.fillStyle(unit.team === 'player' ? 0x8cf5ff : 0xe295ff, 1)
      g.fillCircle(unit.x, unit.y, 4)
    }

    const view = mainCamera.worldView
    g.lineStyle(1, 0xf3ffe0, 0.85)
    g.strokeRect(view.x, view.y, view.width, view.height)
  }

  destroy(): void {
    this.blips.destroy()
    this.border.destroy()
    this.scene.cameras.remove(this.camera)
  }
}
