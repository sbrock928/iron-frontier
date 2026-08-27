import { useMemo, useState } from 'react'
import { saveGame } from '../api/client'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

export function CommandPanel() {
  const state = useGameStore()
  const [saveLabel, setSaveLabel] = useState('Quick Save')
  const kinds = useMemo(() => new Set(state.selected.map((item) => item.kind)), [state.selected])

  const quickSave = async () => {
    if (!state.mission) return
    setSaveLabel('Saving…')
    try {
      await saveGame('quick', state.mission.id, {
        faction: state.faction,
        credits: state.credits,
        power_used: state.powerUsed,
        power_capacity: state.powerCapacity,
        status: state.status,
        saved_at: new Date().toISOString(),
      })
      setSaveLabel('Saved')
    } catch {
      setSaveLabel('Save failed')
    }
    window.setTimeout(() => setSaveLabel('Quick Save'), 1400)
  }

  const isAegis = state.faction === 'aegis'
  return (
    <section className="sidebar-section command-panel">
      <div className="section-title"><span>Command</span><small>{isAegis ? 'AEGIS TACTICS' : 'BROOD INSTINCTS'}</small></div>
      <div className="ability-grid">
        {isAegis ? (
          <>
            <button disabled={!kinds.has('rifleman') && !kinds.has('marauder')} onClick={() => gameBus.emit('activate-ability', 'stim')}>Stim Burst</button>
            <button disabled={!kinds.has('artillery')} onClick={() => gameBus.emit('activate-ability', 'siege')}>Toggle Siege</button>
            <button disabled={!kinds.has('gunship')} onClick={() => gameBus.emit('activate-ability', 'afterburners')}>Afterburners</button>
          </>
        ) : (
          <>
            <button disabled={!kinds.has('skitter') && !kinds.has('brute')} onClick={() => gameBus.emit('activate-ability', 'frenzy')}>Brood Frenzy</button>
            <button disabled={!kinds.has('spitter')} onClick={() => gameBus.emit('activate-ability', 'acid_burst')}>Acid Surge</button>
            <button disabled={!kinds.has('wraith')} onClick={() => gameBus.emit('activate-ability', 'phase')}>Phase Veil</button>
          </>
        )}
        <button onClick={() => gameBus.emit('center-selected', undefined)}>Center</button>
        <button onClick={() => gameBus.emit('stop-selected', undefined)}>Stop</button>
        <button onClick={() => void quickSave()}>{saveLabel}</button>
      </div>
      <div className="command-footer"><button onClick={() => gameBus.emit('restart-game', undefined)}>Restart Mission</button></div>
    </section>
  )
}
