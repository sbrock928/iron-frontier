import { useGameStore } from '../store/gameStore'

export function StatusBar() {
  const { status, message } = useGameStore()
  return (
    <div className={`statusbar status-${status}`}>
      <span className="status-dot" />
      <strong>{status === 'playing' ? 'COMMAND' : status.toUpperCase()}</strong>
      <span>{message}</span>
    </div>
  )
}
