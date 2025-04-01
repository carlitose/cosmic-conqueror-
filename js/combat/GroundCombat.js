import * as THREE from 'three';
import { GroundWeapons } from './GroundWeapons.js';
import { GroundEnemies } from './GroundEnemies.js';
import { GroundPhysics } from './GroundPhysics.js';

/**
 * Class representing the ground combat system
 * Adapted from Three-FPS for planetary ground combat
 */
class GroundCombat {
    /**
     * Create a ground combat instance
     * @param {THREE.Scene} scene - The scene to add elements to
     * @param {THREE.Camera} camera - The player camera
     * @param {Object} options - Additional configuration options
     */
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        this.options = {
            gravity: -9.8,
            playerHeight: 1.8,
            playerSpeed: 5,
            jumpForce: 5,
            hitPoints: 100,
            ...options
        };

        // Combat state
        this.active = false;
        this.playerState = {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            onGround: true,
            hitPoints: this.options.hitPoints,
            currentWeapon: 'pistol'
        };

        // Initialize subsystems
        this.weapons = new GroundWeapons(this.scene, this.camera);
        this.enemies = new GroundEnemies(this.scene);
        this.physics = new GroundPhysics(this.scene);
        
        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            reload: false,
            weaponSwitch: false,
            fire: false
        };

        // Effect collections
        this.projectiles = [];
        this.impacts = [];
        this.muzzleFlashes = [];
    }

    /**
     * Initialize the ground combat system
     */
    initialize() {
        this.setupPlayer();
        this.setupInputHandlers();
        this.setupAudio();
        this.weapons.initialize();
        this.enemies.initialize();
        this.physics.initialize(this.playerState);
    }

    /**
     * Set up the player character
     */
    setupPlayer() {
        // Player body for collision detection (invisible)
        const playerGeometry = new THREE.CylinderGeometry(0.5, 0.5, this.options.playerHeight, 8);
        const playerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            wireframe: true,
            visible: false
        });
        this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        this.playerMesh.position.y = this.options.playerHeight / 2;
        this.scene.add(this.playerMesh);
        
        // Weapon model visible to player
        this.weapons.equipWeapon(this.playerState.currentWeapon);
    }

    /**
     * Set up input event handlers
     */
    setupInputHandlers() {
        // To be implemented
    }

    /**
     * Set up audio effects for combat
     */
    setupAudio() {
        // To be implemented
    }

    /**
     * Imposta statistiche del giocatore da sistema esterno
     * @param {number} attackPower - Potenza d'attacco del giocatore
     * @param {number} maxHealth - Salute massima del giocatore
     */
    setPlayerStats(attackPower, maxHealth) {
        // Aggiorna opzioni
        this.options.attackPower = attackPower || this.options.attackPower || 10;
        this.options.hitPoints = maxHealth || this.options.hitPoints || 100;
        
        // Aggiorna stato giocatore se esiste
        if (this.playerState) {
            this.playerState.hitPoints = this.options.hitPoints;
        }
        
        console.log('Ground combat player stats updated:', {
            attackPower: this.options.attackPower,
            hitPoints: this.options.hitPoints
        });
    }
    
    /**
     * Verifica se il combattimento è completo
     * @returns {boolean} True se il combattimento è finito
     */
    isCombatComplete() {
        // Considera il combattimento completato se non ci sono più nemici
        // o se altre condizioni specifiche sono soddisfatte
        if (this.enemies && this.enemies.enemies && this.enemies.enemies.length === 0) {
            return true;
        }
        
        // Anche se ci sono ancora pochi nemici, dopo un certo tempo consideralo finito
        if (this._combatDuration > 120) { // 2 minuti
            return true;
        }
        
        return false;
    }

    /**
     * Update the combat system
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        if (!this.active) return;
        
        // Aggiorna il tempo di combattimento
        this._combatDuration = (this._combatDuration || 0) + deltaTime;
        
        this.updatePlayerMovement();
        this.weapons.update(deltaTime);
        this.enemies.update(deltaTime, this.playerState.position);
        this.physics.update(deltaTime);
        this.updateProjectiles();
        this.checkCollisions();
    }

    /**
     * Update player movement based on input
     */
    updatePlayerMovement() {
        // To be implemented
    }

    /**
     * Update projectiles and effects
     */
    updateProjectiles() {
        // To be implemented
    }

    /**
     * Check for collisions between entities
     */
    checkCollisions() {
        // To be implemented
    }

    /**
     * Activate ground combat mode
     */
    activate() {
        this.active = true;
    }

    /**
     * Deactivate ground combat mode
     */
    deactivate() {
        this.active = false;
    }

    /**
     * Spara un proiettile dal giocatore
     */
    firePlayerProjectile() {
        if (this.weaponCooldown > 0) return;
        
        // Implementazione sparo proiettile...
        console.log('Giocatore ha sparato');
        this.weaponCooldown = this.weaponCooldownTime;
    }
    
    /**
     * Spara un proiettile dal nemico
     * @param {Object} enemy - Nemico che spara
     */
    fireEnemyProjectile(enemy) {
        // Usa il parametro enemy per evitare l'errore eslint
        console.log(`Nemico ${enemy.id || 'sconosciuto'} ha sparato`);
    }
}

export { GroundCombat }; 