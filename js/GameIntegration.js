import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { WorldManager } from './worldManager.js';
import { createPerformanceMonitor } from './performanceMonitor.js';
import { Player } from './player.js';
import { UIManager } from './uiManager.js';
import { SolarSystem } from './space/SolarSystem.js';
import { TerrainGenerator } from './terrain/TerrainGenerator.js';
import { SpaceCombat } from './combat/SpaceCombat.js';
import { GroundCombat } from './combat/GroundCombat.js';
import { enableLowQualityMode, cleanupUnusedResources } from './utils/performance.js';

/**
 * Integrazione centrale del gioco
 * Gestisce l'inizializzazione, il ciclo di gioco e la coordinazione dei moduli
 */
export class GameIntegration {
    constructor(options = {}) {
        // Opzioni con valori predefiniti
        this.options = {
            targetFPS: 60,
            debug: false,
            quality: 'normal',
            initialMode: 'space',
            ...options
        };
        
        // Riferimenti THREE.js
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.composer = null;
        this.controls = null;
        
        // Stato di gioco
        this.state = {
            mode: this.options.initialMode, // 'space', 'planet', 'combat'
            gameTime: 0,
            isGameOver: false,
            isPaused: false,
            activePlanet: null,
            activeSystem: null,
            systems: [],
            planets: []
        };
        
        // Moduli principali
        this.worldManager = null;
        this.player = null;
        this.uiManager = null;
        this.solarSystem = null;
        this.terrainGenerator = null;
        this.spaceCombat = null;
        this.groundCombat = null;
        
        // Performance
        this.performanceMonitor = createPerformanceMonitor();
        this.animationFrameId = null;
        
        console.log("GameIntegration creato con opzioni:", this.options);
    }
    
    /**
     * Inizializza il gioco
     * @param {HTMLElement} container - Contenitore DOM
     * @returns {Promise} - Promise che si risolve quando l'inizializzazione è completa
     */
    async initialize(container) {
        this.container = container;
        
        // Crea gli elementi THREE.js base
        this.initializeTHREE();
        
        // Inizializza i moduli principali
        this.worldManager = new WorldManager(this.scene);
        this.player = new Player();
        this.uiManager = new UIManager(this.container);
        
        this.solarSystem = new SolarSystem(this.scene);
        this.terrainGenerator = new TerrainGenerator(this.scene);
        this.spaceCombat = new SpaceCombat(this.scene);
        this.groundCombat = new GroundCombat(this.scene);
        
        // Genera l'universo
        this.state.systems = await this.generateSystems();
        this.state.planets = await this.generatePlanets(this.state.systems);
        
        // Configura la modalità iniziale
        this.setGameMode(this.state.mode);
        
        // Imposta event listener
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Inizia il ciclo di gioco
        this.animate();
        
        console.log("Inizializzazione completata");
        return Promise.resolve();
    }
    
