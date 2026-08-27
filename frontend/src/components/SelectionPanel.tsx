import { PORTRAITS, UI_ICONS } from '../game/config'
import { useGameStore } from '../store/gameStore'

export function SelectionPanel() {
  const selected = useGameStore((state) => state.selected)
  return (
    <section className="sidebar-section selection-panel">
      <div className="section-title"><span>Selection</span><small>{selected.length} ACTIVE</small></div>
      {selected.length === 0 ? <p className="muted">Select a unit or structure on the battlefield.</p> : selected.slice(0, 6).map((entity) => {
        const percent = Math.max(0, Math.round((entity.hp / entity.maxHp) * 100))
        const shieldPercent = entity.maxShield ? Math.max(0, Math.round(((entity.shield ?? 0) / entity.maxShield) * 100)) : null
        const portrait = entity.kind in PORTRAITS ? PORTRAITS[entity.kind as keyof typeof PORTRAITS] : UI_ICONS[entity.kind]
        return <div className="selected-card" key={entity.id}>
          <div className="selected-head">
            <img src={portrait} alt="" aria-hidden="true" />
            <div className="selected-meta">
              <div><strong>{entity.label}</strong><span>{entity.hp} / {entity.maxHp}</span></div>
              {shieldPercent !== null && <div className="shield-track"><i style={{ width: `${shieldPercent}%` }} /></div>}
              <div className="health-track"><i style={{ width: `${percent}%` }} /></div>
            </div>
          </div>
        </div>
      })}
      {selected.length > 6 && <p className="muted">+ {selected.length - 6} more units</p>}
    </section>
  )
}
