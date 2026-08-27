import Phaser from 'phaser'
import type { Faction, Mission } from '../types'
import { BattleScene } from './scenes/BattleScene'

export function createGame(parent: HTMLElement, mission: Mission, faction: Faction): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#101713',
    scene: [new BattleScene(mission, faction)],
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  })
}
