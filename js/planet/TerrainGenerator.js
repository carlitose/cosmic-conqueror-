import * as THREE from 'three';

/**
 * Classe per la generazione procedurale di terreni.
 * Basata sul progetto: https://github.com/obecerra3/OpenWorldJS
 */
export class TerrainGenerator {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Dimensioni e parametri del terreno
        this.chunkSize = 100;
        this.heightScale = 20;
        this.resolution = 128;
        this.smoothness = 0.5;
        
        // Contenitore per i chunk del terreno
        this.terrainChunks = [];
        
        // Posizione attuale del centro del terreno
        this.centerX = 0;
        this.centerZ = 0;
        
        // Parametri per la simulazione di diversi tipi di pianeti
        this.planetType = 'earth'; // earth, desert, ice, lava, ocean, forest
    }
    
    /**
     * Inizializza il sistema di terreni
     */
    initialize() {
        // Creazione dello shader per la generazione del terreno
        this.initTerrainShader();
        
        // Generazione del terreno iniziale
        this.generateInitialTerrain();
        
        // Aggiunta delle texture al terreno
        this.setupTerrainTextures();
    }
    
    /**
     * Inizializza lo shader per la generazione del terreno
     */
    initTerrainShader() {
        // Placeholder per ora, qui implementeremo il vero GPGPU shader
        // Per generare il terreno quando avremo preparato i file shader
        console.log('Terrain shader initialized');
    }
    
    /**
     * Genera il terreno iniziale intorno alla posizione corrente
     */
    generateInitialTerrain() {
        // Creazione di 9 chunk iniziali (3x3) intorno al centro
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.createTerrainChunk(
                    this.centerX + x * this.chunkSize,
                    this.centerZ + z * this.chunkSize
                );
            }
        }
    }
    
    /**
     * Crea un singolo chunk di terreno
     */
    createTerrainChunk(x, z) {
        // Geometria base per il chunk
        const geometry = new THREE.PlaneGeometry(
            this.chunkSize,
            this.chunkSize,
            this.resolution - 1,
            this.resolution - 1
        );
        
        // Ruotiamo per orientare il piano sul piano XZ
        geometry.rotateX(-Math.PI / 2);
        
        // Posizione base del chunk
        geometry.translate(x, 0, z);
        
        // Generiamo le altezze per questo chunk
        this.generateHeightmap(geometry, x, z);
        
        // Calcoliamo le normali per un buon lighting
        geometry.computeVertexNormals();
        
        // Per ora usiamo un materiale semplice
        const material = new THREE.MeshStandardMaterial({
            color: this.getPlanetBaseColor(),
            roughness: 0.8,
            metalness: 0.2
        });
        
        // Creiamo la mesh e la aggiungiamo alla scena
        const terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        
        // Aggiungiamo metadati utili
        terrainMesh.userData = {
            chunkX: x,
            chunkZ: z
        };
        
        this.scene.add(terrainMesh);
        this.terrainChunks.push(terrainMesh);
        
        return terrainMesh;
    }
    
    /**
     * Genera una heightmap per un chunk di terreno
     */
    generateHeightmap(geometry, chunkX, chunkZ) {
        const positions = geometry.attributes.position.array;
        
        // Implementazione semplificata, senza GPGPU per ora
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            
            // Calcolo semplice di altezza con Simplex Noise
            // Sostituiremo con vero noise più avanti
            const height = this.calculateHeight(x, z);
            
            // Aggiorna la coordinata Y con l'altezza
            positions[i + 1] = height;
        }
        
        geometry.attributes.position.needsUpdate = true;
    }
    
    /**
     * Calcola l'altezza del terreno in base alle coordinate x, z
     */
    calculateHeight(x, z) {
        // Implementazione semplificata, senza noise vero
        // Formula base: sin(x) * cos(z) + sin(x*0.1) * sin(z*0.1) * 5
        const height = 
            Math.sin(x * 0.05) * Math.cos(z * 0.05) * this.heightScale * 0.5 +
            Math.sin(x * 0.01) * Math.sin(z * 0.01) * this.heightScale +
            (Math.random() * 0.5 - 0.25) * this.heightScale * 0.1;
            
        return height * this.getHeightMultiplierForPlanetType();
    }
    
    /**
     * Configura le texture del terreno in base al tipo di pianeta
     */
    setupTerrainTextures() {
        // Placeholder, qui implementeremo texture più complesse in futuro
        this.terrainChunks.forEach(chunk => {
            const material = chunk.material;
            material.color.set(this.getPlanetBaseColor());
        });
    }
    
    /**
     * Restituisce il colore base in base al tipo di pianeta
     */
    getPlanetBaseColor() {
        switch (this.planetType) {
            case 'desert':
                return 0xd2b48c; // Tan / sabbia
            case 'ice':
                return 0xe0ffff; // Azzurro chiaro
            case 'lava':
                return 0xff4500; // Rosso-arancio
            case 'ocean':
                return 0x1e90ff; // Blu medio
            case 'forest':
                return 0x228b22; // Verde foresta
            case 'earth':
            default:
                return 0x8B4513; // Marrone / terra
        }
    }
    
    /**
     * Restituisce un moltiplicatore di altezza in base al tipo di pianeta
     */
    getHeightMultiplierForPlanetType() {
        switch (this.planetType) {
            case 'desert':
                return 0.7; // Dune basse
            case 'ice':
                return 0.5; // Superficie relativamente piatta
            case 'lava':
                return 1.5; // Superficie irregolare con vulcani
            case 'ocean':
                return 0.3; // Principalmente acqua con poche isole
            case 'forest':
                return 1.0; // Colline e valli normali
            case 'earth':
            default:
                return 1.0; // Terreno standard con colline e valli
        }
    }
    
    /**
     * Aggiorna il terreno in base alla posizione del giocatore
     */
    update(playerPosition) {
        // Calcola in quale chunk si trova il giocatore
        const chunkX = Math.floor(playerPosition.x / this.chunkSize) * this.chunkSize;
        const chunkZ = Math.floor(playerPosition.z / this.chunkSize) * this.chunkSize;
        
        // Se la posizione centrale è cambiata significativamente
        if (Math.abs(chunkX - this.centerX) > this.chunkSize / 2 || 
            Math.abs(chunkZ - this.centerZ) > this.chunkSize / 2) {
            
            // Aggiorna la posizione centrale
            this.centerX = chunkX;
            this.centerZ = chunkZ;
            
            // Rimuovi i chunk distanti e aggiungi nuovi chunk
            this.updateTerrainChunks();
        }
    }
    
    /**
     * Aggiorna i chunk di terreno, rimuovendo quelli distanti e aggiungendone di nuovi
     */
    updateTerrainChunks() {
        // Rimuovi i chunk troppo distanti
        for (let i = this.terrainChunks.length - 1; i >= 0; i--) {
            const chunk = this.terrainChunks[i];
            const dx = Math.abs(chunk.userData.chunkX - this.centerX);
            const dz = Math.abs(chunk.userData.chunkZ - this.centerZ);
            
            if (dx > this.chunkSize * 1.5 || dz > this.chunkSize * 1.5) {
                this.scene.remove(chunk);
                this.terrainChunks.splice(i, 1);
            }
        }
        
        // Aggiungi nuovi chunk se necessario
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                const chunkX = this.centerX + x * this.chunkSize;
                const chunkZ = this.centerZ + z * this.chunkSize;
                
                // Controlla se il chunk esiste già
                let chunkExists = false;
                for (const chunk of this.terrainChunks) {
                    if (chunk.userData.chunkX === chunkX && chunk.userData.chunkZ === chunkZ) {
                        chunkExists = true;
                        break;
                    }
                }
                
                // Se non esiste, crealo
                if (!chunkExists) {
                    this.createTerrainChunk(chunkX, chunkZ);
                }
            }
        }
    }
    
    /**
     * Cambia il tipo di pianeta e aggiorna il terreno
     */
    setPlanetType(type) {
        if (['earth', 'desert', 'ice', 'lava', 'ocean', 'forest'].includes(type)) {
            this.planetType = type;
            
            // Rigenera tutti i chunk con il nuovo tipo di pianeta
            this.regenerateAllChunks();
        }
    }
    
    /**
     * Rigenera tutti i chunk di terreno
     */
    regenerateAllChunks() {
        // Salva le posizioni dei chunk esistenti
        const chunkPositions = this.terrainChunks.map(chunk => ({
            x: chunk.userData.chunkX,
            z: chunk.userData.chunkZ
        }));
        
        // Rimuovi tutti i chunk
        while (this.terrainChunks.length > 0) {
            const chunk = this.terrainChunks.pop();
            this.scene.remove(chunk);
        }
        
        // Ricrea tutti i chunk nelle stesse posizioni
        chunkPositions.forEach(pos => {
            this.createTerrainChunk(pos.x, pos.z);
        });
        
        // Aggiorna l'aspetto
        this.setupTerrainTextures();
    }
    
    /**
     * Trova l'altezza del terreno ad una data posizione x, z
     */
    getHeightAt(x, z) {
        // Trova il chunk che contiene questa posizione
        for (const chunk of this.terrainChunks) {
            const chunkX = chunk.userData.chunkX;
            const chunkZ = chunk.userData.chunkZ;
            
            // Se la posizione è in questo chunk
            if (x >= chunkX - this.chunkSize/2 && x < chunkX + this.chunkSize/2 &&
                z >= chunkZ - this.chunkSize/2 && z < chunkZ + this.chunkSize/2) {
                
                // In un'implementazione reale, dovremmo interpolare l'altezza
                // dalle altezze dei vertici più vicini. Per ora, usiamo una stima.
                return this.calculateHeight(x, z);
            }
        }
        
        // Se non troviamo un chunk a questa posizione, restituiamo un'altezza base
        return 0;
    }
} 