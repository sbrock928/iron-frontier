import Phaser from 'phaser'
import { BUILDING_STATS, GRID_SIZE } from '../config'
import type { Building } from '../entities/Building'
import type { Unit } from '../entities/Unit'

/**
 * Classic RTS shroud + fog-of-war.
 *
 * - unexplored cells are almost completely black
 * - explored cells outside current vision remain dimmed
 * - cells inside current player vision are unobscured
 *
 * A grid-based mask keeps the implementation deterministic and cheap while
 * still producing the chunky, old-school RTS visibility aesthetic.
 */
export class FogOfWarSystem {
  private readonly cellSize = GRID_SIZE
  private readonly columns: number
  private readonly rows: number
  private readonly explored: Uint8Array
  private readonly visible: Uint8Array
  private readonly graphics: Phaser.GameObjects.Graphics
  private nextRefreshAt = 0

  constructor(
    scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    this.columns = Math.ceil(worldWidth / this.cellSize)
    this.rows = Math.ceil(worldHeight / this.cellSize)
    this.explored = new Uint8Array(this.columns * this.rows)
    this.visible = new Uint8Array(this.columns * this.rows)
    this.graphics = scene.add.graphics().setDepth(8000)
  }

  update(time: number, units: Unit[], buildings: Building[], force = false): void {
    if (!force && time < this.nextRefreshAt) return
    this.nextRefreshAt = time + 90
    this.visible.fill(0)

    for (const unit of units) {
      if (!unit.alive || unit.team !== 'player') continue
      this.reveal(unit.x, unit.y, unit.vision)
    }

    for (const building of buildings) {
      if (!building.alive || building.team !== 'player') continue
      this.reveal(building.x, building.y, BUILDING_STATS[building.kind].vision)
    }

    this.redraw()
  }

  isVisible(x: number, y: number): boolean {
    const index = this.indexAtWorld(x, y)
    return index !== null && this.visible[index] === 1
  }

  isExplored(x: number, y: number): boolean {
    const index = this.indexAtWorld(x, y)
    return index !== null && this.explored[index] === 1
  }

  destroy(): void {
    this.graphics.destroy()
  }

  private reveal(worldX: number, worldY: number, radius: number): void {
    const minColumn = Phaser.Math.Clamp(Math.floor((worldX - radius) / this.cellSize), 0, this.columns - 1)
    const maxColumn = Phaser.Math.Clamp(Math.floor((worldX + radius) / this.cellSize), 0, this.columns - 1)
    const minRow = Phaser.Math.Clamp(Math.floor((worldY - radius) / this.cellSize), 0, this.rows - 1)
    const maxRow = Phaser.Math.Clamp(Math.floor((worldY + radius) / this.cellSize), 0, this.rows - 1)
    const radiusSquared = radius * radius

    for (let row = minRow; row <= maxRow; row += 1) {
      const cellY = row * this.cellSize + this.cellSize / 2
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const cellX = column * this.cellSize + this.cellSize / 2
        const dx = cellX - worldX
        const dy = cellY - worldY
        if (dx * dx + dy * dy > radiusSquared) continue
        const index = row * this.columns + column
        this.visible[index] = 1
        this.explored[index] = 1
      }
    }
  }

  private redraw(): void {
    this.graphics.clear()

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const index = row * this.columns + column
        if (this.visible[index] === 1) continue

        const alpha = this.explored[index] === 1 ? 0.58 : 0.94
        this.graphics.fillStyle(0x050807, alpha)
        this.graphics.fillRect(
          column * this.cellSize,
          row * this.cellSize,
          Math.min(this.cellSize + 1, this.worldWidth - column * this.cellSize),
          Math.min(this.cellSize + 1, this.worldHeight - row * this.cellSize),
        )
      }
    }
  }

  private indexAtWorld(x: number, y: number): number | null {
    if (x < 0 || y < 0 || x >= this.worldWidth || y >= this.worldHeight) return null
    const column = Math.floor(x / this.cellSize)
    const row = Math.floor(y / this.cellSize)
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return null
    return row * this.columns + column
  }
}
