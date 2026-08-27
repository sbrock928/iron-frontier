import type { Mission, SaveGame, SaveGamePayload } from '../types'

const API_ROOT = '/api/v1'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${body}`)
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
