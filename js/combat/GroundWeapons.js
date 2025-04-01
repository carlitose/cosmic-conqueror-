import * as THREE from 'three';

/**
 * Class to manage ground combat weapons
 */
class GroundWeapons {
    /**
     * Create a weapons manager
     * @param {THREE.Scene} scene - The scene to add weapons to
     * @param {THREE.Camera} camera - The player camera for weapon positioning
     */
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Weapon definitions
        this.weaponTypes = {
            pistol: {
                name: 'Pistol',
                damage: 15,
                fireRate: 0.5, // Seconds between shots
                reloadTime: 1.2,
                ammoCapacity: 12,
                range: 50,
                model: null,
                sound: 'pistol_fire',
                projectileSpeed: 100,
                automatic: false
            },
            rifle: {
                name: 'Assault Rifle',
                damage: 25,
                fireRate: 0.1,
                reloadTime: 2.0,
                ammoCapacity: 30,
                range: 100,
                model: null,
                sound: 'rifle_fire',
                projectileSpeed: 150,
                automatic: true
            },
            shotgun: {
                name: 'Shotgun',
                damage: 8,  // Per pellet
                pellets: 8,
                spread: 0.1,
                fireRate: 0.8,
                reloadTime: 2.5,
                ammoCapacity: 8,
                range: 30,
                model: null,
                sound: 'shotgun_fire',
                projectileSpeed: 80,
                automatic: false
            },
            rocketLauncher: {
                name: 'Rocket Launcher',
                damage: 100,
                explosionRadius: 5,
                fireRate: 1.5,
                reloadTime: 3.0,
                ammoCapacity: 4,
                range: 150,
                model: null,
                sound: 'rocket_fire',
                projectileSpeed: 40,
                automatic: false
            }
        };
        
