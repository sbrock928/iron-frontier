import type {
  CampaignCreateInput,
  CampaignJoinInput,
  CampaignOrderInput,
  CampaignState,
  CampaignSummary,
  Mission,
  SaveGame,
  SaveGamePayload,
} from '../types'

const API_ROOT = '/api/v1'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const body = await response.text()
    let detail = body
    try {
      const parsed = JSON.parse(body) as { detail?: string }
      detail = parsed.detail ?? body
    } catch {
      // Keep non-JSON proxy and server errors intact.
    }
    throw new Error(detail || `${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

export const getMissions = () => api<Mission[]>('/missions')

export const listSaves = () => api<SaveGame[]>('/saves')

export async function saveGame(slot: string, missionId: string, payload: SaveGamePayload): Promise<void> {
  await api(`/saves/${encodeURIComponent(slot)}`, {
    method: 'PUT',
    body: JSON.stringify({ mission_id: missionId, payload }),
  })
}

export const listCampaigns = () => api<CampaignSummary[]>('/campaigns')

export const createCampaign = (command: CampaignCreateInput) => api<CampaignState>('/campaigns', {
  method: 'POST',
  body: JSON.stringify(command),
})

export const joinCampaign = (command: CampaignJoinInput) => api<CampaignState>('/campaigns/join', {
  method: 'POST',
  body: JSON.stringify(command),
})

const campaignHeaders = (playerToken: string) => ({ 'X-Campaign-Token': playerToken })

export const getCampaign = (campaignId: string, playerToken: string) =>
  api<CampaignState>(`/campaigns/${encodeURIComponent(campaignId)}`, {
    headers: campaignHeaders(playerToken),
  })

export const submitCampaignOrder = (campaignId: string, playerToken: string, command: CampaignOrderInput) =>
  api<CampaignState>(`/campaigns/${encodeURIComponent(campaignId)}/orders`, {
    method: 'POST',
    headers: campaignHeaders(playerToken),
    body: JSON.stringify(command),
  })

export const cancelCampaignOrder = (campaignId: string, orderId: string, playerToken: string) =>
  api<CampaignState>(`/campaigns/${encodeURIComponent(campaignId)}/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers: campaignHeaders(playerToken),
  })

export const setCampaignReady = (campaignId: string, playerToken: string, ready: boolean) =>
  api<CampaignState>(`/campaigns/${encodeURIComponent(campaignId)}/ready`, {
    method: 'PUT',
    headers: campaignHeaders(playerToken),
    body: JSON.stringify({ ready }),
  })
