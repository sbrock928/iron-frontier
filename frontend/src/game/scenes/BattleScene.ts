import Phaser from 'phaser'
import type { BuildingKind, Difficulty, Faction, Mission, UnitKind, UpgradeKey } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { BUILDING_STATS, DIFFICULTY_DATA, FACTION_DATA, UNIT_STATS, UPGRADE_DEFS, buildingAtlasFrame, buildingLabel, isUnitUnlocked } from '../config'
import { Building } from '../entities/Building'
import type { Damageable } from '../entities/Damageable'
import { ResourcePatch } from '../entities/ResourcePatch'
import { Unit } from '../entities/Unit'
import { gameBus } from '../events/gameBus'
import { CombatSystem } from '../systems/CombatSystem'
import { EnemyAI } from '../systems/EnemyAI'
import { FogOfWarSystem } from '../systems/FogOfWarSystem'
import { HarvestingSystem } from '../systems/HarvestingSystem'
import { Pathfinder } from '../systems/Pathfinder'
import { generateTerrainFeatures } from '../systems/TerrainGenerator'
import { SupportSystem } from '../systems/SupportSystem'
import { ProductionSystem } from '../systems/ProductionSystem'
import { ResearchSystem } from '../systems/ResearchSystem'
import { LocalAvoidanceSystem } from '../systems/LocalAvoidanceSystem'

export class BattleScene extends Phaser.Scene {
  private readonly mission: Mission
  private readonly playerFaction: Faction
  private readonly enemyFaction: Faction
  private readonly difficulty: Difficulty
  private units: Unit[] = []
  private buildings: Building[] = []
  private patches: ResourcePatch[] = []
  private selectedUnits: Unit[] = []
  private selectedBuilding: Building | null = null
  private combat!: CombatSystem
  private harvesting!: HarvestingSystem
  private support!: SupportSystem
  private production!: ProductionSystem
  private research!: ResearchSystem
  private avoidance!: LocalAvoidanceSystem
  private pathfinder!: Pathfinder
  private enemyAI!: EnemyAI
  private fog!: FogOfWarSystem
  private unitCounter = 0
  private buildingCounter = 0
  private credits = 0
  private enemyCredits = 3600
  private enemyBuildAttempt = 0
  private readonly completedUpgrades = new Set<UpgradeKey>()
  private readonly enemyCompletedUpgrades = new Set<UpgradeKey>()
  private attackMoveArmed = false
  private readonly controlGroups = new Map<number, string[]>()
  private readonly lastGroupRecallAt = new Map<number, number>()
  private dragStart: Phaser.Math.Vector2 | null = null
  private selectionBox: Phaser.GameObjects.Rectangle | null = null
  private placementKind: BuildingKind | null = null
  private placementGhost: Phaser.GameObjects.Image | null = null
  private nextStoreSyncAt = 0
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {}
  private unsubscribers: Array<() => void> = []
  private pointerInsideGame = false
  private edgePanX = 0
  private edgePanY = 0
  private readonly edgePanMargin = 34
  private readonly minimapRect = new Phaser.Geom.Rectangle(16, 16, 188, 110)
  private audioStarted = false
  private ambientSound: Phaser.Sound.BaseSound | null = null

  constructor(mission: Mission, faction: Faction, enemyFaction: Faction, difficulty: Difficulty) {
    super({ key: 'BattleScene' })
    this.mission = mission
    this.playerFaction = faction
    this.enemyFaction = enemyFaction
    this.difficulty = difficulty
  }

  preload(): void {
    this.load.setPath('/')
    this.load.atlas('units', 'assets/atlas/units.png', 'assets/atlas/units.json')
    this.load.atlas('units-normal', 'assets/atlas/units-normal.png', 'assets/atlas/units-normal.json')
    this.load.atlas('buildings', 'assets/atlas/buildings.png', 'assets/atlas/buildings.json')
    this.load.atlas('buildings-normal', 'assets/atlas/buildings-normal.png', 'assets/atlas/buildings-normal.json')
    this.load.atlas('terrain', 'assets/atlas/terrain.png', 'assets/atlas/terrain.json')
    this.load.atlas('effects', 'assets/atlas/effects.png', 'assets/atlas/effects.json')
    this.load.image('ore-patch', 'assets/effects/ore_patch.png')

    this.load.image('wreck-infantry', 'assets/wrecks/infantry.png')
    this.load.image('wreck-vehicle', 'assets/wrecks/vehicle.png')
    this.load.image('wreck-building', 'assets/wrecks/building.png')
    this.load.audio('sfx-fire', 'assets/audio/fire.wav')
    this.load.audio('sfx-explosion', 'assets/audio/explosion.wav')
    this.load.audio('sfx-select', 'assets/audio/select.wav')
    this.load.audio('sfx-confirm', 'assets/audio/confirm.wav')
    this.load.audio('music-ambient', 'assets/audio/ambient.wav')
  }

  create(): void {
    this.disposeBridge()
    const definition = this.mission.definition
    this.units = []
    this.buildings = []
    this.patches = []
    this.selectedUnits = []
    this.selectedBuilding = null
    this.unitCounter = 0
    this.buildingCounter = 0
    this.dragStart = null
    this.selectionBox = null
    this.placementKind = null
    this.placementGhost = null
    this.pointerInsideGame = false
    this.edgePanX = 0
    this.edgePanY = 0
    this.audioStarted = false
    this.completedUpgrades.clear()
    this.enemyCompletedUpgrades.clear()
    this.controlGroups.clear()
    this.attackMoveArmed = false
    this.enemyCredits = DIFFICULTY_DATA[this.difficulty].aiCredits
    this.enemyBuildAttempt = 0
    this.ambientSound?.stop()
    this.ambientSound = null
    useGameStore.getState().setPlacementKind(null)
    useGameStore.getState().setCompletedUpgrades([])
    useGameStore.getState().setProductionQueues([])
    useGameStore.getState().setResearchQueues([])
    useGameStore.getState().setAttackMoveArmed(false)
    this.credits = definition.starting_credits
    this.cameras.main.setBounds(0, 0, definition.world_width, definition.world_height)
    this.cameras.main.centerOn(definition.player_spawn.x + 250, definition.player_spawn.y)
    this.input.mouse?.disableContextMenu()

    this.setupLighting()
    this.pathfinder = new Pathfinder()
    this.drawTerrain()
    this.combat = new CombatSystem(this)
    this.harvesting = new HarvestingSystem()
    this.support = new SupportSystem(this)
    this.production = new ProductionSystem()
    this.research = new ResearchSystem()
    this.avoidance = new LocalAvoidanceSystem()
    this.fog = new FogOfWarSystem(this, definition.world_width, definition.world_height)
    this.spawnStartingWorld()
    this.fog.update(0, this.units, this.buildings, true)
    this.updateEnemyFogVisibility()
    this.enemyAI = new EnemyAI(
      this,
      definition.enemy.attack_interval_seconds * DIFFICULTY_DATA[this.difficulty].aggression,
      this.enemyFaction,
      (kind) => this.queueEnemyUnit(kind),
      (kind) => this.tryEnemyBuild(kind),
    )
    this.configureInput()
    this.configureKeyboard()
    this.configureBridge()
    this.createMinimap()
    this.syncStore(true)
    useGameStore.getState().setStatus('playing', `${FACTION_DATA[this.playerFaction].name} command online. Destroy the ${buildingLabel('conyard', this.enemyFaction)} and eliminate hostile resistance.`)
  }

