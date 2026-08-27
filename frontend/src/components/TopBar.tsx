import { useState } from 'react'
import { saveGame } from '../api/client'
import { FACTION_DATA } from '../game/config'
import { useGameStore } from '../store/gameStore'

export function TopBar() {
  const { mission, credits, income, supplyUsed, supplyCap, faction, enemyFaction, status, difficulty } = useGameStore()
  const [saveLabel, setSaveLabel] = useState('Save')

  const supplyBlocked = supplyCap > 0 && supplyUsed >= supplyCap
  const supplyTooltip = supplyBlocked
    ? `Supply capped at ${supplyCap} — build more ${FACTION_DATA[faction].buildingLabels.power}s.`
    : 'Supply committed out of the total currently available.'
  const friendly = FACTION_DATA[faction]
  const hostile = FACTION_DATA[enemyFaction]

  const quickSave = async () => {
    if (!mission) return
    setSaveLabel('Saving…')
    try {
      await saveGame('quick', mission.id, {
        faction,
        enemy_faction: enemyFaction,
        difficulty,
        credits,
        supply_used: supplyUsed,
        supply_cap: supplyCap,
        status,
        saved_at: new Date().toISOString(),
      })
      setSaveLabel('Saved')
    } catch {
      setSaveLabel('Save failed')
    }
    window.setTimeout(() => setSaveLabel('Save'), 1400)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <img className="faction-emblem" src={friendly.emblem} alt="" aria-hidden="true" />
        <div>
          <strong>IRON FRONTIER</strong>
          <small>{friendly.name.toUpperCase()} // {mission?.name ?? 'Loading mission'}</small>
        </div>
      </div>

      <div className="hostile-tag" aria-label={`Hostile faction ${hostile.name}`}>
        <span>HOSTILE</span>
        <img src={hostile.emblem} alt="" aria-hidden="true" />
        <strong>{hostile.name.toUpperCase()}</strong>
      </div>

      <div className="resource-strip">
        <div>
          <span>Credits</span>
          <strong>${credits.toLocaleString()}</strong>
        </div>
        <div>
          <span>Income</span>
          <strong>${income.toLocaleString()}/min</strong>
        </div>
        <div
          className={supplyBlocked ? 'danger' : ''}
          data-tooltip={supplyTooltip}
          title={supplyTooltip}
        >
          <span>Supply</span>
          <strong>{supplyUsed} / {supplyCap}</strong>
        </div>
        <button
          className="topbar-save"
          data-tooltip="Quick-save the current matchup and economy snapshot.\nMid-battle unit positions are not persisted yet."
          title="Quick-save the current matchup and economy snapshot. Mid-battle unit positions are not persisted yet."
          onClick={() => void quickSave()}
        >{saveLabel}</button>
      </div>
    </header>
  )
}
