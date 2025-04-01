import * as THREE from 'three';

/**
 * Class to handle physics for ground combat
 */
class GroundPhysics {
    /**
     * Create a physics handler
     * @param {THREE.Scene} scene - The scene
     */
    constructor(scene) {
        this.scene = scene;
        this.gravity = -9.8;
        this.objects = [];
        this.terrain = null;
        this.playerState = null;
        
        // Collision groups
        this.collisionGroups = {
            TERRAIN: 1,
            PLAYER: 2,
            ENEMY: 4,
            PROJECTILE: 8,
            PICKUP: 16
        };
    }
    
    /**
     * Initialize the physics system
     * @param {Object} playerState - Reference to player state object
     */
    initialize(playerState) {
        this.playerState = playerState;
        this.setupDebugHelpers();
    }
    
    /**
     * Set up optional debug visualization
     */
    setupDebugHelpers() {
        this.debugEnabled = false;
        this.debugObjects = new THREE.Group();
        this.scene.add(this.debugObjects);
    }
    
    /**
     * Set reference to terrain generator for height checks
     * @param {Object} terrain - Terrain generator with heightAt method
     */
    setTerrain(terrain) {
        this.terrain = terrain;
    }
    
    /**
     * Register a physics object
     * @param {Object} obj - Object with position and velocity
     * @param {number} radius - Collision radius
     * @param {number} height - Object height
     * @param {number} mass - Object mass
     * @param {number} group - Collision group
     * @param {number} mask - Collision mask
     */
    addObject(obj, radius, height, mass, group, mask) {
        const physicsObj = {
            object: obj,
            position: obj.position,
            velocity: obj.velocity || new THREE.Vector3(),
            radius,
            height,
            mass,
            onGround: false,
            collisionGroup: group,
            collisionMask: mask
        };
        
        this.objects.push(physicsObj);
        return physicsObj;
    }
    
    /**
     * Remove an object from physics simulation
     * @param {Object} obj - Object to remove
     */
    removeObject(obj) {
        const index = this.objects.findIndex(o => o.object === obj);
        if (index !== -1) {
            this.objects.splice(index, 1);
        }
    }
    
    /**
     * Update physics for all objects
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Apply gravity to all objects
        this.objects.forEach(obj => {
            if (!obj.onGround) {
                obj.velocity.y += this.gravity * deltaTime;
            }
        });
        
        // Handle player physics separately for better control
        this.updatePlayerPhysics(deltaTime);
        
        // Update positions based on velocity
        this.objects.forEach(obj => {
            obj.position.add(new THREE.Vector3().copy(obj.velocity).multiplyScalar(deltaTime));
        });
        
        // Check terrain collisions
        this.checkTerrainCollisions();
        
        // Check object-object collisions
        this.checkObjectCollisions();
    }
    
    /**
     * Special handling for player physics
     * @param {number} deltaTime - Time since last update
     */
    updatePlayerPhysics(deltaTime) {
        if (!this.playerState) return;
        
        // Apply gravity if not on ground
        if (!this.playerState.onGround) {
            this.playerState.velocity.y += this.gravity * deltaTime;
        }
        
        // Add some drag/friction to horizontal movement
        const horizontalVelocity = new THREE.Vector2(
            this.playerState.velocity.x,
            this.playerState.velocity.z
        );
        
        // More friction when on ground
        const frictionFactor = this.playerState.onGround ? 0.9 : 0.98;
        horizontalVelocity.multiplyScalar(frictionFactor);
        
        this.playerState.velocity.x = horizontalVelocity.x;
        this.playerState.velocity.z = horizontalVelocity.y;
    }
    
