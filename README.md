# Iron Frontier

An original three-faction science-fiction real-time strategy game built as a production-style React/Phaser + FastAPI monorepo.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Phaser 4 + Zustand
- **Backend:** FastAPI + Pydantic v2 + SQLAlchemy 2 + SQLite
- **Tooling:** Pytest, mypy, pylint, Black, isort, Vitest, ESLint, Prettier

## What is playable now

- box-select units
- right-click formation movement
- A* grid pathfinding around buildings
- riflemen, tanks, and autonomous harvesters
- ore harvesting and refinery income
- buildable power plants, barracks, war factories, refineries, and turrets
- unit production queues
- power generation/usage
- projectile combat and health bars
- classic shroud + fog of war with persistent explored terrain
- rifleman/tank proximity auto-acquisition and defensive fire
- enemy production / attack waves
- minimap
- win / lose state
- backend-loaded mission definition
- backend save slots

All artwork in this starter is generated from Phaser primitives; there are no copyrighted C&C assets.

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
```

macOS/Linux:

```bash
source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

API: http://localhost:8000
Docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Game: http://localhost:5173

Vite proxies `/api` to FastAPI at port 8000.

## Controls

- **Left click:** select one unit
- **Left drag:** box-select units
- **Shift + click/drag:** additive selection
- **Right click ground:** move selected units in formation
- **Right click enemy:** explicit attack order (takes priority over auto-acquisition)
- **WASD / arrows:** pan camera
- **Mouse wheel:** zoom
- **Build panel:** place buildings or queue units
- **Esc / right click during placement:** cancel structure placement

## Architecture

```text
iron-frontier/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers
│   │   ├── core/         # settings and DB wiring
│   │   ├── dao/          # persistence only
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request/response models
│   │   └── services/     # business logic
│   └── tests/
└── frontend/
    └── src/
        ├── api/           # FastAPI client
        ├── components/    # React UI
        ├── game/
        │   ├── entities/
        │   ├── events/
        │   ├── scenes/
        │   └── systems/
        └── store/         # Zustand UI/game state
```

The game simulation is intentionally **not** implemented with React components. Phaser owns world entities and the frame loop; React communicates through a typed event bus and shared UI store.

## Backend quality commands

```bash
cd backend
pytest
black --check app tests
isort --check-only app tests
mypy app
pylint app
```

## Frontend quality commands

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

## Next logical upgrades

- command queues and patrol/guard stances
- repair / sell
- infantry squads and transports
- tech prerequisites
- richer enemy base-building AI
- map / mission editor
- campaign progression
- audio and original sprite art


## Placement input bridge

Structure placement uses a small React DOM input layer while placement mode is active. Pointer coordinates are normalized in React and sent through the typed game bus to Phaser, where the main camera converts them to world coordinates. This avoids stale or duplicate Phaser input listeners during React development lifecycle remounts. The scene unsubscribes from the game bus on both Phaser `SHUTDOWN` and `DESTROY`.

## Camera controls

- Move the pointer to the battlefield edges to scroll the map.
- `WASD` or arrow keys also pan the camera.
- Mouse wheel zooms in/out.
- Click anywhere on the minimap to jump the main camera to that part of the battlefield.


## Fog of war and unit reactions

Player units and structures reveal nearby terrain. Unexplored cells are heavily shrouded; previously explored cells remain dim when no friendly unit currently has vision there. Enemy units and structures are hidden outside current vision and cannot be directly targeted through fog.

Riflemen and Medium Tanks automatically acquire nearby hostile units or structures. Auto-acquired targets use a short leash so units do not chase incidental enemies across the entire map, and a move order is preserved while a unit fires opportunistically. Explicit right-click attack orders still override this behavior and pursue the chosen target.

## Latest visual overhaul

This package includes an **original StarCraft-inspired art/style pass** using bundled local PNG assets (no copyrighted franchise art). The latest pass adds:

- textured battlefield terrain
- original sci-fi unit and building sprites
- asset-backed build/selection UI icons
- fog of war + shroud
- auto-attack for infantry and tanks
- projectile, muzzle-flash, and explosion effects
- polish improvements such as shadows, glow layers, spawn tweens, and impact flashes

All art assets live under `frontend/public/assets/`.

## Faction polish pass

The current build adds a second visual/audio polish layer on top of the StarCraft-inspired art pass:

- **Aegis Expeditionary** player faction presentation and **Vex Dominion** hostile presentation
- animated movement sheets for riflemen, tanks, and harvesters
- tactical selection portraits for combat/mining units
- command-card controls for Stop and Center Selection, plus an Auto Fire passive indicator
- long-lived battlefield wreckage for infantry, vehicles, and destroyed structures
- stronger friendly/hostile tinting, health colors, emblems, and UI identity
- original muzzle, projectile, impact, explosion, selection, and confirmation sound effects
- an original low-volume ambient sci-fi loop that starts after the first user interaction
- animated reactor/building glow and improved death/spawn feedback

