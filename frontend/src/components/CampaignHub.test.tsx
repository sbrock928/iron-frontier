import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  submitCampaignOrder,
} from '../api/client'
import type { CampaignState } from '../types'
import { CampaignHub } from './CampaignHub'

vi.mock('../api/client', () => ({
  cancelCampaignOrder: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  joinCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  setCampaignReady: vi.fn(),
  submitCampaignOrder: vi.fn(),
}))

const campaignId = '11111111-1111-4111-8111-111111111111'
const playerId = '22222222-2222-4222-8222-222222222222'
const playerToken = 'private-campaign-token-with-at-least-thirty-two-characters'
const rivalId = '33333333-3333-4333-8333-333333333333'
const homeId = '44444444-4444-4444-8444-444444444444'
const targetId = '55555555-5555-4555-8555-555555555555'

const campaignState = (status = 'planning'): CampaignState => ({
  id: campaignId,
  join_code: 'IRON42',
  name: 'Fractured Meridian',
  status,
  turn_number: 1,
  max_players: 2,
  version: 1,
  viewer_player_id: playerId,
  viewer_token: playerToken,
  players: [
    { id: playerId, display_name: 'Commander', faction: 'aegis', credits: 2400, ready: false },
    { id: rivalId, display_name: 'Rival', faction: 'noctis', credits: 2400, ready: false },
  ],
  sectors: [
    {
      id: homeId,
      sector_key: 'iron_crown',
      label: 'Iron Crown',
      map_x: 20,
      map_y: 50,
      resource_yield: 520,
      base_level: 1,
      owner_player_id: playerId,
      neighbor_ids: [targetId],
      forces: [{ player_id: playerId, unit_kind: 'rifleman', quantity: 8 }],
    },
    {
      id: targetId,
      sector_key: 'borealis',
      label: 'Borealis Reach',
      map_x: 55,
      map_y: 30,
      resource_yield: 280,
      base_level: 0,
      owner_player_id: null,
      neighbor_ids: [homeId],
      forces: [],
    },
  ],
  completed_research: [],
  pending_orders: [],
  events: [
    {
      id: 1,
      turn_number: 1,
      sequence: 1,
      event_type: 'campaign',
      message: 'The campaign began.',
      payload: {},
      created_at: '2026-08-27T12:00:00Z',
    },
  ],
  unit_catalog: [
    { key: 'rifleman', faction: 'aegis', label: 'Rifle Company', cost: 220, power: 13 },
    { key: 'tank', faction: 'aegis', label: 'Armored Lance', cost: 850, power: 44 },
  ],
  research_catalog: [
    {
      key: 'aegis_composite_plating',
      faction: 'aegis',
      label: 'Composite Plating',
      description: '+10% strategic defense.',
      cost: 700,
    },
  ],
})

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(listCampaigns).mockResolvedValue([])
})

describe('CampaignHub', () => {
  it('creates a campaign from the lobby and opens its persistent sector board', async () => {
    const user = userEvent.setup()
    vi.mocked(createCampaign).mockResolvedValue(campaignState('waiting'))

    render(<CampaignHub onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'ESTABLISH CAMPAIGN' }))

    expect(createCampaign).toHaveBeenCalledWith({
      name: 'Fractured Meridian',
      commander_name: 'Commander',
      faction: 'aegis',
      max_players: 2,
    })
    expect(await screen.findByText('Awaiting commanders')).toBeInTheDocument()
    expect(screen.getAllByText('IRON42')).toHaveLength(2)
  })

  it('resumes the saved commander and queues an adjacent movement order', async () => {
    const user = userEvent.setup()
    const state = campaignState()
    window.localStorage.setItem(
      'iron-frontier-campaign-session',
      JSON.stringify({ campaignId, playerToken }),
    )
    vi.mocked(getCampaign).mockResolvedValue(state)
    vi.mocked(submitCampaignOrder).mockResolvedValue(state)

    render(<CampaignHub onBack={vi.fn()} />)
    await screen.findByText('IRON42')
    await user.click(screen.getByRole('button', { name: /Borealis Reach/i }))
    await user.click(screen.getByRole('button', { name: 'QUEUE MOVE' }))

    await waitFor(() => {
      expect(submitCampaignOrder).toHaveBeenCalledWith(
        campaignId,
        playerToken,
        {
          order_type: 'move',
          source_sector_id: homeId,
          target_sector_id: targetId,
          unit_kind: 'rifleman',
          quantity: 1,
        },
      )
    })
  })
})
