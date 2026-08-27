import { useCallback, useEffect, useRef, useState } from 'react'
import { gameBus } from '../game/events/gameBus'
import type { MinimapSnapshot } from '../types'

/** Colours for each blip category, matching the in-world selection colours. */
const BLIP_COLORS: Record<string, string> = {
  player: '#8dffb4',
  enemy: '#ff7d7d',
  neutral: '#e3c877',
}

/**
 * The minimap, drawn to a DOM canvas from snapshots the scene pushes over the
 * bus. It deliberately does not read game state directly: Phaser stays the sole
 * owner of the simulation, and the HUD only ever renders what it is handed.
 *
 * Left-click and left-drag recentre the camera; right-click issues an order at
 * that point, so forces can be redirected across the map without scrolling.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const snapshotRef = useRef<MinimapSnapshot | null>(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const snapshot = snapshotRef.current
    if (!canvas || !snapshot) return
    const context = canvas.getContext('2d')
    if (!context) return

    // Match the backing store to the element's real pixel size so the map stays
    // sharp on HiDPI displays and correct if the console is resized.
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width * ratio))
    const height = Math.max(1, Math.round(rect.height * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#0a1310'
    context.fillRect(0, 0, width, height)

    const scaleX = width / snapshot.worldWidth
    const scaleY = height / snapshot.worldHeight

    for (const blip of snapshot.blips) {
      context.fillStyle = BLIP_COLORS[blip.team] ?? '#ffffff'
      const size = (blip.structure ? 4 : 2.5) * ratio
      const x = blip.x * scaleX
      const y = blip.y * scaleY
      if (blip.structure) context.fillRect(x - size / 2, y - size / 2, size, size)
      else {
        context.beginPath()
        context.arc(x, y, size / 2, 0, Math.PI * 2)
        context.fill()
      }
    }

    context.strokeStyle = '#e8fff4cc'
    context.lineWidth = Math.max(1, ratio)
    context.strokeRect(
      snapshot.view.x * scaleX,
      snapshot.view.y * scaleY,
      snapshot.view.width * scaleX,
      snapshot.view.height * scaleY,
    )
  }, [])

  useEffect(() => {
    return gameBus.on('minimap-snapshot', (snapshot) => {
      snapshotRef.current = snapshot
      setHasSnapshot(true)
      draw()
    })
  }, [draw])

  /** Converts a pointer event to normalised 0-1 map coordinates. */
  const toMapPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      u: (event.clientX - rect.left) / rect.width,
      v: (event.clientY - rect.top) / rect.height,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const point = toMapPoint(event)
    if (event.button === 2) {
      gameBus.emit('minimap-command', { ...point, action: 'command' })
      return
    }
    if (event.button !== 0) return
    // Capture so a drag that leaves the minimap keeps scrolling the camera
    // instead of stopping at the edge.
    event.currentTarget.setPointerCapture(event.pointerId)
    gameBus.emit('minimap-command', { ...point, action: 'move' })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    gameBus.emit('minimap-command', { ...toMapPoint(event), action: 'move' })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="minimap-panel">
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        aria-label="Tactical minimap"
        title="Left-click or drag to move the camera. Right-click to issue a move order."
        role="img"
      />
      {!hasSnapshot && <span className="minimap-placeholder">SCANNING…</span>}
    </div>
  )
}