All new media is bundled locally under `frontend/public/assets/`; no external game artwork or audio is required.


## Dark sci-fi + alien expansion pass

This build adds a darker, more grounded sci-fi art pass for the human **Aegis Expeditionary** faction and introduces a fully new alien enemy race: the **Noctis Brood**.

### New player units
- Rifleman
- Field Medic
- Marauder
- Medium Tank
- Siege Artillery
- Harvester

### Alien enemy units
- Skitter Drone
- Brute Mauler
- Spitter Beast

### Visual updates
- darker mechanized infantry / vehicle sprites
- new alien unit sprites and alien structure set
- portrait assets for unit selection
- updated hostile faction emblem and identity

### Gameplay updates
- additional starting player units
- new enemy wave compositions using alien units
- alien base structures for the hostile faction

## Omega gameplay pass

This package now includes a broader gameplay/content pass on top of the alien expansion:

### Visual / art pass
- higher-detail, darker original unit sprites for all Aegis ground/vehicle units
- higher-detail original Noctis Brood sprites and refreshed building art
- new flying-unit sprites: **Gunship** and **Wraith Flier**
- updated UI icons and selection portraits for the expanded roster

### New unit roster
**Aegis Expeditionary**
- Rifleman
- Field Medic (auto-heals nearby allies)
- Marauder
- Medium Tank
- Siege Artillery (toggle siege mode)
- Gunship (flying gun platform with afterburners)
- Harvester

**Noctis Brood**
- Skitter Drone
- Brute Mauler
- Spitter Beast
- Wraith Flier

### New mechanics
- fixed harvester cargo/state logic so harvesters resume mining and generate credits again
- flying-unit support in combat, targeting, vision, and rendering depth
- unit abilities via the command panel:
  - **Stim Burst** for Riflemen / Marauders
  - **Toggle Siege** for Siege Artillery
  - **Afterburners** for Gunships
- support/healing system for medics
- broader enemy wave composition including airborne alien assaults
- light tech-tree grouping in the production UI (Barracks tech vs War Factory tech)

### Mission / skirmish content
The backend now seeds three playable scenarios:
- `mission_01` — Operation Iron Dawn
- `mission_02` — Black Skies Counterstroke
- `skirmish_01` — Ash Meridian Skirmish

The frontend mission panel lets you swap between scenarios and restart them from the UI.

## Playable faction selection

The game now supports selecting either faction from the Scenario panel before/during play. Changing faction rebuilds the active battlefield with that faction as the player and automatically assigns the opposing faction to the AI.

### Aegis Expeditionary
- Rifleman
- Field Medic
- Marauder
- Medium Tank
- Siege Artillery
- Gunship
- Harvester
- Aegis industrial structures
- Stim Burst / Siege Mode / Afterburners

### Noctis Brood
- Skitter Drone
- Spitter Beast
- Brute Mauler
- Wraith Flier
- Extractor Drone
- Organic Brood structures (Hive Yard, Spore Reactor, Biomass Processor, Spawn Pit, Gene Forge, Spine Cannon)
- Brood Frenzy / Acid Surge / Phase Veil

Both factions can harvest resources, construct a full base, produce units, use faction-specific abilities, and fight the opposing race in all seeded mission/skirmish scenarios.

## Production, tech-tree, and tactical systems pass

This build adds the RTS systems that turn the prototype production loop into a much more traditional competitive RTS flow.

### Real production queues
- Barracks / Spawn Pits and War Factories / Gene Forges each maintain independent FIFO queues.
- Clicking a unit repeatedly adds multiple copies to the least-busy compatible production building.
- The React sidebar shows the active item, live percentage progress, queued count, and a cancel/refund action.
- Newly produced units obey the rally point of the building that produced them.
- Production-speed upgrades alter actual queue completion time.

### Rally points
- Select a Barracks, Spawn Pit, War Factory, or Gene Forge and right-click the battlefield to assign its rally point.
- Finished units pathfind toward that location automatically.

### Race-specific technology trees
**Aegis Expeditionary**
- Composite Plating
- Targeting AI
- Reactor Optimization
- Siege Doctrine → unlocks Siege Artillery
- Aerospace Command → unlocks Gunships

**Noctis Brood**
- Carapace Grafting
- Synaptic Acceleration
- Metabolic Bloom
- Acid Evolution
- Alpha Mauler Strain → unlocks Brute Maulers
- Phase Brood → unlocks Wraith Fliers

Research has costs, prerequisites, building requirements, queues, and live progress bars. Combat/economy upgrades modify the live simulation rather than acting as UI-only unlocks.

