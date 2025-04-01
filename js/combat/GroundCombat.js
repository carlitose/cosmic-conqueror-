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
        if (!this.active || !this.playerState) return;

        const moveSpeed = this.keys.sprint ? 
            this.options.playerSpeed * 1.5 : 
            this.options.playerSpeed;

        // Get camera direction for movement relative to view
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        // Calculate forward and right vectors
        const forward = cameraDirection;
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Reset velocity
        this.playerState.velocity.x = 0;
        this.playerState.velocity.z = 0;

        // Apply movement based on input
        if (this.keys.forward) {
            this.playerState.velocity.add(forward.multiplyScalar(moveSpeed));
        }
        if (this.keys.backward) {
            this.playerState.velocity.sub(forward.multiplyScalar(moveSpeed));
        }
        if (this.keys.right) {
            this.playerState.velocity.add(right.multiplyScalar(moveSpeed));
        }
        if (this.keys.left) {
            this.playerState.velocity.sub(right.multiplyScalar(moveSpeed));
        }

        // Handle jumping
        if (this.keys.jump && this.playerState.onGround) {
            this.playerState.velocity.y = this.options.jumpForce;
            this.playerState.onGround = false;
        }

        // Apply gravity
        if (!this.playerState.onGround) {
            this.playerState.velocity.y += this.options.gravity * 0.016; // Assume 60fps
        }

        // Update position
        this.playerState.position.add(this.playerState.velocity);

        // Update player mesh and camera
        this.playerMesh.position.copy(this.playerState.position);
        this.camera.position.copy(this.playerState.position);
        this.camera.position.y += this.options.playerHeight * 0.8; // Eye level
    }

    /**
     * Update projectiles and effects
     */
    updateProjectiles() {
        const projectilesToRemove = [];

        // Update projectile positions
        this.projectiles.forEach((projectile, index) => {
            projectile.position.add(projectile.velocity);
            projectile.lifetime -= 0.016; // Assume 60fps

            // Check if projectile should be removed
            if (projectile.lifetime <= 0) {
                projectilesToRemove.push(index);
            }

            // Check terrain collision
            const terrainHeight = this.physics.getTerrainHeight(projectile.position);
            if (projectile.position.y <= terrainHeight) {
                this.createImpact(projectile.position.clone());
                projectilesToRemove.push(index);
            }
        });

        // Remove dead projectiles
        for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
            const index = projectilesToRemove[i];
            const projectile = this.projectiles[index];
            this.scene.remove(projectile);
            this.projectiles.splice(index, 1);
        }

        // Update impact effects
        this.impacts = this.impacts.filter(impact => {
            impact.lifetime -= 0.016;
            if (impact.lifetime <= 0) {
                this.scene.remove(impact);
                return false;
            }
            impact.material.opacity = impact.lifetime;
            return true;
        });

        // Update muzzle flashes
        this.muzzleFlashes = this.muzzleFlashes.filter(flash => {
            flash.lifetime -= 0.016;
            if (flash.lifetime <= 0) {
                this.scene.remove(flash);
                return false;
            }
            flash.material.opacity = flash.lifetime * 2;
            return true;
        });
    }

    /**
     * Check for collisions between entities
     */
    checkCollisions() {
        if (!this.active) return;

        const playerRadius = 0.5;
        const playerPosition = this.playerState.position;

        // Check projectile collisions with enemies
        this.projectiles.forEach((projectile, projectileIndex) => {
            if (projectile.isEnemy) return; // Skip enemy projectiles

            this.enemies.enemies.forEach((enemy, enemyIndex) => {
                const distance = projectile.position.distanceTo(enemy.position);
                if (distance < enemy.radius) {
                    // Hit enemy
                    enemy.takeDamage(projectile.damage);
                    this.createImpact(projectile.position.clone());
                    this.scene.remove(projectile);
                    this.projectiles.splice(projectileIndex, 1);

                    if (enemy.health <= 0) {
                        this.enemies.removeEnemy(enemyIndex);
                    }
                }
            });
        });

        // Check enemy projectiles with player
        this.projectiles.forEach((projectile, index) => {
            if (!projectile.isEnemy) return; // Skip player projectiles

            const distance = projectile.position.distanceTo(playerPosition);
            if (distance < playerRadius) {
                // Hit player
                this.playerState.hitPoints -= projectile.damage;
                this.createImpact(projectile.position.clone());
                this.scene.remove(projectile);
                this.projectiles.splice(index, 1);

                // Emit hit event
                this.emit('playerHit', {
                    damage: projectile.damage,
                    currentHealth: this.playerState.hitPoints
                });

                if (this.playerState.hitPoints <= 0) {
                    this.emit('playerDeath');
                }
            }
        });

        // Check player collision with enemies (melee range)
        this.enemies.enemies.forEach(enemy => {
            const distance = enemy.position.distanceTo(playerPosition);
            if (distance < enemy.meleeRange + playerRadius) {
                // Enemy can attack player
                if (enemy.canMeleeAttack()) {
                    this.playerState.hitPoints -= enemy.meleeDamage;
                    enemy.performMeleeAttack();

                    // Emit hit event
                    this.emit('playerHit', {
                        damage: enemy.meleeDamage,
                        currentHealth: this.playerState.hitPoints
                    });

                    if (this.playerState.hitPoints <= 0) {
                        this.emit('playerDeath');
                    }
                }
            }
        });
    }

    /**
     * Create an impact effect at the specified position
     * @param {THREE.Vector3} position - Position of the impact
     */
    createImpact(position) {
        const impactGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const impactMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1
        });

        const impact = new THREE.Mesh(impactGeometry, impactMaterial);
        impact.position.copy(position);
        impact.lifetime = 0.5; // Half second

        this.scene.add(impact);
        this.impacts.push(impact);
    }

    /**
     * Emit an event to the event system
     * @param {string} eventName - Name of the event
     * @param {Object} data - Event data
     */
    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
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