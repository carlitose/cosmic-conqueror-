import * as THREE from 'three';

/**
 * Class to manage ground enemies
 */
class GroundEnemies {
    /**
     * Create an enemy manager
     * @param {THREE.Scene} scene - The scene to add enemies to
     */
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.spawnPoints = [];
        this.difficulty = 1;
        this.maxEnemies = 10;
        this.lastSpawnTime = 0;
        this.spawnRate = 5; // Seconds between spawns
    }
    
    /**
     * Initialize the enemy system
     */
    initialize() {
        this.setupEnemyTypes();
    }
    
    /**
     * Define enemy types
     */
    setupEnemyTypes() {
        this.enemyTypes = {
            grunt: {
                health: 50,
                speed: 3,
                damage: 10,
                attackRate: 2,
                range: 15,
                color: 0xFF0000,
                scale: 1.0,
                scoreValue: 100
            },
            heavy: {
                health: 120,
                speed: 1.5,
                damage: 25,
                attackRate: 3,
                range: 10,
                color: 0x8B0000,
                scale: 1.3,
                scoreValue: 250
            },
            scout: {
                health: 30,
                speed: 5,
                damage: 5,
                attackRate: 1,
                range: 20,
                color: 0xFFA500,
                scale: 0.8,
                scoreValue: 150
            },
            boss: {
                health: 500,
                speed: 1,
                damage: 40,
                attackRate: 4,
                range: 25,
                color: 0x800080,
                scale: 2.0,
                scoreValue: 1000
            }
        };
    }
    
    /**
     * Add a spawn point
     * @param {THREE.Vector3} position - Position to spawn enemies
     */
    addSpawnPoint(position) {
        this.spawnPoints.push(position.clone());
    }
    
    /**
     * Set spawn points in a circle around a position
     * @param {THREE.Vector3} centerPosition - Center position
     * @param {number} radius - Radius of spawn circle
     * @param {number} count - Number of spawn points
     */
    setupSpawnPointsCircle(centerPosition, radius = 50, count = 8) {
        this.spawnPoints = [];
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = centerPosition.x + Math.cos(angle) * radius;
            const z = centerPosition.z + Math.sin(angle) * radius;
            
            this.spawnPoints.push(new THREE.Vector3(x, centerPosition.y, z));
        }
    }
    
    /**
     * Spawn a new enemy
     * @param {string} type - Enemy type to spawn
     * @param {THREE.Vector3} position - Position to spawn at
     * @return {Object} The spawned enemy
     */
    spawnEnemy(type, position) {
        if (!this.enemyTypes[type]) {
            console.error(`Enemy type ${type} not found`);
            return null;
        }
        
        if (this.enemies.length >= this.maxEnemies) {
            return null;
        }
        
        const enemyConfig = this.enemyTypes[type];
        
        // Create enemy mesh
        const geometry = new THREE.CapsuleGeometry(0.5 * enemyConfig.scale, 1 * enemyConfig.scale, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: enemyConfig.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Create enemy object
        const enemy = {
            type,
            config: enemyConfig,
            mesh,
            health: enemyConfig.health,
            position: mesh.position,
            velocity: new THREE.Vector3(),
            target: null,
            state: 'idle', // idle, chase, attack, stunned
            lastAttackTime: 0,
            stunTime: 0
        };
        
        this.scene.add(mesh);
        this.enemies.push(enemy);
        
        return enemy;
    }
    
    /**
     * Handle enemy taking damage
     * @param {Object} enemy - The enemy to damage
     * @param {number} amount - Amount of damage
     * @param {THREE.Vector3} impactVector - Direction of impact
     */
    damageEnemy(enemy, amount, impactVector) {
        enemy.health -= amount;
        
        // Apply knockback force
        if (impactVector) {
            const knockback = impactVector.clone().normalize().multiplyScalar(0.5);
            enemy.velocity.add(knockback);
        }
        
        // Stun the enemy briefly
        enemy.state = 'stunned';
        enemy.stunTime = 0.5;
        
        // Flash the enemy red
        const originalColor = enemy.mesh.material.color.getHex();
        enemy.mesh.material.color.set(0xFFFFFF);
        
        setTimeout(() => {
            if (enemy.mesh && enemy.mesh.material) {
                enemy.mesh.material.color.set(originalColor);
            }
        }, 100);
        
        // Check if enemy is dead
        if (enemy.health <= 0) {
            this.killEnemy(enemy);
            return true;
        }
        
        return false;
    }
    
    /**
     * Kill and remove an enemy
     * @param {Object} enemy - The enemy to kill
     */
    killEnemy(enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
            this.enemies.splice(index, 1);
        }
        
        this.scene.remove(enemy.mesh);
        
        // Create death effect here if desired
    }
    
    /**
     * Check if enemies should spawn
     * @param {number} currentTime - Current game time
     * @param {THREE.Vector3} playerPosition - Player position
     */
    checkSpawning(currentTime, playerPosition) {
        if (this.enemies.length >= this.maxEnemies) return;
        if (currentTime - this.lastSpawnTime < this.spawnRate) return;
        
        // Spawn wave if time has passed
        this.lastSpawnTime = currentTime;
        this.spawnEnemyWave(playerPosition);
    }
    
    /**
     * Spawn a wave of enemies
     * @param {THREE.Vector3} playerPosition - Player position
     */
    spawnEnemyWave(playerPosition) {
        // If no spawn points defined, create some around player
        if (this.spawnPoints.length === 0) {
            this.setupSpawnPointsCircle(playerPosition);
        }
        
        const spawnCount = Math.min(
            Math.floor(2 + this.difficulty),
            this.maxEnemies - this.enemies.length
        );
        
        for (let i = 0; i < spawnCount; i++) {
            // Choose random spawn point
            const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
            
            // Determine enemy type based on difficulty
            let enemyType = 'grunt';
            const roll = Math.random();
            
            if (roll > 0.9 && this.difficulty > 3) {
                enemyType = 'boss';
            } else if (roll > 0.7 && this.difficulty > 2) {
                enemyType = 'heavy';
            } else if (roll > 0.4) {
                enemyType = 'scout';
            }
            
            this.spawnEnemy(enemyType, spawnPoint);
        }
    }
    
    /**
     * Update all enemies
     * @param {number} deltaTime - Time since last update
     * @param {THREE.Vector3} playerPosition - Player position
     */
    update(deltaTime, playerPosition) {
        const currentTime = performance.now() / 1000;
        
        // Check if should spawn new enemies
        this.checkSpawning(currentTime, playerPosition);
        
        // Update each enemy
        this.enemies.forEach(enemy => {
            this.updateEnemy(enemy, deltaTime, currentTime, playerPosition);
        });
    }
    
    /**
     * Update a single enemy
     * @param {Object} enemy - Enemy to update
     * @param {number} deltaTime - Time since last update
     * @param {number} currentTime - Current game time
     * @param {THREE.Vector3} playerPosition - Player position
     */
    updateEnemy(enemy, deltaTime, currentTime, playerPosition) {
        // Update stun state
        if (enemy.state === 'stunned') {
            enemy.stunTime -= deltaTime;
            if (enemy.stunTime <= 0) {
                enemy.state = 'chase';
            }
        }
        
        // Apply friction to velocity
        enemy.velocity.multiplyScalar(0.9);
        
        // Set player as target
        enemy.target = playerPosition;
        
        // Handle enemy state
        switch (enemy.state) {
            case 'idle':
                // Transition to chase if player is nearby
                if (enemy.position.distanceTo(playerPosition) < enemy.config.range * 2) {
                    enemy.state = 'chase';
                }
                break;
                
            case 'chase':
                // Move toward player
                if (enemy.target) {
                    const direction = new THREE.Vector3().subVectors(enemy.target, enemy.position).normalize();
                    const speed = enemy.config.speed * deltaTime;
                    enemy.velocity.add(direction.multiplyScalar(speed));
                }
                
                // Transition to attack if close enough
                if (enemy.position.distanceTo(playerPosition) < enemy.config.range) {
                    enemy.state = 'attack';
                }
                break;
                
            case 'attack':
                // Attack player if cooldown is up
                if (currentTime - enemy.lastAttackTime > enemy.config.attackRate) {
                    enemy.lastAttackTime = currentTime;
                    // Attack logic here (damage is handled externally)
                }
                
                // Transition back to chase if player moved away
                if (enemy.position.distanceTo(playerPosition) > enemy.config.range) {
                    enemy.state = 'chase';
                }
                break;
                
            case 'stunned':
                // Do nothing while stunned
                break;
        }
        
        // Apply velocity to position
        enemy.position.add(enemy.velocity);
        
        // Keep enemies on the ground
        if (enemy.position.y < 1) {
            enemy.position.y = 1;
        }
        
        // Make enemy face player
        if (enemy.state !== 'stunned' && enemy.target) {
            const lookDir = new THREE.Vector3().subVectors(enemy.target, enemy.position);
            lookDir.y = 0; // Keep upright
            if (lookDir.length() > 0.1) {
                enemy.mesh.lookAt(enemy.position.clone().add(lookDir));
            }
        }
    }
    
    /**
     * Check if an enemy is attacking the player
     * @param {THREE.Vector3} playerPosition - Player position
     * @returns {Object|null} Attack data or null if no attack
     */
    checkEnemyAttacks(playerPosition) {
        const attacks = [];
        const currentTime = performance.now() / 1000;
        
        this.enemies.forEach(enemy => {
            if (enemy.state !== 'attack') return;
            if (currentTime - enemy.lastAttackTime < enemy.config.attackRate) return;
            
            const distance = enemy.position.distanceTo(playerPosition);
            if (distance <= enemy.config.range) {
                enemy.lastAttackTime = currentTime;
                
                attacks.push({
                    enemy,
                    damage: enemy.config.damage,
                    position: enemy.position.clone(),
                    direction: new THREE.Vector3().subVectors(playerPosition, enemy.position).normalize()
                });
            }
        });
        
        return attacks.length > 0 ? attacks : null;
    }
    
    /**
     * Set the difficulty level
     * @param {number} level - New difficulty level
     */
    setDifficulty(level) {
        this.difficulty = Math.max(1, level);
        this.maxEnemies = 5 + (this.difficulty * 2);
        this.spawnRate = Math.max(1, 6 - (this.difficulty * 0.5));
    }
    
    /**
     * Get all enemy positions for collision checking
     * @returns {Array} Array of enemy position and size data
     */
    getEnemyPositions() {
        return this.enemies.map(enemy => ({
            position: enemy.position.clone(),
            radius: 0.5 * enemy.config.scale,
            height: 2 * enemy.config.scale,
            enemy
        }));
    }
}

export { GroundEnemies }; 