### Tactical controls
- **Attack Move:** click the Attack Move command or press `Shift+A`, then right-click a destination.
- **Control groups:** `Ctrl+1` through `Ctrl+9` assigns the current selection; `1` through `9` recalls it. Double-tap a group number to center the camera.
- **Stop:** cancels movement, attack orders, and attack-move state.
- Existing unit abilities remain faction-specific.

### Movement polish
A local-avoidance/separation system now keeps friendly units from stacking directly on top of one another while moving in groups.

### Economy-driven enemy AI
The enemy no longer receives free scripted attack-wave units. It now:
- starts with a refinery and worker
- harvests the same finite resource patches as the player
- pays credits for workers and combat units
- uses the same timed production queues
- rebuilds lost critical infrastructure when it can afford to
- builds extra defenses / refineries over time
- respects its power grid and builds additional power when overloaded
- escalates its unit composition over the course of the match
- launches attacks using units it actually owns


## Three-faction expansion + main menu

The game now opens to a real pre-match command screen instead of immediately constructing a Phaser battle. From the main menu you can choose:

- scenario / skirmish map
- player faction
- enemy faction (mirror matches are supported)
- AI difficulty: Cadet, Standard, Veteran, or Extermination

The selected difficulty changes AI starting credits, harvesting efficiency, production speed, attack cadence, and starting army strength.

### Playable factions

#### Aegis Expeditionary
Industrial combined arms with conventional infantry, armor, artillery, aircraft, healing support, and mature logistics.

Roster: Rifleman, Field Medic, Marauder, Specter Sniper, Medium Tank, Siege Artillery, Goliath Walker, Gunship, Valkyrie Interceptor, Harvester.

Structures: Construction Yard, Fusion Reactor, Refinery, Barracks, War Factory, Flight Control, Science Directorate, Guard Turret, Sensor Array.

Nine faction-specific research options cover armor, targeting, economy, precision infantry, siege systems, heavy armor, air technology, interceptors, and medical support.

#### Noctis Brood
Fast biological warfare built around mutation, regeneration/support, heavy organisms, and predatory air units.

Roster: Skitter Drone, Spitter Beast, Brood Caster, Brute Mauler, Ravager Strain, Wraith Flier, Devourer, Extractor Drone.

Structures: Hive Yard, Spore Reactor, Biomass Processor, Spawn Pit, Gene Forge, Sky Nest, Cerebral Nexus, Spine Cannon, Seer Node.

Nine evolution paths cover carapace armor, attack speed, economy, acid weapons, support organisms, heavy strains, Ravagers, phase fliers, and Devourers.

#### Veyra Ascendancy
An original high-tech psionic/crystal faction inspired by the *archetype* of expensive elite sci-fi armies: fewer but stronger units, regenerating energy shields, precision weapons, advanced air power, and phase abilities. It does not use franchise artwork or named characters.

Roster: Lancer, Resonant Adept, Oracle Seer, Sentinel Walker, Prism Titan, Seraph Fighter, Concord Sphere, Crystal Probe.

Structures: Nexus Core, Flux Pylon, Crystal Assimilator, Disciple Gate, Forge Sanctum, Star Portal, Archive Spire, Prism Battery, Oracle Beacon.

Nine Ascension technologies cover shield regeneration, weapon resonance, crystal economy, phase movement, support/detection, heavy constructs, titan-class units, advanced fighters, and late-game command craft.

Veyra units and structures have regenerating shields in addition to normal hit points. Seers can restore allied shields and the faction has Shield Surge, Phase Stride, and Resonance Overcharge tactical abilities.

### Expanded production model

Production is now separated into infantry, ground/heavy, and air structures rather than forcing every unit through two factories. Each production structure has its own FIFO queue, live percentage/progress bar, queued count, cancellation/refund handling, and rally point. Rally points work for infantry, ground, and air-production structures.

Research uses real timed queues with prerequisites, costs, required structures, live progress bars, and unit unlocks. Tier 2/3 units cannot simply be purchased before their corresponding technology is completed.

### Additional battlefield systems retained

- functional workers for all three factions
- finite resource fields and refinery income
- real enemy economy / production rather than free scripted unit spawns
- attack-move
- control groups 1–9
- local unit avoidance
- A* ground pathfinding and direct air navigation
- fog of war
- air/ground targeting rules
- healing and shield-support systems
- unit abilities
- base-building AI
- production queues and research queues
- rally points
- multiple missions and skirmish maps

### Windows development note

Vite now proxies the backend explicitly through `127.0.0.1` rather than `localhost`:

```text
http://127.0.0.1:8000
```

This avoids the Windows/Node case where `localhost` resolves to IPv6 `::1` while Uvicorn is listening on IPv4 `127.0.0.1`.
