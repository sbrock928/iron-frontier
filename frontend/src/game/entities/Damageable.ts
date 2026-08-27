import type { Team } from '../../types'

export interface Damageable {
  id: string
  team: Team
  x: number
  y: number
  hp: number
  maxHp: number
  alive: boolean
  takeDamage(amount: number): void
}
