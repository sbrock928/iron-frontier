/**
 * Minimal binary min-heap used by the pathfinder's open set.
 *
 * The previous A* implementation scanned every open node linearly to find the
 * lowest `f` score, which made each expansion O(n). With a heap that drops to
 * O(log n), which matters a great deal on the larger 3200x1900 skirmish maps
 * where the open set regularly holds several hundred nodes.
 */
export class BinaryHeap<T> {
  private readonly items: T[] = []

  constructor(private readonly score: (item: T) => number) {}

  get size(): number {
    return this.items.length
  }

  clear(): void {
    this.items.length = 0
  }

  push(item: T): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): T | undefined {
    const top = this.items[0]
    if (top === undefined) return undefined
    const last = this.items.pop() as T
    if (this.items.length > 0) {
      this.items[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex
    const item = this.items[index] as T
    const itemScore = this.score(item)

    while (index > 0) {
      const parentIndex = (index - 1) >> 1
      const parent = this.items[parentIndex] as T
      if (itemScore >= this.score(parent)) break
      this.items[index] = parent
      index = parentIndex
    }
    this.items[index] = item
  }

  private sinkDown(startIndex: number): void {
    let index = startIndex
    const length = this.items.length
    const item = this.items[index] as T
    const itemScore = this.score(item)

    for (;;) {
      const rightIndex = (index + 1) << 1
      const leftIndex = rightIndex - 1
      let swapIndex = -1
      let swapScore = itemScore

      if (leftIndex < length) {
        const leftScore = this.score(this.items[leftIndex] as T)
        if (leftScore < swapScore) {
          swapIndex = leftIndex
          swapScore = leftScore
        }
      }

      if (rightIndex < length) {
        const rightScore = this.score(this.items[rightIndex] as T)
        if (rightScore < swapScore) {
          swapIndex = rightIndex
          swapScore = rightScore
        }
      }

      if (swapIndex === -1) break
      this.items[index] = this.items[swapIndex] as T
      index = swapIndex
    }

    this.items[index] = item
  }
}
