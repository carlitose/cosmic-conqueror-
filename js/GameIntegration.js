import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { initializeSetup } from './setup.js';
import { WorldManager } from './worldManager.js';
import { performanceMonitor } from './performanceMonitor.js';
import { Player } from './player.js';
import { initializeUIManager, setPlayer as setUiPlayer, showCharacterSelection, hideCharacterSelection, showGameOver, hideGameOver, updateUI, showPlanetInfo, hidePlanetInfo, closeUpgradesScreen, closeLegendScreen } from './uiManager.js';
import { initAudioPool, playSound } from './audioManager.js';
import { getMovementState } from './playerControls.js';
import { SolarSystem } from './space/SolarSystem.js';
import { TerrainGenerator } from './planet/TerrainGenerator.js';
import { SpaceCombat } from './combat/SpaceCombat.js';
import { GroundCombat } from './combat/GroundCombat.js';
import { UniverseGenerator } from './universe.js';
import { GAME_MODES, UI_ELEMENTS, PERFORMANCE, PHYSICS, MAX_PROJECTILES } from './constants.js';

/**
 * Integrazione centrale del gioco (Orchestratore)
 */
export class GameIntegration {
    constructor(options = {}) {
        this.options = {
            targetFPS: PERFORMANCE.TARGET_FPS,
            debug: false,
            quality: 'normal',
            initialMode: GAME_MODES.SPACE,
            ...options
        };

        // Riferimenti THREE.js (impostati da initialize)
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.composer = null;
        this.pointerLockControls = null;

        // Stato di gioco
        this.state = {
            mode: this.options.initialMode,
            lastMode: null,
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
        this.solarSystem = null;
        this.terrainGenerator = null;
        this.spaceCombat = null;
        this.groundCombat = null;
        this.universeGenerator = null;

        // Projectiles & Combat related
        this.activeProjectiles = [];
        this.projectilePool = [];
        this.activeEnemies = [];
        this.collisionCache = new Map();
        this.lastPhysicsUpdate = 0;
        this.lastFrustumCheck = 0;

        // Animation frame ID
        this.animationFrameId = null;

        console.log("GameIntegration created with options:", this.options);
    }

    /**
     * Inizializza il gioco
     */
    async initialize(container) {
        this.container = container;

        try {
            // 1. Setup THREE.js Core (Scene, Camera, Renderer, Controls, Composer, Clock)
            const setupResult = initializeSetup(container); // setup.js inizializza tutto
            if (!setupResult) throw new Error("Failed to initialize THREE.js setup.");
            this.scene = setupResult.scene;
            this.camera = setupResult.camera;
            this.renderer = setupResult.renderer;
            this.composer = setupResult.composer;
            this.pointerLockControls = setupResult.controls; // Ottieni riferimento da setup.js
            this.clock = new THREE.Clock(); // Inizializza il clock qui

            // 2. Inizializza Performance Monitor
            performanceMonitor.initialize(this.scene, this.camera, this.renderer, this.composer, document.getElementById(UI_ELEMENTS.FPS_SELECT));
            performanceMonitor.setTargetFPS(this.options.targetFPS);
            if (this.options.quality === 'low') {
                performanceMonitor.enableLowQuality();
            }

            // 3. Inizializza Audio Manager
            initAudioPool();

            // 4. Inizializza UI Manager (con callbacks)
            initializeUIManager({
                startGame: this.startGame.bind(this),
                restartGame: this.restartGame.bind(this),
                conquerPlanet: this.attemptConquerPlanet.bind(this),
                upgrade: this.attemptUpgrade.bind(this)
                // Manca upgradePlayer? Rinominato in upgrade
            });

            // 5. Player Controls (Già inizializzati in setup.js)
            // Aggiungi listener per attacchi (è già qui, va bene)
            document.addEventListener('player-attack', (event) => {
                if (this.pointerLockControls?.isLocked && this.player && !this.state.isGameOver) {
                    this.handlePlayerAttack(event.detail);
                }
            });

            // 6. Inizializza moduli di gioco (non attivarli ancora)
            this.worldManager = new WorldManager(this.scene);
            this.universeGenerator = new UniverseGenerator();
            this.solarSystem = new SolarSystem(this.scene);
            this.terrainGenerator = new TerrainGenerator(this.scene, this.camera); // Passa camera?
            this.spaceCombat = new SpaceCombat(this.scene, this.camera, null); // Player sarà passato dopo
            this.groundCombat = new GroundCombat(this.scene, this.camera, null); // Player sarà passato dopo

            // 7. Prepara il pool di proiettili (Logica dal vecchio main.js)
            this.initProjectilePool();

            // 8. Mostra selezione personaggio
            showCharacterSelection();

            // 9. Imposta listener resize finestra
            window.addEventListener('resize', this.onWindowResize.bind(this));

            console.log("GameIntegration Initialization sequence complete. Waiting for player selection...");
            return Promise.resolve();

        } catch (error) {
            console.error("Error during GameIntegration initialization:", error);
            this.dispose(); // Tenta pulizia
            return Promise.reject(error);
        }
    }

    /**
     * Avvia il gioco dopo la selezione del personaggio
     */
    startGame(playerRace) {
        if (!playerRace) {
            console.error("Cannot start game without a player race.");
            return;
        }
        console.log(`Starting game with race: ${playerRace}`);
        hideCharacterSelection();

        try {
            // 1. Crea Player e informa UI/Combat
            this.player = new Player(playerRace); // Ora this.player è definito
            this.player.createMesh(); // Crea mesh ma non aggiungerla (prima persona?)
            setUiPlayer(this.player); // Passa player a UI
            this.spaceCombat.player = this.player; // Passa player a moduli combattimento
            this.groundCombat.player = this.player;

            // 2. Genera Universo
            console.log("Generating universe...");
            const universeData = this.universeGenerator.generateUniverse(50, 5); // Usa valori
            this.state.systems = universeData.systems;
            this.state.planets = universeData.planets;
            console.log(`Universe generated: ${this.state.systems.length} systems, ${this.state.planets.length} planets`);

            // 3. Crea Visuali Universo (stelle, pianeti, ecc.)
            this.worldManager.createUniverseVisuals(this.state.systems, this.state.planets);
            // this.worldManager.createPortals(...); // Crea portali se necessario

            // 4. Configura la modalità di gioco iniziale
            this.setGameMode(GAME_MODES.SPACE); // Usa costante

            // 5. Blocca controlli e avvia loop
            if (this.pointerLockControls) {
                this.pointerLockControls.lock();
            } else {
                console.error("PointerLockControls not available when starting game!");
            }
            this.startGameLoop();

            console.log("Game Started!");

        } catch (error) {
            console.error("Error starting game:", error);
            this.handleGameOver(); // Gestisci errore come game over
        }
    }

    /** Avvia il ciclo di gioco */
    startGameLoop() {
        if (this.animationFrameId) return;
        console.log("Starting game loop...");
        this.clock.start();
        this.state.isPaused = false;
        this.state.isGameOver = false;
        // Resetta tempi per evitare salti
        performanceMonitor.lastFrameTime = performance.now();
        performanceMonitor.lastFrameTimestamp = performance.now();
        this.animate();
    }

    /** Ferma il ciclo di gioco */
    stopGameLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log("Game loop stopped.");
        }
    }

    /** Ciclo principale di animazione */
    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        performanceMonitor.update();
        if (!performanceMonitor.shouldRenderFrame()) return;

        const deltaTime = Math.min(this.clock.getDelta(), 0.1); // Limita delta time massimo
        this.state.gameTime += deltaTime;

        if (this.state.isPaused || this.state.isGameOver || !this.player || !this.pointerLockControls?.isLocked) {
            this.render();
            return;
        }

        try {
            this.update(deltaTime);
            this.render();
        } catch (error) {
            console.error("Error in animation loop:", error);
            this.handleGameOver();
        }
    }

    /**
     * Aggiorna lo stato del gioco
     * @param {number} deltaTime - Delta time
     */
    update(deltaTime) {
        performanceMonitor.checkQualityMode();
        if (performanceMonitor.frameCount % 300 === 0) {
            performanceMonitor.cleanupUnusedResources(this.collisionCache);
        }

        const movement = getMovementState();
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);

        this.player.update(
            deltaTime,
            movement.forward, movement.backward, movement.left, movement.right,
            movement.up, movement.down,
            cameraDirection
        );
        this.pointerLockControls.getObject().position.copy(this.player.position);

        this.worldManager.update(deltaTime, this.camera.position);

        const cullingInterval = performanceMonitor.lowQualityMode ? PHYSICS.FRUSTUM_CHECK_INTERVAL * 2 : PHYSICS.FRUSTUM_CHECK_INTERVAL;
        const time = performance.now();
        if (time - this.lastFrustumCheck > cullingInterval) {
            this.updateFrustumCulling();
            this.lastFrustumCheck = time;
        }

        // Aggiorna moduli specifici della modalità
        this.updateActiveModeLogic(deltaTime);

        this.updateEnemies(deltaTime);
        this.updateProjectiles(deltaTime);

        updateUI(); // Aggiorna UI (da uiManager.js)
    }

    /** Aggiorna logica specifica della modalità */
    updateActiveModeLogic(deltaTime) {
        switch (this.state.mode) {
            case GAME_MODES.SPACE:
                if (this.solarSystem?.active) this.solarSystem.update(deltaTime); // Assicurati che update esista e sia corretto
                this.checkPlanetInteraction();
                this.checkPortalInteraction();
                break;
            case GAME_MODES.PLANET:
                if (this.terrainGenerator?.active) this.terrainGenerator.update(deltaTime, this.player.position); // Passa pos player
                this.checkPortalInteraction(); // Potrebbe esserci un portale anche sul pianeta?
                break;
            case GAME_MODES.SPACE_COMBAT:
                if (this.spaceCombat?.active) this.spaceCombat.update(deltaTime);
                if (this.spaceCombat?.isCombatComplete()) this.setGameMode(this.state.lastMode || GAME_MODES.SPACE);
                break;
            case GAME_MODES.GROUND_COMBAT:
                if (this.groundCombat?.active) this.groundCombat.update(deltaTime);
                if (this.groundCombat?.isCombatComplete()) this.setGameMode(this.state.lastMode || GAME_MODES.PLANET);
                break;
        }
    }

    /** Rendering */
    render() {
        if (this.composer && !performanceMonitor.lowQualityMode) {
            this.composer.render();
        } else if (this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Imposta la modalità di gioco
     * @param {string} mode - Modalità di gioco ('space', 'planet', 'combat')
     * @param {Object} options - Opzioni aggiuntive per la modalità
     */
    setGameMode(newMode, options = {}) {
        if (this.state.mode === newMode && !options.force) return; // Evita cambi inutili se non forzato

        console.log(`Switching game mode from ${this.state.mode} to ${newMode}`);
        this.state.lastMode = this.state.mode;
        this.state.mode = newMode;

        this.deactivateCurrentSystems(); // Pulisce prima

        // Attiva sistemi per la nuova modalità
        switch (newMode) {
            case GAME_MODES.SPACE: this.setupSpaceMode(); break;
            case GAME_MODES.PLANET: this.setupPlanetMode(options.planet || this.state.activePlanet); break;
            case GAME_MODES.SPACE_COMBAT: this.setupSpaceCombatMode(); break;
            case GAME_MODES.GROUND_COMBAT: this.setupGroundCombatMode(); break;
        }
        // uiManager.setGameMode(newMode, options); // Notifica UI se necessario
    }

    deactivateCurrentSystems() {
        console.log("Deactivating systems for mode:", this.state.lastMode);
        // Disattiva moduli specifici
        if (this.solarSystem) this.solarSystem.active = false; // Assumi che abbia un flag 'active'
        if (this.terrainGenerator) this.terrainGenerator.active = false; // Assumi che abbia un flag 'active'
        if (this.spaceCombat) this.spaceCombat.deactivate();
        if (this.groundCombat) this.groundCombat.deactivate();

        // Rimuovi nemici e proiettili attivi dalla scena e dalle liste
        this.activeProjectiles.forEach(p => this.scene.remove(p.mesh));
        this.activeProjectiles = [];
        this.activeEnemies.forEach(e => e.removeFromScene(this.scene)); // Usa metodo nemico se esiste
        this.activeEnemies = [];

        // Pulisci cache collisioni
        this.collisionCache.clear();

        // Nascondi UI specifiche (es. info pianeta)
        hidePlanetInfo();

        // Potrebbe essere necessario pulire oggetti specifici dalla scena qui
        // this.worldManager.clearModeSpecificObjects(this.state.lastMode);
    }

    setupSpaceMode() {
        console.log("Setting up SPACE mode");
        if (this.solarSystem) this.solarSystem.active = true;
        // Assicurati che worldManager mostri tutto
        this.worldManager.showAll(); // Aggiungi questo metodo a WorldManager
        if (this.playerControlsInitialized && this.pointerLockControls) {
             // playerControls.setMode('space'); // Modifica playerControls per avere questo metodo
        } else { console.warn("PlayerControls not ready in setupSpaceMode"); }
        this.player.isFlying = true;
    }

    setupPlanetMode(planet) {
        if (!planet) {
            console.error("Cannot enter PLANET mode without a target planet.");
            this.setGameMode(GAME_MODES.SPACE, {force: true}); // Forza ritorno allo spazio
            return;
        }
        console.log(`Setting up PLANET mode for ${planet.name}`);
        this.state.activePlanet = planet;

        if (this.terrainGenerator) {
            // this.terrainGenerator.setPlanetType(this.getPlanetTypeForTerrain(planet)); // DEPRECATO? Terrain usa dati pianeta?
            this.terrainGenerator.generateTerrain(planet); // Usa metodo corretto
            this.terrainGenerator.active = true;
        }

        if (this.playerControlsInitialized && this.pointerLockControls) {
            // playerControls.setMode('planet');
        } else { console.warn("PlayerControls not ready in setupPlanetMode"); }
        this.player.isFlying = false;

        // Posiziona giocatore
        const spawnHeight = this.terrainGenerator?.getHeightAt(0, 0) ?? planet.size * 1.1; // Usa getHeightAt
        this.player.position.set(0, spawnHeight + 1, 0); // Poco sopra il terreno
        this.pointerLockControls.getObject().position.copy(this.player.position);
        this.camera.lookAt(this.player.position.x + 1, this.player.position.y, this.player.position.z);

        this.worldManager.focusOnPlanet(planet.id);
    }

    setupSpaceCombatMode() {
        console.log("Setting up SPACE COMBAT mode");
        if (this.spaceCombat) {
            this.spaceCombat.player = this.player; // Assicurati che il player sia assegnato
            this.spaceCombat.initialize(this.player.position);
            this.spaceCombat.activate();
            this.spaceCombat.spawnEnemyWave(this.player.position); // Spawn nemici all'inizio
        }
         if (this.playerControlsInitialized && this.pointerLockControls) {
            // playerControls.setMode('spaceCombat');
         } else { console.warn("PlayerControls not ready in setupSpaceCombatMode"); }
        this.player.isFlying = true;
        // Nascondi mondo non necessario?
        this.worldManager.hideNonCombatElements(); // Aggiungere a WorldManager
    }

    setupGroundCombatMode() {
        if (!this.state.activePlanet) {
             console.error("Cannot enter GROUND COMBAT without an active planet.");
             this.setGameMode(GAME_MODES.SPACE, {force: true});
             return;
        }
        console.log("Setting up GROUND COMBAT mode on", this.state.activePlanet.name);
        if (this.groundCombat) {
            this.groundCombat.player = this.player; // Assicura player assegnato
            this.groundCombat.initialize();
            this.groundCombat.activate();
            if (this.terrainGenerator?.active) {
                this.groundCombat.physics.setTerrain(this.terrainGenerator); // Collega fisica e terreno
            }
            this.groundCombat.enemies.setupSpawnPointsCircle(this.player.position, 50, 5); // Setup punti spawn
            this.groundCombat.enemies.spawnEnemyWave(this.player.position); // Spawn nemici
        }
         if (this.playerControlsInitialized && this.pointerLockControls) {
            // playerControls.setMode('groundCombat');
         } else { console.warn("PlayerControls not ready in setupGroundCombatMode"); }
        this.player.isFlying = false;
        // Mantieni visibile solo il terreno attuale? WorldManager potrebbe gestirlo.
    }

    /**
     * Gestisce l'attacco del giocatore (callback dai controlli)
     * @param {string} attackType - Tipo di attacco
     * @param {THREE.Vector3} direction - Direzione dell'attacco
     */
    handlePlayerAttack(attackType, direction) {
        const attackData = this.player.attack(attackType, direction);
        
        if (attackData) {
            // In base alla modalità, passa l'attacco al gestore appropriato
            if (this.state.mode === 'combat') {
                if (this.state.lastMode === 'space') {
                    this.spaceCombat.createProjectile(attackData);
                } else {
                    this.groundCombat.createProjectile(attackData);
                }
            } else {
                // Attacco in spazio o pianeta
                // Per ora non facciamo nulla qui, ma potremmo implementare proiettili
                // anche in queste modalità se necessario
            }
            
            // Riproduci il suono dell'attacco
            this.audioManager.playSound('shoot', 0.5);
        }
    }
    
    /**
     * Verifica se dovremmo entrare in combattimento spaziale
     * @returns {boolean} True se dovremmo entrare in combattimento
     */
    shouldEnterSpaceCombat() {
        // Logica per decidere quando entrare in combattimento spaziale
        // Per ora, ritorna false (placeholder)
        return false;
    }
    
    /**
     * Verifica se dovremmo entrare in combattimento a terra
     * @returns {boolean} True se dovremmo entrare in combattimento
     */
    shouldEnterGroundCombat() {
        // Logica per decidere quando entrare in combattimento a terra
        // Per ora, ritorna false (placeholder)
        return false;
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
     * Riavvia il gioco dopo un game over
     */
    restartGame() {
        console.log("Restarting game...");
        hideGameOver();
        
        // Resetta stato giocatore
        if(this.player) this.player.reset(); // Assumendo che Player abbia un metodo reset()

        // Resetta stato gioco
        this.state.isGameOver = false;
        this.state.gameTime = 0;
        this.activeEnemies = [];
        this.activeProjectiles = [];
        
        // Torna alla modalità iniziale e riavvia loop
        this.setGameMode(GAME_MODES.SPACE);
        if (this.pointerLockControls) this.pointerLockControls.lock();
        this.startGameLoop();
    }
    
    /**
     * Tenta la conquista di un pianeta
     * @param {Object} planet - Pianeta da conquistare
     */
    conquerPlanet(planet = null) {
        const targetPlanet = planet || this.state.activePlanet;
        
        if (!targetPlanet) {
            console.error("Tentativo di conquista senza un pianeta selezionato");
            return;
        }
        
        // Tenta la conquista
        const result = {
            success: this.player.attackPower > targetPlanet.defense,
            resources: Math.floor(targetPlanet.size * 10 + Math.random() * 20),
            message: ""
        };
        
        if (result.success) {
            // Conquista riuscita
            targetPlanet.isConquered = true;
            targetPlanet.conqueredBy = this.player.race;
            targetPlanet.defense = 0;
            
            // Aggiorna risorse del giocatore
            this.player.currency += result.resources;
            
            // Mostra messaggio
            result.message = `Hai conquistato ${targetPlanet.name} e ottenuto ${result.resources} risorse!`;
            this.uiManager.showMessage(result.message);
            
            // Aggiorna visuali del pianeta
            this.worldManager.updatePlanetVisuals(targetPlanet);
        } else {
            // Conquista fallita, avvia combattimento
            result.message = `Difese di ${targetPlanet.name} troppo forti. Inizia il combattimento!`;
            this.uiManager.showMessage(result.message);
            
            // Avvia il combattimento
            this.setGameMode('combat');
        }
        
        return result;
    }
    
    /**
     * Potenzia una statistica del giocatore
     * @param {string} stat - Statistica da potenziare
     */
    upgradePlayer(stat) {
        const result = this.player.upgrade(stat);
        
        if (result.success) {
            this.uiManager.showMessage(result.message);
            this.uiManager.updatePlayerStats(this.player);
        } else {
            this.uiManager.showMessage(result.message, 'error');
        }
        
        return result;
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
     * Pulisce le risorse quando il gioco viene fermato
     */
    dispose() {
        // Ferma il ciclo di gioco
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Rimuovi event listener
        window.removeEventListener('resize', this.onWindowResize);
        
        // Disattiva i controlli
        if (this.playerControls) {
            this.playerControls.dispose();
        }
        
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
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Pulisci moduli
        if (this.audioManager) {
            this.audioManager.dispose();
        }
        
        console.log("Risorse del gioco liberate");
    }

    // --- Logica di Combattimento/Proiettili (Spostare in CombatManager in futuro) ---

    initProjectilePool() {
        const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8); // Dimensione proiettile base
        const projectileMats = {
            player: new THREE.MeshBasicMaterial({ color: 0x00ffff }),
            enemy: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
            special: new THREE.MeshBasicMaterial({ color: 0xff00ff }) // Esempio
        };

        for (let i = 0; i < MAX_PROJECTILES; i++) {
            const mesh = new THREE.Mesh(sphereGeo.clone(), projectileMats.player); // Inizia con mat player
            mesh.visible = false;
            this.scene.add(mesh);
            this.projectilePool.push({ mesh: mesh, materialCache: projectileMats, inUse: false });
        }
        console.log(`Projectile pool initialized with ${this.projectilePool.length} objects.`);
    }

    createProjectile(data) {
        let poolItem = this.projectilePool.find(p => !p.inUse);

        if (!poolItem) {
            // Se il pool è esaurito, ricicla il proiettile più vecchio
            // Trova il proiettile con startTime più basso tra quelli attivi
            let oldestProjectileIndex = -1;
            let oldestTime = Infinity;
            for(let i = 0; i < this.activeProjectiles.length; i++) {
                if (this.activeProjectiles[i].startTime < oldestTime) {
                    oldestTime = this.activeProjectiles[i].startTime;
                    oldestProjectileIndex = i;
                }
            }
            if (oldestProjectileIndex !== -1) {
                 console.warn("Projectile pool limit reached, recycling oldest projectile.");
                 const recycledData = this.activeProjectiles.splice(oldestProjectileIndex, 1)[0];
                 poolItem = recycledData.poolItem; // Ottieni il poolItem riciclato
                 // Non rimuovere dalla scena qui, verrà riutilizzato
            } else {
                console.error("Projectile pool limit reached and no active projectile to recycle!");
                return; // Non possiamo creare nuovi proiettili
            }
        }


        poolItem.inUse = true;
        const mesh = poolItem.mesh;

        // Imposta materiale corretto
        if (data.isEnemyProjectile) {
            mesh.material = poolItem.materialCache.enemy;
        } else if (data.type === 'special') { // Assumi un tipo speciale
            mesh.material = poolItem.materialCache.special;
        } else {
            mesh.material = poolItem.materialCache.player;
        }
        mesh.material.color.set(data.color || (data.isEnemyProjectile ? 0xffaa00 : 0x00ffff));

        mesh.position.copy(data.origin).addScaledVector(data.direction, 1.5); // Posizione iniziale
        mesh.scale.setScalar(data.width || 1); // Scala
        mesh.visible = true;
        // mesh.lookAt(mesh.position.clone().add(data.direction)); // Orientamento (opzionale per sfere)

        this.activeProjectiles.push({
            poolItem: poolItem, // Mantieni riferimento al pool item
            mesh: mesh,
            direction: data.direction,
            speed: data.speed,
            power: data.power,
            range: data.range,
            distanceTraveled: 0,
            type: data.type,
            isEnemyProjectile: data.isEnemyProjectile || false,
            startTime: performance.now() // Per riciclaggio
        });

        playSound(data.isEnemyProjectile ? 'enemy_shoot' : 'shoot', 0.4); // Usa suoni diversi?
    }

    updateProjectiles(deltaTime) {
        const now = performance.now();
        const doFullPhysics = now - this.lastPhysicsUpdate > PHYSICS.PHYSICS_UPDATE_INTERVAL;
        if(doFullPhysics) this.lastPhysicsUpdate = now;

        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const p = this.activeProjectiles[i];
            const moveDistance = p.speed * deltaTime;
            p.mesh.position.addScaledVector(p.direction, moveDistance);
            p.distanceTraveled += moveDistance;

            let hit = false;
            let hitObject = null;

            // --- Collision Detection (Ottimizzata) ---
            // Crea bounding box solo una volta per frame se serve
             const projBox = new THREE.Box3().setFromObject(p.mesh);

            if (p.isEnemyProjectile && this.player.mesh) {
                 const playerBox = new THREE.Box3().setFromObject(this.player.mesh);
                 if (projBox.intersectsBox(playerBox)) {
                     hit = true;
                     hitObject = this.player;
                 }
            } else if (!p.isEnemyProjectile) {
                for (let j = this.activeEnemies.length - 1; j >= 0; j--) {
                     const enemy = this.activeEnemies[j];
                     if (!enemy.isActive || !enemy.mesh) continue;
                     // Ottimizzazione: controlla solo nemici relativamente vicini
                     if (enemy.position.distanceToSquared(p.mesh.position) < p.range * p.range * 0.5) { // Check distanza al quadrato
                         const enemyBox = new THREE.Box3().setFromObject(enemy.mesh);
                         if (projBox.intersectsBox(enemyBox)) {
                             hit = true;
                             hitObject = enemy;
                             break; // Colpito un nemico, esci dal loop nemici
                         }
                     }
                 }
            }

            // Se c'è stato un hit, gestiscilo
            if (hit && hitObject) {
                this.handleProjectileHit(p, hitObject);
                // Ricicla proiettile
                p.mesh.visible = false;
                p.poolItem.inUse = false;
                this.activeProjectiles.splice(i, 1);
                continue; // Passa al prossimo proiettile
            }

            // Rimuovi se fuori range
            if (p.distanceTraveled > p.range) {
                p.mesh.visible = false;
                p.poolItem.inUse = false;
                this.activeProjectiles.splice(i, 1);
            }
        }

        // Pulizia cache collisioni (se usata attivamente)
        // if (now % 5000 < 20) { this.cleanupCollisionCache(now); }
    }

    handleProjectileHit(projectile, target) {
        const hitPosition = projectile.mesh.position.clone();
        let damageDealt = projectile.power;

        if (target === this.player) {
            const alive = this.player.takeDamage(damageDealt);
            playSound('hit', 0.7);
            this.createHitEffect(hitPosition, 0xff0000); // Effetto rosso
            if (!alive) this.handleGameOver();
        } else { // È un nemico
             const enemy = target; // Rinomina per chiarezza
             const enemyStillAlive = enemy.takeDamage(damageDealt);
             playSound('hit', 0.5);
             this.createHitEffect(hitPosition, 0xffff00); // Effetto giallo

             if (!enemyStillAlive) {
                 // Nemico distrutto
                 const expGained = enemy.type === 'drone' ? 10 : 25; // Da rendere dinamico
                 const currencyGained = enemy.type === 'drone' ? 5 : 10;
                 this.player.gainExperience(expGained);
                 this.player.currency += currencyGained;
                 this.createExplosionEffect(enemy.position, enemy.mesh.scale.x * 1.5); // Scala esplosione
                 playSound('explosion', 0.6);
                 // Il nemico verrà rimosso nel ciclo updateEnemies perché isActive è false
             }
        }
    }


    updateEnemies(deltaTime) {
         for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
             const enemy = this.activeEnemies[i];
             if (!enemy.isActive) {
                 enemy.removeFromScene(this.scene); // Assicurati che questo metodo esista in Enemy.js
                 this.activeEnemies.splice(i, 1);
                 continue;
             }

             // Ottimizzazione: aggiorna AI solo se vicino o periodicamente
             let shouldUpdateAI = false;
             const distanceToPlayerSq = enemy.position.distanceToSquared(this.player.position);
             const updateRangeSq = 500 * 500; // Range entro cui aggiornare sempre

             if(performanceMonitor.lowQualityMode) {
                 shouldUpdateAI = distanceToPlayerSq < updateRangeSq * 0.2 || (performanceMonitor.frameCount + i) % 10 === 0; // Aggiorna meno spesso in low quality
             } else {
                 shouldUpdateAI = distanceToPlayerSq < updateRangeSq || (performanceMonitor.frameCount + i) % 5 === 0; // Aggiorna più spesso
             }

             if(shouldUpdateAI){
                 const enemyProjectileData = enemy.update(deltaTime, this.player); // Update AI e attacco
                 if (enemyProjectileData) {
                     this.createProjectile(enemyProjectileData);
                 }
             } else {
                // Movimento semplice o interpolazione se lontano e non aggiornato
                // enemy.simpleUpdate(deltaTime);
             }
         }
     }

    checkPlanetInteraction() {
        if (!this.universeGenerator || !this.player || this.state.mode !== GAME_MODES.SPACE) return;

        const playerPos = this.player.position; // Usa posizione player non camera per interazione
        let closestPlanet = null;
        let closestDistSq = Infinity;

        // Usa worldManager per ottenere le mesh dei pianeti
        this.worldManager.planetMeshes.forEach(planetLOD => {
            if(planetLOD.userData.planetData){
                const planetData = planetLOD.userData.planetData;
                const distSq = playerPos.distanceToSquared(planetLOD.position);
                if(distSq < closestDistSq){
                    closestDistSq = distSq;
                    closestPlanet = planetData;
                }
            }
        });

        const interactionDistance = (closestPlanet?.size || 0) * 1.5 + 10; // Distanza = 1.5x raggio + 10 unità

        if (closestPlanet && closestDistSq < interactionDistance * interactionDistance) {
            if (this.state.activePlanet !== closestPlanet) {
                this.state.activePlanet = closestPlanet;
                showPlanetInfo(closestPlanet); // Mostra UI
                // TODO: Abilitare tasto 'E' per atterrare/conquistare
            }
        } else {
            if (this.state.activePlanet) {
                hidePlanetInfo(); // Nascondi UI
                this.state.activePlanet = null;
                // TODO: Disabilitare tasto 'E'
            }
        }
    }

    checkPortalInteraction() {
        // ... Implementa usando this.worldManager.exitPortalBox ecc. ...
    }

    updateFrustumCulling() {
        if (!this.camera || !this.worldManager) return;
        // Delega a WorldManager
        this.worldManager.updateFrustumCulling(this.camera, performanceMonitor.lowQualityMode);
    }

    // --- Effetti Visivi ---
    createHitEffect(position, color = 0xffff00) {
        const effectDuration = 0.2;
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        const effectMesh = new THREE.Mesh(geometry, material);
        effectMesh.position.copy(position);
        this.scene.add(effectMesh);

        let elapsed = 0;
        const animateEffect = () => {
            const deltaEffect = this.clock.getDelta(); // Usa clock per delta
            elapsed += deltaEffect;
            if (elapsed < effectDuration) {
                effectMesh.scale.multiplyScalar(1 + 15 * deltaEffect); // Espandi rapidamente
                effectMesh.material.opacity = 0.8 * (1 - elapsed / effectDuration);
                requestAnimationFrame(animateEffect);
            } else {
                this.scene.remove(effectMesh);
                // TODO: Dispose geometry/material
            }
        };
        requestAnimationFrame(animateEffect);
    }

    createExplosionEffect(position, scale = 1, color = 0xff8800) {
        const effectDuration = 0.5;
        const particles = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const material = new THREE.PointsMaterial({ color: color, size: 0.5 * scale, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending });

        for (let i = 0; i < particles; i++) { positions.push(0, 0, 0); }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const particleSystem = new THREE.Points(geometry, material);
        particleSystem.position.copy(position);
        this.scene.add(particleSystem);

        const initialVelocities = [];
        for (let i = 0; i < particles; i++) {
            initialVelocities.push(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(Math.random() * 10 * scale));
        }

        let elapsed = 0;
        const animateExplosion = () => {
            const deltaExplosion = this.clock.getDelta(); // Usa clock per delta
            elapsed += deltaExplosion;
            if (elapsed < effectDuration) {
                const posAttribute = particleSystem.geometry.attributes.position;
                for (let i = 0; i < particles; i++) {
                    posAttribute.setXYZ(i, posAttribute.getX(i) + initialVelocities[i].x * deltaExplosion, posAttribute.getY(i) + initialVelocities[i].y * deltaExplosion, posAttribute.getZ(i) + initialVelocities[i].z * deltaExplosion);
                }
                posAttribute.needsUpdate = true;
                particleSystem.material.opacity = 1.0 * (1 - elapsed / effectDuration);
                requestAnimationFrame(animateExplosion);
            } else {
                this.scene.remove(particleSystem);
                // TODO: Dispose geometry/material
            }
        };
        requestAnimationFrame(animateExplosion);
    }

    // --- Gestione Stato Gioco ---
    handleGameOver() {
        if (this.state.isGameOver) return;
        console.log("GAME OVER!");
        this.state.isGameOver = true;
        if (this.pointerLockControls) this.pointerLockControls.unlock();
        closeUpgradesScreen();
        closeLegendScreen();
        showGameOver(); // Mostra UI Game Over
    }

    // --- Azioni Giocatore (Callbacks da UI) ---
    attemptConquerPlanet() {
        if (!this.state.activePlanet || !this.player) return;

        const planet = this.state.activePlanet;
        const result = this.universeGenerator.conquerPlanet(planet, this.player.race, this.player.attackPower);

        console.log(result.message);

        if (result.success) {
            this.player.currency += result.resources;
            this.player.addConqueredPlanet(planet);
            showPlanetInfo(planet); // Aggiorna UI
            this.worldManager.updatePlanetVisuals(planet); // Cambia aspetto pianeta
            this.setGameMode(GAME_MODES.PLANET, { planet }); // Vai al pianeta
            playSound('success');
        } else {
            // Avvia combattimento terrestre
            playSound('failure');
            this.setGameMode(GAME_MODES.GROUND_COMBAT);
        }
    }

    attemptUpgrade(stat) {
        if (!this.player) return;
        
        // Calcola costo
        const currentLevel = this.player.upgrades[stat];
        const baseCost = 100;
        const cost = baseCost * Math.pow(2, currentLevel);

        const result = this.player.upgrade(stat, cost);

        if (result.success) {
            console.log(result.message);
            updateUI();
            playSound('upgrade');
        } else {
            console.warn(result.message);
            playSound('error');
        }
    }


    getPlanetTypeForTerrain(planet) {
        if (!planet || !planet.type) return 'earth';
        return planet.type;
    }

    // --- UI Management ---
    updateUI() {
        if (!this.player || !this.uiManager) return;

        // Aggiorna HUD con dati del giocatore
        this.uiManager.updatePlayerStats({
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            energy: this.player.energy,
            maxEnergy: this.player.maxEnergy,
            currency: this.player.currency,
            level: this.player.level,
            experience: this.player.experience,
            experienceToNextLevel: this.player.experienceToNextLevel
        });

        // Aggiorna informazioni di gioco
        const planetName = this.state.activePlanet ? this.state.activePlanet.name : '';
        const systemName = this.state.currentSystem ? this.state.currentSystem.name : '';
        
        this.uiManager.updateGameInfo({
            mode: this.state.mode,
            fps: Math.round(performanceMonitor.fps),
            planetName: planetName,
            systemName: systemName,
            gameTime: this.state.gameTime.toFixed(0)
        });

        // Aggiorna mini-mappa se disponibile nel UIManager
        if (this.uiManager.updateMinimap && this.state.mode === GAME_MODES.SPACE) {
            const nearbyObjects = [];
            
            // Aggiungi pianeti alla minimappa
            this.worldManager.planetMeshes.forEach(planet => {
                if (planet.userData.planetData) {
                    nearbyObjects.push({
                        position: planet.position.clone(),
                        type: 'planet',
                        size: planet.userData.planetData.size,
                        conquered: planet.userData.planetData.owner === this.player.race
                    });
                }
            });
            
            // Aggiungi nemici alla minimappa
            this.activeEnemies.forEach(enemy => {
                nearbyObjects.push({
                    position: enemy.position.clone(),
                    type: 'enemy'
                });
            });
            
            this.uiManager.updateMinimap(this.player.position, nearbyObjects);
        }
        
        // Aggiorna contatore nemici se in modalità combattimento
        if (this.state.mode === GAME_MODES.SPACE_COMBAT || this.state.mode === GAME_MODES.GROUND_COMBAT) {
            this.uiManager.updateCombatInfo({
                enemiesRemaining: this.activeEnemies.length,
                waveNumber: this.state.currentWave || 1
            });
        }
    }

    toggleInventory() {
        if (!this.player || !this.uiManager) return;
        
        if (this.state.uiState.inventoryOpen) {
            this.uiManager.closeInventory();
            if (this.pointerLockControls) this.pointerLockControls.lock();
        } else {
            this.uiManager.showInventory(this.player.inventory);
            if (this.pointerLockControls) this.pointerLockControls.unlock();
        }
        
        this.state.uiState.inventoryOpen = !this.state.uiState.inventoryOpen;
    }

    toggleMap() {
        if (!this.uiManager) return;
        
        if (this.state.uiState.mapOpen) {
            this.uiManager.closeMap();
            if (this.pointerLockControls) this.pointerLockControls.lock();
        } else {
            // Genera mappa dell'universo con dati da universeGenerator
            const universeData = {
                systems: this.universeGenerator ? this.universeGenerator.getSystems() : [],
                playerPosition: this.player ? this.player.position.clone() : new THREE.Vector3(),
                conqueredPlanets: this.player ? this.player.getConqueredPlanets() : []
            };
            
            this.uiManager.showMap(universeData);
            if (this.pointerLockControls) this.pointerLockControls.unlock();
        }
        
        this.state.uiState.mapOpen = !this.state.uiState.mapOpen;
    }

    handleUIInteraction(action, data) {
        if (!this.player) return;
        
        switch(action) {
            case 'upgrade':
                this.attemptUpgrade(data.stat);
                break;
                
            case 'useItem':
                this.player.useItem(data.itemId);
                this.updateUI();
                break;
                
            case 'equipItem':
                this.player.equipItem(data.itemId, data.slot);
                this.updateUI();
                break;
                
            case 'jumpToSystem':
                if (this.universeGenerator) {
                    const system = this.universeGenerator.getSystemById(data.systemId);
                    if (system) {
                        this.teleportPlayer(system.position);
                        this.toggleMap(); // Chiudi mappa
                    }
                }
                break;
                
            case 'landOnPlanet':
                if (this.state.activePlanet) {
                    this.attemptConquerPlanet();
                }
                break;
                
            case 'restart':
                this.restartGame();
                break;
                
            default:
                console.warn(`UI action not handled: ${action}`);
        }
    }

    teleportPlayer(position) {
        if (!this.player) return;
        
        this.player.position.copy(position);
        // Offset per evitare collisioni
        this.player.position.y += 10;
        
        // Resetta velocità
        this.player.velocity.set(0, 0, 0);
        
        // Resetta controlli
        if (this.controls) {
            this.controls.target.copy(this.player.position);
        }
        
        this.createExplosionEffect(this.player.position, 2, 0x00ffff);
        playSound('teleport');
    }

    // --- Audio Management ---
    setupAudio() {
        if (!this.audioManager) return;
        
        // Imposta livelli audio da configurazione
        this.audioManager.setMusicVolume(this.options.musicVolume || 0.5);
        this.audioManager.setSfxVolume(this.options.sfxVolume || 0.7);
        
        // Carica musica di background
        this.audioManager.loadBackgroundMusic('space', './assets/audio/space_ambient.mp3');
        this.audioManager.loadBackgroundMusic('combat', './assets/audio/combat.mp3');
        this.audioManager.loadBackgroundMusic('planet', './assets/audio/planet_ambient.mp3');
        
        // Avvia musica spaziale
        this.audioManager.playBackgroundMusic('space');
    }

    playBackgroundMusic(type) {
        if (!this.audioManager) return;
        this.audioManager.playBackgroundMusic(type);
    }

    // --- Event Handlers ---
    handleWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        if (this.composer) {
            this.composer.setSize(width, height);
        }
        
        console.log(`Resized to ${width}x${height}`);
    }

    handleKeyDown(event) {
        // Ignora input se in modalità UI
        if (this.state.uiState.inventoryOpen || this.state.uiState.mapOpen) {
            return;
        }
        
        switch(event.code) {
            case 'KeyI':
                this.toggleInventory();
                break;
                
            case 'KeyM':
                this.toggleMap();
                break;
                
            case 'KeyE':
                // Interagisci con pianeta/portale
                if (this.state.activePlanet) {
                    this.attemptConquerPlanet();
                }
                break;
                
            case 'KeyF':
                // Abilita/disabilita volo in modalità pianeta
                if (this.state.mode === GAME_MODES.PLANET && this.player) {
                    this.player.toggleFlight();
                }
                break;
                
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4': {
                // Attiva abilità/usa oggetto rapido
                const slotIndex = parseInt(event.code.replace('Digit', '')) - 1;
                if (this.player) {
                    this.player.useQuickSlot(slotIndex);
                    this.updateUI();
                }
            }
                break;
                
            case 'Escape':
                // Apri menu pausa
                this.togglePauseMenu();
                break;
        }
    }

    togglePauseMenu() {
        if (!this.uiManager) return;
        
        if (this.state.isPaused) {
            this.uiManager.closePauseMenu();
            if (this.pointerLockControls) this.pointerLockControls.lock();
            this.state.isPaused = false;
            this.clock.start(); // Riavvia clock
        } else {
            this.uiManager.showPauseMenu();
            if (this.pointerLockControls) this.pointerLockControls.unlock();
            this.state.isPaused = true;
            this.clock.stop(); // Ferma clock
        }
    }

    // --- Resource Management ---
    cleanupResources() {
        console.log("Cleaning up resources...");
        
        // Ferma gameloop
        cancelAnimationFrame(this.animationFrameId);
        
        // Rilascia controlli e event listeners
        if (this.pointerLockControls) {
            this.pointerLockControls.disconnect();
        }
        
        window.removeEventListener('resize', this.handleWindowResize.bind(this));
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Cleanup audio
        if (this.audioManager) {
            this.audioManager.stopAll();
        }
        
        // Pulisci geometrie e materiali
        if (this.scene) {
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
        }
        
        // Rilascia renderer e composer
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.composer) {
            this.composer.dispose();
        }
        
        console.log("Resources cleaned up");
    }

    // --- Debug ---
    toggleDebugMode() {
        this.options.debug = !this.options.debug;
        console.log(`Debug mode: ${this.options.debug}`);
        
        if (this.options.debug) {
            // Abilita display stats se disponibili
            if (window.Stats) {
                this.stats = new Stats();
                document.body.appendChild(this.stats.dom);
            }
            
            // Aggiungi helpers
            if (this.scene) {
                // Grid helper
                const gridHelper = new THREE.GridHelper(1000, 100);
                gridHelper.name = 'debugGridHelper';
                this.scene.add(gridHelper);
                
                // Axes helper
                const axesHelper = new THREE.AxesHelper(10);
                axesHelper.name = 'debugAxesHelper';
                axesHelper.position.set(0, 0.1, 0); // Leggero offset per evitare z-fighting con grid
                this.scene.add(axesHelper);
            }
        } else {
            // Rimuovi stats
            if (this.stats) {
                document.body.removeChild(this.stats.dom);
                this.stats = null;
            }
            
            // Rimuovi helpers
            if (this.scene) {
                const gridHelper = this.scene.getObjectByName('debugGridHelper');
                if (gridHelper) this.scene.remove(gridHelper);
                
                const axesHelper = this.scene.getObjectByName('debugAxesHelper');
                if (axesHelper) this.scene.remove(axesHelper);
            }
        }
    }

    // Metodo logger che usa il debug mode
    log(message, force = false) {
        if (this.options.debug || force) {
            console.log(`[GameIntegration] ${message}`);
        }
    }
} 
