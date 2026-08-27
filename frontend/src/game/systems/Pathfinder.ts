import type { Building } from '../entities/Building'
import { GRID_SIZE } from '../config'
import { BinaryHeap } from '../core/BinaryHeap'

type Point = { x: number; y: number }

/** Marks a cell as impassable in the flat obstacle grid. */
const BLOCKED = 1

/** Cost of a straight (orthogonal) step, in cell units. */
const STRAIGHT_COST = 1
/** Cost of a diagonal step: sqrt(2). */
const DIAGONAL_COST = Math.SQRT2

/** Neighbour offsets ordered orthogonal-first so ties favour straight lines. */
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

interface OpenNode {
  index: number
  f: number
}

/**
 * Grid A* pathfinder.
 *
 * Three things make this materially faster than the naive implementation it
 * replaces, which matters because every unit in a selection requests its own
 * path on each right-click:
 *
 *  1. A binary heap open set instead of a linear minimum scan.
 *  2. Flat typed arrays keyed by `row * cols + col` instead of `Map`/`Set`
 *     objects keyed by `"col,row"` strings, so the hot loop allocates nothing.
 *  3. A cached obstacle grid that is only rebuilt when the building layout
 *     actually changes, rather than on every single call.
 *
 * The heuristic is octile distance, which is admissible for 8-connected grids.
 * The previous Manhattan heuristic overestimated diagonal travel and so
 * produced visibly non-optimal, staircase-shaped routes.
 */
export class Pathfinder {
  private grid = new Uint8Array(0)
  private gridCols = 0
  private gridRows = 0
  private gridSignature = -1

  /** Permanent map obstacles (cliffs, etc.) applied underneath the per-frame building grid. */
  private staticGrid = new Uint8Array(0)
  private staticGridCols = 0
  private staticGridRows = 0

  private gScore = new Float32Array(0)
  private cameFrom = new Int32Array(0)
  private visitStamp = new Int32Array(0)
  private closed = new Uint8Array(0)
  private currentStamp = 0

  private readonly open = new BinaryHeap<OpenNode>((node) => node.f)

  /**
   * Registers permanent terrain obstacles (cliff clusters, etc.) that block
   * pathing for the rest of the mission. Call once after the map's decoration
   * layer is generated, before the first `findPath` request; building
   * obstacles are layered on top of this static grid on every rebuild.
   */
  setTerrainObstacles(obstacles: ReadonlyArray<{ x: number; y: number; width: number; height: number }>, worldWidth: number, worldHeight: number): void {
    const cols = Math.max(1, Math.ceil(worldWidth / GRID_SIZE))
    const rows = Math.max(1, Math.ceil(worldHeight / GRID_SIZE))
    this.staticGrid = new Uint8Array(cols * rows)
    this.staticGridCols = cols
    this.staticGridRows = rows

    for (const obstacle of obstacles) {
      const minCol = Math.max(0, Math.floor((obstacle.x - obstacle.width / 2) / GRID_SIZE))
      const maxCol = Math.min(cols - 1, Math.floor((obstacle.x + obstacle.width / 2) / GRID_SIZE))
      const minRow = Math.max(0, Math.floor((obstacle.y - obstacle.height / 2) / GRID_SIZE))
      const maxRow = Math.min(rows - 1, Math.floor((obstacle.y + obstacle.height / 2) / GRID_SIZE))
      for (let row = minRow; row <= maxRow; row += 1) {
        const rowOffset = row * cols
        for (let col = minCol; col <= maxCol; col += 1) this.staticGrid[rowOffset + col] = BLOCKED
      }
    }
    this.invalidate()
  }

  /**
   * Forces the cached obstacle grid to be rebuilt on the next query. Call this
   * whenever a building is added or removed so the cache can never go stale.
   */
  invalidate(): void {
    this.gridSignature = -1
  }

