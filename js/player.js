import * as THREE from 'three';

/**
 * Classe per gestire il personaggio del giocatore (Saiyan o Viltrumita)
 */
export class Player {
    constructor(race) {
        this.race = race; // 'saiyan' o 'viltrumite'
        this.health = 100;
        this.maxHealth = 100;
        this.energy = 100;
        this.maxEnergy = 100;
        this.currency = 0;
        this.position = new THREE.Vector3(0, 10, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3();
        this.isFlying = false;
        this.speed = 50; // Velocità base
        this.flightSpeedMultiplier = 5; // Moltiplicatore velocità in volo (x5)
        this.mesh = null;
        this.attackPower = 10;
        
        // Proprietà specifiche per razza
        if (race === 'saiyan') {
            this.attackType = 'energy'; // I Saiyan sono più forti con attacchi energetici
            this.attackColor = 0x3e78ff;
            this.specialAttackType = 'energyWave';
            this.specialAttackColor = 0x3e78ff;
            this.energyRegenRate = 0.2; // Rigenerazione energia più veloce
            this.healthRegenRate = 0.05;
        } else if (race === 'viltrumite') {
            this.attackType = 'physical'; // I Viltrumiti sono più forti fisicamente
            this.attackColor = 0xff3e3e;
            this.specialAttackType = 'laserEyes';
            this.specialAttackColor = 0xff3e3e;
            this.energyRegenRate = 0.1;
            this.healthRegenRate = 0.1; // Rigenerazione salute più veloce
        }
        
        // Progressione e livelli
        this.level = 1;
        this.expPoints = 0;
        this.nextLevelExp = 100;
        
        // Potenziamenti sbloccabili
        this.upgrades = {
            attackPower: 0,    // 0-10 livelli
            defense: 0,        // 0-10 livelli
            speed: 0,          // 0-10 livelli
            energyCapacity: 0, // 0-10 livelli
            healthCapacity: 0  // 0-10 livelli
        };
        
        // Inventario
        this.inventory = [];
        
        // Pianeti conquistati
        this.conqueredPlanets = [];
    }
    
    /**
     * Crea la mesh del personaggio
     */
    createMesh() {
        // Per ora, usiamo una semplice capsula per il corpo
        const geometry = new THREE.CapsuleGeometry(1, 3, 4, 8);
        const material = new THREE.MeshPhongMaterial({
            color: this.race === 'saiyan' ? 0x3e78ff : 0xff3e3e,
            emissive: this.race === 'saiyan' ? 0x1a1a5a : 0x5a1a1a,
            shininess: 30
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.position);
        
        return this.mesh;
    }
    
    /**
     * Aggiorna la posizione e lo stato del giocatore
     * @param {number} deltaTime - Tempo trascorso dall'ultimo frame
     * @param {boolean} moveForward - Se il giocatore sta andando avanti
     * @param {boolean} moveBackward - Se il giocatore sta andando indietro
     * @param {boolean} moveLeft - Se il giocatore sta andando a sinistra
     * @param {boolean} moveRight - Se il giocatore sta andando a destra
     * @param {boolean} moveUp - Se il giocatore sta andando su
     * @param {boolean} moveDown - Se il giocatore sta andando giù
     * @param {THREE.Vector3} cameraDirection - Direzione della camera
     */
    update(deltaTime, moveForward, moveBackward, moveLeft, moveRight, moveUp, moveDown, cameraDirection) {
        // Aggiorna energia e salute
        this.regenerate(deltaTime);
        
        // Calcola velocità in base alla direzione della camera
        const actualSpeed = this.getSpeed() * deltaTime;
        
        // Resetta velocità
        this.velocity.set(0, 0, 0);
        
        // Ottieni la direzione attuale dalla telecamera (questa cambia con il movimento del mouse)
        const forward = cameraDirection.clone().normalize();
        
        if (this.isFlying) {
            // In modalità volo, usa la direzione completa della camera (inclusa componente Y)
            // Applica movimento in base agli input nella direzione della telecamera
            if (moveForward) {
                this.velocity.add(forward.clone().multiplyScalar(actualSpeed));
            }
            if (moveBackward) {
                this.velocity.add(forward.clone().multiplyScalar(-actualSpeed));
            }
            
            // Calcola il vettore destro perpendicolare alla direzione forward
            const right = new THREE.Vector3();
            right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
            
            if (moveLeft) {
                this.velocity.add(right.clone().multiplyScalar(actualSpeed));
            }
            if (moveRight) {
                this.velocity.add(right.clone().multiplyScalar(-actualSpeed));
            }
            
            // Calcola il vettore up in base alla direzione della camera
            const up = new THREE.Vector3(0, 1, 0);
            
            // Movimento verticale (volo)
            if (moveUp) {
                this.velocity.add(up.clone().multiplyScalar(actualSpeed));
            } else if (moveDown) {
                this.velocity.add(up.clone().multiplyScalar(-actualSpeed));
            }
        } else {
            // In modalità non-volo, forziamo il movimento orizzontale
            forward.y = 0;
            forward.normalize();
            
            // Calcola il vettore destro perpendicolare alla direzione forward
            const right = new THREE.Vector3();
            right.crossVectors(new THREE.Vector3(0, 1, 0), forward);
            
            // Applica movimento in base agli input
            if (moveForward) {
                this.velocity.add(forward.clone().multiplyScalar(actualSpeed));
            }
            if (moveBackward) {
                this.velocity.add(forward.clone().multiplyScalar(-actualSpeed));
            }
            if (moveLeft) {
                this.velocity.add(right.clone().multiplyScalar(actualSpeed));
            }
            if (moveRight) {
                this.velocity.add(right.clone().multiplyScalar(-actualSpeed));
            }
            
            // A terra, non c'è movimento verticale
            this.velocity.y = 0;
        }
        
        // Applica effettivamente il movimento
        this.position.add(this.velocity);
        
        // Aggiorna mesh se esiste
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }
    }
    
    /**
     * Attiva/disattiva la modalità volo
     */
    toggleFlight() {
        this.isFlying = !this.isFlying;
        return this.isFlying;
    }
    
    /**
     * Rigenera energia e salute del giocatore
     * @param {number} deltaTime - Tempo trascorso dall'ultimo frame
     */
    regenerate(deltaTime) {
        // Rigenera energia
        if (this.energy < this.maxEnergy) {
            this.energy = Math.min(this.maxEnergy, this.energy + (this.energyRegenRate * deltaTime * 10));
        }
        
        // Rigenera salute (più lentamente)
        if (this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + (this.healthRegenRate * deltaTime * 10));
        }
    }
    
