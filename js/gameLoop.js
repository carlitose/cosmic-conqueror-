import * as THREE from 'three';
import { performanceMonitor } from './performanceMonitor.js';
import { getCamera, getScene, getRenderer, getComposer } from './setup.js';
import { getMovementState, getControls } from './playerControls.js';
import { updateUI } from './uiManager.js';
import { PHYSICS } from './constants.js';

/**
 * Modulo che gestisce il ciclo principale del gioco (game loop)
 */

// Variabili interne
let prevTime = performance.now();
let lastFrustumCheck = 0;
let animationFrameId = null;
let isRunning = false;
let isGameOver = false;
let player = null;

// Sistemi e moduli esterni
let moduleUpdaters = {};

/**
 * Classe del ciclo di gioco
 */
export class GameLoop {
    /**
     * Crea una nuova istanza del game loop
     * @param {Object} gameState - Oggetto contenente lo stato del gioco
     */
    constructor(gameState) {
        this.gameState = gameState || {};
        
        // Ottieni riferimenti ai componenti Three.js
        this.scene = gameState.scene || getScene();
        this.camera = gameState.camera || getCamera();
        this.renderer = gameState.renderer || getRenderer();
        this.composer = gameState.composer || getComposer();
        this.controls = gameState.controls || getControls();
        
        // Salva il riferimento al giocatore
        player = gameState.player;
        
        // Inizializza frustrumCullingObjects se non esiste
        this.frustumCullingObjects = gameState.frustumCullingObjects || [];
        
        // Imposta sistema di collisione
        this.collisionCache = new Map();
        
        console.log("Game loop created");
    }
    
    /**
     * Funzione principale del ciclo di animazione
     */
    animate() {
        if (!isRunning) return;
        
        animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        // Aggiorna monitor prestazioni
        performanceMonitor.update();
        
        // Applica il limitatore di frame rate
        if (!performanceMonitor.shouldRenderFrame()) {
            return; // Salta il frame se stiamo superando il frame rate target
        }
        
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // Non aggiornare se il gioco non è iniziato, se il puntatore non è bloccato o se è Game Over
        if (!player || !this.controls?.isLocked || isGameOver) { 
            prevTime = time;
            // Rendering diretto in stato di pausa
            if (performanceMonitor.lowQualityMode || !this.composer) {
                this.renderer.render(this.scene, this.camera);
            } else {
                this.composer.render();
            }
            return; 
        }

        try {
            // --- Update Player (ogni frame) --- 
            this.updatePlayer(delta);
            
            // --- Frustum Culling (ogni 500ms, in low quality meno spesso) ---
            const cullingInterval = performanceMonitor.lowQualityMode ? 
                PHYSICS.FRUSTUM_CHECK_INTERVAL * 2 : PHYSICS.FRUSTUM_CHECK_INTERVAL;
                
            if (time - lastFrustumCheck > cullingInterval) {
                this.updateFrustumCulling();
                lastFrustumCheck = time;
            }
            
            // --- Aggiorna i vari moduli di gioco ---
            this.updateModules(delta);
            
            // --- Physics & Collisions ---
            // TODO: Implementare sistema di collisioni centralizzato
            
            // --- Aggiorna UI ---
            updateUI();
            
            // --- Rendering ---
            if (performanceMonitor.lowQualityMode || !this.composer) {
                this.renderer.render(this.scene, this.camera);
            } else {
                this.composer.render();
            }
        } catch (error) {
            console.error("Error in animation loop:", error);
            isGameOver = true;
        }
        
        prevTime = time;
    }
    
    /**
     * Aggiorna il giocatore
     * @param {number} delta - Tempo trascorso dal frame precedente
     */
    updatePlayer(delta) {
        if (!player) return;
        
        const movement = getMovementState();
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        player.update(
            delta, 
            movement.forward, 
            movement.backward, 
            movement.left, 
            movement.right, 
            movement.up, 
            movement.down, 
            cameraDirection
        );
        
        // Sincronizza la posizione della camera con il giocatore
        if (this.controls) {
            this.controls.getObject().position.copy(player.position);
        }
    }
    
    /**
     * Aggiorna il frustum culling per ottimizzare le performance
     */
    updateFrustumCulling() {
        if (!this.scene || !this.camera || this.frustumCullingObjects.length === 0) return;
        
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);
        
        // Ottimizza rendendo visibili solo gli oggetti nel frustum della camera
        for (const obj of this.frustumCullingObjects) {
            if (obj && obj.userData && !obj.userData.alwaysVisible) {
                // Utilizza boundingSphere per un test veloce
                if (!obj.geometry || !obj.geometry.boundingSphere) {
                    if (obj.geometry) obj.geometry.computeBoundingSphere();
                    else continue;
                }
                
                // Calcola posizione assoluta della bounding sphere
                const boundingSphere = obj.geometry.boundingSphere.clone();
                boundingSphere.applyMatrix4(obj.matrixWorld);
                
                // Imposta visibilità in base all'intersezione con il frustum
                const isVisible = frustum.intersectsSphere(boundingSphere);
                
                // Aggiorna visibilità solo se cambia, per evitare operazioni DOM inutili
                if (obj.visible !== isVisible) {
                    obj.visible = isVisible;
                }
            }
        }
    }
    
    /**
     * Aggiunge un sistema/modulo da aggiornare nel game loop
     * @param {string} name - Nome identificativo del modulo
     * @param {Function} updateFunction - Funzione di aggiornamento del modulo
     */
    addModule(name, updateFunction) {
        if (typeof updateFunction !== 'function') {
            console.warn(`Il modulo ${name} non ha una funzione di update valida`);
            return;
        }
        
        moduleUpdaters[name] = updateFunction;
        console.log(`Modulo ${name} aggiunto al game loop`);
    }
    
    /**
     * Rimuove un sistema/modulo dal game loop
     * @param {string} name - Nome del modulo da rimuovere
     */
    removeModule(name) {
        if (moduleUpdaters[name]) {
            delete moduleUpdaters[name];
            console.log(`Modulo ${name} rimosso dal game loop`);
        }
    }
    
    /**
     * Aggiorna tutti i moduli registrati
     * @param {number} delta - Delta time
     */
    updateModules(delta) {
        for (const [name, updateFn] of Object.entries(moduleUpdaters)) {
            try {
                updateFn(delta, player?.position);
            } catch (error) {
                console.error(`Errore nell'aggiornamento del modulo ${name}:`, error);
            }
        }
    }
    
    /**
     * Avvia il game loop
     */
    start() {
        if (isRunning) return;
        
        console.log("Starting game loop");
        isRunning = true;
        prevTime = performance.now();
        this.animate();
    }
    
    /**
     * Ferma il game loop
     */
    stop() {
        if (!isRunning) return;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        isRunning = false;
        console.log("Game loop stopped");
    }
    
    /**
     * Imposta lo stato di game over
     * @param {boolean} value - True per attivare lo stato di game over
     */
    setGameOver(value) {
        isGameOver = value;
    }
    
    /**
     * Aggiunge oggetti al sistema di frustum culling
     * @param {THREE.Object3D|Array<THREE.Object3D>} objects - Oggetti da aggiungere
     */
    addFrustumCullingObjects(objects) {
        if (Array.isArray(objects)) {
            this.frustumCullingObjects = this.frustumCullingObjects.concat(objects);
        } else {
            this.frustumCullingObjects.push(objects);
        }
    }
} 