  update(time: number, delta: number): void {
    if (useGameStore.getState().status !== 'playing') return
    this.panCamera(delta)
    for (const unit of this.units) unit.updateMovement(delta)
    for (const building of this.buildings) building.updateShield(delta, time)
    this.avoidance.update(this.units)
    this.harvesting.update(delta, this.units, this.buildings, this.patches, (team, amount) => {
      if (team === 'player') this.credits += amount
      else this.enemyCredits += amount
    }, (team) => this.harvestMultiplier(team))
    this.production.update(delta, (team) => this.productionSpeedMultiplier(team), (completion) => this.completeProduction(completion.building, completion.kind, completion.team))
    this.research.update(delta, (team) => this.productionSpeedMultiplier(team), (upgrade, team) => this.completeResearch(upgrade, team))
    this.support.update(time, this.units, (team, kind) => this.supportMultiplier(team, kind))
    this.fog.update(time, this.units, this.buildings)
    this.updateEnemyFogVisibility()
    this.combat.update(
      time,
      delta,
      this.units,
      this.buildings,
      (team, target) => team !== 'player' || this.fog.isVisible(target.x, target.y),
    )
    this.resumeAttackMoves()
    this.enemyAI.update(time, this.units, this.buildings)
    this.units = this.units.filter((item) => item.alive)
    const buildingsBefore = this.buildings.length
    this.buildings = this.buildings.filter((item) => item.alive)
    if (this.buildings.length !== buildingsBefore) this.pathfinder.invalidate()
    this.selectedUnits = this.selectedUnits.filter((item) => item.alive)
    if (this.selectedBuilding && !this.selectedBuilding.alive) this.selectedBuilding = null
    this.checkEndState()
    if (time >= this.nextStoreSyncAt) {
      this.nextStoreSyncAt = time + 180
      this.syncStore(false)
    }
  }

  /**
   * Enables Phaser's Light2D pipeline with a dim ambient colour matching the
   * game's dark, overcast aesthetic, and binds each colour atlas to its
   * paired normal-map atlas so lit units/buildings pick up per-pixel bump
   * shading from dynamic lights (muzzle flashes, explosions). Atlases with no
   * authored normal map (terrain, effects) fall back to Phaser's built-in
   * flat normal, which still lets them receive flat diffuse lighting.
   */
  private setupLighting(): void {
    this.lights.enable()
    this.lights.setAmbientColor(0x4a5246)

    const bindNormalMap = (colorKey: string, normalKey: string) => {
      if (!this.textures.exists(colorKey) || !this.textures.exists(normalKey)) return
      const normalSource = this.textures.get(normalKey).source[0]
      if (!normalSource) return
      this.textures.get(colorKey).setDataSource(normalSource.source)
    }
    bindNormalMap('units', 'units-normal')
    bindNormalMap('buildings', 'buildings-normal')
  }

  private drawTerrain(): void {
    const { world_width: width, world_height: height } = this.mission.definition
    this.add.tileSprite(width / 2, height / 2, width, height, 'terrain', 'ground_base').setLighting(true).setDepth(0)

    const avoidZones = [
      { x: this.mission.definition.player_spawn.x, y: this.mission.definition.player_spawn.y, radius: 300 },
      { x: this.mission.definition.enemy_spawn.x, y: this.mission.definition.enemy_spawn.y, radius: 300 },
      ...this.mission.definition.ore_fields.map((point) => ({ x: point.x, y: point.y, radius: 130 })),
    ]
    const features = generateTerrainFeatures(this.mission.id, width, height, avoidZones)
    this.pathfinder.setTerrainObstacles(features.obstacles, width, height)
    for (const decoration of features.decorations) {
      const baseSize = decoration.frame.startsWith('ground_') ? 512 : decoration.blocking ? 512 : 256
      this.add.image(decoration.x, decoration.y, 'terrain', decoration.frame)
        .setDisplaySize(baseSize * decoration.scale, baseSize * decoration.scale)
        .setAlpha(decoration.alpha)
        .setDepth(decoration.frame.startsWith('ground_') ? 0.5 : decoration.blocking ? 4 : 3.5)
    }

    const grime = this.add.graphics().setDepth(1)
    for (let index = 0; index < 36; index += 1) {
      const x = 90 + ((index * 317) % (width - 180))
      const y = 80 + ((index * 197) % (height - 160))
      grime.fillStyle(index % 2 === 0 ? 0x0a160f : 0x25372d, index % 2 === 0 ? 0.18 : 0.16)
      grime.fillCircle(x, y, 14 + (index % 5) * 5)
    }
    const grid = this.add.graphics().setDepth(2)
    grid.lineStyle(1, 0x385044, 0.2)
    for (let x = 0; x <= width; x += 96) grid.lineBetween(x, 0, x, height)
    for (let y = 0; y <= height; y += 96) grid.lineBetween(0, y, width, y)
    const bands = this.add.graphics().setDepth(3)
    bands.fillGradientStyle(0x050a07, 0x050a07, 0x0f1813, 0x0f1813, 0.28, 0.1, 0.1, 0.28)
    bands.fillRect(0, 0, width, height)
  }

