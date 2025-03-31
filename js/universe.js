import * as THREE from 'three';

/**
 * Classe per la generazione procedurale di pianeti e sistemi stellari
 */
export class UniverseGenerator {
    constructor() {
        this.planets = [];
        this.systems = [];
        this.seed = Math.random() * 10000;
    }
    
    /**
     * Genera un universo proceduralmente
     * @param {number} numSystems - Numero di sistemi stellari da generare
     * @param {number} planetsPerSystem - Numero di pianeti per sistema
     */
    generateUniverse(numSystems = 10, planetsPerSystem = 5) {
        this.systems = [];
        this.planets = [];
        
        for (let i = 0; i < numSystems; i++) {
            const system = this.generateStarSystem(i, planetsPerSystem);
            this.systems.push(system);
            this.planets = this.planets.concat(system.planets);
        }
        
        return {
            systems: this.systems,
            planets: this.planets
        };
    }
    
    /**
     * Genera un sistema stellare con pianeti
     * @param {number} index - Indice del sistema
     * @param {number} numPlanets - Numero di pianeti da generare nel sistema
     */
    generateStarSystem(index, numPlanets) {
        // Posizione del sistema stellare nell'universo (distribuzione sferica)
        const radius = 1000 + (index * 500);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta) * 0.5; // Schiacciato sull'asse y per un universo più a forma di disco
        const z = radius * Math.cos(phi);
        
        // Genera tipo di stella casuale
        const starTypes = ['yellow', 'blue', 'red', 'white', 'orange'];
        const starType = starTypes[Math.floor(Math.random() * starTypes.length)];
        
        // Colore stella in base al tipo
        let starColor;
        switch (starType) {
            case 'yellow': starColor = 0xffdf00; break;
            case 'blue': starColor = 0x0066ff; break;
            case 'red': starColor = 0xff3300; break;
            case 'white': starColor = 0xffffff; break;
            case 'orange': starColor = 0xff8c00; break;
        }
        
        // Genera nome sistema
        const systemName = this.generateName('system');
        
        // Crea oggetto sistema
        const system = {
            id: `system-${index}`,
            name: systemName,
            position: new THREE.Vector3(x, y, z),
            starType: starType,
            starColor: starColor,
            starSize: 1 + Math.random() * 2, // Dimensione stella tra 1 e 3
            planets: []
        };
        
        // Genera pianeti per questo sistema
        for (let i = 0; i < numPlanets; i++) {
            const planet = this.generatePlanet(system, i);
            system.planets.push(planet);
        }
        
