/**
 * Owns control-group (Ctrl/Cmd+1-9 assign, 1-9 recall) bookkeeping so
 * BattleScene doesn't need to manage the raw maps itself. Selection
 * resolution (turning ids back into live Unit/Building references) stays in
 * BattleScene since it already owns those collections.
 */
export class ControlGroupManager {
  private readonly groups = new Map<number, string[]>()
  private readonly lastRecallAt = new Map<number, number>()
  /** Window, in ms, within which a second recall of the same group counts as a "double tap" (center camera). */
  static readonly DOUBLE_TAP_WINDOW_MS = 450

  clear(): void {
    this.groups.clear()
    this.lastRecallAt.clear()
  }

  assign(group: number, ids: string[]): void {
    this.groups.set(group, ids)
  }

  idsFor(group: number): string[] | undefined {
    return this.groups.get(group)
  }

  /** Records a recall attempt and reports whether it happened fast enough after the previous one to count as a double-tap. */
  recordRecall(group: number, now: number): boolean {
    const previous = this.lastRecallAt.get(group) ?? -Infinity
    this.lastRecallAt.set(group, now)
    return now - previous < ControlGroupManager.DOUBLE_TAP_WINDOW_MS
  }

  /** Returns member counts per group (1-9), keyed by group number, omitting empty/fully-dead groups. */
  sizes(isAlive: (id: string) => boolean): Record<number, number> {
    const result: Record<number, number> = {}
    for (const [group, ids] of this.groups) {
      const count = ids.filter(isAlive).length
      if (count > 0) result[group] = count
    }
    return result
  }
}