    /**
     * Effettua un attacco energetico
     * @param {THREE.Vector3} direction - Direzione dell'attacco
     * @param {number} energyCost - Costo in energia
     * @return {Object|null} - Dati dell'attacco o null se energia insufficiente
     */
    attackEnergy(direction, energyCost = 10) {
        if (this.energy >= energyCost) {
            this.energy -= energyCost;
            
            return {
                type: this.attackType,
                direction: direction.clone().normalize(),
                power: this.attackPower * (1 + this.upgrades.attackPower * 0.2),
                color: this.attackColor,
                origin: this.position.clone(),
                speed: 60, // Velocità del proiettile
                range: 100
            };
        }
        
        return null;
    }
    
    /**
     * Effettua un attacco speciale
     * @param {THREE.Vector3} direction - Direzione dell'attacco
     * @param {number} energyCost - Costo in energia
     * @return {Object|null} - Dati dell'attacco o null se energia insufficiente
     */
    attackSpecial(direction, energyCost = 25) {
        if (this.energy >= energyCost) {
            this.energy -= energyCost;
            
            // Tipo di attacco speciale in base alla razza
            if (this.race === 'saiyan') {
                // Energy Wave - più potente ma più lento
                return {
                    type: this.specialAttackType,
                    direction: direction.clone().normalize(),
                    power: this.attackPower * 2 * (1 + this.upgrades.attackPower * 0.2),
                    color: this.specialAttackColor,
                    origin: this.position.clone(),
                    speed: 40,
                    range: 150,
                    width: 3
                };
            } else {
                // Laser Eyes - più veloce ma meno potente
                return {
                    type: this.specialAttackType,
                    direction: direction.clone().normalize(),
                    power: this.attackPower * 1.5 * (1 + this.upgrades.attackPower * 0.2),
                    color: this.specialAttackColor,
                    origin: this.position.clone(),
                    speed: 120,
                    range: 200,
                    width: 1
                };
            }
        }
        
        return null;
    }
    
    /**
     * Subisce danno
     * @param {number} amount - Quantità di danno
     * @return {boolean} - true se ancora vivo, false se morto
     */
    takeDamage(amount) {
        // Riduzione danno in base alla difesa
        const actualDamage = amount * (1 - (this.upgrades.defense * 0.05));
        this.health -= actualDamage;
        
        if (this.health <= 0) {
            this.health = 0;
            return false; // Morto
        }
        
        return true; // Ancora vivo
    }
    
