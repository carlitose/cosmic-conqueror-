# Portal Game - Vibe Jam 2025

A simple 3D game with portals implemented for Vibe Jam 2025. Navigate through the virtual space and enter portals to travel to other games.

## Features

- **Instant Play**: No loading screens, signups, or logins required
- **Portal System**: Enter portals to navigate to other games in the Vibeverse
- **Return Portals**: When coming from another game, a return portal is created to go back
- **Parameter Passing**: Player information is passed between games via URL parameters

## Controls

- **W / Up Arrow**: Move forward
- **A / Left Arrow**: Move left
- **S / Down Arrow**: Move backward
- **D / Right Arrow**: Move right

## Portal System

### Exit Portal (Green)
- Leads to the main Vibeverse hub at portal.pieter.com
- Passes player information via URL parameters

### Return Portal (Blue)
- Only appears when the player arrives via another portal
- Returns the player to the game they came from
- Preserves player information

### Entry Portal (Red)
- Appears at the player's spawn location when coming from another portal

## URL Parameters

The game supports the following URL parameters:
- `username`: Player's username
- `color`: Player's color (hex or simple color name)
- `speed`: Movement speed in meters per second
- `ref`: URL of the game the player came from
- `portal`: Set to 'true' when coming from a portal

Additional supported parameters:
- `avatar_url`: URL to player's avatar image
- `team`: Player's team name
- `speed_x`, `speed_y`, `speed_z`: Directional speed components
- `rotation_x`, `rotation_y`, `rotation_z`: Player rotation

## Development

This game is built using Three.js and vanilla JavaScript. It doesn't require any build tools or preprocessing.

## Vibe Jam 2025 Requirements

- ✅ Game is at least 80% written by AI
- ✅ Game is instantly playable on web without logins or signups
- ✅ Game is free-to-play
- ✅ Game loads instantly without loading screens
- ✅ Game includes the required Vibe Jam badge
- ✅ Game includes portal functionality 