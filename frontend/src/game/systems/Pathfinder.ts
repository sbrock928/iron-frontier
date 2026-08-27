import type { Building } from '../entities/Building'
import { GRID_SIZE } from '../config'

type Point = { x: number; y: number }
type Cell = { col: number; row: number }

type Node = Cell & { g: number; f: number; parent: Node | null }

const key = (cell: Cell) => `${cell.col},${cell.row}`

export class Pathfinder {
  findPath(start: Point, goal: Point, buildings: Building[], worldWidth: number, worldHeight: number): Point[] {
    if ('isFlying' in start && Boolean((start as Point & { isFlying?: boolean }).isFlying)) return [goal]
    const cols = Math.ceil(worldWidth / GRID_SIZE)
    const rows = Math.ceil(worldHeight / GRID_SIZE)
    const startCell = this.toCell(start, cols, rows)
    const goalCell = this.toCell(goal, cols, rows)
    const blocked = this.blockedCells(buildings, cols, rows)
    blocked.delete(key(startCell))
    blocked.delete(key(goalCell))

    const open = new Map<string, Node>()
    const closed = new Set<string>()
    const first: Node = { ...startCell, g: 0, f: this.heuristic(startCell, goalCell), parent: null }
    open.set(key(first), first)

    while (open.size > 0) {
      let current: Node | null = null
      for (const node of open.values()) {
        if (current === null || node.f < current.f) current = node
      }
      if (current === null) break
      const currentKey = key(current)
      open.delete(currentKey)
      if (current.col === goalCell.col && current.row === goalCell.row) {
        return this.reconstruct(current).map((cell) => this.toWorld(cell))
      }
      closed.add(currentKey)

      for (const neighbor of this.neighbors(current, cols, rows)) {
        const neighborKey = key(neighbor)
        if (closed.has(neighborKey) || blocked.has(neighborKey)) continue
        const diagonal = neighbor.col !== current.col && neighbor.row !== current.row
        const tentativeG = current.g + (diagonal ? 1.414 : 1)
        const known = open.get(neighborKey)
        if (known && tentativeG >= known.g) continue
        const node: Node = {
          ...neighbor,
          g: tentativeG,
          f: tentativeG + this.heuristic(neighbor, goalCell),
          parent: current,
        }
        open.set(neighborKey, node)
      }
    }
    return [goal]
  }

  private toCell(point: Point, cols: number, rows: number): Cell {
    return {
      col: Math.max(0, Math.min(cols - 1, Math.floor(point.x / GRID_SIZE))),
      row: Math.max(0, Math.min(rows - 1, Math.floor(point.y / GRID_SIZE))),
    }
  }

  private toWorld(cell: Cell): Point {
    return { x: cell.col * GRID_SIZE + GRID_SIZE / 2, y: cell.row * GRID_SIZE + GRID_SIZE / 2 }
  }

  private heuristic(a: Cell, b: Cell): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
  }

  private neighbors(cell: Cell, cols: number, rows: number): Cell[] {
    const result: Cell[] = []
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (dc === 0 && dr === 0) continue
        const col = cell.col + dc
        const row = cell.row + dr
        if (col >= 0 && row >= 0 && col < cols && row < rows) result.push({ col, row })
      }
    }
    return result
  }

  private blockedCells(buildings: Building[], cols: number, rows: number): Set<string> {
    const blocked = new Set<string>()
    for (const building of buildings.filter((item) => item.alive)) {
      const half = building.size / 2 + 20
      const minCol = Math.max(0, Math.floor((building.x - half) / GRID_SIZE))
      const maxCol = Math.min(cols - 1, Math.floor((building.x + half) / GRID_SIZE))
      const minRow = Math.max(0, Math.floor((building.y - half) / GRID_SIZE))
      const maxRow = Math.min(rows - 1, Math.floor((building.y + half) / GRID_SIZE))
      for (let col = minCol; col <= maxCol; col += 1) {
        for (let row = minRow; row <= maxRow; row += 1) blocked.add(key({ col, row }))
      }
    }
    return blocked
  }

  private reconstruct(node: Node): Cell[] {
    const result: Cell[] = []
    let current: Node | null = node
    while (current) {
      result.push({ col: current.col, row: current.row })
      current = current.parent
    }
    return result.reverse().slice(1)
  }
}
