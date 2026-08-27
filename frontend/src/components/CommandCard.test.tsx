import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandCard } from './CommandCard'
import { ResearchPanel } from './ResearchPanel'
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
const artillery: SelectedEntity = { id: 'u3', label: 'Siege Artillery', kind: 'artillery', hp: 250, maxHp: 250, team: 'player' }
const techlab: SelectedEntity = { id: 'b1', label: 'Research Citadel', kind: 'techlab', hp: 820, maxHp: 820, team: 'player' }

beforeEach(() => {
  useGameStore.getState().resetBattleState()
  useGameStore.setState({ mission, faction: 'aegis', enemyFaction: 'noctis', status: 'playing' })
})

describe('ResearchPanel', () => {
  it('shows the technology tree independently of unit selection', async () => {
    const user = userEvent.setup()
    useGameStore.getState().setOwnedBuildingKinds([])

    render(<ResearchPanel />)
    await user.click(screen.getByRole('button', { name: /Research/i }))

    expect(screen.getByRole('button', { name: /Composite Plating/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siege Doctrine/i })).toBeInTheDocument()
  })

  it('enables an upgrade once its structure, prerequisites, and cost are satisfied', async () => {
    const user = userEvent.setup()
    useGameStore.getState().setOwnedBuildingKinds(['barracks'])
    useGameStore.setState({ credits: 99999 })

    render(<ResearchPanel />)
    await user.click(screen.getByRole('button', { name: /Research/i }))

    expect(screen.getByRole('button', { name: /Composite Plating/i })).toBeEnabled()
  })

  it('explains which structure a specific upgrade needs instead of failing silently', async () => {
    const user = userEvent.setup()
    useGameStore.getState().setOwnedBuildingKinds(['barracks'])
    useGameStore.setState({ credits: 99999 })

    render(<ResearchPanel />)
    await user.click(screen.getByRole('button', { name: /Research/i }))

    const siege = screen.getByRole('button', { name: /Siege Doctrine/i })
    expect(siege).toBeDisabled()
    expect(siege).toHaveAttribute('title', expect.stringContaining('Requires Science Directorate'))
  })

  it('emits the selected upgrade without requiring a research structure selection', async () => {
    const user = userEvent.setup()
    const listener = vi.fn()
    const unsubscribe = gameBus.on('research-upgrade', listener)
    useGameStore.getState().setOwnedBuildingKinds(['barracks'])
    useGameStore.setState({ credits: 99999 })

    render(<ResearchPanel />)
    await user.click(screen.getByRole('button', { name: /Research/i }))
    await user.click(screen.getByRole('button', { name: /Composite Plating/i }))

    expect(listener).toHaveBeenCalledWith('aegis_composite_plating')
    unsubscribe()
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

  it('only shows abilities supported by the selected unit type', () => {
    useGameStore.getState().setSelected([rifleman])

    render(<CommandCard />)

    expect(screen.getByRole('button', { name: /Stim Burst/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Toggle Siege/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Afterburners/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Research/i })).not.toBeInTheDocument()
  })

  it('updates contextual abilities when the selected unit type changes', () => {
    useGameStore.getState().setSelected([artillery])

    render(<CommandCard />)

    expect(screen.getByRole('button', { name: /Toggle Siege/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Stim Burst/i })).not.toBeInTheDocument()
  })

  it('includes effect and hotkey details in ability tooltips', () => {
    useGameStore.getState().setSelected([rifleman])
    render(<CommandCard />)

    expect(screen.getByRole('button', { name: /Stim Burst/i })).toHaveAttribute(
      'title',
      expect.stringMatching(/Temporary attack and movement boost[\s\S]*Hotkey:/),
    )
  })

  it('does not expose a faction-wide ability for a building selection', () => {
    useGameStore.setState({ faction: 'veyra' })
    useGameStore.getState().setSelected([techlab])

    render(<CommandCard />)

    expect(screen.queryByRole('button', { name: /Shield Surge/i })).not.toBeInTheDocument()
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
