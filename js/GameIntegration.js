import * as THREE from 'three';
import { SolarSystem } from './space/SolarSystem.js';
import { TerrainGenerator } from './planet/TerrainGenerator.js';
import { SpaceCombat } from './combat/SpaceCombat.js';
import { GroundCombat } from './combat/GroundCombat.js';

/**
 * Main integration class for Cosmic Conqueror
 * Combines functionality from various projects into a cohesive game
 */
class GameIntegration {
    /**
     * Create the game integration
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Game state
        this.state = {
            mode: 'space', // 'space', 'planet', 'space-combat', 'ground-combat'
            activePlanet: null,
            playerPosition: new THREE.Vector3(),
            score: 0,
            gameTime: 0
        };
        
        // Core Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            10000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        // Initialize systems (inactive by default)
        this.solarSystem = new SolarSystem(this.scene, options.solarSystem);
        this.terrainGenerator = new TerrainGenerator(this.scene, options.terrain);
        this.spaceCombat = new SpaceCombat(this.scene, this.camera, options.spaceCombat);
        this.groundCombat = new GroundCombat(this.scene, this.camera, options.groundCombat);
        
        // Portal system for Vibe Jam requirement
        this.portalSystem = null; // Will be initialized later
        
        // Debug and UI
        this.debugMode = options.debugMode || false;
        this.uiElements = {};
    }
    
    /**
     * Initialize the game
     * @param {HTMLElement} container - DOM element to attach the renderer to
     */
    initialize(container) {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);
        
        // Setup camera
        this.camera.position.set(0, 10, 50);
        this.camera.lookAt(0, 0, 0);
        
        // Setup lighting
        this.setupLighting();
        
        // Initialize subsystems
        this.solarSystem.initialize();
        