    /**
     * Inizializza THREE.js (scene, camera, renderer, postprocessing)
     */
    initializeTHREE() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.00025);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 10000
        );
        this.camera.position.set(0, 10, 50);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // Clock
        this.clock = new THREE.Clock();
        
        // Luci base
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Effetti post-processing
        this.setupPostProcessing();
    }
    
    /**
     * Configura effetti post-processing
     */
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Aggiungi bloom pass per effetto bagliore
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.4, 0.85
        );
        this.composer.addPass(bloomPass);
        
        // Ottimizza in base alla qualità
        if (this.options.quality === 'low') {
            enableLowQualityMode(this.scene, this.camera, this.composer, THREE);
            this.performanceMonitor.enableLowQuality();
        }
    }
    
    /**
     * Genera i sistemi stellari
     * @returns {Array} Array di sistemi stellari
     */
    async generateSystems() {
        // Placeholder: In una versione completa questo potrebbe caricare da un file
        // o generare proceduralmente
        const systems = [];
        
        // Crea alcuni sistemi di esempio
        for (let i = 0; i < 5; i++) {
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * 2000,
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 2000
            );
            
            systems.push({
                id: `system_${i}`,
                name: `Sistema ${i + 1}`,
                position: position,
                starColor: new THREE.Color(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5),
                starSize: 10 + Math.random() * 20,
                planets: [] // Verrà popolato più tardi
            });
        }
        
        return systems;
    }
    
    /**
     * Genera i pianeti per i sistemi stellari
     * @param {Array} systems - Array di sistemi stellari
     * @returns {Array} Array di pianeti
     */
    async generatePlanets(systems) {
        const planets = [];
        
        systems.forEach(system => {
            const numPlanets = 2 + Math.floor(Math.random() * 6); // 2-7 pianeti per sistema
            
            for (let i = 0; i < numPlanets; i++) {
                const orbitRadius = 50 + i * 30 + Math.random() * 20;
                const angle = Math.random() * Math.PI * 2;
                const x = system.position.x + Math.cos(angle) * orbitRadius;
                const z = system.position.z + Math.sin(angle) * orbitRadius;
                
                // Tipi di pianeti
                const types = ['rocky', 'gas', 'ocean', 'lava', 'forest'];
                const type = types[Math.floor(Math.random() * types.length)];
                
                const planet = {
                    id: `planet_${planets.length}`,
                    systemId: system.id,
                    name: `Pianeta ${planets.length + 1}`,
                    position: new THREE.Vector3(x, system.position.y, z),
                    parentStar: system,
                    type: type,
                    size: type === 'gas' ? 15 + Math.random() * 15 : 5 + Math.random() * 10,
                    orbitRadius: orbitRadius,
                    orbitSpeed: 0.0001 + Math.random() * 0.0005,
                    rotationSpeed: 0.0005 + Math.random() * 0.001,
                    orbitAngle: angle,
                    color: new THREE.Color(Math.random(), Math.random(), Math.random()),
                    defense: Math.random() * 100
                };
                
                planets.push(planet);
                system.planets.push(planet);
            }
        });
        
        return planets;
    }
    
    /**
     * Ciclo principale di animazione
     */
    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        // --- Performance Start ---
        this.performanceMonitor.update();
        
        // Log periodico delle performance
        if (this.performanceMonitor.frameCount % 100 === 0) {
            this.performanceMonitor.logPerformance();
        }
        
        // Applica limiter FPS
        if (!this.performanceMonitor.shouldRenderFrame()) {
            return; // Salta il frame
        }
        
        // --- Performance End ---
        const deltaTime = this.clock.getDelta();
        this.state.gameTime += deltaTime;
        
        if (!this.state.isPaused && !this.state.isGameOver) {
            this.update(deltaTime);
        }
        
        this.render();
    }
    
    /**
     * Aggiorna lo stato del gioco
     * @param {number} deltaTime - Delta time
     */
    update(deltaTime) {
        // --- Gestione qualità dinamica ---
        if (!this.performanceMonitor.lowQualityMode && this.performanceMonitor.shouldSwitchToLowQuality()) {
            console.warn("Switching to LOW quality mode");
            enableLowQualityMode(this.scene, this.camera, this.composer, THREE);
            this.worldManager.setLODQuality('low');
            this.performanceMonitor.enableLowQuality();
        }
        
        // --- Cleanup periodico ---
        if (this.performanceMonitor.frameCount % 300 === 0) {
            cleanupUnusedResources(THREE);
        }
        
        // Aggiorna il player
        this.player.update(deltaTime);
        
        // Aggiorna il WorldManager con la posizione del giocatore
        const playerPosition = this.state.mode === 'space' ? 
            this.camera.position : this.player.position;
        this.worldManager.update(deltaTime, playerPosition);
        
        // Aggiorna in base alla modalità corrente
        switch (this.state.mode) {
            case 'space':
                this.updateSpaceMode(deltaTime);
                break;
            case 'planet':
                this.updatePlanetMode(deltaTime);
                break;
            case 'combat':
                this.updateCombatMode(deltaTime);
                break;
        }
        
        // Aggiorna l'UI con lo stato corrente
        this.uiManager.update(this.state);
        
        // Gestisci collisioni e altri eventi
        this.checkCollisions();
        this.checkGameEvents();
    }
    
    /**
     * Aggiorna la modalità spaziale
     * @param {number} deltaTime - Delta time
     */
    updateSpaceMode(deltaTime) {
        // Aggiorna le stelle
        this.solarSystem.update(deltaTime);
        
        // Verifica se il giocatore è vicino a un pianeta
        this.checkPlanetProximity();
        
        // Verifica se dovremmo entrare in modalità combattimento
        if (this.shouldEnterSpaceCombat()) {
            this.setGameMode('combat');
        }
    }
    
    /**
     * Aggiorna la modalità planetaria
     * @param {number} deltaTime - Delta time
     */
    updatePlanetMode(deltaTime) {
        // Aggiorna il terreno
        this.terrainGenerator.update(deltaTime);
        
        // Verifica se il giocatore è vicino a un portale
        this.checkPortalProximity();
        
        // Verifica se dovremmo entrare in modalità combattimento
        if (this.shouldEnterGroundCombat()) {
            this.setGameMode('combat');
        }
    }
    
    /**
     * Aggiorna la modalità combattimento
     * @param {number} deltaTime - Delta time
     */
    updateCombatMode(deltaTime) {
        if (this.state.lastMode === 'space') {
            this.spaceCombat.update(deltaTime);
        } else {
            this.groundCombat.update(deltaTime);
        }
        
        // Verifica se il combattimento è finito
        if (this.isCombatComplete()) {
            this.setGameMode(this.state.lastMode);
        }
    }
    
    /**
     * Verifica collisioni tra oggetti
     */
    checkCollisions() {
        // Implementazione da completare in base al sistema di collisione
    }
    
    /**
     * Verifica eventi speciali nel gioco
     */
    checkGameEvents() {
        // Implementazione da completare per eventi come missioni, obiettivi, ecc.
    }
    
    /**
     * Verifica se il giocatore è vicino a un pianeta
     */
    checkPlanetProximity() {
        // Implementazione per rilevare quando il giocatore è vicino a un pianeta
        // e mostrare l'UI di interazione
    }
    
    /**
     * Verifica se il giocatore è vicino a un portale
     */
    checkPortalProximity() {
        // Implementazione per rilevare quando il giocatore è vicino a un portale
        // che permette di tornare nello spazio
    }
    
    /**
     * Rendering della scena
     */
    render() {
        // Usa composer se disponibile, altrimenti renderer standard
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /**
     * Imposta la modalità di gioco
     * @param {string} mode - Modalità di gioco ('space', 'planet', 'combat')
     * @param {Object} options - Opzioni aggiuntive per la modalità
     */
    setGameMode(mode, options = {}) {
        // Salva la modalità precedente per eventuali ritorni
        if (this.state.mode !== mode) {
            this.state.lastMode = this.state.mode;
        }
        
        // Disattiva i sistemi della modalità corrente
        this.deactivateCurrentSystems();
        
        // Aggiorna la modalità
        this.state.mode = mode;
        console.log(`Modalità di gioco cambiata: ${mode}`);
        
        // Configura la nuova modalità
        switch (mode) {
            case 'space':
                this.setupSpaceMode();
                break;
            case 'planet':
                this.setupPlanetMode(options.planet || this.state.activePlanet);
                break;
            case 'combat':
                this.setupCombatMode(options.enemies);
                break;
        }
        
        // Notifica l'UI del cambio di modalità
        this.uiManager.setGameMode(mode, options);
    }
    
    /**
     * Disattiva i sistemi della modalità corrente
     */
    deactivateCurrentSystems() {
        // Implementazione della logica per disattivare i sistemi non necessari
        // quando si cambia modalità di gioco
        this.clearSceneForModeChange();
    }
    
    /**
     * Pulisce la scena per il cambio di modalità
     */
    clearSceneForModeChange() {
        // Rimuovi oggetti specifici della modalità precedente, preservando
        // quelli comuni (luci, player, UI 3D)
    }
    
    /**
     * Configura la modalità spaziale
     */
    setupSpaceMode() {
        // Crea visuali dell'universo
        this.worldManager.createUniverseVisuals(this.state.systems, this.state.planets);
        
        // Configura controlli per lo spazio
        this.setupSpaceControls();
        
        // Posiziona il giocatore/camera
        if (this.state.lastPosition) {
            this.camera.position.copy(this.state.lastPosition);
        }
    }
    
    /**
     * Configura la modalità planetaria
     * @param {Object} planet - Dati del pianeta
     */
    setupPlanetMode(planet) {
        if (!planet) {
            console.error("Tentativo di entrare in modalità pianeta senza un pianeta selezionato");
            this.setGameMode('space');
            return;
        }
        
        // Salva il pianeta attivo
        this.state.activePlanet = planet;
        
        // Salva la posizione nello spazio per tornare indietro
        this.state.lastPosition = this.camera.position.clone();
        
        // Focalizza sul pianeta
        this.worldManager.focusOnPlanet(planet.id);
        
        // Genera terreno per il pianeta
        this.terrainGenerator.generateTerrain(planet);
        
        // Configura controlli per il pianeta
        this.setupPlanetControls();
        
        // Posiziona il giocatore sulla superficie
        this.player.position.set(0, planet.size + 2, 0);
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 2; // Alza la camera rispetto al giocatore
    }
    
    /**
     * Configura la modalità combattimento
     * @param {Array} enemies - Nemici da affrontare
     */
    setupCombatMode(enemies) {
        // Configura il combattimento in base alla modalità precedente
        if (this.state.lastMode === 'space') {
            this.spaceCombat.startCombat(enemies || this.generateSpaceEnemies());
        } else {
            this.groundCombat.startCombat(enemies || this.generateGroundEnemies());
        }
        
        // Configura controlli per il combattimento
        this.setupCombatControls();
    }
    
    /**
     * Configura controlli per lo spazio
     */
    setupSpaceControls() {
        // Implementazione controlli per modalità spaziale
    }
    
    /**
     * Configura controlli per il pianeta
     */
    setupPlanetControls() {
        // Implementazione controlli per modalità planetaria
    }
    
    /**
     * Configura controlli per il combattimento
     */
    setupCombatControls() {
        // Implementazione controlli per modalità combattimento
    }
    
    /**
     * Verifica se dovremmo entrare in combattimento spaziale
     * @returns {boolean} True se dovremmo entrare in combattimento
     */
    shouldEnterSpaceCombat() {
        // Logica per decidere quando entrare in combattimento spaziale
        return false; // Placeholder
    }
    
    /**
     * Verifica se dovremmo entrare in combattimento a terra
     * @returns {boolean} True se dovremmo entrare in combattimento
     */
    shouldEnterGroundCombat() {
        // Logica per decidere quando entrare in combattimento a terra
        return false; // Placeholder
    }
    
    /**
     * Verifica se il combattimento è completo
     * @returns {boolean} True se il combattimento è completo
     */
    isCombatComplete() {
        // Verifica se il combattimento è finito
        if (this.state.lastMode === 'space') {
            return this.spaceCombat.isComplete();
        } else {
            return this.groundCombat.isComplete();
        }
    }
    
    /**
     * Genera nemici spaziali
     * @returns {Array} Array di nemici
     */
    generateSpaceEnemies() {
        // Implementazione per generare nemici nello spazio
        return [];
    }
    
    /**
     * Genera nemici terrestri
     * @returns {Array} Array di nemici
     */
    generateGroundEnemies() {
        // Implementazione per generare nemici sul terreno
        return [];
    }
    
    /**
     * Handler per il ridimensionamento della finestra
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    /**
     * Aggiunge metodi per il WorldManager
     */
    setLODQuality(quality) {
        if (this.worldManager) {
            this.worldManager.setLODQuality(quality);
        }
    }
    
    /**
     * Pulisce le risorse quando il gioco viene fermato
     */
    dispose() {
        // Ferma il ciclo di gioco
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Rimuovi event listener
        window.removeEventListener('resize', this.onWindowResize);
        
        // Pulisci THREE.js
        this.scene.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();
        
        // Pulisci moduli
        // ...
        
        console.log("Risorse del gioco liberate");
    }
} 