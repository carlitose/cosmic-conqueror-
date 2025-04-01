# Portal Game - Vibe Jam 2025

A space exploration and planetary conquest game with portals connecting to the Vibeverse.

## Game Concept

Cosmic Conqueror is a game where you explore space, conquer planets, and fight against planetary defenses. The game supports two distinct modes:

1. **Space Exploration**: Navigate between star systems, planets, and engage in space combat.
2. **Planetary Exploration**: Land on planets and explore procedurally generated terrains.

The game includes the portals from Vibe Jam 2025 that allow players to travel to other games.

## Architecture

The project is structured into separate modules:

- **core**: Core game system, UI, event management, state management
- **space**: Space navigation, star systems, planets
- **planet**: Procedural terrain generation, terrestrial physics
- **combat**: Combat systems (both space and planetary)
- **player**: Player management, statistics, inventory, progression
- **portals**: Portal system for Vibe Jam

## Main Components

### Space (based on KyleGough/solar-system)
- 3D visualization of the star system
- Planets with textures and orbits
- Space navigation
- Points of interest on planets

### Terrains (based on obecerra3/OpenWorldJS)
- Procedural terrain generation with GPGPU
- Physics with Ammo.js
- First/third-person controls

### Combat (based on mohsenheydari/three-fps and Louis-Tarvin/threejs-game)
- FPS combat system on planets
- Space combat system with flight/weapon modes
- Artificial intelligence for enemies

### Vibe Jam Requirements
- Entry portal (created when a user arrives from another game)
- Exit portal (to go to other games)
- Parameter passing between portals

## How to Play

- WASD/Arrow Keys: Movement
- Mouse: Look around
- Left Click: Primary attack
- Right Click: Special attack
- Space: Toggle flight
- Keys 1-9: Change weapons/abilities
- U: Upgrade menu
- H: Control legend

## Development Plan

1. Integrate space navigation from the solar system model
2. Integrate terrain generation from OpenWorldJS
3. Implement transition between space and planetary modes
4. Add space and ground combat
5. Optimize performance and refine user experience

## Technologies

- Three.js for 3D graphics
- Ammo.js for physics
- WebGL Shaders for visual effects and procedural generation
- Modular JavaScript for game architecture

## Credits

This project combines elements from the following open-source projects:
- [Solar System Model](https://github.com/KyleGough/solar-system) by Kyle Gough
- [OpenWorldJS](https://github.com/obecerra3/OpenWorldJS) by obecerra3
- [Three-FPS](https://github.com/mohsenheydari/three-fps) by Mohsen Heydari
- [ThreeJS-Game](https://github.com/Louis-Tarvin/threejs-game) by Louis Tarvin 