  private spawnStartingWorld(): void {
    const player = this.mission.definition.player_spawn
    const enemy = this.mission.definition.enemy_spawn

    this.spawnBuilding('conyard', 'player', player.x, player.y)
    this.spawnBuilding('power', 'player', player.x - 150, player.y - 140)
    this.spawnBuilding('refinery', 'player', player.x + 165, player.y - 130)
    this.spawnBuilding('barracks', 'player', player.x - 165, player.y + 145)
    this.spawnBuilding('warfactory', 'player', player.x + 5, player.y + 220)

    const playerStarts = FACTION_DATA[this.playerFaction].startingUnits
    playerStarts.forEach((kind, index) => {
      const offsets = [
        { x: 245, y: -35 },
        { x: 35, y: 140 },
        { x: 85, y: 155 },
        { x: 140, y: 125 },
        { x: 185, y: 210 },
      ]
      const offset = offsets[index] ?? { x: 180 + index * 26, y: 170 + (index % 2) * 42 }
      this.spawnUnit(kind, 'player', player.x + offset.x, player.y + offset.y)
    })


    this.spawnBuilding('conyard', 'enemy', enemy.x, enemy.y)
    this.spawnBuilding('power', 'enemy', enemy.x + 160, enemy.y - 140)
    this.spawnBuilding('refinery', 'enemy', enemy.x + 20, enemy.y - 175)
    this.spawnBuilding('warfactory', 'enemy', enemy.x - 165, enemy.y + 145)
    this.spawnBuilding('barracks', 'enemy', enemy.x + 150, enemy.y + 145)
    this.spawnBuilding('turret', 'enemy', enemy.x - 200, enemy.y - 120)
    if (this.mission.id !== 'mission_01') this.spawnBuilding('turret', 'enemy', enemy.x + 210, enemy.y - 110)

    this.spawnUnit(FACTION_DATA[this.enemyFaction].worker, 'enemy', enemy.x - 40, enemy.y - 210)

    const enemyWorker = FACTION_DATA[this.enemyFaction].worker
    const enemyPattern = FACTION_DATA[this.enemyFaction].startingUnits.filter((kind) => kind !== enemyWorker)
    const difficultyUnitScale = this.difficulty === 'easy' ? 0.7 : this.difficulty === 'hard' ? 1.25 : this.difficulty === 'brutal' ? 1.5 : 1
    const enemyStartingCount = Math.max(2, Math.round(this.mission.definition.enemy.starting_units * difficultyUnitScale))
    for (let index = 0; index < enemyStartingCount; index += 1) {
      const kind = enemyPattern[index % enemyPattern.length] ?? enemyPattern[0] ?? enemyWorker
      this.spawnUnit(kind, 'enemy', enemy.x - 260, enemy.y - 80 + index * 44)
    }
    this.patches = this.mission.definition.ore_fields.map((point) => new ResourcePatch(this, point.x, point.y))
  }

