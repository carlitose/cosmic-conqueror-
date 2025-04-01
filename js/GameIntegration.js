import * as THREE from 'three';

import { initializeSetup } from './setup.js';
import { WorldManager } from './worldManager.js';
import { performanceMonitor } from './performanceMonitor.js';
import { Player } from './player.js';
import { UIManager } from './uiManager.js';
import { AudioManager } from './audioManager.js';
import { PlayerControls } from './playerControls.js';
import { SolarSystem } from './space/SolarSystem.js';
import { TerrainGenerator } from './planet/TerrainGenerator.js';
import { SpaceCombat } from './combat/SpaceCombat.js';
import { GroundCombat } from './combat/GroundCombat.js';
import { UniverseGenerator } from './universe.js';
import { CONSTANTS } from './constants.js';

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
        
        // Riferimenti THREE.js (verranno impostati da setup.js)
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
        this.audioManager = null;
        this.playerControls = null;
        this.solarSystem = null;
        this.terrainGenerator = null;
        this.spaceCombat = null;
        this.groundCombat = null;
        
        // Animation frame ID per la cancellazione
        this.animationFrameId = null;
        
        // Moduli attivi (per update)
        this.activeModules = [];
        
        console.log("GameIntegration creato con opzioni:", this.options);
    }
    
    /**
     * Inizializza il gioco
     * @param {HTMLElement} container - Contenitore DOM
     * @returns {Promise} - Promise che si risolve quando l'inizializzazione è completa
     */
    async initialize(container) {
        this.container = container;
        
        try {
            // Inizializza THREE.js tramite setup.js
            const setupResult = initializeSetup(container, {
                quality: this.options.quality,
                debug: this.options.debug
            });
            
            // Assegna i risultati alle proprietà
            this.scene = setupResult.scene;
            this.camera = setupResult.camera;
            this.renderer = setupResult.renderer;
            this.clock = setupResult.clock;
            this.composer = setupResult.composer;
            
            // Inizializza il performance monitor
            performanceMonitor.initialize({
                targetFPS: this.options.targetFPS,
                scene: this.scene,
                camera: this.camera,
                renderer: this.renderer,
                composer: this.composer
            });
            
            // Inizializza l'audio manager
            this.audioManager = new AudioManager();
            await this.audioManager.initialize();
            
            // Inizializza il player
            this.player = new Player();
            this.player.createMesh();
            this.scene.add(this.player.mesh);
            
            // Inizializza i controlli del giocatore
            this.playerControls = new PlayerControls(this.camera, this.player, this.container);
            this.playerControls.initialize();
            this.playerControls.setAttackCallback(this.handlePlayerAttack.bind(this));
            
            // Inizializza l'UI manager
            this.uiManager = new UIManager(this.container);
            this.uiManager.initialize(this.player);
            this.uiManager.setCallbacks({
                startGame: this.startGame.bind(this),
                restartGame: this.restartGame.bind(this),
                conquerPlanet: this.conquerPlanet.bind(this),
                upgradePlayer: this.upgradePlayer.bind(this)
            });
            
            // Inizializza world manager
            this.worldManager = new WorldManager(this.scene);
            
            // Inizializza i moduli di gioco
            this.solarSystem = new SolarSystem(this.scene);
            this.terrainGenerator = new TerrainGenerator(this.scene);
            this.spaceCombat = new SpaceCombat(this.scene, this.camera, this.player);
            this.groundCombat = new GroundCombat(this.scene, this.camera, this.player);
            
            // Genera l'universo usando UniverseGenerator
            console.log("Generando l'universo...");
            const universeGenerator = new UniverseGenerator();
            const universeData = universeGenerator.generateUniverse(
                CONSTANTS.UNIVERSE.SYSTEM_COUNT, 
                CONSTANTS.UNIVERSE.PLANETS_PER_SYSTEM
            );
            
            // Salva i dati dell'universo nello state
            this.state.systems = universeData.systems;
            this.state.planets = universeData.planets;
            
            // Crea le visuali dell'universo
            this.worldManager.createUniverseVisuals(this.state.systems, this.state.planets);
            
            // Imposta la modalità iniziale
            this.setGameMode(this.state.mode);
            
            // Imposta event listener per il ridimensionamento della finestra
            window.addEventListener('resize', this.onWindowResize.bind(this));
            
            // Inizia il ciclo di gioco
            this.startGameLoop();
            
            console.log("Inizializzazione completata");
            return Promise.resolve();
        } catch (error) {
            console.error("Errore durante l'inizializzazione:", error);
            return Promise.reject(error);
        }
    }
    
    /**
     * Avvia il ciclo di gioco
     */
    startGameLoop() {
        // Reset del clock per evitare salti al primo frame
        this.clock.start();
        
        // Avvia l'animazione
        this.animate();
    }
    
    /**
     * Ciclo principale di animazione (ex gameLoop.js)
     */
    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        // Aggiorna il performance monitor
        performanceMonitor.update();
        
        // Applica limiter FPS
        if (!performanceMonitor.shouldRenderFrame()) {
            return; // Salta il frame
        }
        
        // Calcola delta time
        const deltaTime = this.clock.getDelta();
        this.state.gameTime += deltaTime;
        
        // Aggiorna solo se il gioco è attivo
        if (!this.state.isPaused && !this.state.isGameOver) {
            this.update(deltaTime);
        }
        
        // Rendering
        this.render();
    }
    
    /**
     * Aggiorna lo stato del gioco
     * @param {number} deltaTime - Delta time
     */
    update(deltaTime) {
        // Ottimizzazione dinamica della qualità
        performanceMonitor.checkQualityMode();
        
        // Esegui pulizia periodica delle risorse
        if (performanceMonitor.frameCount % 300 === 0) {
            performanceMonitor.cleanupUnusedResources();
        }
        
        // Aggiorna il player e i controlli
        this.playerControls.update(deltaTime);
        this.player.update(deltaTime);
        
        // Aggiorna WorldManager con la posizione del giocatore
        const playerPosition = this.state.mode === 'space' ? 
            this.camera.position : this.player.position;
        this.worldManager.update(deltaTime, playerPosition);
        
        // Aggiorna i moduli in base alla modalità corrente
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
        
        // Aggiorna moduli attivi
        this.updateActiveModules(deltaTime);
        
        // Aggiorna l'UI con lo stato corrente
        this.uiManager.update(this.state, this.player);
        
        // Gestisci collisioni e altri eventi
        this.checkCollisions();
        this.checkGameEvents();
    }
    
    /**
     * Aggiorna i moduli attivi
     * @param {number} deltaTime - Delta time
     */
    updateActiveModules(deltaTime) {
        for (const module of this.activeModules) {
            if (module && typeof module.update === 'function') {
                module.update(deltaTime);
            }
        }
    }
    
    /**
     * Aggiunge un modulo agli aggiornamenti attivi
     * @param {Object} module - Modulo da aggiungere
     * @param {string} name - Nome del modulo (opzionale)
     */
    addModule(module, name = '') {
        if (module && typeof module.update === 'function') {
            module.isActive = true;
            if (name) module.moduleName = name;
            this.activeModules.push(module);
        }
    }
    
    /**
     * Rimuove un modulo dagli aggiornamenti attivi
     * @param {Object} module - Modulo da rimuovere
     */
    removeModule(module) {
        const index = this.activeModules.indexOf(module);
        if (index !== -1) {
            this.activeModules.splice(index, 1);
        }
    }
    
    /**
     * Aggiorna la modalità spaziale
     * @param {number} deltaTime - Delta time
     */
    updateSpaceMode(deltaTime) {
        // Aggiorna il sistema solare
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
        if (this.state.mode === 'space') {
            // Collisioni nello spazio (pianeti, portali, nemici)
            // ...
        } else if (this.state.mode === 'planet') {
            // Collisioni su un pianeta (terreno, oggetti, nemici)
            // ...
        } else if (this.state.mode === 'combat') {
            // Collisioni in combattimento (proiettili, nemici)
            // ...
        }
    }
    
    /**
     * Verifica eventi speciali nel gioco
     */
    checkGameEvents() {
        // Implementazione per verificare eventi come missioni, obiettivi, ecc.
    }
    
    /**
     * Verifica se il giocatore è vicino a un pianeta
     */
    checkPlanetProximity() {
        // Cerca il pianeta più vicino al giocatore
        const playerPosition = this.camera.position;
        let nearestPlanet = null;
        let nearestDistance = Infinity;
        
        for (const planet of this.state.planets) {
            const distance = playerPosition.distanceTo(planet.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlanet = planet;
            }
        }
        
        // Se il giocatore è abbastanza vicino, mostra le informazioni del pianeta
        if (nearestPlanet && nearestDistance < nearestPlanet.size * 3) {
            if (this.state.activePlanet !== nearestPlanet) {
                this.state.activePlanet = nearestPlanet;
                this.uiManager.showPlanetInfo(nearestPlanet);
            }
        } else if (this.state.activePlanet) {
            this.state.activePlanet = null;
            this.uiManager.hidePlanetInfo();
        }
    }
    
    /**
     * Verifica se il giocatore è vicino a un portale
     */
    checkPortalProximity() {
        // Implementazione per verificare la vicinanza a portali
    }
    
    /**
     * Rendering della scena
     */
    render() {
        // Usa composer se disponibile, altrimenti renderer standard
        if (this.composer && !performanceMonitor.lowQualityMode) {
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
        // Svuota la lista di moduli attivi
        this.activeModules = [];
        
        // Disattiva moduli specifici
        if (this.solarSystem) this.solarSystem.active = false;
        if (this.terrainGenerator) this.terrainGenerator.active = false;
        if (this.spaceCombat) this.spaceCombat.deactivate();
        if (this.groundCombat) this.groundCombat.deactivate();
        
        // Pulisci la scena per il cambio di modalità
        this.clearSceneForModeChange();
    }
    
    /**
     * Pulisce la scena per il cambio di modalità
     */
    clearSceneForModeChange() {
        // Preserva gli oggetti essenziali della scena (luci, player, UI 3D)
        const preserveObjects = [this.player.mesh];
        
        // Rimuovi gli oggetti non essenziali dalla scena
        const objectsToRemove = [];
        this.scene.traverse(object => {
            // Salta gli oggetti da preservare
            if (preserveObjects.includes(object)) return;
            
            // Salta le luci
            if (object instanceof THREE.Light) return;
            
            // Salta la camera e gli oggetti collegati
            if (object === this.camera || object.parent === this.camera) return;
            
            // Salta oggetti marcati come permanenti
            if (object.userData && object.userData.isPermanent) return;
            
            // Aggiungi alla lista di oggetti da rimuovere
            if (object.parent === this.scene) {
                objectsToRemove.push(object);
            }
        });
        
        // Rimuovi gli oggetti
        for (const object of objectsToRemove) {
            this.scene.remove(object);
        }
    }
    
    /**
     * Configura la modalità spaziale
     */
    setupSpaceMode() {
        // Crea visuali dell'universo
        this.worldManager.createUniverseVisuals(this.state.systems, this.state.planets);
        
        // Attiva il sistema solare
        this.solarSystem.active = true;
        
        // Aggiungi il modulo alla lista degli attivi
        this.addModule(this.solarSystem, 'solarSystem');
        
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
        this.terrainGenerator.active = true;
        
        // Aggiungi il modulo alla lista degli attivi
        this.addModule(this.terrainGenerator, 'terrainGenerator');
        
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
            this.addModule(this.spaceCombat, 'spaceCombat');
        } else {
            this.groundCombat.startCombat(enemies || this.generateGroundEnemies());
            this.addModule(this.groundCombat, 'groundCombat');
        }
        
        // Configura controlli per il combattimento
        this.setupCombatControls();
    }
    
    /**
     * Configura controlli per lo spazio
     */
    setupSpaceControls() {
        this.playerControls.setMode('space');
        
        // Imposta il player in modalità volo
        this.player.setFlightMode(true);
    }
    
    /**
     * Configura controlli per il pianeta
     */
    setupPlanetControls() {
        this.playerControls.setMode('planet');
        
        // Imposta il player in modalità terrestre
        this.player.setFlightMode(false);
    }
    
    /**
     * Configura controlli per il combattimento
     */
    setupCombatControls() {
        // In base al tipo di combattimento
        if (this.state.lastMode === 'space') {
            this.playerControls.setMode('spaceCombat');
            this.player.setFlightMode(true);
        } else {
            this.playerControls.setMode('groundCombat');
            this.player.setFlightMode(false);
        }
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
     * Avvia il gioco
     * @param {string} playerRace - Razza del giocatore
     */
    startGame(playerRace) {
        console.log(`Iniziando il gioco con razza: ${playerRace}`);
        
        // Imposta la razza del giocatore
        this.player.setRace(playerRace);
        
        // Metti il giocatore nella posizione iniziale
        this.player.position.set(0, 10, 0);
        this.camera.position.copy(this.player.position);
        
        // Avvia il gioco
        this.playerControls.lock();
        this.uiManager.hideTitleScreen();
    }
    
    /**
     * Riavvia il gioco dopo un game over
     */
    restartGame() {
        // Reimposta lo stato del gioco
        this.state.isGameOver = false;
        
        // Reimposta il player
        this.player.reset();
        
        // Riavvia il gioco
        this.setGameMode('space');
        this.uiManager.hideGameOverScreen();
        this.playerControls.lock();
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
} 