  findPath(
    start: Point,
    goal: Point,
    buildings: Building[],
    worldWidth: number,
    worldHeight: number,
  ): Point[] {
    // Air units ignore terrain and structures entirely.
    if ('isFlying' in start && Boolean((start as Point & { isFlying?: boolean }).isFlying)) {
      return [{ x: goal.x, y: goal.y }]
    }

    const cols = Math.max(1, Math.ceil(worldWidth / GRID_SIZE))
    const rows = Math.max(1, Math.ceil(worldHeight / GRID_SIZE))
    this.ensureCapacity(cols, rows)
    this.rebuildGridIfNeeded(buildings, cols, rows)

    const startIndex = this.toIndex(start, cols, rows)
    const goalIndex = this.toIndex(goal, cols, rows)
    if (startIndex === goalIndex) return [{ x: goal.x, y: goal.y }]

    // A unit standing inside a structure's footprint, or a goal placed on one,
    // must never be treated as unreachable. Temporarily unblock both endpoints
    // and restore them afterwards so the cached grid stays correct.
    const startWasBlocked = this.grid[startIndex] === BLOCKED
    const goalWasBlocked = this.grid[goalIndex] === BLOCKED
    this.grid[startIndex] = 0
    this.grid[goalIndex] = 0

    try {
      return this.search(startIndex, goalIndex, goal, cols, rows)
    } finally {
      if (startWasBlocked) this.grid[startIndex] = BLOCKED
      if (goalWasBlocked) this.grid[goalIndex] = BLOCKED
    }
  }

  private search(startIndex: number, goalIndex: number, goal: Point, cols: number, rows: number): Point[] {
    this.currentStamp += 1
    const stamp = this.currentStamp
    this.open.clear()

    const goalCol = goalIndex % cols
    const goalRow = (goalIndex / cols) | 0

    this.gScore[startIndex] = 0
    this.cameFrom[startIndex] = -1
    this.visitStamp[startIndex] = stamp
    this.closed[startIndex] = 0
    this.open.push({
      index: startIndex,
      f: this.heuristic(startIndex % cols, (startIndex / cols) | 0, goalCol, goalRow),
    })

    while (this.open.size > 0) {
      const current = this.open.pop() as OpenNode
      const index = current.index

      // Stale heap entry left behind by a cheaper route to the same cell.
      if (this.closed[index] === 1) continue
      this.closed[index] = 1

      if (index === goalIndex) return this.reconstruct(index, goal, cols)

      const col = index % cols
      const row = (index / cols) | 0
      const currentG = this.gScore[index] as number

      for (const [dc, dr] of NEIGHBOR_OFFSETS) {
        const nextCol = col + dc
        const nextRow = row + dr
        if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) continue

        const nextIndex = nextRow * cols + nextCol
        if (this.grid[nextIndex] === BLOCKED) continue
        if (this.visitStamp[nextIndex] === stamp && this.closed[nextIndex] === 1) continue

        const diagonal = dc !== 0 && dr !== 0
        if (diagonal) {
          // Refuse to cut corners between two diagonally adjacent obstacles;
          // otherwise units clip through the seams of packed structures.
          if (this.grid[row * cols + nextCol] === BLOCKED) continue
          if (this.grid[nextRow * cols + col] === BLOCKED) continue
        }

        const tentativeG = currentG + (diagonal ? DIAGONAL_COST : STRAIGHT_COST)
        const seen = this.visitStamp[nextIndex] === stamp
        if (seen && tentativeG >= (this.gScore[nextIndex] as number)) continue

        this.gScore[nextIndex] = tentativeG
        this.cameFrom[nextIndex] = index
        this.visitStamp[nextIndex] = stamp
        this.closed[nextIndex] = 0
        this.open.push({ index: nextIndex, f: tentativeG + this.heuristic(nextCol, nextRow, goalCol, goalRow) })
      }
    }

