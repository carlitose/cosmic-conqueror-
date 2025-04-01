/**
 * Game Constants
 * This file contains all the constants used throughout the game
 */

// Game Modes
export const GAME_MODES = {
    SPACE: 'space',
    PLANET: 'planet',
    SPACE_COMBAT: 'space-combat',
    GROUND_COMBAT: 'ground-combat'
};

// Projectiles
export const MAX_PROJECTILES = 50;

// Performance Settings
export const PERFORMANCE = {
    TARGET_FPS: 60,
    LOW_QUALITY_THRESHOLD: 20,
    NORMAL_QUALITY_THRESHOLD: 40,
    FPS_SAMPLE_SIZE: 10,
    QUALITY_CHECK_INTERVAL: 300  // Every 300 frames
};

// Physics
export const PHYSICS = {
    FRUSTUM_CHECK_INTERVAL: 500,  // ms between frustum culling checks
    PHYSICS_UPDATE_INTERVAL: 16   // ms between full physics updates
};

// Player
export const PLAYER = {
    DEFAULT_HEALTH: 100,
    DEFAULT_ENERGY: 100,
    BASE_MOVEMENT_SPEED: 50
};

// Game Objects
export const INTERACTION_DISTANCES = {
    PLANET: 20,  
    PORTAL: 10,
    SYSTEM: 100
};

// UI Element IDs
export const UI_ELEMENTS = {
    CHARACTER_SELECTION: 'character-selection',
    START_GAME: 'start-game',
    HEALTH_FILL: 'health-fill',
    ENERGY_FILL: 'energy-fill',
    CURRENCY_AMOUNT: 'currency-amount',
    PLANET_INFO: 'planet-info',
    PLANET_NAME: 'planet-name',
    PLANET_STATUS: 'planet-status',
    PLANET_DEFENSE: 'defense-value',
    CONQUER_BUTTON: 'conquer-btn',
    GAME_OVER_SCREEN: 'game-over-screen',
    RESTART_BUTTON: 'restart-game',
    UPGRADES_SCREEN: 'upgrades-screen',
    CLOSE_UPGRADES: 'close-upgrades',
    LEGEND_SCREEN: 'legend-screen',
    CLOSE_LEGEND: 'close-legend',
    FPS_SELECT: 'fps-select'
};

// Key codes for controls
export const KEYS = {
    FORWARD: ['KeyW', 'ArrowUp'],
    BACKWARD: ['KeyS', 'ArrowDown'],
    LEFT: ['KeyA', 'ArrowLeft'],
    RIGHT: ['KeyD', 'ArrowRight'],
    UP: ['Space'],
    DOWN: ['ShiftLeft', 'ShiftRight'],
    FIRE: ['Mouse0'],  // Left mouse button
    INTERACT: ['KeyE', 'KeyF'],
    TOGGLE_UPGRADES: ['KeyU'],
    TOGGLE_LEGEND: ['KeyL'],
    TOGGLE_MAP: ['KeyM']
}; 