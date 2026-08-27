import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandCard } from './CommandCard'
import { TopBar } from './TopBar'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'
import type { Mission, SelectedEntity } from '../types'

const mission = {
  id: 'mission_test',
  name: 'Test Op',
  description: 'Fixture',
  definition: { starting_credits: 5000 },
} as unknown as Mission

const worker: SelectedEntity = { id: 'u1', label: 'Harvester', kind: 'harvester', hp: 430, maxHp: 430, team: 'player' }
const rifleman: SelectedEntity = { id: 'u2', label: 'Rifleman', kind: 'rifleman', hp: 95, maxHp: 95, team: 'player' }

beforeEach(() => {
  useGameStore.getState().resetBattleState()
  useGameStore.setState({ mission, faction: 'aegis', enemyFaction: 'noctis', status: 'playing' })
})

describe('CommandCard research gating', () => {
  it('disables Research when the player owns no structure that can research', () => {
    useGameStore.getState().setSelected([rifleman])
    useGameStore.getState().setOwnedBuildingKinds([])

    render(<CommandCard />)

    const research = screen.getByRole('button', { name: /Research/i })
    expect(research).toBeDisabled()
    expect(research).toHaveAttribute('title', expect.stringContaining('No research structure built'))
  })

  it('enables Research once a structure that performs it exists', () => {
    useGameStore.getState().setSelected([rifleman])
    // Several tier-1 upgrades are researched at the barracks.
    useGameStore.getState().setOwnedBuildingKinds(['barracks'])

    render(<CommandCard />)

    expect(screen.getByRole('button', { name: /Research/i })).toBeEnabled()
  })

  it('explains which structure a specific upgrade needs instead of failing silently', async () => {
    const user = userEvent.setup()
    useGameStore.getState().setSelected([rifleman])
    useGameStore.getState().setOwnedBuildingKinds(['barracks'])
    useGameStore.setState({ credits: 99999 })

    render(<CommandCard />)
    await user.click(screen.getByRole('button', { name: /Research/i }))

    // Siege Doctrine is a techlab upgrade; the player only has a barracks.
    const siege = screen.getByRole('button', { name: /Siege Doctrine/i })
    expect(siege).toBeDisabled()
    expect(siege).toHaveAttribute('title', expect.stringContaining('Requires Science Directorate'))
  })
})

describe('CommandCard orders', () => {
  it('disables Build until a worker or the construction yard is selected', () => {
    useGameStore.getState().setSelected([rifleman])
    render(<CommandCard />)
    expect(screen.getByRole('button', { name: /Build/i })).toBeDisabled()
  })

  it('enables Build for a worker', () => {
    useGameStore.getState().setSelected([worker])
    render(<CommandCard />)
    expect(screen.getByRole('button', { name: /Build/i })).toBeEnabled()
  })

  it('emits a stop order when the S hotkey is pressed', async () => {
    const user = userEvent.setup()
    const listener = vi.fn()
    const unsubscribe = gameBus.on('stop-selected', listener)
    useGameStore.getState().setSelected([rifleman])

    render(<CommandCard />)
    await user.keyboard('s')

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('does not fire a hotkey whose order is disabled', async () => {
    const user = userEvent.setup()
    const listener = vi.fn()
    const unsubscribe = gameBus.on('stop-selected', listener)
    useGameStore.getState().setSelected([])

    render(<CommandCard />)
    await user.keyboard('s')

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})

describe('TopBar supply readout', () => {
  it('does not warn while a unit can still be trained', () => {
    useGameStore.getState().setEconomy(1000, 21, 22, 100)
    const { container } = render(<TopBar />)
    expect(container.querySelector('.danger')).toBeNull()
  })

  it('warns exactly when the cap is reached, matching the production gate', () => {
    // The scene refuses training when used + cost > capacity. Every unit costs
    // at least 1 supply, so used === capacity is genuinely blocked and must warn.
    useGameStore.getState().setEconomy(1000, 22, 22, 100)
    const { container } = render(<TopBar />)
    expect(container.querySelector('.danger')).not.toBeNull()
  })

  it('does not warn before the match has established a cap', () => {
    useGameStore.getState().setEconomy(0, 0, 0, 0)
    const { container } = render(<TopBar />)
    expect(container.querySelector('.danger')).toBeNull()
  })

  it('shows committed supply against the cap', () => {
    useGameStore.getState().setEconomy(1000, 8, 22, 100)
    render(<TopBar />)
    expect(screen.getByText('8 / 22')).toBeInTheDocument()
  })
})
