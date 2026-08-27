import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type Phaser from 'phaser'
import type { Faction, Mission } from '../types'
import { createGame } from '../game/Game'
import { gameBus } from '../game/events/gameBus'
import { useGameStore } from '../store/gameStore'

type NormalizedPoint = { u: number; v: number }

function getNormalizedPoint(event: ReactPointerEvent<HTMLDivElement>): NormalizedPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  const u = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0
  const v = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0
  return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) }
}

export function GameCanvas({ mission, faction }: { mission: Mission; faction: Faction }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const placementKind = useGameStore((state) => state.placementKind)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    gameRef.current = createGame(host, mission, faction)
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [mission, faction])

  return (
    <div className="game-stage">
      <div className="game-canvas" ref={hostRef} aria-label="Iron Frontier battlefield" />
      <div className="camera-help" aria-hidden="true">EDGE SCROLL · WASD/ARROWS · WHEEL ZOOM · CLICK MINIMAP</div>
      {placementKind && (
        <div
          className="placement-input-layer"
          aria-label={`Place ${placementKind}`}
          onPointerEnter={(event) => gameBus.emit('placement-pointer-move', getNormalizedPoint(event))}
          onPointerMove={(event) => gameBus.emit('placement-pointer-move', getNormalizedPoint(event))}
          onPointerDown={(event) => {
            event.preventDefault()
            if (event.button === 2) {
              gameBus.emit('cancel-placement', undefined)
              return
            }
            if (event.button === 0) gameBus.emit('placement-pointer-down', getNormalizedPoint(event))
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span>PLACE STRUCTURE</span>
        </div>
      )}
    </div>
  )
}