    /**
     * Guadagna punti esperienza e controlla level-up
     * @param {number} exp - Punti esperienza da aggiungere
     * @return {boolean} - true se è avvenuto un level-up
     */
    gainExperience(exp) {
        this.expPoints += exp;
        
        if (this.expPoints >= this.nextLevelExp) {
            this.levelUp();
            return true;
        }
        
        return false;
    }
    
    /**
     * Aumenta di livello il giocatore
     */
    levelUp() {
        this.level++;
        this.expPoints -= this.nextLevelExp;
        this.nextLevelExp = Math.floor(this.nextLevelExp * 1.5);
        
        // Incrementa le statistiche di base
        this.maxHealth += 10;
        this.health = this.maxHealth;
        this.maxEnergy += 10;
        this.energy = this.maxEnergy;
        this.attackPower += 5;
        
        return {
            level: this.level,
            maxHealth: this.maxHealth,
            maxEnergy: this.maxEnergy,
            attackPower: this.attackPower
        };
    }
    
    /**
     * Potenzia una statistica specifica
     * @param {string} stat - Statistica da potenziare
     * @param {number} cost - Costo in valuta
     * @return {Object} - Risultato dell'operazione
     */
    upgrade(stat, cost) {
        // Verifica disponibilità valuta
        if (this.currency < cost) {
            return { success: false, message: "Valuta insufficiente per questo potenziamento" };
        }
        
        // Applica il potenziamento
        this.currency -= cost;
        this.upgrades[stat]++;
        
        // Variabili temporanee per evitare dichiarazioni nei case
        let prevMaxHealth, prevMaxEnergy;
        
        // Aggiorna le statistiche in base al potenziamento
        switch(stat) {
            case 'attackPower':
                this.attackPower += 5;
                break;
            case 'healthCapacity':
                prevMaxHealth = this.maxHealth;
                this.maxHealth = 100 + (this.upgrades.healthCapacity * 20);
                this.health += (this.maxHealth - prevMaxHealth);
                break;
            case 'energyCapacity':
                prevMaxEnergy = this.maxEnergy;
                this.maxEnergy = 100 + (this.upgrades.energyCapacity * 20);
                this.energy += (this.maxEnergy - prevMaxEnergy);
                break;
            case 'speed':
                // La velocità è calcolata dinamicamente nel metodo getSpeed()
                break;
            case 'defense':
                // La difesa è utilizzata nel metodo takeDamage()
                break;
        }
        
        return { 
            success: true, 
            message: `Hai potenziato ${stat} al livello ${this.upgrades[stat]}`,
            newLevel: this.upgrades[stat]
        };
    }
    
    /**
     * Calcola la velocità attuale del giocatore
     * @return {number} Velocità effettiva
     */
    getSpeed() {
        let currentSpeed = this.speed * (1 + this.upgrades.speed * 0.15); // Applica potenziamento velocità
        if (this.isFlying) {
            currentSpeed *= this.flightSpeedMultiplier;
        }
        return currentSpeed;
    }
    
    /**
     * Aggiunge un pianeta all'elenco dei pianeti conquistati
     * @param {Object} planet - Il pianeta conquistato
     */
    addConqueredPlanet(planet) {
        if (!this.conqueredPlanets.some(p => p.id === planet.id)) {
            this.conqueredPlanets.push({
                id: planet.id,
                name: planet.name,
                systemName: planet.systemName,
                resources: planet.resources,
                conqueredAt: new Date().toISOString()
            });
        }
    }
    
    /**
     * Ottieni i dati del giocatore per condividerli con altri giochi
     */
    getPortalData() {
        return {
            username: `${this.race}_conqueror_${this.level}`,
            race: this.race,
            level: this.level,
            color: this.race === 'saiyan' ? 'blue' : 'red',
            speed: this.getSpeed() / 10, // Convertito in una scala più adatta per il portale
            planets_conquered: this.conqueredPlanets.length
        };
    }