    /**
     * Check for collisions with terrain
     */
    checkTerrainCollisions() {
        if (!this.terrain) return;
        
        // Handle player terrain collision
        if (this.playerState) {
            const playerPos = this.playerState.position;
            const terrainHeight = this.getTerrainHeightAt(playerPos.x, playerPos.z);
            
            if (playerPos.y < terrainHeight) {
                playerPos.y = terrainHeight;
                this.playerState.velocity.y = 0;
                this.playerState.onGround = true;
            } else {
                // Small threshold to allow walking down slopes
                const groundCheckThreshold = 0.1;
                this.playerState.onGround = (playerPos.y - terrainHeight) <= groundCheckThreshold;
            }
        }
        
        // Handle other objects' terrain collision
        this.objects.forEach(obj => {
            if (!(obj.collisionMask & this.collisionGroups.TERRAIN)) return;
            
            const objPos = obj.position;
            const terrainHeight = this.getTerrainHeightAt(objPos.x, objPos.z);
            
            if (objPos.y - obj.radius < terrainHeight) {
                objPos.y = terrainHeight + obj.radius;
                obj.velocity.y = 0;
                obj.onGround = true;
            } else {
                const groundCheckThreshold = 0.1;
                obj.onGround = (objPos.y - obj.radius - terrainHeight) <= groundCheckThreshold;
            }
        });
    }
    
    /**
     * Get terrain height at position, with fallback
     * @param {number} x - X coordinate
     * @param {number} z - Z coordinate
     * @returns {number} Height at position
     */
    getTerrainHeightAt(x, z) {
        if (this.terrain && typeof this.terrain.getHeightAt === 'function') {
            return this.terrain.getHeightAt(x, z);
        }
        return 0; // Default ground level
    }
    
    /**
     * Check for collisions between objects
     */
    checkObjectCollisions() {
        const objectCount = this.objects.length;
        
        // Compare each object against others
        for (let i = 0; i < objectCount; i++) {
            const objA = this.objects[i];
            
            // Player-object collision (special case)
            if (this.playerState && (objA.collisionMask & this.collisionGroups.PLAYER)) {
                this.checkPlayerObjectCollision(objA);
            }
            
            // Object-object collisions
            for (let j = i + 1; j < objectCount; j++) {
                const objB = this.objects[j];
                
                // Skip if no collision possible
                if (!(objA.collisionGroup & objB.collisionMask) && 
                    !(objB.collisionGroup & objA.collisionMask)) {
                    continue;
                }
                
                // Check collision
                if (this.detectCollision(objA, objB)) {
                    this.resolveCollision(objA, objB);
                }
            }
        }
    }
    
    /**
     * Check for collision between player and an object
     * @param {Object} obj - Object to check
     */
    checkPlayerObjectCollision(obj) {
        if (!this.playerState) return;
        
        const playerPos = this.playerState.position;
        const objPos = obj.position;
        
        // Simple distance check
        const playerRadius = 0.5; // Approximate player radius
        const playerHeight = 1.8; // Approximate player height
        
        // Horizontal distance
        const dx = playerPos.x - objPos.x;
        const dz = playerPos.z - objPos.z;
        const horizontalDistSq = dx * dx + dz * dz;
        const minHorizontalDist = playerRadius + obj.radius;
        
        if (horizontalDistSq < minHorizontalDist * minHorizontalDist) {
            // Check vertical overlap
            const playerBottom = playerPos.y;
            const playerTop = playerPos.y + playerHeight;
            const objBottom = objPos.y - obj.height / 2;
            const objTop = objPos.y + obj.height / 2;
            
            if (playerBottom < objTop && playerTop > objBottom) {
                // Collision detected
                this.resolvePlayerObjectCollision(obj);
            }
        }
    }
    
    /**
     * Resolve collision between player and object
     * @param {Object} obj - Object colliding with player
     */
    resolvePlayerObjectCollision(obj) {
        if (!this.playerState) return;
        
        const playerPos = this.playerState.position;
        const objPos = obj.position;
        
        // Simple separation vector
        const dx = playerPos.x - objPos.x;
        const dz = playerPos.z - objPos.z;
        
        // Normalize
        const distSq = dx * dx + dz * dz;
        if (distSq < 0.0001) return; // Prevent division by zero
        
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        
        // Move player away
        const playerRadius = 0.5;
        const separation = playerRadius + obj.radius - dist;
        
        if (separation > 0) {
            playerPos.x += nx * separation;
            playerPos.z += nz * separation;
            
            // Reflect velocity component along normal
            const dot = this.playerState.velocity.x * nx + this.playerState.velocity.z * nz;
            this.playerState.velocity.x -= 2 * dot * nx;
            this.playerState.velocity.z -= 2 * dot * nz;
            
            // Add some damping
            this.playerState.velocity.multiplyScalar(0.8);
        }
    }
    