    // Unreachable: fall back to a direct order so the unit still responds.
    return [{ x: goal.x, y: goal.y }]
  }

  /**
   * Octile distance: the exact cost of moving on an 8-connected grid with no
   * obstacles, and therefore both admissible and consistent.
   */
  private heuristic(col: number, row: number, goalCol: number, goalRow: number): number {
    const dx = Math.abs(col - goalCol)
    const dy = Math.abs(row - goalRow)
    return STRAIGHT_COST * (dx + dy) + (DIAGONAL_COST - 2 * STRAIGHT_COST) * Math.min(dx, dy)
  }

  private reconstruct(goalIndex: number, goal: Point, cols: number): Point[] {
    const cells: number[] = []
    let cursor = goalIndex
    while (cursor !== -1) {
      cells.push(cursor)
      cursor = this.cameFrom[cursor] as number
    }
    cells.reverse()
    // `cells[0]` is the cell the unit already occupies; it anchors the
    // string-pulling pass but is never emitted as a waypoint.
    if (cells.length < 2) return [{ x: goal.x, y: goal.y }]

    const smoothed = this.smooth(cells, cols)
    if (smoothed.length === 0) return [{ x: goal.x, y: goal.y }]

    const points = smoothed.map((index) => this.toWorld(index, cols))
    // Finish on the exact requested position rather than the cell centre so
    // formation offsets and rally points land where the player clicked.
    points[points.length - 1] = { x: goal.x, y: goal.y }
    return points
  }

  /**
   * String-pulling pass: walks forward from the start cell and keeps only the
   * furthest cell still reachable in a straight, unobstructed line, repeating
   * from there. Turns the grid staircase into a natural-looking route.
   *
   * Takes the full cell list including the start cell as its first anchor, and
   * returns only the waypoints the unit must actually travel to.
   */
  private smooth(cells: number[], cols: number): number[] {
    const result: number[] = []
    let anchor = cells[0] as number
    let index = 1

    while (index < cells.length) {
      let furthest = index
      for (let probe = cells.length - 1; probe > index; probe -= 1) {
        if (this.hasLineOfSight(anchor, cells[probe] as number, cols)) {
          furthest = probe
          break
        }
      }
      anchor = cells[furthest] as number
      result.push(anchor)
      index = furthest + 1
    }

    return result
  }

  /** Bresenham walk reporting whether every cell between two points is free. */
  private hasLineOfSight(fromIndex: number, toIndex: number, cols: number): boolean {
    let col = fromIndex % cols
    let row = (fromIndex / cols) | 0
    const targetCol = toIndex % cols
    const targetRow = (toIndex / cols) | 0

    const dx = Math.abs(targetCol - col)
    const dy = Math.abs(targetRow - row)
    const stepCol = col < targetCol ? 1 : -1
    const stepRow = row < targetRow ? 1 : -1
    let error = dx - dy

    for (;;) {
      if (this.grid[row * cols + col] === BLOCKED) return false
      if (col === targetCol && row === targetRow) return true
      const doubled = error * 2
      if (doubled > -dy) {
        error -= dy
        col += stepCol
      }
      if (doubled < dx) {
        error += dx
        row += stepRow
      }
    }
  }

  private ensureCapacity(cols: number, rows: number): void {
    if (this.gridCols === cols && this.gridRows === rows && this.grid.length > 0) return
    const size = cols * rows
    this.grid = new Uint8Array(size)
    this.gScore = new Float32Array(size)
    this.cameFrom = new Int32Array(size)
    this.visitStamp = new Int32Array(size)
    this.closed = new Uint8Array(size)
    this.gridCols = cols
    this.gridRows = rows
    this.gridSignature = -1
    this.currentStamp = 0
  }

  private rebuildGridIfNeeded(buildings: Building[], cols: number, rows: number): void {
    const signature = this.signatureOf(buildings)
    if (signature === this.gridSignature) return
    this.gridSignature = signature
    if (this.staticGridCols === cols && this.staticGridRows === rows && this.staticGrid.length === cols * rows) {
      this.grid.set(this.staticGrid)
    } else {
      this.grid.fill(0)
    }

    for (const building of buildings) {
      if (!building.alive) continue
      const half = building.size / 2 + 20
      const minCol = Math.max(0, Math.floor((building.x - half) / GRID_SIZE))
      const maxCol = Math.min(cols - 1, Math.floor((building.x + half) / GRID_SIZE))
      const minRow = Math.max(0, Math.floor((building.y - half) / GRID_SIZE))
      const maxRow = Math.min(rows - 1, Math.floor((building.y + half) / GRID_SIZE))
      for (let row = minRow; row <= maxRow; row += 1) {
        const rowOffset = row * cols
        for (let col = minCol; col <= maxCol; col += 1) this.grid[rowOffset + col] = BLOCKED
      }
    }
  }

  /**
   * Cheap fingerprint of the current building layout. Buildings never move, so
   * position, size and liveness are enough to detect any change that would
   * affect the obstacle grid. `invalidate()` covers the pathological case.
   */
  private signatureOf(buildings: Building[]): number {
    let hash = 2166136261
    for (const building of buildings) {
      if (!building.alive) continue
      hash = Math.imul(hash ^ (building.x | 0), 16777619)
      hash = Math.imul(hash ^ (building.y | 0), 16777619)
      hash = Math.imul(hash ^ (building.size | 0), 16777619)
    }
    return hash | 0
  }

  private toIndex(point: Point, cols: number, rows: number): number {
    const col = Math.max(0, Math.min(cols - 1, Math.floor(point.x / GRID_SIZE)))
    const row = Math.max(0, Math.min(rows - 1, Math.floor(point.y / GRID_SIZE)))
    return row * cols + col
  }

  private toWorld(index: number, cols: number): Point {
    const col = index % cols
    const row = (index / cols) | 0
    return { x: col * GRID_SIZE + GRID_SIZE / 2, y: row * GRID_SIZE + GRID_SIZE / 2 }
  }
}