    useAbility(abilityName) {
        if (this.abilityCooldowns[abilityName] > 0) return false;
        
        // Consumo energia per abilità
        if (this.energy < this.abilities[abilityName].energyCost) return false;
        this.energy -= this.abilities[abilityName].energyCost;
        
        // Imposta il cooldown
        this.abilityCooldowns[abilityName] = this.abilities[abilityName].cooldown;
        
        // Esegui l'abilità usando un approccio con object literals invece di switch
        const abilityHandlers = {
            teleport: () => {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                const teleportDist = 10 * this.stats.teleportRange;
                
                // Teleport in avanti
                this.position.addScaledVector(forward, teleportDist);
                this.createTeleportEffect(this.position);
                return true;
            },
            
            energyBlast: () => {
                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                
                // Crea un proiettile energetico
                const projectileData = {
                    type: 'energy_blast',
                    origin: this.position.clone().addScaledVector(direction, 2),
                    direction: direction,
                    speed: 100,
                    range: 100,
                    power: 25 * this.stats.attackPower,
                    color: 0x00ffff,
                    isPlayerProjectile: true
                };
                
                // Ritorna i dati del proiettile per main.js
                this.lastProjectile = projectileData;
                
                return true;
            }
            // Altre abilità possono essere aggiunte qui
        };
        
        // Esegui l'handler dell'abilità se esiste
        if (abilityHandlers[abilityName]) {
            return abilityHandlers[abilityName]();
        }
        
        return false;
    }

    /**
     * Imposta le proprietà specifiche della razza
     * @param {string} race - La razza del personaggio ('saiyan' o 'viltrumite')
     */
    setRace(race) {
        this.race = race;
        
        if (race === 'saiyan') {
            this.attackType = 'energy';
            this.attackColor = 0x3e78ff;
            this.specialAttackType = 'energyWave';
            this.specialAttackColor = 0x3e78ff;
            this.energyRegenRate = 0.2;
            this.healthRegenRate = 0.05;
            
            // Aggiorna il materiale della mesh se esiste
            if (this.mesh) {
                this.mesh.material.color.setHex(0x3e78ff);
                this.mesh.material.emissive.setHex(0x1a1a5a);
            }
        } else if (race === 'viltrumite') {
            this.attackType = 'physical';
            this.attackColor = 0xff3e3e;
            this.specialAttackType = 'laserEyes';
            this.specialAttackColor = 0xff3e3e;
            this.energyRegenRate = 0.1;
            this.healthRegenRate = 0.1;
            
            // Aggiorna il materiale della mesh se esiste
            if (this.mesh) {
                this.mesh.material.color.setHex(0xff3e3e);
                this.mesh.material.emissive.setHex(0x5a1a1a);
            }
        }
    }

    /**
     * Riporta il personaggio allo stato iniziale
     */
    reset() {
        this.health = this.maxHealth;
        this.energy = this.maxEnergy;
        this.position.set(0, 10, 0);
        this.rotation.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.isFlying = false;
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.rotation.copy(this.rotation);
        }
    }

    /**
     * Usa un oggetto dall'inventario
     * @param {string} itemId - ID dell'oggetto da usare
     * @returns {boolean} - True se l'oggetto è stato usato con successo
     */
    useItem(itemId) {
        const itemIndex = this.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;
        
        const item = this.inventory[itemIndex];
        
        // Applica gli effetti dell'oggetto
        switch(item.type) {
            case 'healthPotion':
                this.health = Math.min(this.maxHealth, this.health + item.value);
                break;
            case 'energyPotion':
                this.energy = Math.min(this.maxEnergy, this.energy + item.value);
                break;
            case 'powerBoost':
                this.attackPower *= item.multiplier;
                setTimeout(() => {
                    this.attackPower /= item.multiplier;
                }, item.duration);
                break;
            default:
                return false;
        }
        
        // Rimuovi l'oggetto dall'inventario se è consumabile
        if (item.consumable) {
            this.inventory.splice(itemIndex, 1);
        }
        
        return true;
    }

    /**
     * Equipaggia un oggetto
     * @param {string} itemId - ID dell'oggetto da equipaggiare
     * @returns {boolean} - True se l'oggetto è stato equipaggiato con successo
     */
    equipItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || !item.equippable) return false;
        
        // Rimuovi l'oggetto precedentemente equipaggiato dello stesso tipo
        const currentEquipped = this.inventory.find(i => 
            i.equipped && i.slot === item.slot
        );
        if (currentEquipped) {
            currentEquipped.equipped = false;
        }
        
        // Equipaggia il nuovo oggetto
        item.equipped = true;
        
        // Applica i bonus dell'oggetto
        if (item.stats) {
            Object.entries(item.stats).forEach(([stat, value]) => {
                switch(stat) {
                    case 'attackPower':
                        this.attackPower += value;
                        break;
                    case 'defense':
                        this.maxHealth += value;
                        break;
                    case 'speed':
                        this.speed += value;
                        break;
                }
            });
        }
        
        return true;
    }
} 