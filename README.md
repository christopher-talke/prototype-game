# Sightline - An Experimental 2D Tactical Arena Shooter

A top-down tactical arena shooter built with TypeScript - no Canvas, no WebGL. 

Every game element is a DOM node; fog of war is a CSS clip-path polygon computed from a 2D raycast each frame. Why? Because why the hell not. This is a prototype game built for fun and learning, not performance or scalability.

Inspired by Counter-Strike, Zero Sievert, and Escape from Tarkov, it started as a learning exercise to understand raycasting, collision detection, and game loops in a familiar environment. It has since grown into a complete game with an economy system, AI bots, multiple maps, and configurable game modes.

Running at a stable 60 FPS with up to 10 AI opponents through DOM element pooling, throttled updates, and segment-based raycast culling.

Of course this was developed with the assistance of AI LLM models, however, the design, architecture, and code were all written and orchestrated by me. The AI was used as a tool to help implement specific features or solve particular algoritmic problems, but the overall vision and execution of the game are my own.

---

## Gameplay & Features

- **Objective**: Eliminate the opposing team. First to 5 round wins takes the match.
- **Teams**: Two teams (Red vs Blue), up to 5 players each.
- **Economy**: Earn money each round to buy weapons and grenades. Manage your economy to outgun the enemy.
- **Fog of War**: You can only see within your line of sight. Use sound and teammate intel to track enemies.
- **Sounds**: Positional audio cues for footsteps, gunfire, and grenades. Use sound to your advantage.
- **Movement**: WASD to move. Use cover and positioning to outplay opponents.
- **Weapons**: Pistols, rifles, and shotguns with different ranges and fire rates. Choose the right tool for the situation.
- **Grenades**: Flashbangs to blind enemies, smoke grenades for cover, frag grenades to deal area damage, and C4 for strategic/timed explosions.
- **Gamemodes**: Team Deathmatch, Snipers, Low Gravity and One Shot Kill. Each mode offers unique challenges and strategies.
- **Maps**: Multiple arenas with different layouts, cover, and sightlines. Inspired by classics from various games adapated to a 2D perspective.
- **Map Editor**: Create and share your own custom maps with the built-in map editor. Design unique arenas and challenge your friends.

---

## Getting Started

If you'd like to run the game locally, and/or develop on it, follow these steps:

```bash
pnpm install
pnpm run dev
```

---

## Architecture

The game is architected with a clear separation of concerns between the simulation and rendering layers.

The simulation layer (`GameSimulation`) is pure state - no DOM access. 

It returns `GameEvent[]` arrays for every mutation. `ClientRenderer` subscribes to the event bus and handles all DOM and audio side effects. This allows for a offline and online adapter to be swapped in and out without touching the core game logic.

This means that the game can be run in a headless mode for server-side simulation, or with a local offline adapter for single player without any changes to the core simulation or rendering logic.

```
OfflineAdapter
  -> GameSimulation  (authoritative state, emits GameEvent[])
  -> gameEventBus
  -> ClientRenderer  (DOM + audio reactions only)
```

--- 

## License
MIT License - see [LICENSE](LICENSE) for details.