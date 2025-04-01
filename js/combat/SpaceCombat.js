import * as THREE from 'three';

/**
 * Classe che gestisce il combattimento spaziale.
 * Basata sul progetto: https://github.com/Louis-Tarvin/threejs-game
 */
export class SpaceCombat {
    constructor(scene, camera, player) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        
        // Stato del combattimento
        this.enemies = [];
        this.projectiles = [];
        this.explosions = [];
        
        // Modalità di combattimento
        this.mode = 'flight'; // 'flight' o 'weapon'
        
        // Parametri armi
        this.weaponCooldown = 0.5; // Secondi tra un colpo e l'altro
        this.lastShotTime = 0;
        
        // Geometrie e materiali riutilizzabili
        this.setupMaterials();
    }
    
    /**
     * Inizializza il sistema di combattimento
     */
    initialize() {
        // Creazione delle geometrie e materiali
        this.setupMaterials();
    }
    
    /**
     * Prepara i materiali riutilizzabili
     */
    setupMaterials() {
        // Proiettili del giocatore
        this.playerProjectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        this.playerProjectileMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        
        // Proiettili nemici
        this.enemyProjectileGeometry = new THREE.SphereGeometry(0.4, 8, 8);
        this.enemyProjectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        // Effetto esplosione
        this.explosionGeometry = new THREE.SphereGeometry(1, 16, 16);
        this.explosionMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff7700,
            transparent: true, 
            opacity: 1.0 
        });
    }
    
    /**
     * Cambia modalità di combattimento
     */
    toggleMode() {
        this.mode = this.mode === 'flight' ? 'weapon' : 'flight';
        return this.mode;
    }
    
    /**
     * Crea un nemico spaziale nella posizione data
     */
    spawnEnemy(position, type = 'fighter') {
        // Geometria base per il nemico
        let geometry, material;
        let speed, health, attackPower, attackRange;
        
        switch (type) {
            case 'fighter':
                geometry = new THREE.ConeGeometry(1, 3, 8);
                material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                speed = 20;
                health = 20;
                attackPower = 10;
                attackRange = 50;
                break;
            case 'bomber':
                geometry = new THREE.SphereGeometry(2, 16, 16);
                material = new THREE.MeshStandardMaterial({ color: 0xff4400 });
                speed = 10;
                health = 50;
                attackPower = 25;
                attackRange = 70;
                break;
            case 'cruiser':
                geometry = new THREE.BoxGeometry(5, 2, 10);
                material = new THREE.MeshStandardMaterial({ color: 0x770000 });
                speed = 5;
                health = 100;
                attackPower = 15;
                attackRange = 100;
                break;
        }
        
        // Crea la mesh del nemico
        const enemyMesh = new THREE.Mesh(geometry, material);
        enemyMesh.position.copy(position);
        enemyMesh.lookAt(this.player.position);
        
        // Aggiunge metadati
        enemyMesh.userData = {
            type: type,
            health: health,
            maxHealth: health,
            speed: speed,
            attackPower: attackPower,
            attackRange: attackRange,
            lastAttackTime: 0,
            attackCooldown: 2, // Secondi tra attacchi
            isActive: true
        };
        
        this.scene.add(enemyMesh);
        this.enemies.push(enemyMesh);
        
        return enemyMesh;
    }
    
    /**
     * Spara un proiettile dalla posizione del giocatore
     */
    firePlayerProjectile() {
        const currentTime = performance.now() / 1000;
        
        // Controlla cooldown
        if (currentTime - this.lastShotTime < this.weaponCooldown) {
            return;
        }
        
        this.lastShotTime = currentTime;
        
        // Se in modalità volo, spara nella direzione di movimento
        // Se in modalità arma, spara nella direzione della camera
        const direction = new THREE.Vector3();
        
        if (this.mode === 'flight') {
            // Usa la direzione di movimento del giocatore
            direction.set(0, 0, -1).applyQuaternion(this.player.quaternion);
        } else {
            // Usa la direzione della camera
            this.camera.getWorldDirection(direction);
        }
        
        // Crea proiettile
        const projMesh = new THREE.Mesh(
            this.playerProjectileGeometry, 
            this.playerProjectileMaterial
        );
        
        // Posiziona davanti al giocatore
        projMesh.position.copy(this.player.position);
        projMesh.position.add(direction.clone().multiplyScalar(3));
        
        // Aggiungi metadati
        projMesh.userData = {
            isPlayerProjectile: true,
            speed: 60,
            damage: 10,
            direction: direction,
            distance: 0,
            maxDistance: 200
        };
        
        this.scene.add(projMesh);
        this.projectiles.push(projMesh);
        
        // Aggiungi effetto sonoro (placeholder)
        console.log("Laser sound");
        
        return projMesh;
    }
    
    /**
     * Spara un proiettile da un nemico verso il giocatore
     */
    fireEnemyProjectile(enemy) {
        const currentTime = performance.now() / 1000;
        
        // Controlla cooldown
        if (currentTime - enemy.userData.lastAttackTime < enemy.userData.attackCooldown) {
            return;
        }
        
        enemy.userData.lastAttackTime = currentTime;
        
        // Calcola direzione verso il giocatore
        const direction = new THREE.Vector3().subVectors(
            this.player.position, 
            enemy.position
        ).normalize();
        
        // Crea proiettile
        const projMesh = new THREE.Mesh(
            this.enemyProjectileGeometry, 
            this.enemyProjectileMaterial
        );
        
        // Posiziona davanti al nemico
        projMesh.position.copy(enemy.position);
        projMesh.position.add(direction.clone().multiplyScalar(3));
        
        // Aggiungi metadati
        projMesh.userData = {
            isEnemyProjectile: true,
            speed: 40,
            damage: enemy.userData.attackPower,
            direction: direction,
            distance: 0,
            maxDistance: enemy.userData.attackRange * 1.5
        };
        
        this.scene.add(projMesh);
        this.projectiles.push(projMesh);
        
        return projMesh;
    }
    
    /**
     * Crea un'esplosione nella posizione data
     */
    createExplosion(position, size = 1) {
        const explosion = new THREE.Mesh(
            this.explosionGeometry,
            this.explosionMaterial.clone()
        );
        
        explosion.position.copy(position);
        explosion.scale.setScalar(size);
        
        // Aggiungi metadati per l'animazione
        explosion.userData = {
            creationTime: performance.now() / 1000,
            duration: 1.0, // Durata in secondi
            size: size
        };
        
        this.scene.add(explosion);
        this.explosions.push(explosion);
        
        return explosion;
    }
    
    /**
     * Aggiorna lo stato del combattimento
     */
    update(deltaTime) {
        // Aggiorna nemici
        this.updateEnemies(deltaTime);
        
        // Aggiorna proiettili
        this.updateProjectiles(deltaTime);
        
        // Aggiorna esplosioni
        this.updateExplosions(deltaTime);
        
        // Controlla collisioni
        this.checkCollisions();
    }
    
    /**
     * Aggiorna gli nemici
     */
    updateEnemies(deltaTime) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            if (!enemy.userData.isActive) {
                // Rimuovi nemici inattivi
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                continue;
            }
            
            // Calcola distanza dal giocatore
            const distanceToPlayer = enemy.position.distanceTo(this.player.position);
            
            if (distanceToPlayer <= enemy.userData.attackRange) {
                // Il giocatore è a portata di attacco
                this.fireEnemyProjectile(enemy);
                
                // Se è un fighter, insegue il giocatore
                if (enemy.userData.type === 'fighter') {
                    // Movimento verso il giocatore
                    const directionToPlayer = new THREE.Vector3().subVectors(
                        this.player.position, 
                        enemy.position
                    ).normalize();
                    
                    // Velocità di movimento
                    const speed = enemy.userData.speed * deltaTime;
                    
                    // Muovi l'enemy
                    enemy.position.add(directionToPlayer.multiplyScalar(speed));
                    
                    // Ruota verso il giocatore
                    enemy.lookAt(this.player.position);
                }
            } else {
                // Movimento casuale o pattern predefinito (semplificato)
                // Per ora, muoviamo solo in modo basico verso il giocatore
                
                const directionToPlayer = new THREE.Vector3().subVectors(
                    this.player.position, 
                    enemy.position
                ).normalize();
                
                // Velocità di movimento
                const speed = enemy.userData.speed * deltaTime;
                
                // Muovi l'enemy
                enemy.position.add(directionToPlayer.multiplyScalar(speed));
                
                // Ruota verso il giocatore
                enemy.lookAt(this.player.position);
            }
        }
    }
    
    /**
     * Aggiorna i proiettili
     */
    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Muovi il proiettile
            const moveAmount = projectile.userData.speed * deltaTime;
            projectile.position.add(projectile.userData.direction.clone().multiplyScalar(moveAmount));
            
            // Aggiorna distanza percorsa
            projectile.userData.distance += moveAmount;
            
            // Elimina proiettili che superano la distanza massima
            if (projectile.userData.distance > projectile.userData.maxDistance) {
                this.scene.remove(projectile);
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    /**
     * Aggiorna le esplosioni
     */
    updateExplosions(deltaTime) {
        const currentTime = performance.now() / 1000;
        
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            const elapsedTime = currentTime - explosion.userData.creationTime;
            
            if (elapsedTime > explosion.userData.duration) {
                // Rimuovi esplosioni completate
                this.scene.remove(explosion);
                this.explosions.splice(i, 1);
                continue;
            }
            
            // Anima l'esplosione
            const progress = elapsedTime / explosion.userData.duration;
            const scale = explosion.userData.size * (1 + progress * 2);
            explosion.scale.setScalar(scale);
            
            // Fade out
            explosion.material.opacity = 1 - progress;
        }
    }
    
    /**
     * Controlla collisioni tra proiettili e oggetti
     */
    checkCollisions() {
        // Crea box del giocatore
        const playerBox = new THREE.Box3().setFromObject(this.player);
        
        // Controlla ogni proiettile
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            const projectileBox = new THREE.Box3().setFromObject(projectile);
            
            // Proiettili nemici vs giocatore
            if (projectile.userData.isEnemyProjectile) {
                if (projectileBox.intersectsBox(playerBox)) {
                    // Danneggia giocatore
                    this.player.takeDamage(projectile.userData.damage);
                    
                    // Crea piccola esplosione
                    this.createExplosion(projectile.position, 1);
                    
                    // Rimuovi proiettile
                    this.scene.remove(projectile);
                    this.projectiles.splice(i, 1);
                    continue;
                }
            }
            
            // Proiettili giocatore vs nemici
            if (projectile.userData.isPlayerProjectile) {
                let hit = false;
                
                for (let j = 0; j < this.enemies.length; j++) {
                    const enemy = this.enemies[j];
                    const enemyBox = new THREE.Box3().setFromObject(enemy);
                    
                    if (projectileBox.intersectsBox(enemyBox)) {
                        // Danneggia nemico
                        enemy.userData.health -= projectile.userData.damage;
                        
                        if (enemy.userData.health <= 0) {
                            // Nemico distrutto
                            this.createExplosion(enemy.position, 3);
                            enemy.userData.isActive = false;
                        } else {
                            // Piccola esplosione per hit
                            this.createExplosion(projectile.position, 1);
                        }
                        
                        // Rimuovi proiettile
                        hit = true;
                        break;
                    }
                }
                
                if (hit) {
                    this.scene.remove(projectile);
                    this.projectiles.splice(i, 1);
                }
            }
        }
    }
    
    /**
     * Genera ondata di nemici
     */
    spawnEnemyWave(playerPosition, difficulty = 1) {
        const count = 2 + Math.floor(difficulty * 1.5);
        const types = ['fighter', 'bomber', 'cruiser'];
        const radius = 100 + (Math.random() * 50);
        
        for (let i = 0; i < count; i++) {
            // Determina il tipo di nemico (più difficoltà = più nemici avanzati)
            const typeIndex = Math.min(
                Math.floor(Math.random() * 3),
                Math.floor(Math.random() * difficulty)
            );
            const type = types[typeIndex];
            
            // Posizione casuale intorno al giocatore
            const angle = Math.random() * Math.PI * 2;
            const x = playerPosition.x + Math.cos(angle) * radius;
            const y = playerPosition.y + (Math.random() - 0.5) * 20;
            const z = playerPosition.z + Math.sin(angle) * radius;
            
            this.spawnEnemy(new THREE.Vector3(x, y, z), type);
        }
    }
} 