        // Current weapon state
        this.currentWeapon = null;
        this.weaponMesh = null;
        this.ammo = {};
        this.isReloading = false;
        this.lastFireTime = 0;
    }
    
    /**
     * Initialize weapons system
     */
    initialize() {
        this.setupWeaponModels();
        this.setupProjectileMaterials();
        
        // Initialize ammo
        Object.keys(this.weaponTypes).forEach(weapon => {
            this.ammo[weapon] = this.weaponTypes[weapon].ammoCapacity;
        });
    }
    
    /**
     * Set up weapon models
     */
    setupWeaponModels() {
        // Pistol model
        const pistolGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.5);
        const pistolMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.weaponTypes.pistol.model = new THREE.Mesh(pistolGeometry, pistolMaterial);
        
        // Rifle model
        const rifleGeometry = new THREE.BoxGeometry(0.2, 0.15, 1.0);
        const rifleMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        this.weaponTypes.rifle.model = new THREE.Mesh(rifleGeometry, rifleMaterial);
        
        // Shotgun model
        const shotgunGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.8);
        const shotgunMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        this.weaponTypes.shotgun.model = new THREE.Mesh(shotgunGeometry, shotgunMaterial);
        
        // Rocket launcher model
        const launcherGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
        const launcherMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
        this.weaponTypes.rocketLauncher.model = new THREE.Mesh(launcherGeometry, launcherMaterial);
        
        // Rotate to correct orientation
        launcherGeometry.rotateZ(Math.PI / 2);
    }
    
    /**
     * Set up projectile materials
     */
    setupProjectileMaterials() {
        // Bullet material
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
        this.bulletGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        
        // Rocket material
        this.rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xFF4500 });
        this.rocketGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    }
    
    /**
     * Equip a specific weapon
     * @param {string} weaponType - The type of weapon to equip
     */
    equipWeapon(weaponType) {
        if (!this.weaponTypes[weaponType]) {
            console.error(`Weapon type ${weaponType} not found`);
            return;
        }
        
        // Remove current weapon if any
        if (this.weaponMesh) {
            this.camera.remove(this.weaponMesh);
        }
        
        this.currentWeapon = weaponType;
        const weaponConfig = this.weaponTypes[weaponType];
        
        // Clone the weapon model
        this.weaponMesh = weaponConfig.model.clone();
        
        // Position weapon in front of camera
        this.weaponMesh.position.set(0.3, -0.2, -0.5);
        this.camera.add(this.weaponMesh);
    }
    
    /**
     * Fire the current weapon
     * @param {THREE.Vector3} position - Starting position for projectile
     * @param {THREE.Vector3} direction - Direction to fire
     * @returns {Object|null} Projectile data or null if cannot fire
     */
    fire(position, direction) {
        const now = performance.now() / 1000;
        const weaponConfig = this.weaponTypes[this.currentWeapon];
        
        // Check if can fire
        if (this.isReloading) return null;
        if (now - this.lastFireTime < weaponConfig.fireRate) return null;
        if (this.ammo[this.currentWeapon] <= 0) {
            this.reload();
            return null;
        }
        
        // Update state
        this.lastFireTime = now;
        this.ammo[this.currentWeapon]--;
        
        // Create projectile data
        if (this.currentWeapon === 'shotgun') {
            return this.fireShotgun(position, direction);
        } else if (this.currentWeapon === 'rocketLauncher') {
            return this.fireRocket(position, direction);
        } else {
            return this.fireBullet(position, direction);
        }
    }
    
    /**
     * Fire a normal bullet
     * @param {THREE.Vector3} position - Start position
     * @param {THREE.Vector3} direction - Direction
     * @returns {Object} Projectile data
     */
    fireBullet(position, direction) {
        const weaponConfig = this.weaponTypes[this.currentWeapon];
        
        return {
            type: 'bullet',
            weapon: this.currentWeapon,
            position: position.clone(),
            direction: direction.clone(),
            speed: weaponConfig.projectileSpeed,
            damage: weaponConfig.damage,
            range: weaponConfig.range,
            lifetime: 0
        };
    }
    
    /**
     * Fire multiple pellets (shotgun)
     * @param {THREE.Vector3} position - Start position
     * @param {THREE.Vector3} direction - Base direction
     * @returns {Array} Array of projectile data
     */
    fireShotgun(position, direction) {
        const weaponConfig = this.weaponTypes.shotgun;
        const pellets = [];
        
        for (let i = 0; i < weaponConfig.pellets; i++) {
            // Add random spread
            const spread = weaponConfig.spread;
            const spreadVector = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            );
            
            const pelletDirection = direction.clone().add(spreadVector).normalize();
            
            pellets.push({
                type: 'pellet',
                weapon: 'shotgun',
                position: position.clone(),
                direction: pelletDirection,
                speed: weaponConfig.projectileSpeed,
                damage: weaponConfig.damage,
                range: weaponConfig.range,
                lifetime: 0
            });
        }
        
        return pellets;
    }
    
    /**
     * Fire a rocket
     * @param {THREE.Vector3} position - Start position
     * @param {THREE.Vector3} direction - Direction
     * @returns {Object} Projectile data
     */
    fireRocket(position, direction) {
        const weaponConfig = this.weaponTypes.rocketLauncher;
        
        return {
            type: 'rocket',
            weapon: 'rocketLauncher',
            position: position.clone(),
            direction: direction.clone(),
            speed: weaponConfig.projectileSpeed,
            damage: weaponConfig.damage,
            explosionRadius: weaponConfig.explosionRadius,
            range: weaponConfig.range,
            lifetime: 0
        };
    }
    
    /**
     * Reload the current weapon
     */
    reload() {
        if (this.isReloading) return;
        
        this.isReloading = true;
        const weaponConfig = this.weaponTypes[this.currentWeapon];
        
        // After reload time, restore ammo
        setTimeout(() => {
            this.ammo[this.currentWeapon] = weaponConfig.ammoCapacity;
            this.isReloading = false;
        }, weaponConfig.reloadTime * 1000);
    }
    
    /**
     * Update weapon state
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Weapon sway/bob effect can be implemented here
    }
}

export { GroundWeapons }; 