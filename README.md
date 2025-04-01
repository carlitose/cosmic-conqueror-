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

# Cosmic Conqueror - Integrazione Espansa

Cosmic Conqueror è un gioco dove you explore space, conquer planets, and fight against planetary defenses. The game supports two distinct modes:

1. **Space Exploration** - Naviga attraverso il sistema solare, scopri nuovi pianeti e affronta nemici nello spazio.
2. **Planetary Exploration** - Esplora la superficie di pianeti con terreno generato proceduralmente.

## Nuove funzionalità integrate

Il gioco ora include nuovi moduli integrati da vari progetti:

### Sistema Solare Realistico
- Visualizzazione realistica di stelle e pianeti con effetti visivi avanzati
- Orbite, rotazione e simulazione di corpi celesti
- Sistema di stelle e pianeti con proprietà fisiche realistiche

### Generazione Procedurale di Terreno Planetario
- Generazione di terreno in tempo reale durante l'esplorazione dei pianeti
- Diversi tipi di pianeti con caratteristiche uniche
- Sistema di rendering ottimizzato per prestazioni fluide

### Combattimento Spaziale
- Sistema di combattimento contro navi nemiche nello spazio
- Differenti tipologie di attacco e nemici
- Sfide progressivamente più difficili

### Combattimento a Terra
- Sistema FPS per battaglie sulla superficie dei pianeti
- Diverse armi e nemici da affrontare
- Fisica realistica e collisioni

## Struttura del progetto

Il progetto è ora organizzato in moduli specializzati:

```
js/
├── space/           # Moduli per la navigazione spaziale
│   └── SolarSystem.js
├── planet/          # Moduli per la generazione di terreno
│   └── TerrainGenerator.js
├── combat/          # Moduli per il combattimento
│   ├── SpaceCombat.js
│   ├── GroundCombat.js
│   ├── GroundWeapons.js
│   ├── GroundEnemies.js
│   └── GroundPhysics.js
├── GameIntegration.js # Modulo principale di integrazione
├── main.js          # Punto di ingresso del gioco
├── player.js        # Sistema del giocatore
├── enemy.js         # Sistema di nemici
└── universe.js      # Generatore di universo
```

## Comandi

I comandi sono stati estesi per supportare le nuove modalità:

- **WASD**: Movimento
- **Mouse**: Guarda intorno
- **Spazio**: Salto/Volo
- **Clic sinistro/destro del mouse**: Attacchi
- **1**: Modalità Spazio
- **2**: Modalità Pianeta (quando vicino a un pianeta)
- **3**: Modalità Combattimento Spaziale
- **4**: Modalità Combattimento a Terra (quando su un pianeta)
- **M**: Cicla tra le modalità di gioco

## Integrazione con Vibe Jam

Il gioco supporta completamente i requisiti di Vibe Jam con:
- Portali di entrata e uscita
- Passaggio di parametri attraverso i portali
- Mantenimento dello stato del giocatore tra diverse applicazioni

## Crediti

Questa versione integra componenti da diversi progetti:
- Sistema solare realistico
- Engine di generazione di terreno procedurale OpenWorldJS
- Sistema di combattimento terrestre basato su Three-FPS
- Meccaniche di combattimento spaziale da ThreeJS-Game 