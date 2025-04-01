import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { initializeSetup } from './setup.js';
import { WorldManager } from './worldManager.js';
import { performanceMonitor } from './performanceMonitor.js';
import { Player } from './player.js';
import {
    initializeUIManager, setPlayer as setUiPlayer, showCharacterSelection, hideCharacterSelection,
    showGameOver, hideGameOver, updateUI, showPlanetInfo, hidePlanetInfo,
    closeUpgradesScreen, closeLegendScreen, showMessage, openUpgradesScreen, openLegendScreen
} from './uiManager.js';
import { initAudioPool, playSound, ensureAudioExists } from './audioManager.js';
import { getMovementState, disposeControls } from './playerControls.js';
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

        // Riferimenti THREE.js
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
            planets: [],
            uiState: {
                inventoryOpen: false,
                mapOpen: false,
                upgradesOpen: false,
                legendOpen: false
            }
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

        // Debug
        this.stats = null;

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
            const setupResult = initializeSetup(container);
            if (!setupResult) throw new Error("Failed to initialize THREE.js setup.");
            this.scene = setupResult.scene;
            this.camera = setupResult.camera;
            this.renderer = setupResult.renderer;
            this.composer = setupResult.composer;
            this.pointerLockControls = setupResult.controls;
            this.clock = new THREE.Clock();

            // 2. Inizializza Performance Monitor
            performanceMonitor.initialize(
                this.scene,
                this.camera,
                this.renderer,
                this.composer,
                document.getElementById(UI_ELEMENTS.FPS_SELECT)
            );
            performanceMonitor.setTargetFPS(this.options.targetFPS);
            if (this.options.quality === 'low') {
                performanceMonitor.enableLowQuality();
            }
            if (this.options.debug) this.addDebugStats();

            // 3. Inizializza Audio Manager
            initAudioPool();
            // Carica suoni specifici mancanti
            ensureAudioExists('enemy_shoot');
            ensureAudioExists('energy_wave_sound');
            ensureAudioExists('laser_sound');
            ensureAudioExists('success');
            ensureAudioExists('failure');
            ensureAudioExists('upgrade');
            ensureAudioExists('error');
            ensureAudioExists('teleport');

            // 4. Inizializza UI Manager (con callbacks)
            initializeUIManager({
                startGame: this.startGame.bind(this),
                restartGame: this.restartGame.bind(this),
                conquerPlanet: this.attemptConquerPlanet.bind(this),
                upgrade: this.attemptUpgrade.bind(this)
            });

            // 5. Player Controls (Già inizializzati in setup.js)
            document.addEventListener('player-attack', this.handlePlayerAttack.bind(this));
            document.addEventListener('keydown', this.handleKeyDown.bind(this));

            // 6. Inizializza moduli di gioco (non attivarli ancora)
            this.worldManager = new WorldManager(this.scene);
            this.universeGenerator = new UniverseGenerator();
            this.solarSystem = new SolarSystem(this.scene);
            this.terrainGenerator = new TerrainGenerator(this.scene, this.camera);
            this.spaceCombat = new SpaceCombat(this.scene, this.camera, null);
            this.groundCombat = new GroundCombat(this.scene, this.camera);

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
            this.dispose();
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
            this.player = new Player(playerRace);
            this.player.createMesh();
            setUiPlayer(this.player);
            this.spaceCombat.player = this.player;
            this.groundCombat.player = this.player;

            // 2. Genera Universo
            console.log("Generating universe...");
            const universeData = this.universeGenerator.generateUniverse(50, 5);
            this.state.systems = universeData.systems;
            this.state.planets = universeData.planets;
            console.log(`Universe generated: ${this.state.systems.length} systems, ${this.state.planets.length} planets`);

            // 3. Crea Visuali Universo (stelle, pianeti, ecc.)
            this.worldManager.createUniverseVisuals(this.state.systems, this.state.planets);

            // 4. Configura la modalità di gioco iniziale
            this.setGameMode(GAME_MODES.SPACE);

            // 5. Blocca controlli e avvia loop
            if (this.pointerLockControls) {
                this.pointerLockControls.lock();
                const hint = document.getElementById('controls-hint');
                if (hint) hint.style.opacity = '0';
            } else {
                console.error("PointerLockControls not available when starting game!");
            }
            this.startGameLoop();

            console.log("Game Started!");

        } catch (error) {
            console.error("Error starting game:", error);
            this.handleGameOver();
        }
    }

    /** Avvia il ciclo di gioco */
    startGameLoop() {
        if (this.animationFrameId) return;
        console.log("Starting game loop...");
        this.clock.start();
        this.state.isPaused = false;
        this.state.isGameOver = false;
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
        if (this.options.debug && this.stats) this.stats.begin();

        if (!performanceMonitor.shouldRenderFrame()) {
            if (this.options.debug && this.stats) this.stats.end();
            return;
        }

        const deltaTime = Math.min(this.clock.getDelta(), 0.1);
        this.state.gameTime += deltaTime;

        const isLocked = this.pointerLockControls?.isLocked ?? false;
        if (this.state.isPaused || this.state.isGameOver || !this.player || !isLocked) {
            this.render();
            if (this.options.debug && this.stats) this.stats.end();
            return;
        }

        try {
            this.update(deltaTime);
            this.render();
        } catch (error) {
            console.error("Error in animation loop:", error);
            this.handleGameOver();
        }

        if (this.options.debug && this.stats) this.stats.end();
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
            this.worldManager.updateFrustumCulling(this.camera, performanceMonitor.lowQualityMode);
            this.lastFrustumCheck = time;
        }

        this.updateActiveModeLogic(deltaTime);

        this.updateEnemies(deltaTime);
        this.updateProjectiles(deltaTime);

        updateUI();
    }

    /** Aggiorna logica specifica della modalità */
    updateActiveModeLogic(deltaTime) {
        switch (this.state.mode) {
            case GAME_MODES.SPACE:
                if (this.solarSystem?.active) this.solarSystem.update(deltaTime);
                this.checkPlanetInteraction();
                this.checkPortalInteraction();
                break;
            case GAME_MODES.PLANET:
                if (this.terrainGenerator?.active) this.terrainGenerator.update(this.player.position);
                this.checkPortalInteraction();
                break;
            case GAME_MODES.SPACE_COMBAT:
                if (this.spaceCombat?.active) {
                    this.spaceCombat.update(deltaTime);
                    this.activeEnemies = this.spaceCombat.enemies;
                    if (this.spaceCombat.isCombatComplete()) {
                        console.log("Space combat complete. Returning to last mode:", this.state.lastMode);
                        this.setGameMode(this.state.lastMode || GAME_MODES.SPACE);
                    }
                }
                break;
            case GAME_MODES.GROUND_COMBAT:
                if (this.groundCombat?.active) {
                    this.groundCombat.update(deltaTime);
                    this.activeEnemies = this.groundCombat.enemies.enemies;
                    if (this.groundCombat.isCombatComplete()) {
                        console.log("Ground combat complete. Returning to last mode:", this.state.lastMode);
                        this.setGameMode(this.state.lastMode || GAME_MODES.PLANET);
                    }
                }
                break;
        }
    }

    /** Rendering */
    render() {
        if (this.composer && !performanceMonitor.lowQualityMode) {
            try {
                this.composer.render();
            } catch (e) {
                console.error("Error rendering with composer:", e);
                this.renderer.render(this.scene, this.camera);
            }
        } else if (this.renderer) {
            try {
                this.renderer.render(this.scene, this.camera);
            } catch(e) {
                console.error("Error rendering with renderer:", e);
                this.handleGameOver();
            }
        }
    }

    /**
     * Imposta la modalità di gioco
     * @param {string} mode - Modalità di gioco ('space', 'planet', 'combat')
     * @param {Object} options - Opzioni aggiuntive per la modalità
     */
    setGameMode(newMode, options = {}) {
        if (this.state.mode === newMode && !options.force) return;

        console.log(`Switching game mode from ${this.state.mode} to ${newMode}`);
        const previousMode = this.state.mode;
        this.state.mode = newMode;
        this.state.lastMode = previousMode;

        this.deactivateCurrentSystems(previousMode);

        switch (newMode) {
            case GAME_MODES.SPACE: this.setupSpaceMode(); break;
            case GAME_MODES.PLANET: this.setupPlanetMode(options.planet || this.state.activePlanet); break;
            case GAME_MODES.SPACE_COMBAT: this.setupSpaceCombatMode(); break;
            case GAME_MODES.GROUND_COMBAT: this.setupGroundCombatMode(); break;
        }
    }

    deactivateCurrentSystems(modeToDeactivate) {
        console.log("Deactivating systems for mode:", modeToDeactivate);
        if (this.solarSystem && modeToDeactivate === GAME_MODES.SPACE) this.solarSystem.active = false;
        if (this.terrainGenerator && modeToDeactivate === GAME_MODES.PLANET) this.terrainGenerator.active = false;
        if (this.spaceCombat && modeToDeactivate === GAME_MODES.SPACE_COMBAT) this.spaceCombat.deactivate();
        if (this.groundCombat && modeToDeactivate === GAME_MODES.GROUND_COMBAT) this.groundCombat.deactivate();

        this.activeProjectiles.forEach(p => {
            if(p.mesh) this.scene.remove(p.mesh);
            if(p.poolItem) p.poolItem.inUse = false;
        });
        this.activeProjectiles = [];
        this.activeEnemies.forEach(e => {
             if (e.removeFromScene) e.removeFromScene(this.scene);
             else if(e.mesh) this.scene.remove(e.mesh);
        });
        this.activeEnemies = [];
        this.collisionCache.clear();
        hidePlanetInfo();
    }

    setupSpaceMode() {
        console.log("Setting up SPACE mode");
        if (this.solarSystem) this.solarSystem.active = true;
        this.worldManager.showAll();
        if (this.player) this.player.isFlying = true;
    }

    setupPlanetMode(planet) {
        if (!planet) {
            console.error("Cannot enter PLANET mode without a target planet.");
            this.setGameMode(GAME_MODES.SPACE, {force: true});
            return;
        }
        console.log(`Setting up PLANET mode for ${planet.name}`);
        this.state.activePlanet = planet;

        if (this.terrainGenerator) {
            this.terrainGenerator.setPlanetType(planet.type);
            this.terrainGenerator.initialize();
            this.terrainGenerator.active = true;
        } else {
            console.error("TerrainGenerator not initialized!");
            this.setGameMode(GAME_MODES.SPACE, {force: true});
            return;
        }

        if (this.player) this.player.isFlying = false;

        const spawnHeight = this.terrainGenerator.getHeightAt(0, 0) + 1.0;
        this.player.position.set(0, spawnHeight, 0);
        this.pointerLockControls.getObject().position.copy(this.player.position);
        this.camera.lookAt(this.player.position.x + 1, this.player.position.y, this.player.position.z);

        this.worldManager.focusOnPlanet(planet.id);
    }

    setupSpaceCombatMode() {
        console.log("Setting up SPACE COMBAT mode");
        if (!this.player) {
            console.error("Player not available for Space Combat!");
            this.setGameMode(GAME_MODES.SPACE, {force: true});
            return;
        }
        if (this.spaceCombat) {
            this.spaceCombat.player = this.player;
            this.spaceCombat.initialize(this.player.position);
            this.spaceCombat.activate();
            this.spaceCombat.spawnEnemyWave(this.player.position);
            this.activeEnemies = this.spaceCombat.enemies;
        }
        if (this.player) this.player.isFlying = true;
        this.worldManager.hideNonCombatElements();
    }

    setupGroundCombatMode() {
        if (!this.state.activePlanet || !this.player || !this.terrainGenerator) {
             console.error("Cannot enter GROUND COMBAT without active planet, player or terrain.");
             this.setGameMode(this.state.lastMode || GAME_MODES.PLANET, {force: true});
             return;
        }
        console.log("Setting up GROUND COMBAT mode on", this.state.activePlanet.name);
        if (this.groundCombat) {
            this.groundCombat.player = this.player;
            this.groundCombat.initialize();
            this.groundCombat.activate();
            if (this.terrainGenerator.active) {
                this.groundCombat.physics.setTerrain(this.terrainGenerator);
            } else {
                 console.warn("TerrainGenerator is not active for GroundCombat physics");
            }
            this.groundCombat.enemies.setupSpawnPointsCircle(this.player.position, 50, 5);
            this.groundCombat.enemies.spawnEnemyWave(this.player.position);
            this.activeEnemies = this.groundCombat.enemies.enemies;
        }
        if (this.player) this.player.isFlying = false;
    }

    // --- Logica di Combattimento/Proiettili (Spostare in CombatManager) ---

    initProjectilePool() {
        const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const projectileMats = {
            player: new THREE.MeshBasicMaterial({ color: 0x00ffff }),
            enemy: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
            special: new THREE.MeshBasicMaterial({ color: 0xff00ff }),
            energyWave: new THREE.MeshBasicMaterial({ color: 0x3e78ff, transparent: true, opacity: 0.8 }),
            laserEyes: new THREE.MeshBasicMaterial({ color: 0xff3e3e, transparent: true, opacity: 0.9 })
        };

        this.projectilePool = [];
        for (let i = 0; i < MAX_PROJECTILES; i++) {
            const mesh = new THREE.Mesh(sphereGeo.clone(), projectileMats.player);
            mesh.visible = false;
            this.scene.add(mesh);
            this.projectilePool.push({ mesh: mesh, materialCache: projectileMats, inUse: false });
        }
        console.log(`Projectile pool initialized with ${this.projectilePool.length} objects.`);
    }

    handlePlayerAttack(detail) {
        if (!this.player) return;

        const direction = detail.direction || new THREE.Vector3();

        let attackData = null;
        if (detail.button === 0) {
            attackData = this.player.attackEnergy(direction);
        } else if (detail.button === 2) {
            attackData = this.player.attackSpecial(direction);
        }

        if (attackData) {
            this.createProjectile(attackData);
        }
    }

    createProjectile(data) {
         let poolItem = this.projectilePool.find(p => !p.inUse);

         if (!poolItem) {
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
                 poolItem = recycledData.poolItem;
            } else {
                console.error("Projectile pool limit reached and no active projectile to recycle!");
                return;
            }
        }

         poolItem.inUse = true;
         const mesh = poolItem.mesh;
         const mats = poolItem.materialCache;

         let targetMaterial = mats.player;
         if(data.isEnemyProjectile) {
             targetMaterial = mats.enemy;
         } else if (data.type === 'energyWave') {
             targetMaterial = mats.energyWave;
         } else if (data.type === 'laserEyes') {
            targetMaterial = mats.laserEyes;
         }

         mesh.material = targetMaterial;
         mesh.material.color.set(data.color || targetMaterial.color.getHex());

         mesh.position.copy(data.origin).addScaledVector(data.direction, 1.5);
         mesh.scale.setScalar(data.width || 1);
         mesh.visible = true;

         this.activeProjectiles.push({
             poolItem: poolItem,
             mesh: mesh,
             direction: data.direction,
             speed: data.speed,
             power: data.power,
             range: data.range,
             distanceTraveled: 0,
             type: data.type,
             isEnemyProjectile: data.isEnemyProjectile || false,
             startTime: performance.now()
         });

         let soundName = 'shoot';
         if (data.isEnemyProjectile) soundName = 'enemy_shoot';
         else if (data.type === 'energyWave') soundName = 'energy_wave_sound';
         else if (data.type === 'laserEyes') soundName = 'laser_sound';
         playSound(soundName, 0.4);
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
                     if (enemy.position.distanceToSquared(p.mesh.position) < p.range * p.range * 0.5) {
                         const enemyBox = new THREE.Box3().setFromObject(enemy.mesh);
                         if (projBox.intersectsBox(enemyBox)) {
                             hit = true;
                             hitObject = enemy;
                             break;
                         }
                     }
                 }
            }

            if (hit && hitObject) {
                this.handleProjectileHit(p, hitObject);
                p.mesh.visible = false;
                p.poolItem.inUse = false;
                this.activeProjectiles.splice(i, 1);
                continue;
            }

            if (p.distanceTraveled > p.range) {
                p.mesh.visible = false;
                p.poolItem.inUse = false;
                this.activeProjectiles.splice(i, 1);
            }
        }
    }

    handleProjectileHit(projectile, target) {
        const hitPosition = projectile.mesh.position.clone();
        let damageDealt = projectile.power;

        if (target === this.player) {
            const alive = this.player.takeDamage(damageDealt);
            playSound('hit', 0.7);
            this.createHitEffect(hitPosition, 0xff0000);
            if (!alive) this.handleGameOver();
        } else {
             const enemy = target;
             const enemyStillAlive = enemy.takeDamage(damageDealt);
             playSound('hit', 0.5);
             this.createHitEffect(hitPosition, 0xffff00);

             if (!enemyStillAlive) {
                 const expGained = enemy.type === 'drone' ? 10 : 25;
                 const currencyGained = enemy.type === 'drone' ? 5 : 10;
                 this.player.gainExperience(expGained);
                 this.player.currency += currencyGained;
                 this.createExplosionEffect(enemy.position, enemy.mesh.scale.x * 1.5);
                 playSound('explosion', 0.6);
             }
        }
    }

    updateEnemies(deltaTime) {
         for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
             const enemy = this.activeEnemies[i];
             if (!enemy.isActive) {
                 enemy.removeFromScene(this.scene);
                 this.activeEnemies.splice(i, 1);
                 continue;
             }

             let shouldUpdateAI = false;
             const distanceToPlayerSq = enemy.position.distanceToSquared(this.player.position);
             const updateRangeSq = 500 * 500;

             if(performanceMonitor.lowQualityMode) {
                 shouldUpdateAI = distanceToPlayerSq < updateRangeSq * 0.2 || (performanceMonitor.frameCount + i) % 10 === 0;
             } else {
                 shouldUpdateAI = distanceToPlayerSq < updateRangeSq || (performanceMonitor.frameCount + i) % 5 === 0;
             }

             if(shouldUpdateAI){
                 const enemyProjectileData = enemy.update(deltaTime, this.player);
                 if (enemyProjectileData) {
                     this.createProjectile(enemyProjectileData);
                 }
             }
         }
     }

    checkPlanetInteraction() {
        if (!this.universeGenerator || !this.player || this.state.mode !== GAME_MODES.SPACE) return;

        const playerPos = this.player.position;
        let closestPlanet = null;
        let closestDistSq = Infinity;

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

        const interactionDistance = (closestPlanet?.size || 0) * 1.5 + 10;

        if (closestPlanet && closestDistSq < interactionDistance * interactionDistance) {
            if (this.state.activePlanet !== closestPlanet) {
                this.state.activePlanet = closestPlanet;
                showPlanetInfo(closestPlanet);
            }
        } else {
            if (this.state.activePlanet) {
                hidePlanetInfo();
                this.state.activePlanet = null;
            }
        }
    }

    checkPortalInteraction() {
        // Implementa usando this.worldManager.exitPortalBox ecc.
    }

    updateFrustumCulling() {
        if (!this.camera || !this.worldManager) return;
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
            const deltaEffect = this.clock.getDelta();
            elapsed += deltaEffect;
            if (elapsed < effectDuration) {
                effectMesh.scale.multiplyScalar(1 + 15 * deltaEffect);
                effectMesh.material.opacity = 0.8 * (1 - elapsed / effectDuration);
                requestAnimationFrame(animateEffect);
            } else {
                this.scene.remove(effectMesh);
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
            const deltaExplosion = this.clock.getDelta();
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
            }
        };
        requestAnimationFrame(animateExplosion);
    }

    // --- Gestione Stato Gioco ---
    handleGameOver() {
        if (this.state.isGameOver) return;
        console.log("GAME OVER!");
        this.state.isGameOver = true;
        this.stopGameLoop();
        if (this.pointerLockControls) this.pointerLockControls.unlock();
        showGameOver();
        closeUpgradesScreen();
        closeLegendScreen();
        const hint = document.getElementById('controls-hint');
        if(hint) hint.style.opacity = '1';
    }

    restartGame() {
        console.log("Restarting game...");
        hideGameOver();

        if (this.player && typeof this.player.reset === 'function') {
            this.player.reset();
        } else {
            console.warn("Player.reset() method not found.");
            location.reload();
            return;
        }

        this.state.isGameOver = false;
        this.state.isPaused = false;
        this.state.gameTime = 0;

        this.setGameMode(GAME_MODES.SPACE, { force: true });
        if (this.pointerLockControls) {
             this.pointerLockControls.lock();
             const hint = document.getElementById('controls-hint');
             if (hint) hint.style.opacity = '0';
        }
        this.startGameLoop();
    }

    // --- Azioni Giocatore (Callbacks da UI) ---
    attemptConquerPlanet() {
        if (!this.state.activePlanet || !this.player) return;

        const planet = this.state.activePlanet;
        const result = this.universeGenerator.conquerPlanet(planet, this.player.race, this.player.attackPower);

        showMessage(result.message, result.success ? 'success' : 'warning');

        if (result.success) {
            this.player.currency += result.resources;
            this.player.addConqueredPlanet(planet);
            showPlanetInfo(planet);
            if(this.worldManager.updatePlanetVisuals) this.worldManager.updatePlanetVisuals(planet);
            playSound('success');
        } else {
            playSound('failure');
        }
    }

    attemptUpgrade(stat) {
        if (!this.player) return;
        const currentLevel = this.player.upgrades[stat];
        const baseCost = 100;
        const maxLevel = 10;
        const cost = baseCost * Math.pow(2, currentLevel);

        if (currentLevel >= maxLevel) {
            showMessage("Potenziamento già al massimo livello.", "info");
            return;
        }

        const result = this.player.upgrade(stat, cost);

        if (result.success) {
             showMessage(result.message, 'success');
             updateUI();
             playSound('upgrade');
        } else {
             showMessage(result.message, 'error');
             playSound('error');
        }
    }

    getPlanetTypeForTerrain(planet) {
        if (!planet || !planet.type) return 'earth';
        return planet.type;
    }

    // --- Gestione Input Globale ---
    handleKeyDown(event) {
        // Gestisci prima gli shortcut UI che sbloccano il cursore
        if (event.code === 'KeyU') {
            this.state.uiState.upgradesOpen ? closeUpgradesScreen() : openUpgradesScreen();
            this.state.uiState.upgradesOpen = !this.state.uiState.upgradesOpen;
            this.pointerLockControls.isLocked ? this.pointerLockControls.unlock() : this.pointerLockControls.lock();
            return; // Non processare altro
        }
        if (event.code === 'KeyL') {
            this.state.uiState.legendOpen ? closeLegendScreen() : openLegendScreen();
            this.state.uiState.legendOpen = !this.state.uiState.legendOpen;
            this.pointerLockControls.isLocked ? this.pointerLockControls.unlock() : this.pointerLockControls.lock();
            return;
        }
        // Aggiungere M per Mappa, I per Inventario, Escape per Pausa qui se implementate

        // Se il gioco è in pausa o terminato, o il cursore è sbloccato (e non è un tasto UI), ignora altri input
        if (this.state.isGameOver || this.state.isPaused || !this.pointerLockControls?.isLocked) return;

        // Altri input gestiti solo se il lock è attivo
        switch (event.code) {
            case 'KeyE':
                if (this.state.mode === GAME_MODES.SPACE && this.state.activePlanet) {
                    if (!this.state.activePlanet.isConquered) {
                        this.attemptConquerPlanet();
                    } else {
                        console.log("Landing on planet:", this.state.activePlanet.name);
                        this.setGameMode(GAME_MODES.PLANET, { planet: this.state.activePlanet });
                    }
                } else if (this.state.mode === GAME_MODES.PLANET) {
                    console.log("Leaving planet...");
                    this.setGameMode(GAME_MODES.SPACE);
                }
                break;
            // Aggiungere altri tasti azione specifici del gioco (es. cambio arma, abilità)
        }
    }

    // --- Lifecycle & Debug ---
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    dispose() {
        console.log("Disposing GameIntegration resources...");
        this.stopGameLoop();
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        document.removeEventListener('player-attack', this.handlePlayerAttack.bind(this));
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        disposeControls(); // Chiama funzione da playerControls
        
        // Rilascia altre risorse...
        
        console.log("Game resources disposed.");
    }
    addDebugStats() {
        if (!this.stats) {
            this.stats = new Stats();
            this.stats.dom.style.position = 'absolute';
            this.stats.dom.style.top = '0px';
            this.stats.dom.style.left = '0px';
            this.container.appendChild(this.stats.dom);
        }
    }
} 
