import * as THREE from 'three';

/**
 * Classe base per le unità nemiche (difese planetarie)
 */
export class Enemy {
    constructor(type, position, targetPlanet) {
        this.type = type; // Es: 'drone', 'turret'
        this.position = position.clone();
        this.targetPlanet = targetPlanet; // Il pianeta che sta difendendo
        this.health = 50; // Salute base
        this.maxHealth = 50;
        this.attackPower = 5; // Danno base
        this.attackRange = 100; // Raggio d'attacco
        this.attackCooldown = 2; // Secondi tra attacchi
        this.lastAttackTime = 0;
        this.mesh = null;
        this.targetPlayer = null; // Riferimento al giocatore quando è nel raggio
        this.isActive = true;

        // Proprietà per il movimento dei droni
        if (this.type === 'drone') {
            this.spawnPoint = position.clone(); // Punto attorno al quale pattugliare
            this.patrolRadius = 15; // Raggio di pattugliamento
            this.patrolTarget = this.getRandomPatrolPoint(); // Prossimo punto da raggiungere
            this.moveSpeed = 5 + Math.random() * 5; // Velocità del drone
            this.hoverAmplitude = 0.5 + Math.random(); // Ampiezza fluttuazione
            this.hoverFrequency = 1 + Math.random(); // Frequenza fluttuazione
            this.hoverTime = Math.random() * Math.PI * 2; // Offset tempo fluttuazione
        }
    }

    /**
     * Crea la mesh per il nemico
     */
    createMesh() {
        let geometry, material;
        if (this.type === 'drone') {
            geometry = new THREE.SphereGeometry(1.5, 16, 16);
            material = new THREE.MeshStandardMaterial({ 
                color: 0xff4444, 
                roughness: 0.4, 
                metalness: 0.6 
            });
        } else if (this.type === 'turret') {
            geometry = new THREE.CylinderGeometry(1, 2, 4, 8);
            material = new THREE.MeshStandardMaterial({ 
                color: 0x888888, 
                roughness: 0.6, 
                metalness: 0.8 
            });
        } else {
            // Default: cubo rosso
            geometry = new THREE.BoxGeometry(2, 2, 2);
            material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.userData.enemyData = this; // Collega l'istanza della classe alla mesh

        return this.mesh;
    }

    /**
     * Aggiorna lo stato e il comportamento del nemico
     * @param {number} deltaTime - Tempo trascorso dall'ultimo frame
     * @param {Player} player - Istanza del giocatore
     */
    update(deltaTime, player) {
        if (!this.isActive || !player || !this.mesh) return null;

        const distanceToPlayer = this.position.distanceTo(player.position);

        // Controlla se il giocatore è nel raggio d'attacco
        if (distanceToPlayer <= this.attackRange) {
            this.targetPlayer = player;
            // Droni: Inseguono brevemente o si fermano per attaccare?
            // Per ora, si fermano e attaccano.
            return this.aimAndAttack(deltaTime); // Ritorna i dati del proiettile se spara
        } else {
            this.targetPlayer = null;
            
            // Movimento droni quando il giocatore è lontano
            if (this.type === 'drone') {
                this.patrol(deltaTime);
            }
        }
        
        return null; // Non spara se non mira al giocatore
    }

    /**
     * Mira al giocatore e attacca se possibile
     * @param {number} deltaTime - Tempo trascorso dall'ultimo frame
     */
    aimAndAttack(deltaTime) {
        if (!this.targetPlayer || !this.mesh) return null;
        
        const currentTime = performance.now() / 1000;
        
        // Mira al giocatore
        this.mesh.lookAt(this.targetPlayer.position);

        // Attacca se il cooldown è terminato
        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.lastAttackTime = currentTime;
            this.fireProjectile();
        }
    }

    /**
     * Genera e lancia un proiettile verso il giocatore
     * @return {Object|null} - Dati del proiettile per main.js o null
     */
    fireProjectile() {
        if (!this.targetPlayer) return null;

        const direction = new THREE.Vector3().subVectors(this.targetPlayer.position, this.position).normalize();
        const origin = this.position.clone().addScaledVector(direction, 2); // Parte leggermente davanti al nemico

        return {
            type: 'enemy_basic',
            direction: direction,
            power: this.attackPower,
            color: 0xffaa00, // Colore proiettile nemico
            origin: origin,
            speed: 40, // Velocità proiettile nemico
            range: this.attackRange * 1.2, // Portata leggermente superiore al raggio d'attacco
            isEnemyProjectile: true // Flag per identificarlo
        };
    }

    /**
     * Il nemico subisce danno
     * @param {number} amount - Quantità di danno
     * @return {boolean} - true se ancora vivo, false se distrutto
     */
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.isActive = false;
            // TODO: Aggiungere effetto distruzione
            console.log(`Nemico (${this.type}) distrutto!`);
            return false; // Distrutto
        }
        return true; // Ancora vivo
    }
    
    /**
     * Rimuove la mesh dalla scena
     * @param {THREE.Scene} scene
     */
    removeFromScene(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh = null; 
        }
    }

    /**
     * Fa pattugliare il drone
     * @param {number} deltaTime
     */
    patrol(deltaTime) {
        // Movimento verso il punto di pattugliamento
        const directionToTarget = new THREE.Vector3().subVectors(this.patrolTarget, this.position);
        const distanceToTarget = directionToTarget.length();
        
        if (distanceToTarget < 1) {
            // Raggiunto il target, scegline uno nuovo
            this.patrolTarget = this.getRandomPatrolPoint();
        } else {
            // Muovi verso il target
            directionToTarget.normalize();
            this.position.addScaledVector(directionToTarget, this.moveSpeed * deltaTime);
        }
        
        // Movimento fluttuante (hovering)
        this.hoverTime += deltaTime * this.hoverFrequency;
        const hoverOffset = Math.sin(this.hoverTime) * this.hoverAmplitude;
        // Applica fluttuazione sull'asse Y locale rispetto alla superficie del pianeta
        const upVector = new THREE.Vector3().subVectors(this.position, this.targetPlanet.position).normalize();
        this.mesh.position.copy(this.position).addScaledVector(upVector, hoverOffset);
        
        // Aggiorna posizione base (senza hover) per il prossimo calcolo
        this.position.copy(this.mesh.position).addScaledVector(upVector, -hoverOffset);
        
        // Orienta il drone nella direzione del movimento
        this.mesh.lookAt(this.patrolTarget);
    }
    
    /**
     * Ottiene un punto casuale all'interno del raggio di pattugliamento attorno allo spawn point
     */
    getRandomPatrolPoint() {
        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 2 * this.patrolRadius,
            (Math.random() - 0.5) * 2 * (this.patrolRadius * 0.5), // Movimento verticale limitato
            (Math.random() - 0.5) * 2 * this.patrolRadius
        );
        return new THREE.Vector3().copy(this.spawnPoint).add(randomOffset);
    }
} 