        return system;
    }
    
    /**
     * Genera un pianeta all'interno di un sistema stellare
     * @param {Object} system - Il sistema stellare contenitore
     * @param {number} index - Indice del pianeta nel sistema
     */
    generatePlanet(system, index) {
        // Distanza dal centro del sistema (stella)
        const orbitRadius = 20 + (index * 15) + (Math.random() * 10);
        
        // Posizione in orbita
        const orbitAngle = Math.random() * Math.PI * 2;
        const x = Math.cos(orbitAngle) * orbitRadius;
        const z = Math.sin(orbitAngle) * orbitRadius;
        
        // Posizione assoluta nell'universo
        const absPosition = new THREE.Vector3(
            system.position.x + x,
            system.position.y,
            system.position.z + z
        );
        
        // Tipo pianeta - determina l'aspetto e le caratteristiche
        const planetTypes = ['rocky', 'gas', 'desert', 'ice', 'lava', 'ocean', 'forest'];
        const planetType = planetTypes[Math.floor(Math.random() * planetTypes.length)];
        
        // Colore base pianeta in base al tipo
        let planetColor;
        switch (planetType) {
            case 'rocky': planetColor = 0x8B4513; break;
            case 'gas': planetColor = 0xE3F9FD; break; 
            case 'desert': planetColor = 0xD2B48C; break;
            case 'ice': planetColor = 0xE0FFFF; break;
            case 'lava': planetColor = 0xFF4500; break;
            case 'ocean': planetColor = 0x1E90FF; break;
            case 'forest': planetColor = 0x228B22; break;
        }
        
        // Dimensione pianeta
        const planetSize = 1 + Math.random() * 4; // Dimensione tra 1 e 5
        
        // Genera nome pianeta
        const planetName = this.generateName('planet');
        
        // Genera forza difensiva (più alta = più difficile da conquistare)
        const baseDefense = 10 + (index * 5); // I pianeti più lontani sono più difficili
        const defenseVariation = Math.floor(Math.random() * 20) - 10; // +/- 10 punti random
        const defense = Math.max(5, baseDefense + defenseVariation);
        
        // Risorse ottenibili conquistando questo pianeta
        const resources = Math.floor((defense * 1.5) + (Math.random() * 50));
        
        return {
            id: `planet-${system.id}-${index}`,
            name: planetName,
            systemId: system.id,
            systemName: system.name,
            position: absPosition,
            localPosition: new THREE.Vector3(x, 0, z),
            orbitRadius: orbitRadius,
            orbitAngle: orbitAngle,
            orbitSpeed: 0.001 + (Math.random() * 0.002), // Velocità rotazione sull'orbita
            type: planetType,
            color: planetColor,
            size: planetSize,
            defense: defense,
            resources: resources,
            isConquered: false,
            conqueredBy: null
        };
    }
    
    /**
     * Genera un nome casuale per un pianeta o sistema
     * @param {string} type - 'planet' o 'system'
     */
    generateName(type) {
        const prefixes = ['Al', 'Bel', 'Cas', 'Dor', 'El', 'Far', 'Gal', 'Hy', 'Ix', 'Jor', 'Kro', 'Ly', 'Mal', 'Neb', 'Ob', 'Phor', 'Qu', 'Ry', 'Sig', 'Tau', 'Ul', 'Vex', 'War', 'Xer', 'Yil', 'Zet'];
        const suffixes = ['ack', 'bos', 'cor', 'dex', 'eon', 'far', 'gon', 'hara', 'ius', 'jan', 'kos', 'lar', 'mon', 'nor', 'ovis', 'pax', 'qua', 'ron', 'son', 'tor', 'ulon', 'vex', 'wor', 'xus', 'yar', 'zon'];
        
        let name = '';
        
        if (type === 'system') {
            const systemExtras = [' Prime', ' Major', ' Minor', ' Alpha', ' Beta', ' Gamma', ' System', ' Sector', ' Cluster', ''];
            name = prefixes[Math.floor(Math.random() * prefixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)] +
                   systemExtras[Math.floor(Math.random() * systemExtras.length)];
        } else {
            const planetExtras = ['-' + Math.floor(Math.random() * 10), 
                                  '-' + String.fromCharCode(65 + Math.floor(Math.random() * 26)), 
                                  ' Prime', '', ''];
            name = prefixes[Math.floor(Math.random() * prefixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)] +
                   planetExtras[Math.floor(Math.random() * planetExtras.length)];
        }
        
        return name;
    }
    
    /**
     * Aggiorna le posizioni dei pianeti nelle loro orbite
     * @param {number} deltaTime - Tempo trascorso dall'ultimo aggiornamento
     */
    updatePlanetPositions(deltaTime) {
        for (const planet of this.planets) {
            // Aggiorna angolo orbita
            planet.orbitAngle += planet.orbitSpeed * deltaTime;
            
            // Calcola nuove posizioni locali
            planet.localPosition.x = Math.cos(planet.orbitAngle) * planet.orbitRadius;
            planet.localPosition.z = Math.sin(planet.orbitAngle) * planet.orbitRadius;
            
            // Aggiorna posizione assoluta
            const system = this.systems.find(s => s.id === planet.systemId);
            if (system) {
                planet.position.x = system.position.x + planet.localPosition.x;
                planet.position.z = system.position.z + planet.localPosition.z;
            }
        }
    }
    
    /**
     * Trova il pianeta più vicino a una posizione data
     * @param {THREE.Vector3} position - La posizione da controllare
     * @param {number} maxDistance - Distanza massima di ricerca
     */
    findNearestPlanet(position, maxDistance = 20) {
        let nearestPlanet = null;
        let nearestDistance = maxDistance;
        
        for (const planet of this.planets) {
            const distance = position.distanceTo(planet.position);
            if (distance < nearestDistance) {
                nearestPlanet = planet;
                nearestDistance = distance;
            }
        }
        
        return { planet: nearestPlanet, distance: nearestDistance };
    }
    
    /**
     * Trova il sistema più vicino a una posizione data
     * @param {THREE.Vector3} position - La posizione da controllare
     * @param {number} maxDistance - Distanza massima di ricerca
     */
    findNearestSystem(position, maxDistance = 100) {
        let nearestSystem = null;
        let nearestDistance = maxDistance;
        
        for (const system of this.systems) {
            const distance = position.distanceTo(system.position);
            if (distance < nearestDistance) {
                nearestSystem = system;
                nearestDistance = distance;
            }
        }
        
        return { system: nearestSystem, distance: nearestDistance };
    }
    
    /**
     * Conquista un pianeta
     * @param {Object} planet - Il pianeta da conquistare
     * @param {string} playerRace - La razza del giocatore
     * @param {number} playerPower - La potenza del giocatore
     */
    conquerPlanet(planet, playerRace, playerPower) {
        if (planet && !planet.isConquered) {
            // Calcola probabilità di successo basata sulla potenza del giocatore rispetto alle difese del pianeta
            const successChance = (playerPower / planet.defense) * 0.7;
            const roll = Math.random();
            
            if (roll < successChance) {
                planet.isConquered = true;
                planet.conqueredBy = playerRace;
                return {
                    success: true,
                    message: `Hai conquistato ${planet.name}!`,
                    resources: planet.resources
                };
            } else {
                return {
                    success: false,
                    message: `La conquista di ${planet.name} è fallita. Le difese del pianeta sono troppo forti!`,
                    resources: 0
                };
            }
        } else if (planet && planet.isConquered) {
            return {
                success: false,
                message: `${planet.name} è già stato conquistato!`,
                resources: 0
            };
        }
        
        return {
            success: false,
            message: "Nessun pianeta da conquistare.",
            resources: 0
        };
    }
} 