    /**
     * Detect collision between two physics objects
     * @param {Object} objA - First object
     * @param {Object} objB - Second object
     * @returns {boolean} True if collision detected
     */
    detectCollision(objA, objB) {
        const posA = objA.position;
        const posB = objB.position;
        
        // Sphere-sphere collision
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dz = posB.z - posA.z;
        
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = objA.radius + objB.radius;
        
        return distSq < minDist * minDist;
    }
    
    /**
     * Resolve collision between two physics objects
     * @param {Object} objA - First object
     * @param {Object} objB - Second object
     */
    resolveCollision(objA, objB) {
        const posA = objA.position;
        const posB = objB.position;
        
        // Calculate normal
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dz = posB.z - posA.z;
        
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 0.0001) return; // Prevent division by zero
        
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        
        // Calculate separation distance
        const separation = objA.radius + objB.radius - dist;
        
        if (separation <= 0) return; // No overlap
        
        // Mass ratio for position correction
        const totalMass = objA.mass + objB.mass;
        const ratioA = objB.mass / totalMass;
        const ratioB = objA.mass / totalMass;
        
        // Adjust positions
        posA.x -= nx * separation * ratioA;
        posA.y -= ny * separation * ratioA;
        posA.z -= nz * separation * ratioA;
        
        posB.x += nx * separation * ratioB;
        posB.y += ny * separation * ratioB;
        posB.z += nz * separation * ratioB;
        
        // Relative velocity
        const velDiffX = objB.velocity.x - objA.velocity.x;
        const velDiffY = objB.velocity.y - objA.velocity.y;
        const velDiffZ = objB.velocity.z - objA.velocity.z;
        
        // Project relative velocity onto normal
        const relVelDotNormal = velDiffX * nx + velDiffY * ny + velDiffZ * nz;
        
        // Do not resolve if objects are moving away from each other
        if (relVelDotNormal > 0) return;
        
        // Calculate impulse scalar
        const restitution = 0.3; // Bounciness
        const impulseScalar = -(1 + restitution) * relVelDotNormal / totalMass;
        
        // Apply impulse
        objA.velocity.x -= impulseScalar * objB.mass * nx;
        objA.velocity.y -= impulseScalar * objB.mass * ny;
        objA.velocity.z -= impulseScalar * objB.mass * nz;
        