        // Set initial game mode
        this.setGameMode('space');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start animation loop
        this.animate();
    }
    
    /**
     * Set up scene lighting
     */
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(10, 10, 10);
        sunLight.castShadow = true;
        
        // Adjust shadow properties
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -20;
        sunLight.shadow.camera.right = 20;
        sunLight.shadow.camera.top = 20;
        sunLight.shadow.camera.bottom = -20;
        
        this.scene.add(sunLight);
    }
    
    /**
     * Set up event listeners for user input
     */
    setupEventListeners() {
        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Input handlers will be set up based on current game mode
    }
    
    /**
     * Main animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        this.state.gameTime += deltaTime;
        
        this.update(deltaTime);
        this.render();
    }
    
    /**
     * Update game state
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Update active systems based on game mode
        switch (this.state.mode) {
            case 'space':
                this.solarSystem.update(deltaTime);
                // Check if player is near an enemy ship to transition to combat
                if (this.shouldEnterSpaceCombat()) {
                    this.setGameMode('space-combat');
                }
                break;
                
            case 'planet':
                this.terrainGenerator.update(deltaTime, this.state.playerPosition);
                // Check if enemies are nearby to transition to ground combat
                if (this.shouldEnterGroundCombat()) {
                    this.setGameMode('ground-combat');
                }
                break;
                
            case 'space-combat':
                this.spaceCombat.update(deltaTime);
                // Return to space mode when combat ends
                if (this.spaceCombat.isCombatComplete()) {
                    this.setGameMode('space');
                }
                break;
                
            case 'ground-combat':
                this.groundCombat.update(deltaTime);
                // Return to planet mode when combat ends
                if (this.groundCombat.isCombatComplete()) {
                    this.setGameMode('planet');
                }
                break;
        }
    }
    
    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Change game mode
     * @param {string} mode - New game mode
     */
    setGameMode(mode) {
        // Deactivate current systems
        this.deactivateCurrentSystems();
        
        // Set new mode
        this.state.mode = mode;
        
        // Activate new systems
        switch (mode) {
            case 'space':
                this.setupSpaceMode();
                break;
                
            case 'planet':
                this.setupPlanetMode();
                break;
                
            case 'space-combat':
                this.setupSpaceCombatMode();
                break;
                
            case 'ground-combat':
                this.setupGroundCombatMode();
                break;
        }
        
        console.log(`Game mode changed to: ${mode}`);
    }
    
    /**
     * Deactivate all systems
     */
    deactivateCurrentSystems() {
        // Store camera position for continuity
        this.state.playerPosition = this.camera.position.clone();
        
        // Deactivate systems
        this.solarSystem.active = false;
        this.terrainGenerator.active = false;
        this.spaceCombat.deactivate();
        this.groundCombat.deactivate();
    }
    
    /**
     * Setup space exploration mode
     */
    setupSpaceMode() {
        // Clear scene except for essential elements
        this.clearSceneForModeChange();
        
        // Activate solar system
        this.solarSystem.active = true;
        
        // Reset camera
        this.camera.position.copy(this.state.playerPosition);
        this.camera.lookAt(0, 0, 0);
        
        // Setup space controls
        this.setupSpaceControls();
    }
    
    /**
     * Setup planetary exploration mode
     */
    setupPlanetMode() {
        // Clear scene for new mode
        this.clearSceneForModeChange();
        
        // Configure terrain for active planet
        if (this.state.activePlanet) {
            this.terrainGenerator.setPlanetType(this.state.activePlanet.type);
        } else {
            this.terrainGenerator.setPlanetType('earth');
        }
        
        // Initialize and activate terrain
        this.terrainGenerator.initialize();
        this.terrainGenerator.active = true;
        
        // Position player on terrain
        const spawnPosition = new THREE.Vector3(0, 10, 0);
        this.camera.position.copy(spawnPosition);
        this.state.playerPosition = spawnPosition;
        
        // Setup first-person controls
        this.setupPlanetControls();
    }
    
    /**
     * Setup space combat mode
     */
    setupSpaceCombatMode() {
        // Save current position for returning after combat
        this.state.returnPosition = this.camera.position.clone();
        
        // Initialize combat at current position
        this.spaceCombat.initialize(this.state.playerPosition);
        this.spaceCombat.activate();
        
        // Setup combat controls
        this.setupSpaceCombatControls();
    }
    
    /**
     * Setup ground combat mode
     */
    setupGroundCombatMode() {
        // Save position for returning after combat
        this.state.returnPosition = this.camera.position.clone();
        
        // Initialize ground combat
        this.groundCombat.initialize();
        this.groundCombat.activate();
        
        // Connect terrain to physics system
        this.groundCombat.physics.setTerrain(this.terrainGenerator);
        
        // Setup FPS controls
        this.setupGroundCombatControls();
    }
    
    /**
     * Clear scene elements for mode change
     */
    clearSceneForModeChange() {
        // Preserve certain scene elements and remove others
        // Implementation depends on specific requirements
    }
    
    /**
     * Setup controls for space mode
     */
    setupSpaceControls() {
        // Implement space navigation controls
    }
    
    /**
     * Setup controls for planet mode
     */
    setupPlanetControls() {
        // Implement planet exploration controls
    }
    
    /**
     * Setup controls for space combat
     */
    setupSpaceCombatControls() {
        // Implement space combat controls
    }
    
    /**
     * Setup controls for ground combat
     */
    setupGroundCombatControls() {
        // Implement FPS controls
    }
    
    /**
     * Check if player should enter space combat
     * @returns {boolean} True if should enter combat
     */
    shouldEnterSpaceCombat() {
        // Logic to determine if space combat should be triggered
        return false; // Placeholder
    }
    
    /**
     * Check if player should enter ground combat
     * @returns {boolean} True if should enter combat
     */
    shouldEnterGroundCombat() {
        // Logic to determine if ground combat should be triggered
        return false; // Placeholder
    }
    
    /**
     * Land on a planet
     * @param {Object} planet - Planet data
     */
    landOnPlanet(planet) {
        this.state.activePlanet = planet;
        this.setGameMode('planet');
    }
    
    /**
     * Return to space from a planet
     */
    leaveCurrentPlanet() {
        this.setGameMode('space');
    }
    
    /**
     * Create a portal to another location
     * @param {string} targetMode - Target game mode
     * @param {THREE.Vector3} targetPosition - Target position
     * @param {Object} params - Additional portal parameters
     */
    createPortal(targetMode, targetPosition, params = {}) {
        // Vibe Jam portal implementation
        console.log(`Creating portal to ${targetMode} at position ${targetPosition.x}, ${targetPosition.y}, ${targetPosition.z}`);
        console.log('Portal parameters:', params);
        
        // Portal implementation would go here
    }
    
    /**
     * Processa i parametri ricevuti da un portale
     * @param {Object} params Parametri dal portale
     */
    processPortalParameters(params) {
        console.log('GameIntegration: Ricevuti parametri dal portale:', params);
        // ... existing code ...
    }
}

export { GameIntegration }; 