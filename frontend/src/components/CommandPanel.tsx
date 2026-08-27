import { useMemo, useState } from 'react'
import { saveGame } from '../api/client'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

export function CommandPanel({ onExitToMenu }: { onExitToMenu: () => void }) {
  const state = useGameStore()
  const [saveLabel, setSaveLabel] = useState('Quick Save')
  const kinds = useMemo(() => new Set(state.selected.map((item) => item.kind)), [state.selected])

  const quickSave = async () => {
    if (!state.mission) return
    setSaveLabel('Saving…')
    try {
      await saveGame('quick', state.mission.id, {
        faction: state.faction,
        enemy_faction: state.enemyFaction,
        difficulty: state.difficulty,
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

  return (
    <section className="sidebar-section command-panel">
      <div className="section-title"><span>Command</span><small>{state.faction.toUpperCase()} TACTICS</small></div>
      <div className="ability-grid">
        {state.faction === 'aegis' && <>
          <button disabled={!kinds.has('rifleman') && !kinds.has('marauder')} onClick={() => gameBus.emit('activate-ability', 'stim')}>Stim Burst</button>
          <button disabled={!kinds.has('artillery')} onClick={() => gameBus.emit('activate-ability', 'siege')}>Toggle Siege</button>
          <button disabled={!kinds.has('gunship') && !kinds.has('interceptor')} onClick={() => gameBus.emit('activate-ability', 'afterburners')}>Afterburners</button>
        </>}
        {state.faction === 'noctis' && <>
          <button disabled={!kinds.has('skitter') && !kinds.has('brute') && !kinds.has('ravager')} onClick={() => gameBus.emit('activate-ability', 'frenzy')}>Brood Frenzy</button>
          <button disabled={!kinds.has('spitter') && !kinds.has('broodcaster')} onClick={() => gameBus.emit('activate-ability', 'acid_burst')}>Acid Surge</button>
          <button disabled={!kinds.has('wraith') && !kinds.has('devourer')} onClick={() => gameBus.emit('activate-ability', 'phase')}>Phase Veil</button>
        </>}
        {state.faction === 'veyra' && <>
          <button disabled={state.selected.length === 0} onClick={() => gameBus.emit('activate-ability', 'shield_surge')}>Shield Surge</button>
          <button disabled={!kinds.has('lancer') && !kinds.has('adept') && !kinds.has('seer')} onClick={() => gameBus.emit('activate-ability', 'phase_stride')}>Phase Stride</button>
          <button disabled={!kinds.has('sentinel') && !kinds.has('colossus') && !kinds.has('seraph') && !kinds.has('arbiter')} onClick={() => gameBus.emit('activate-ability', 'overcharge')}>Overcharge</button>
        </>}
        <button className={state.attackMoveArmed ? 'command-active' : ''} onClick={() => gameBus.emit('arm-attack-move', undefined)}>Attack Move</button>
        <button onClick={() => gameBus.emit('center-selected', undefined)}>Center</button>
        <button onClick={() => gameBus.emit('stop-selected', undefined)}>Stop</button>
        <button onClick={() => void quickSave()}>{saveLabel}</button>
      </div>
      <p className="muted command-hint">Shift+A: attack-move · Ctrl+1–9: assign group · 1–9: recall · right-click selected production building: set rally point.</p>
      <div className="command-footer two"><button onClick={() => gameBus.emit('restart-game', undefined)}>Restart</button><button onClick={onExitToMenu}>Main Menu</button></div>
    </section>
  )
}
