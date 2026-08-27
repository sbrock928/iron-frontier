# Iron Frontier — Art Style Bible

This document is the single source of truth for the game's visual identity. Every
generated or hand-authored asset must conform to it. `scripts/art/shared.ts`
contains a machine-readable copy of the hard constraints below; if you change one,
change both.

The goal is **grounded military-industrial sci-fi realism** — the look of a
pre-rendered 90s RTS (StarCraft, Command & Conquer, Total Annihilation) where
sprites were rendered from detailed 3D models, not the flat low-poly / cartoon
look the project started with.

---

## 1. Non-negotiable technical constraints

These exist so that 178 independently generated assets composite into one
coherent scene. They are enforced in the prompt preamble and verified by
`scripts/art/process-art.ts`.

| Constraint | Value | Why |
|---|---|---|
| Camera | Top-down, tilted ~15° off vertical | Matches the game's orthographic ground plane |
| Projection | Orthographic (no perspective convergence) | Sprites must read identically anywhere on screen |
| Subject facing | **Nose/front pointing right (0°, east)** | `Unit.body.rotation` is set to the raw movement angle |
| Key light | Top-left, ~35° elevation, neutral white | All shadows fall bottom-right, consistently |
| Fill light | Cool blue-grey bounce from bottom-right, 25% intensity | Keeps shadow detail readable on dark terrain |
| Background | Fully transparent | Composited over terrain |
| Framing | Single centred subject, ~10% margin | `process-art.ts` trims and re-centres, but needs headroom |
| Source resolution | 1024×1024 (generator maximum) | Downsampled to 2× the sprite's on-screen size; never upscaled |
| Ground shadow | **Excluded from the sprite** | `process-art.ts` derives a squashed contact shadow from the alpha channel into `{name}_shadow.png`, drawn under the sprite at runtime |
| Outlines | None | No cel shading, no toon outline, no sticker border |

## 2. Material language

- Weathered, **not** pristine. Chipped paint, oxidation streaks, panel-line grime,
  heat discolouration around exhausts and barrels.
- Physically plausible metal: brushed steel, anodised alloy, dull ceramic composite.
  Micro-surface variation, never a flat fill colour.
- Panel lines, rivets, weld seams, greebles, cabling and vents at a density that
  survives downsampling to 52–118px. Detail that vanishes at target size is wasted.
- Readable **silhouette first**. At 52px a Rifleman must be distinguishable from a
  Lancer by outline alone.

## 3. Faction identity

Faction is expressed through form language and a single accent hue, both baked
directly into the generated art.

> **No runtime recolouring.** An earlier design isolated the accent hue into a
> tint mask so it could be swapped per player. That pass was removed: hue
> analysis of the generated art showed the saturated pixels rarely land near the
> nominal accent hue (e.g. `tank.png` is dominated by 40–60° orange while the
> Aegis accent is ~175° cyan), so the masks came out essentially empty. Accent
> colour is therefore the generator's responsibility — get it right in the
> prompt, because nothing downstream will fix it.

### Aegis Expeditionary — accent `#66e8dd` (cyan)
Human industrial military. Boxy, bolted, utilitarian. Olive-drab and gunmetal
plating over exposed hydraulics and track assemblies. Stencilled unit numbers and
hazard striping. Cyan sensor glass and holographic readouts. Think modern armour
with a near-future overlay.

### Noctis Brood — accent `#c684ff` (violet)
Bio-mechanical horror. Chitinous carapace over wet muscle and exposed sinew.
Asymmetric, organic curves; bone spurs, mandibles, spiracles. Bruised purple-black
shell with translucent violet bioluminescence pulsing beneath the plates. Never
manufactured — always grown.

### Veyra Ascendancy — accent `#e5b6ff` (pale amethyst)
Advanced crystalline artifice. Elegant, curved, symmetrical. Polished white-gold
ceramic with amethyst crystal inlays and floating, unsupported geometry. Seamless
surfaces with hairline energy channels. Serene and ancient rather than mechanical.

## 4. Per-category rules

**Units** — Full colour, subject fills the frame. Vehicles and walkers are rendered
as **two layers**: a hull (`{kind}.png`) and a separately generated turret
(`{kind}_turret.png`) whose pivot is dead centre so it can rotate independently
toward its target. Infantry, air and worker roles are single-layer.

**Buildings** — Viewed from slightly higher than units so the roof reads clearly.
Must show grounding detail (foundation, cabling, exhaust, scorch) so they sit *on*
the terrain rather than floating. Generated once per faction.

**Terrain** — Must tile seamlessly on all four edges. No lighting gradient across
the tile, no recognisable landmark feature that would repeat visibly.

**Effects** — Greyscale/white only. Every effect is tinted at runtime by team
colour, so any baked hue fights that tint.

**Portraits** — Bust framing, three-quarter view, dramatic rim light, dark vignette
background. These are the only assets not viewed top-down.

## 5. Prohibited

Cel shading · toon outlines · flat vector fills · low-poly faceting · isometric or
perspective projection · cast ground shadows · drop shadows · text or logos ·
watermarks · visible background · multiple subjects in frame · motion blur.

---

## 6. Pipeline

```
art/prompts/*.json   ──▶ npm run art:gen     ──▶ art/src/**       (1024px raw, committed)
art/src/**           ──▶ npm run art:process ──▶ art/build/**     (despilled, trimmed, sized, + `_n` normals and `_shadow` contact shadows)
art/build/**         ──▶ npm run art:pack    ──▶ frontend/public/assets/atlas/*
```

Raw generations are committed so the expensive step never needs repeating and the
downstream steps stay fully deterministic. `art:gen` skips anything that already
exists unless `--force` is passed.

The pipeline is deliberately decoupled from the game: replacing AI generation with
Blender renders means dropping files into `art/src/` and rerunning `art:process`.
No game code changes.
