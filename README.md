# HALF-HOP

*A Totally Not Unhinged Game.*

You are **Skippy**, a red kangaroo in a stolen orange **H.O.P. suit** (Hazardous
Outback Protection). The Outback Defence Force built a secret nuclear missile
base on the best grazing land in the red centre. Hop over the fence, get through the
Security Complex, reach **Silo 7** and launch the nuke. Where it lands is a
problem for later.

HALF-HOP plays like Half-Life 1, but it's in third person so you can see the
kangaroo. You can switch to first person with **V**. Everything runs in the
browser and is generated when the game loads. There are no image or sound
files.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

To make a production build:

```bash
npm run build      # outputs to dist/, which any static web server can host
npm run build:single   # also writes dist-single/index.html, the whole game in one HTML file
```

You need a browser with WebGL2: a current Chrome, Edge, Firefox or Safari.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Hop around |
| **Mouse** | Look and aim. Click the game to capture the mouse. |
| **Mouse 1** | Fire. With fists, this is a double-footed **KICK**. |
| **Mouse 2** | Alt fire. With fists, this is a boxing **JAB**. |
| **Q** / Mouse 3 | Quick kick with any weapon |
| **Space** | Hop. Hold it to keep bouncing (auto-hop). |
| **C** (or Left Alt) | Crouch. Hold it to coil your legs, then press **Space** for a **SUPER HOP**. |
| **Shift** | Walk quietly |
| **E** | Use doors and buttons. Hold it on wall chargers and the fuel valve. |
| **R** | Reload |
| **G** | Throw a hand grenade |
| **F** | Flashlight |
| **1 – 5** / Wheel | Choose a weapon |
| **V** | Switch between third and first person |
| **Tab** | Show objectives |
| **F5 / F9** | Quick save / quick load |
| **Esc** | Pause |
| **~** | Developer console |

Crouch is on **C** because in a browser **Ctrl+W** closes the tab.

## What's in the game

- **Three chapters.**
  1. *Outback Perimeter*: sunset in the red centre. A tutorial canyon, a perimeter fence with a sweeping searchlight, a guard booth, a watchtower, dingo kennels, barracks, a comms shack you get into through the roof hatch, and a bunker blast door that triggers an ambush when it opens.
  2. *Security Complex*: offices built around a ring of corridors. There's a checkpoint lobby with a camera and turret, a vent route into the locked armoury, a mess hall fight, the security office where the red keycard is, the Project EMU lab, a two-level generator hall with three breakers to throw, and a pitch-dark server room full of dingoes.
  3. *Silo 7*: a 40 m silo with the missile in the middle. You take the launch key off the Base Commander, fuel the missile while holding off an ambush, find the RPG and open the silo doors. Then a gunship boss attacks, and after that you turn the key.
- **Kangaroo movement.** Air control works like Quake and Half-Life, so you can bunny-hop by holding Space. A charged *super hop* clears 4 m fences, and running into it turns it into a long jump. There are also ladders, and you can tuck your legs mid-air to crouch-jump into vents.
- **The kangaroo model** is made in code and animated with IK. It hops, balances on its tail, does a double-footed kick and boxing jabs, and pulls weapons out of its pouch.
- **Weapons**:
  - Fists & Feet: the kick knocks enemies flying, smashes crates, sends barrels sliding and tips over sentry guns.
  - 9mm pistol, with rapid fire on alt.
  - MP5 SMG, with a grenade launcher on alt.
  - Shotgun, with a double blast on alt.
  - Laser-guided RPG: the rocket follows your crosshair.
  - Hand grenades.
- **Enemies**:
  - ODF grunts in gas masks. They talk to each other over the radio, take cover, strafe, flank, throw grenades and run from yours.
  - Military dingoes that hunt in packs and pounce.
  - Ceiling and floor sentry turrets.
  - A searchlight and a security camera that sound the alarm if they spot you.
  - The gunship boss.
- **Half-Life 1 look.** Every surface uses brushes lit by an in-browser *lightmap compiler*: ray-traced sun, sky and point-light shadows plus ambient occlusion. Models are lit from the lightmap under them, the way GoldSrc lit studio models. Muzzle flashes and explosions add dynamic lights. The renderer runs at low resolution with pixelated upscaling, and the HUD uses orange numerals.
- **Audio.** About 80 sound effects are synthesised with WebAudio. The soundtrack is procedural and rendered offline. Lines from the suit, the PA system, the grunts and the mysterious *K-Man* are spoken with the Web Speech API, and every line also has a subtitle.
- Secrets, three difficulty levels (*Joey*, *Boomer*, *Big Red*), autosaves, quicksave and load, an options menu and an ending.

## Developer console (`~`)

`god`, `noclip`, `notarget`, `impulse 101` (all weapons), `give <item>`,
`map <outback|complex|silo>`, `kill`, `pos`, `tp x y z`, `fire <targetname>`, `fps`.

## Project layout

```
src/
  engine/   renderer, input, brush world + collision, lightmap baker, shaders,
            procedural textures, sky, AABB physics, synthesized audio + music
  game/     game session, player (movement, camera), kangaroo model, weapons,
            view model, FX, nav-grid A*, entities (doors, triggers, NPCs, boss…)
  maps/     map builder DSL (air volumes carve rooms out of the void) + the 3 levels
  ui/       HUD and menus
```

Maps are written in code with a small Hammer-like DSL. You declare *air
volumes* for rooms, corridors and outdoor areas, and the builder wraps each
one in wall, floor and ceiling brushes. Wherever two volumes touch, it cuts an
opening automatically. Entities talk to each other with Half-Life style
`targetname` and `target` I/O.