  private configureInput(): void {
    this.input.on('gameover', (pointer: Phaser.Input.Pointer) => {
      this.pointerInsideGame = true
      this.updateEdgePan(pointer)
    })
    this.input.on('gameout', () => {
      this.pointerInsideGame = false
      this.edgePanX = 0
      this.edgePanY = 0
      // Avoid leaving a drag-selection rectangle behind if the pointer is
      // released outside the Phaser canvas.
      if (this.selectionBox) {
        this.selectionBox.destroy()
        this.selectionBox = null
        this.dragStart = null
      }
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startAudio()
      if (pointer.button === 0 && this.handleMinimapClick(pointer.x, pointer.y)) return
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      if (pointer.button === 2) {
        if (this.placementKind) {
          this.cancelPlacement()
          return
        }
        this.issueCommand(world.x, world.y)
        return
      }
      if (pointer.button !== 0) return
      if (this.placementKind) {
        this.tryPlaceBuilding(world.x, world.y)
        return
      }
      this.dragStart = new Phaser.Math.Vector2(world.x, world.y)
      this.selectionBox = this.add.rectangle(world.x, world.y, 1, 1, 0x86c99a, 0.12).setStrokeStyle(1, 0xb9f5c7)
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerInsideGame = true
      this.updateEdgePan(pointer)
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      if (this.placementGhost && this.placementKind) this.updatePlacementGhost(world.x, world.y)
      if (!this.dragStart || !this.selectionBox || !pointer.isDown) return
      const width = world.x - this.dragStart.x
      const height = world.y - this.dragStart.y
      this.selectionBox.setPosition(this.dragStart.x + width / 2, this.dragStart.y + height / 2)
      this.selectionBox.setSize(Math.abs(width), Math.abs(height))
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || !this.dragStart || !this.selectionBox) return
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      const distance = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, world.x, world.y)
      if (distance < 8) this.selectAt(world.x, world.y, pointer.event.shiftKey)
      else this.selectBox(this.selectionBox.getBounds(), pointer.event.shiftKey)
      this.selectionBox.destroy()
      this.selectionBox = null
      this.dragStart = null
    })

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const camera = this.cameras.main
      camera.setZoom(Phaser.Math.Clamp(camera.zoom - dy * 0.0007, 0.62, 1.35))
    })
  }

  private configureKeyboard(): void {
    if (!this.input.keyboard) return
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      ESC: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      SHIFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    }
    this.keys.ESC?.on('down', () => {
      this.cancelPlacement()
      this.attackMoveArmed = false
      useGameStore.getState().setAttackMoveArmed(false)
    })
    this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      if (event.shiftKey && event.code === 'KeyA') {
        event.preventDefault()
        this.armAttackMove()
        return
      }
      if (!/^Digit[1-9]$/.test(event.code)) return
      const group = Number(event.code.replace('Digit', ''))
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        this.assignControlGroup(group)
      } else {
        this.recallControlGroup(group)
      }
    })
  }

  private configureBridge(): void {
    this.unsubscribers.push(gameBus.on('build-structure', (kind) => this.beginPlacement(kind)))
    this.unsubscribers.push(gameBus.on('produce-unit', (kind) => this.queueUnit(kind)))
    this.unsubscribers.push(gameBus.on('research-upgrade', (upgrade) => this.queueResearch(upgrade)))
    this.unsubscribers.push(gameBus.on('cancel-production', (buildingId) => this.cancelProduction(buildingId)))
    this.unsubscribers.push(gameBus.on('restart-game', () => this.scene.restart()))
    this.unsubscribers.push(gameBus.on('placement-pointer-move', (point) => this.movePlacementFromScreen(point.u, point.v)))
    this.unsubscribers.push(gameBus.on('placement-pointer-down', (point) => this.placeFromScreen(point.u, point.v)))
    this.unsubscribers.push(gameBus.on('cancel-placement', () => this.cancelPlacement()))
    this.unsubscribers.push(gameBus.on('stop-selected', () => this.stopSelected()))
    this.unsubscribers.push(gameBus.on('center-selected', () => this.centerSelected()))
    this.unsubscribers.push(gameBus.on('arm-attack-move', () => this.armAttackMove()))
    this.unsubscribers.push(gameBus.on('activate-ability', (ability) => this.activateAbility(ability)))

    const dispose = () => this.disposeBridge()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
    this.events.once(Phaser.Scenes.Events.DESTROY, dispose)
  }

  private disposeBridge(): void {
    const subscriptions = this.unsubscribers.splice(0)
    subscriptions.forEach((unsubscribe) => unsubscribe())
    this.ambientSound?.stop()
    this.ambientSound = null
    this.audioStarted = false
  }

  private screenPointToWorld(u: number, v: number): Phaser.Math.Vector2 {
    const screenX = Phaser.Math.Clamp(u, 0, 1) * this.scale.width
    const screenY = Phaser.Math.Clamp(v, 0, 1) * this.scale.height
    return this.cameras.main.getWorldPoint(screenX, screenY)
  }

  private movePlacementFromScreen(u: number, v: number): void {
    if (!this.placementKind || !this.placementGhost) return
    this.pointerInsideGame = true
    this.edgePanX = u <= this.edgePanMargin / this.scale.width ? -1 : u >= 1 - this.edgePanMargin / this.scale.width ? 1 : 0
    this.edgePanY = v <= this.edgePanMargin / this.scale.height ? -1 : v >= 1 - this.edgePanMargin / this.scale.height ? 1 : 0
    const world = this.screenPointToWorld(u, v)
    this.updatePlacementGhost(world.x, world.y)
  }

  private placeFromScreen(u: number, v: number): void {
    if (!this.placementKind) return
    const world = this.screenPointToWorld(u, v)
    this.tryPlaceBuilding(world.x, world.y)
  }

  private panCamera(delta: number): void {
    const camera = this.cameras.main
    const speed = 620 * (delta / 1000) / camera.zoom
    let x = 0
    let y = 0

    if (this.cursors?.left.isDown || (this.keys.A?.isDown && !this.keys.SHIFT?.isDown)) x -= 1
    if (this.cursors?.right.isDown || this.keys.D?.isDown) x += 1
    if (this.cursors?.up.isDown || this.keys.W?.isDown) y -= 1
    if (this.cursors?.down.isDown || this.keys.S?.isDown) y += 1

    if (this.pointerInsideGame) {
      x += this.edgePanX
      y += this.edgePanY
    }

    if (x === 0 && y === 0) return
    const magnitude = Math.hypot(x, y) || 1
    camera.scrollX += (x / magnitude) * speed
    camera.scrollY += (y / magnitude) * speed
  }

  private updateEdgePan(pointer: Phaser.Input.Pointer): void {
    const width = this.scale.width
    const height = this.scale.height
    const margin = this.edgePanMargin

    // Don't edge-scroll while interacting with the fixed-position minimap.
    if (this.minimapRect.contains(pointer.x, pointer.y)) {
      this.edgePanX = 0
      this.edgePanY = 0
      return
    }

    this.edgePanX = pointer.x <= margin ? -1 : pointer.x >= width - margin ? 1 : 0
    this.edgePanY = pointer.y <= margin ? -1 : pointer.y >= height - margin ? 1 : 0
  }

  private handleMinimapClick(screenX: number, screenY: number): boolean {
    if (!this.minimapRect.contains(screenX, screenY)) return false
    const u = Phaser.Math.Clamp((screenX - this.minimapRect.x) / this.minimapRect.width, 0, 1)
    const v = Phaser.Math.Clamp((screenY - this.minimapRect.y) / this.minimapRect.height, 0, 1)
    const worldX = u * this.mission.definition.world_width
    const worldY = v * this.mission.definition.world_height
    this.cameras.main.centerOn(worldX, worldY)
    this.edgePanX = 0
    this.edgePanY = 0
    return true
  }

  private selectAt(x: number, y: number, additive: boolean): void {
    const unit = [...this.units].reverse().find((item) => item.alive && item.team === 'player' && Phaser.Math.Distance.Between(item.x, item.y, x, y) < 28)
    const building = [...this.buildings].reverse().find((item) => item.alive && item.team === 'player' && item.contains(x, y))
    if (!additive) this.clearSelection()
    if (unit) {
      if (!this.selectedUnits.includes(unit)) this.selectedUnits.push(unit)
      unit.setSelected(true)
      this.selectedBuilding = null
    } else if (building) {
      this.clearSelection()
      this.selectedBuilding = building
      building.setSelected(true)
    }
    this.syncSelection()
    if (unit || building) this.sound.play('sfx-select', { volume: 0.18 })
  }

  private selectBox(bounds: Phaser.Geom.Rectangle, additive: boolean): void {
    if (!additive) this.clearSelection()
    for (const unit of this.units.filter((item) => item.alive && item.team === 'player')) {
      if (bounds.contains(unit.x, unit.y) && !this.selectedUnits.includes(unit)) {
        this.selectedUnits.push(unit)
        unit.setSelected(true)
      }
    }
    this.syncSelection()
    if (this.selectedUnits.length > 0) this.sound.play('sfx-select', { volume: 0.16 })
  }

  private clearSelection(): void {
    this.selectedUnits.forEach((unit) => unit.setSelected(false))
    this.selectedUnits = []
    if (this.selectedBuilding) this.selectedBuilding.setSelected(false)
    this.selectedBuilding = null
  }

  private syncSelection(): void {
    const entities = this.selectedBuilding
      ? [this.selectedBuilding.toSelectedEntity()]
      : this.selectedUnits.map((unit) => unit.toSelectedEntity())
    useGameStore.getState().setSelected(entities)
  }

  private issueCommand(x: number, y: number): void {
    if (this.selectedBuilding && ['barracks', 'warfactory', 'airfield'].includes(this.selectedBuilding.kind)) {
      this.selectedBuilding.setRallyPoint(x, y)
      useGameStore.getState().setStatus('playing', `${buildingLabel(this.selectedBuilding.kind, this.playerFaction)} rally point set.`)
      return
    }
    if (this.selectedUnits.length === 0) return
    const enemy = this.findEnemyAt(x, y)
    if (enemy) {
      this.selectedUnits.forEach((unit) => unit.setAttackTarget(enemy))
      this.attackMoveArmed = false
      useGameStore.getState().setAttackMoveArmed(false)
      return
    }
    const attackMove = this.attackMoveArmed
    const columns = Math.ceil(Math.sqrt(this.selectedUnits.length))
    this.selectedUnits.forEach((unit, index) => {
      const row = Math.floor(index / columns)
      const col = index % columns
      const offsetX = (col - (columns - 1) / 2) * 44
      const offsetY = row * 44
      const goal = { x: x + offsetX, y: y + offsetY }
      const path = this.pathfinder.findPath(unit, goal, this.buildings, this.mission.definition.world_width, this.mission.definition.world_height)
      const vectors = path.map((point) => new Phaser.Math.Vector2(point.x, point.y))
      if (attackMove) unit.setAttackMovePath(vectors, new Phaser.Math.Vector2(goal.x, goal.y))
      else unit.setPath(vectors)
    })
    if (attackMove) {
      this.attackMoveArmed = false
      useGameStore.getState().setAttackMoveArmed(false)
      useGameStore.getState().setStatus('playing', 'Attack-move order issued.')
    }
  }

  private findEnemyAt(x: number, y: number): Damageable | undefined {
    const unit = this.units.find((candidate) =>
      candidate.alive
      && candidate.team === 'enemy'
      && this.fog.isVisible(candidate.x, candidate.y)
      && Phaser.Math.Distance.Between(candidate.x, candidate.y, x, y) < 30,
    )
    if (unit) return unit
    return this.buildings.find((building) =>
      building.alive
      && building.team === 'enemy'
      && this.fog.isVisible(building.x, building.y)
      && building.contains(x, y),
    )
  }

  private beginPlacement(kind: BuildingKind): void {
    this.startAudio()
    if (kind === 'conyard') return
    const stats = BUILDING_STATS[kind]
    const displayLabel = buildingLabel(kind, this.playerFaction)
    if (this.credits < stats.cost) {
      useGameStore.getState().setStatus('playing', `Need $${stats.cost.toLocaleString()} for ${displayLabel}.`)
      return
    }
    if (!this.meetsBuildingPrerequisite(kind)) {
      useGameStore.getState().setStatus('playing', `Prerequisite missing for ${displayLabel}.`)
      return
    }
    this.cancelPlacement()
    this.placementKind = kind
    useGameStore.getState().setPlacementKind(kind)
    const world = this.cameras.main.getWorldPoint(this.scale.width / 2, this.scale.height / 2)
    this.placementGhost = this.add
      .image(world.x, world.y, 'buildings', buildingAtlasFrame(kind, this.playerFaction))
      .setDisplaySize(stats.spriteSize.width, stats.spriteSize.height)
      .setTint(0x8dffc8)
      .setAlpha(0.42)
      .setDepth(9000)
    this.updatePlacementGhost(world.x, world.y)
    useGameStore.getState().setStatus('playing', `PLACEMENT MODE: ${displayLabel}. Move onto the battlefield and left-click to place; Esc/right-click cancels.`)
  }

  private meetsBuildingPrerequisite(kind: BuildingKind): boolean {
    const owns = (candidate: BuildingKind) => this.buildings.some((building) => building.alive && building.team === 'player' && building.kind === candidate)
    if (kind === 'power') return owns('conyard')
    if (kind === 'refinery' || kind === 'barracks') return owns('power')
    if (kind === 'warfactory' || kind === 'turret') return owns('refinery') && owns('power')
    if (kind === 'techlab') return owns('barracks') && owns('refinery') && owns('power')
    if (kind === 'airfield') return owns('warfactory') && owns('power')
    if (kind === 'detector') return owns('techlab') && owns('power')
    return true
  }

  private isValidBuildingPlacement(kind: BuildingKind, x: number, y: number): boolean {
    const stats = BUILDING_STATS[kind]
    const overlaps = this.buildings.some((building) =>
      building.alive && Phaser.Math.Distance.Between(building.x, building.y, x, y) < (building.size + stats.size) * 0.58,
    )
    const nearBase = this.buildings.some((building) =>
      building.alive && building.team === 'player' && Phaser.Math.Distance.Between(building.x, building.y, x, y) < 520,
    )
    const withinWorld =
      x > stats.size &&
      y > stats.size &&
      x < this.mission.definition.world_width - stats.size &&
      y < this.mission.definition.world_height - stats.size
    return !overlaps && nearBase && withinWorld
  }

  private updatePlacementGhost(x: number, y: number): void {
    if (!this.placementKind || !this.placementGhost) return
    const valid = this.isValidBuildingPlacement(this.placementKind, x, y)
    this.placementGhost
      .setPosition(x, y)
      .setTint(valid ? 0x8dffc8 : 0xff8c8c)
      .setAlpha(valid ? 0.42 : 0.32)
  }

  private tryPlaceBuilding(x: number, y: number): void {
    const kind = this.placementKind
    if (!kind) return
    const stats = BUILDING_STATS[kind]
    if (!this.isValidBuildingPlacement(kind, x, y)) {
      useGameStore.getState().setStatus('playing', 'Invalid build location — red ghost means blocked, out of bounds, or too far from your base.')
      this.updatePlacementGhost(x, y)
      return
    }
    this.credits -= stats.cost
    this.spawnBuilding(kind, 'player', x, y)
    this.sound.play('sfx-confirm', { volume: 0.22 })
    this.cancelPlacement()
    this.syncStore(true)
    useGameStore.getState().setStatus('playing', `${buildingLabel(kind, this.playerFaction)} deployed.`)
  }

  private cancelPlacement(): void {
    this.placementKind = null
    this.placementGhost?.destroy()
    this.placementGhost = null
    this.edgePanX = 0
    this.edgePanY = 0
    useGameStore.getState().setPlacementKind(null)
  }

  private queueUnit(kind: UnitKind): void {
    this.startAudio()
    const stats = UNIT_STATS[kind]
    const allowed = [...FACTION_DATA[this.playerFaction].infantry, ...FACTION_DATA[this.playerFaction].factory, ...FACTION_DATA[this.playerFaction].air]
    if (!allowed.includes(kind)) {
      useGameStore.getState().setStatus('playing', `${stats.label} does not belong to ${FACTION_DATA[this.playerFaction].name}.`)
      return
    }
    if (!isUnitUnlocked(kind, this.completedUpgrades)) {
      useGameStore.getState().setStatus('playing', `${stats.label} is locked behind your faction tech tree.`)
      return
    }
    const factoryKind: BuildingKind = stats.requiredFactory
    const factories = this.buildings.filter((building) => building.alive && building.team === 'player' && building.kind === factoryKind)
    if (factories.length === 0) {
      useGameStore.getState().setStatus('playing', `${buildingLabel(factoryKind, this.playerFaction)} required.`)
      return
    }
    const factory = [...factories].sort((a, b) => this.production.queueLength(a.id) - this.production.queueLength(b.id))[0]
    if (!factory) return
    if (this.credits < stats.cost) {
      useGameStore.getState().setStatus('playing', `Need $${stats.cost.toLocaleString()} for ${stats.label}.`)
      return
    }
    const economy = this.calculatePower()
    if (economy.used > economy.capacity) {
      useGameStore.getState().setStatus('playing', 'Low power: unit production is offline.')
      return
    }
    this.credits -= stats.cost
    this.production.enqueue(factory, this.playerFaction, kind)
    this.sound.play('sfx-confirm', { volume: 0.16 })
    useGameStore.getState().setStatus('playing', `${stats.label} added to ${buildingLabel(factory.kind, this.playerFaction)} queue.`)
    this.syncStore(true)
  }

  private cancelProduction(buildingId: string): void {
    const kind = this.production.cancelFirst(buildingId)
    if (!kind) return
    const refund = Math.round(UNIT_STATS[kind].cost * 0.75)
    this.credits += refund
    useGameStore.getState().setStatus('playing', `${UNIT_STATS[kind].label} cancelled. $${refund.toLocaleString()} refunded.`)
    this.syncStore(true)
  }

  private queueResearch(upgradeKey: UpgradeKey): void {
    const def = UPGRADE_DEFS[upgradeKey]
    if (def.faction !== this.playerFaction || this.completedUpgrades.has(upgradeKey) || this.research.isQueued(upgradeKey)) return
    if (!def.prerequisites.every((item) => this.completedUpgrades.has(item))) {
      useGameStore.getState().setStatus('playing', `Prerequisites not met for ${def.label}.`)
      return
    }
    const building = this.buildings.find((candidate) => candidate.alive && candidate.team === 'player' && candidate.kind === def.requiredBuilding)
    if (!building) {
      useGameStore.getState().setStatus('playing', `${buildingLabel(def.requiredBuilding, this.playerFaction)} required for ${def.label}.`)
      return
    }
    if (this.credits < def.cost) {
      useGameStore.getState().setStatus('playing', `Need $${def.cost.toLocaleString()} to research ${def.label}.`)
      return
    }
    const power = this.calculatePower()
    if (power.used > power.capacity) {
      useGameStore.getState().setStatus('playing', 'Low power: research systems are offline.')
      return
    }
    this.credits -= def.cost
    this.research.enqueue(building, this.playerFaction, upgradeKey)
    this.sound.play('sfx-confirm', { volume: 0.16 })
    useGameStore.getState().setStatus('playing', `${def.label} research queued.`)
    this.syncStore(true)
  }

  private completeProduction(building: Building, kind: UnitKind, team: 'player' | 'enemy'): void {
    if (!building.alive) return
    const unit = this.spawnUnit(kind, team, building.x + building.size * 0.65, building.y + building.size * 0.65)
    if (building.rallyPoint) {
      const goal = { x: building.rallyPoint.x, y: building.rallyPoint.y }
      const path = this.pathfinder.findPath(unit, goal, this.buildings, this.mission.definition.world_width, this.mission.definition.world_height)
      unit.setPath(path.map((point) => new Phaser.Math.Vector2(point.x, point.y)))
    }
    if (team === 'player') useGameStore.getState().setStatus('playing', `${UNIT_STATS[kind].label} ready.`)
  }

  private completeResearch(upgradeKey: UpgradeKey, team: 'player' | 'enemy'): void {
    const target = team === 'player' ? this.completedUpgrades : this.enemyCompletedUpgrades
    target.add(upgradeKey)
    this.applyUpgradeEffects(team)
    if (team === 'player') {
      useGameStore.getState().setCompletedUpgrades([...this.completedUpgrades])
      useGameStore.getState().setStatus('playing', `${UPGRADE_DEFS[upgradeKey].label} research complete.`)
    }
  }

  private queueEnemyUnit(kind: UnitKind): boolean {
    const allowed = [...FACTION_DATA[this.enemyFaction].infantry, ...FACTION_DATA[this.enemyFaction].factory, ...FACTION_DATA[this.enemyFaction].air]
    if (!allowed.includes(kind)) return false
    const stats = UNIT_STATS[kind]
    const factories = this.buildings.filter((building) => building.alive && building.team === 'enemy' && building.kind === stats.requiredFactory)
    const enemyPower = this.calculatePowerForTeam('enemy')
    if (enemyPower.used > enemyPower.capacity) {
      this.tryEnemyBuild('power')
      return false
    }
    if (factories.length === 0 || this.enemyCredits < stats.cost || this.production.totalQueued('enemy') >= 5) return false
    const factory = [...factories].sort((a, b) => this.production.queueLength(a.id) - this.production.queueLength(b.id))[0]
    if (!factory) return false
    this.enemyCredits -= stats.cost
    this.production.enqueue(factory, this.enemyFaction, kind)
    return true
  }

  private tryEnemyBuild(kind: BuildingKind): boolean {
    const stats = BUILDING_STATS[kind]
    if (this.enemyCredits < stats.cost) return false
    const core = this.buildings.find((building) => building.alive && building.team === 'enemy' && building.kind === 'conyard')
    if (!core) return false
    const existing = this.buildings.filter((building) => building.alive && building.team === 'enemy').length
    this.enemyBuildAttempt += 1
    const angle = ((existing + this.enemyBuildAttempt) * 1.37) % (Math.PI * 2)
    const radius = kind === 'refinery' ? 240 : 210
    const x = Phaser.Math.Clamp(core.x + Math.cos(angle) * radius, stats.size, this.mission.definition.world_width - stats.size)
    const y = Phaser.Math.Clamp(core.y + Math.sin(angle) * radius, stats.size, this.mission.definition.world_height - stats.size)
    const overlaps = this.buildings.some((building) => building.alive && Phaser.Math.Distance.Between(building.x, building.y, x, y) < (building.size + stats.size) * 0.55)
    if (overlaps) return false
    this.enemyCredits -= stats.cost
    this.spawnBuilding(kind, 'enemy', x, y)
    return true
  }

  private spawnUnit(kind: UnitKind, team: 'player' | 'enemy', x: number, y: number): Unit {
    this.unitCounter += 1
    const unit = new Unit(this, `${team}-unit-${this.unitCounter}`, kind, team, x, y)
    this.units.push(unit)
    this.applyUpgradeToUnit(unit, team)
    if (team === 'enemy' && this.fog) unit.setFogVisible(this.fog.isVisible(x, y))
    return unit
  }

  private spawnBuilding(kind: BuildingKind, team: 'player' | 'enemy', x: number, y: number): Building {
    this.buildingCounter += 1
    const id = team === 'enemy' && kind === 'conyard' ? 'enemy_conyard' : `${team}-building-${this.buildingCounter}`
    const faction = team === 'player' ? this.playerFaction : this.enemyFaction
    const building = new Building(this, id, kind, team, faction, x, y)
    this.buildings.push(building)
    // The pathfinder caches its obstacle grid, so any layout change must be
    // announced explicitly rather than relying on change detection alone.
    this.pathfinder.invalidate()
    if (team === 'enemy' && this.fog) building.setFogVisible(this.fog.isVisible(x, y))
    return building
  }

  private updateEnemyFogVisibility(): void {
    for (const unit of this.units) {
      if (unit.team === 'enemy') unit.setFogVisible(unit.alive && this.fog.isVisible(unit.x, unit.y))
    }
    for (const building of this.buildings) {
      if (building.team === 'enemy') building.setFogVisible(building.alive && this.fog.isVisible(building.x, building.y))
    }
  }

  private startAudio(): void {
    if (this.audioStarted) return
    this.audioStarted = true
    this.ambientSound = this.sound.add('music-ambient', { loop: true, volume: 0.075 })
    this.ambientSound.play()
  }

  private stopSelected(): void {
    this.startAudio()
    if (this.selectedUnits.length === 0) return
    this.selectedUnits.forEach((unit) => unit.stop())
    this.sound.play('sfx-confirm', { volume: 0.14 })
    useGameStore.getState().setStatus('playing', 'Selected squad holding position.')
  }

  private centerSelected(): void {
    if (this.selectedBuilding) {
      this.cameras.main.centerOn(this.selectedBuilding.x, this.selectedBuilding.y)
      return
    }
    if (this.selectedUnits.length === 0) return
    const x = this.selectedUnits.reduce((sum, unit) => sum + unit.x, 0) / this.selectedUnits.length
    const y = this.selectedUnits.reduce((sum, unit) => sum + unit.y, 0) / this.selectedUnits.length
    this.cameras.main.centerOn(x, y)
  }

  private activateAbility(ability: 'stim' | 'siege' | 'afterburners' | 'frenzy' | 'acid_burst' | 'phase' | 'shield_surge' | 'phase_stride' | 'overcharge'): void {
    this.startAudio()
    const now = this.time.now
    let triggered = 0
    for (const unit of this.selectedUnits) {
      if (ability === 'stim' && unit.activateStim(now)) triggered += 1
      if (ability === 'siege' && unit.toggleSiege(now)) triggered += 1
      if (ability === 'afterburners' && unit.activateAfterburners(now)) triggered += 1
      if (ability === 'frenzy' && unit.activateFrenzy(now)) triggered += 1
      if (ability === 'acid_burst' && unit.activateAcidBurst(now)) triggered += 1
      if (ability === 'phase' && unit.activatePhase(now)) triggered += 1
      if (ability === 'shield_surge' && unit.activateShieldSurge(now)) triggered += 1
      if (ability === 'phase_stride' && unit.activatePhaseStride(now)) triggered += 1
      if (ability === 'overcharge' && unit.activateOvercharge(now)) triggered += 1
    }
    if (triggered > 0) {
      this.sound.play('sfx-confirm', { volume: 0.18 })
      const messages: Record<string, string> = {
        stim: 'Stim Burst engaged.', siege: 'Siege mode toggled.', afterburners: 'Afterburners online.',
        frenzy: 'Brood Frenzy unleashed.', acid_burst: 'Acid Surge glands overpressurized.', phase: 'Phase Veil engaged.',
        shield_surge: 'Veyra shield lattice surged.', phase_stride: 'Phase Stride engaged.', overcharge: 'Resonance Overcharge active.',
      }
      const message = messages[ability] ?? 'Ability activated.'
      useGameStore.getState().setStatus('playing', message)
    }
  }

  private armAttackMove(): void {
    if (this.selectedUnits.length === 0) {
      useGameStore.getState().setStatus('playing', 'Select combat units before issuing attack-move.')
      return
    }
    this.attackMoveArmed = true
    useGameStore.getState().setAttackMoveArmed(true)
    useGameStore.getState().setStatus('playing', 'ATTACK MOVE armed — right-click a destination. Shift+A also arms this command.')
  }

  private assignControlGroup(group: number): void {
    const ids = this.selectedBuilding
      ? [this.selectedBuilding.id]
      : this.selectedUnits.map((unit) => unit.id)
    if (ids.length === 0) return
    this.controlGroups.set(group, ids)
    useGameStore.getState().setStatus('playing', `Control group ${group} assigned (${ids.length}).`)
  }

  private recallControlGroup(group: number): void {
    const ids = this.controlGroups.get(group)
    if (!ids || ids.length === 0) return
    this.clearSelection()
    const unitMatches = this.units.filter((unit) => unit.alive && unit.team === 'player' && ids.includes(unit.id))
    const buildingMatch = this.buildings.find((building) => building.alive && building.team === 'player' && ids.includes(building.id))
    if (buildingMatch) {
      this.selectedBuilding = buildingMatch
      buildingMatch.setSelected(true)
    } else {
      this.selectedUnits = unitMatches
      this.selectedUnits.forEach((unit) => unit.setSelected(true))
    }
    this.syncSelection()
    const now = this.time.now
    const previous = this.lastGroupRecallAt.get(group) ?? -1000
    this.lastGroupRecallAt.set(group, now)
    if (now - previous < 450) this.centerSelected()
  }

  private resumeAttackMoves(): void {
    for (const unit of this.units) {
      if (!unit.alive || !unit.attackMoveActive || unit.attackTarget || !unit.attackMoveGoal) continue
      if (unit.distanceTo(unit.attackMoveGoal) < 28) {
        unit.clearAttackMove()
        continue
      }
      if (unit.hasMoveOrder) continue
      const goal = { x: unit.attackMoveGoal.x, y: unit.attackMoveGoal.y }
      const path = this.pathfinder.findPath(unit, goal, this.buildings, this.mission.definition.world_width, this.mission.definition.world_height)
      unit.resumeAttackMove(path.map((point) => new Phaser.Math.Vector2(point.x, point.y)))
    }
  }

  private productionSpeedMultiplier(team: 'player' | 'enemy'): number {
    if (team === 'enemy') return Math.max(0.72, this.mission.definition.enemy.production_multiplier * DIFFICULTY_DATA[this.difficulty].production)
    if (this.playerFaction === 'aegis' && this.completedUpgrades.has('aegis_reactor_optimization')) return 1.18
    if (this.playerFaction === 'noctis' && this.completedUpgrades.has('noctis_metabolic_bloom')) return 1.18
    if (this.playerFaction === 'veyra' && this.completedUpgrades.has('veyra_crystal_efficiency')) return 1.18
    return 1
  }

  private harvestMultiplier(team: 'player' | 'enemy'): number {
    if (team === 'enemy') return DIFFICULTY_DATA[this.difficulty].economy
    if (this.playerFaction === 'aegis' && this.completedUpgrades.has('aegis_reactor_optimization')) return 1.15
    if (this.playerFaction === 'noctis' && this.completedUpgrades.has('noctis_metabolic_bloom')) return 1.15
    if (this.playerFaction === 'veyra' && this.completedUpgrades.has('veyra_crystal_efficiency')) return 1.15
    return 1
  }

  private supportMultiplier(team: 'player' | 'enemy', kind: UnitKind): number {
    if (team === 'enemy') return 1
    if (kind === 'medic' && this.completedUpgrades.has('aegis_nanomedicine')) return 1.35
    if (kind === 'seer' && this.completedUpgrades.has('veyra_shield_harmonics')) return 1.25
    if (kind === 'broodcaster' && this.completedUpgrades.has('noctis_brood_mind')) return 1.2
    return 1
  }

  private applyUpgradeEffects(team: 'player' | 'enemy'): void {
    for (const unit of this.units.filter((candidate) => candidate.alive && candidate.team === team)) this.applyUpgradeToUnit(unit, team)
  }

  private applyUpgradeToUnit(unit: Unit, team: 'player' | 'enemy'): void {
    const faction = team === 'player' ? this.playerFaction : this.enemyFaction
    const upgrades = team === 'player' ? this.completedUpgrades : this.enemyCompletedUpgrades
    let speed = 1
    let damage = 1
    let cooldown = 1
    let visionBonus = 0
    let rangeBonus = 0
    let damageReduction = 0
    let shieldRegen = 1

    if (faction === 'aegis') {
      if (upgrades.has('aegis_composite_plating')) damageReduction += 0.12
      if (upgrades.has('aegis_targeting_ai')) { damage *= 1.12; visionBonus += 30 }
      if (upgrades.has('aegis_heavy_chassis') && UNIT_STATS[unit.kind].role === 'vehicle') damageReduction += 0.08
      if (upgrades.has('aegis_aerospace_command') && unit.isFlying) visionBonus += 60
    } else if (faction === 'noctis') {
      if (upgrades.has('noctis_carapace_grafting')) damageReduction += 0.12
      if (upgrades.has('noctis_synaptic_acceleration')) { speed *= 1.12; cooldown *= 0.90 }
      if (upgrades.has('noctis_acid_evolution') && (unit.kind === 'spitter' || unit.kind === 'broodcaster')) { damage *= 1.20; rangeBonus += 35 }
    } else {
      if (upgrades.has('veyra_shield_harmonics')) shieldRegen *= 1.35
      if (upgrades.has('veyra_resonance_matrix')) { damage *= 1.12; rangeBonus += 25 }
      if (upgrades.has('veyra_phase_doctrine') && (unit.kind === 'lancer' || unit.kind === 'adept')) speed *= 1.15
      if (upgrades.has('veyra_oracle_path') && unit.kind === 'seer') visionBonus += 120
      if (upgrades.has('veyra_star_gate') && unit.isFlying) visionBonus += 50
    }
    unit.applyUpgradeModifiers({ speed, damage, cooldown, visionBonus, rangeBonus, damageReduction, shieldRegen })
  }

  private calculatePowerForTeam(team: 'player' | 'enemy'): { used: number; capacity: number } {
    let used = 0
    let capacity = 0
    for (const building of this.buildings.filter((item) => item.alive && item.team === team)) {
      const power = BUILDING_STATS[building.kind].power
      if (power < 0) capacity += Math.abs(power)
      else used += power
    }
    return { used, capacity }
  }

  private calculatePower(): { used: number; capacity: number } {
    return this.calculatePowerForTeam('player')
  }

  private syncStore(forceSelection: boolean): void {
    const power = this.calculatePower()
    const store = useGameStore.getState()
    store.setEconomy(Math.round(this.credits), power.used, power.capacity)
    store.setProductionQueues(this.production?.getPlayerViews() ?? [])
    store.setResearchQueues(this.research?.getPlayerViews() ?? [])
    store.setCompletedUpgrades([...this.completedUpgrades])
    store.setAttackMoveArmed(this.attackMoveArmed)
    if (forceSelection || this.selectedUnits.length > 0 || this.selectedBuilding) this.syncSelection()
  }

  private checkEndState(): void {
    const enemyConyardAlive = this.buildings.some((building) => building.id === 'enemy_conyard' && building.alive)
    const playerConyardAlive = this.buildings.some((building) => building.team === 'player' && building.kind === 'conyard' && building.alive)
    if (!enemyConyardAlive) {
      this.clearSelection()
      useGameStore.getState().setStatus('victory', `Mission accomplished — ${FACTION_DATA[this.enemyFaction].name} command destroyed.`)
    } else if (!playerConyardAlive) {
      this.clearSelection()
      useGameStore.getState().setStatus('defeat', `Your ${buildingLabel('conyard', this.playerFaction)} was destroyed.`)
    }
  }

  private createMinimap(): void {
    const width = 188
    const height = 110
    const mini = this.cameras.add(16, 16, width, height, false, 'minimap')
    mini.setBounds(0, 0, this.mission.definition.world_width, this.mission.definition.world_height)
    mini.centerOn(this.mission.definition.world_width / 2, this.mission.definition.world_height / 2)
    mini.setZoom(Math.min(width / this.mission.definition.world_width, height / this.mission.definition.world_height))
    const border = this.add.rectangle(16 + width / 2, 16 + height / 2, width + 6, height + 6, 0x0b0e0c, 0.2)
      .setStrokeStyle(2, 0xb8c5ba)
      .setScrollFactor(0)
      .setDepth(9999)
    mini.ignore(border)
  }
}