        objB.velocity.x += impulseScalar * objA.mass * nx;
        objB.velocity.y += impulseScalar * objA.mass * ny;
        objB.velocity.z += impulseScalar * objA.mass * nz;
    }
    
    /**
     * Get collision result data without modifying objects
     * @param {THREE.Vector3} posA - Position of object A
     * @param {number} radiusA - Radius of object A
     * @param {THREE.Vector3} posB - Position of object B
     * @param {number} radiusB - Radius of object B
     * @returns {Object|null} Collision data or null if no collision
     */
    getCollisionResult(posA, radiusA, posB, radiusB) {
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dz = posB.z - posA.z;
        
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = radiusA + radiusB;
        
        if (distSq >= minDist * minDist) {
            return null; // No collision
        }
        
        const dist = Math.sqrt(distSq);
        const separation = minDist - dist;
        
        // Avoid division by zero
        let nx = 0, ny = 0, nz = 0;
        if (dist > 0.0001) {
            nx = dx / dist;
            ny = dy / dist;
            nz = dz / dist;
        } else {
            // Default to pushing up if objects are at exact same position
            ny = 1;
        }
        
        return {
            collision: true,
            normal: new THREE.Vector3(nx, ny, nz),
            separation: separation,
            point: new THREE.Vector3(
                posA.x + nx * radiusA,
                posA.y + ny * radiusA,
                posA.z + nz * radiusA
            )
        };
    }
    
    /**
     * Cast a ray and get the first hit
     * @param {THREE.Vector3} origin - Ray origin
     * @param {THREE.Vector3} direction - Ray direction (normalized)
     * @param {number} maxDistance - Maximum ray distance
     * @param {number} collisionMask - Collision mask
     * @returns {Object|null} Hit result or null if no hit
     */
    raycast(origin, direction, maxDistance, collisionMask) {
        let closestHit = null;
        let closestDist = maxDistance;
        
        // Check objects
        this.objects.forEach(obj => {
            if (!(obj.collisionGroup & collisionMask)) return;
            
            // Ray-sphere intersection
            const dx = obj.position.x - origin.x;
            const dy = obj.position.y - origin.y;
            const dz = obj.position.z - origin.z;
            
            // Project center of sphere onto ray
            const t = dx * direction.x + dy * direction.y + dz * direction.z;
            
            // If behind ray or too far, skip
            if (t < 0 || t > closestDist) return;
            
            // Closest point on ray to sphere center
            const px = origin.x + t * direction.x;
            const py = origin.y + t * direction.y;
            const pz = origin.z + t * direction.z;
            
            // Distance from closest point to sphere center
            const distSq = (px - obj.position.x) * (px - obj.position.x) +
                           (py - obj.position.y) * (py - obj.position.y) +
                           (pz - obj.position.z) * (pz - obj.position.z);
            
            // If outside sphere, skip
            if (distSq > obj.radius * obj.radius) return;
            
            // Calculate actual hit distance (t minus penetration)
            const penetration = Math.sqrt(obj.radius * obj.radius - distSq);
            const hitDist = t - penetration;
            
            // If behind ray origin, skip
            if (hitDist < 0) return;
            
            // If closer than current hit, update
            if (hitDist < closestDist) {
                closestDist = hitDist;
                
                // Calculate hit position and normal
                const hitPos = new THREE.Vector3(
                    origin.x + hitDist * direction.x,
                    origin.y + hitDist * direction.y,
                    origin.z + hitDist * direction.z
                );
                
                const normal = new THREE.Vector3(
                    hitPos.x - obj.position.x,
                    hitPos.y - obj.position.y,
                    hitPos.z - obj.position.z
                ).normalize();
                
                closestHit = {
                    object: obj.object,
                    position: hitPos,
                    normal: normal,
                    distance: hitDist
                };
            }
        });
        
        // Check terrain if available
        if (this.terrain && (collisionMask & this.collisionGroups.TERRAIN)) {
            // Simplified terrain raycast - could be improved for accuracy
            const steps = 10;
            const stepSize = closestDist / steps;
            
            for (let i = 0; i < steps; i++) {
                const t = i * stepSize;
                const px = origin.x + direction.x * t;
                const py = origin.y + direction.y * t;
                const pz = origin.z + direction.z * t;
                
                const terrainHeight = this.getTerrainHeightAt(px, pz);
                
                // If ray is below terrain
                if (py < terrainHeight) {
                    // Approximate hit position with simple linear interpolation
                    const prevPos = new THREE.Vector3(
                        origin.x + direction.x * (t - stepSize),
                        origin.y + direction.y * (t - stepSize),
                        origin.z + direction.z * (t - stepSize)
                    );
                    
                    const prevHeight = this.getTerrainHeightAt(prevPos.x, prevPos.z);
                    
                    // Linear interpolation to find more precise hit point
                    const fraction = (prevHeight - prevPos.y) / ((terrainHeight - py) + (prevPos.y - prevHeight));
                    const hitDist = t - stepSize + fraction * stepSize;
                    
                    // If closer than current hit
                    if (hitDist < closestDist) {
                        closestDist = hitDist;
                        
                        const hitPos = new THREE.Vector3(
                            origin.x + direction.x * hitDist,
                            origin.y + direction.y * hitDist,
                            origin.z + direction.z * hitDist
                        );
                        
                        // Approximate normal by sampling terrain heights
                        const dx = 0.1;
                        const dz = 0.1;
                        const h = this.getTerrainHeightAt(hitPos.x, hitPos.z);
                        const hx = this.getTerrainHeightAt(hitPos.x + dx, hitPos.z);
                        const hz = this.getTerrainHeightAt(hitPos.x, hitPos.z + dz);
                        
                        const normal = new THREE.Vector3(
                            (h - hx) / dx,
                            1,
                            (h - hz) / dz
                        ).normalize();
                        
                        closestHit = {
                            object: null, // No specific object for terrain
                            position: hitPos,
                            normal: normal,
                            distance: hitDist,
                            isTerrain: true
                        };
                    }
                    
                    break;
                }
            }
        }
        
        return closestHit;
    }
}

export { GroundPhysics }; 