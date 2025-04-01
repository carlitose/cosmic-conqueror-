import * as THREE from 'three';

/**
 * World Manager
 * Gestisce la creazione e l'aggiornamento del mondo di gioco
 */
export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.planetMeshes = [];
        this.starMeshes = [];
        this.activeEnemies = [];
        
        // Riferimenti LOD
        this.planetLODGeometries = {
            high: new THREE.SphereGeometry(1, 64, 64),
            medium: new THREE.SphereGeometry(1, 32, 32),
            low: new THREE.SphereGeometry(1, 16, 16),
            ultraLow: new THREE.SphereGeometry(1, 8, 8)
        };
        
        console.log("World Manager initialized");
    }
    
    /**
     * Crea l'ambiente visivo dell'universo
     * @param {Array} systems - Array di sistemi stellari
     * @param {Array} planets - Array di pianeti
     */
    createUniverseVisuals(systems, planets) {
        // Reset degli array
        this.planetMeshes = [];
        this.starMeshes = [];
        this.activeEnemies = [];
        
        // Crea lo sfondo stellato
        this.createStarfieldBackground();
        
        // Crea le stelle
        this.createStars(systems);
        
        // Crea i pianeti con LOD
        this.createPlanetsWithLOD(planets);
    }
    
    /**
     * Crea uno sfondo stellato ottimizzato
     */
    createStarfieldBackground() {
        // Crea environment map (skybox) per lo sfondo stellato
        try {
            const cubeTextureLoader = new THREE.CubeTextureLoader();
            const environmentMap = cubeTextureLoader.load([
                'public/textures/environment/px.png',
                'public/textures/environment/nx.png',
                'public/textures/environment/py.png',
                'public/textures/environment/ny.png',
                'public/textures/environment/pz.png',
                'public/textures/environment/nz.png',
            ], 
            undefined, 
            undefined, 
            function(err) { 
                console.warn('Errore caricamento environment map, utilizzo colore nero di base', err);
                this.scene.background = new THREE.Color(0x000000);
            }.bind(this));
            this.scene.background = environmentMap;
        } catch (error) {
            console.warn('Environment map non disponibile, utilizzo colore nero di base', error);
            this.scene.background = new THREE.Color(0x000000);
        }
        
        // Crea starfield di sfondo (stelle lontane)
        const starCount = 10000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            // Posizione casuale sulle superficie di una sfera grande
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 5000 + Math.random() * 15000;
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            starPositions[i * 3] = x;
            starPositions[i * 3 + 1] = y;
            starPositions[i * 3 + 2] = z;
            
            // Colori leggermente variati
            const r = 0.8 + Math.random() * 0.2;
            const g = 0.8 + Math.random() * 0.2;
            const b = 0.8 + Math.random() * 0.2;
            
            starColors[i * 3] = r;
            starColors[i * 3 + 1] = g;
            starColors[i * 3 + 2] = b;
            
            // Dimensione variabile
            starSizes[i] = 1.0 + Math.random() * 2.0;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        
        // Shader per le stelle
        const starMaterial = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: true,
            transparent: true,
            vertexColors: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const starField = new THREE.Points(starGeometry, starMaterial);
        starField.userData.isStarfield = true;
        
        this.scene.add(starField);
        return starField;
    }
    
    /**
     * Crea le stelle dei sistemi
     * @param {Array} systems - Sistemi stellari
     */
    createStars(systems) {
        if (!systems || systems.length === 0) {
            console.warn("Nessun sistema stellare da creare");
            return;
        }
        
        const starGeometry = new THREE.SphereGeometry(1, 64, 32);
        
        // Crea le stelle con effetti luminosi
        systems.forEach(system => {
            // Crea materiale luminoso per la stella
            const starMaterial = new THREE.MeshBasicMaterial({ 
                color: system.starColor,
                transparent: true,
                opacity: 0.9
            });
            
            const starMesh = new THREE.Mesh(starGeometry, starMaterial);
            starMesh.position.copy(system.position);
            starMesh.scale.setScalar(system.starSize * 6);
            starMesh.userData.systemData = system;
            
            // Aggiungi luce per illuminare il sistema
            const starLight = new THREE.PointLight(system.starColor, 1.5, 0, 2);
            starLight.position.copy(system.position);
            this.scene.add(starLight);
            
            // Aggiungi effetto flare alla stella
            this.createStarFlare(system.position, system.starColor, system.starSize * 2);
            
            this.scene.add(starMesh);
            this.starMeshes.push(starMesh);
            
            // Crea percorsi orbitali
            if (system.planets && system.planets.length > 0) {
                system.planets.forEach(planetData => {
                    const orbitGeometry = new THREE.RingGeometry(
                        planetData.orbitRadius - 0.1, 
                        planetData.orbitRadius + 0.1, 
                        64
                    );
                    const orbitMaterial = new THREE.MeshBasicMaterial({ 
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.1,
                        side: THREE.DoubleSide 
                    });
                    
                    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
                    orbit.rotation.x = Math.PI / 2;
                    orbit.position.copy(system.position);
                    this.scene.add(orbit);
                });
            }
        });
    }
    
    /**
     * Crea effetto flare (bagliore) per le stelle
     * @param {THREE.Vector3} position - Posizione della stella
     * @param {number} color - Colore del flare
     * @param {number} size - Dimensione del flare
     * @returns {THREE.Mesh} Mesh del flare
     */
    createStarFlare(position, color, size) {
        const flareGeometry = new THREE.PlaneGeometry(size * 5, size * 5);
        const flareMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const flare = new THREE.Mesh(flareGeometry, flareMaterial);
        flare.position.copy(position);
        
        // Indica che il flare deve essere aggiornato manualmente in ogni frame
        flare.userData.isFlare = true;
        
        this.scene.add(flare);
        return flare;
    }
    
    /**
     * Crea pianeti con Level of Detail
     * @param {Array} planets - Pianeti da creare
     */
    createPlanetsWithLOD(planets) {
        if (!planets || planets.length === 0) {
            console.warn("Nessun pianeta da creare");
            return;
        }
        
        // Pulizia delle mesh pianeti esistenti prima di crearne di nuove
        // per prevenire duplicazioni
        this.planetMeshes.forEach(mesh => {
            if (mesh && mesh.parent) {
                mesh.parent.remove(mesh);
            }
        });
        this.planetMeshes = [];
        
        // Traccia gli ID dei pianeti già creati per evitare duplicati
        const createdPlanetIds = new Set();
        
        planets.forEach(planetData => {
            // Salta i pianeti senza dati validi o già creati
            if (!planetData || !planetData.id || createdPlanetIds.has(planetData.id)) {
                return;
            }
            
            // Registra questo pianeta come creato
            createdPlanetIds.add(planetData.id);
            
            // Seleziona texture in base al tipo di pianeta
            let diffuseTexture = null;
            let bumpTexture = null;
            let hasBumpMap = false;
            
            switch (planetData.type) {
                case 'rocky':
                    diffuseTexture = new THREE.TextureLoader().load('public/textures/mars.jpg',
                        undefined, undefined, function() { console.warn('Errore caricamento texture mars.jpg'); });
                    try {
                        bumpTexture = new THREE.TextureLoader().load('public/textures/mars-bump.jpg');
                        hasBumpMap = true;
                    } catch {
                        console.warn('Texture mars-bump.jpg non trovata');
                    }
                    break;
                case 'gas':
                    diffuseTexture = new THREE.TextureLoader().load('public/textures/jupiter.jpg',
                        undefined, undefined, function() { console.warn('Errore caricamento texture jupiter.jpg'); });
                    break;
                case 'lava':
                    diffuseTexture = new THREE.TextureLoader().load('public/textures/venus.jpg',
                        undefined, undefined, function() { console.warn('Errore caricamento texture venus.jpg'); });
                    try {
                        bumpTexture = new THREE.TextureLoader().load('public/textures/venus-bump.jpg');
                        hasBumpMap = true;
                    } catch {
                        console.warn('Texture venus-bump.jpg non trovata');
                    }
                    break;
                case 'ocean':
                case 'forest':
                default:
                    diffuseTexture = new THREE.TextureLoader().load('public/textures/earth.jpg',
                        undefined, undefined, function() { console.warn('Errore caricamento texture earth.jpg'); });
                    try {
                        bumpTexture = new THREE.TextureLoader().load('public/textures/earth-bump.jpg');
                        hasBumpMap = true;
                    } catch {
                        console.warn('Texture earth-bump.jpg non trovata');
                    }
                    break;
            }
            
            // Crea materiale con o senza texture
            const planetMaterial = new THREE.MeshPhongMaterial({
                color: diffuseTexture ? 0xffffff : planetData.color,
                map: diffuseTexture,
                bumpMap: hasBumpMap ? bumpTexture : null,
                bumpScale: hasBumpMap ? 0.05 : 0,
                shininess: 5
            });
            
            // Crea meshes per ogni livello di dettaglio
            const highMesh = new THREE.Mesh(this.planetLODGeometries.high, planetMaterial.clone());
            const mediumMesh = new THREE.Mesh(this.planetLODGeometries.medium, planetMaterial.clone());
            const lowMesh = new THREE.Mesh(this.planetLODGeometries.low, planetMaterial.clone());
            const ultraLowMesh = new THREE.Mesh(this.planetLODGeometries.ultraLow, planetMaterial.clone());
            
            // Configura LOD (Level of Detail)
            const lod = new THREE.LOD();
            
            // Distanze dinamiche in base alla dimensione del pianeta
            const sizeFactor = planetData.size;
            lod.addLevel(highMesh, 0);                    // Dettaglio alto quando vicino
            lod.addLevel(mediumMesh, sizeFactor * 50);    // Dettaglio medio a distanza media
            lod.addLevel(lowMesh, sizeFactor * 150);      // Dettaglio basso a distanza alta
            lod.addLevel(ultraLowMesh, sizeFactor * 300); // Dettaglio minimo quando molto lontano
            
            // Posiziona e configura il LOD
            lod.position.copy(planetData.position);
            lod.scale.setScalar(planetData.size);
            lod.userData.planetData = planetData;
            
            // Aggiungi atmosfera per pianeti specifici
            if (['rocky', 'forest', 'ocean'].includes(planetData.type)) {
                const atmosphere = this.createPlanetAtmosphere(planetData);
                if (atmosphere) {
                    lod.add(atmosphere);
                }
            }
            
            // Anelli per pianeti giganti
            if (planetData.type === 'gas' && planetData.size > 15) {
                const rings = this.createPlanetRings(planetData);
                if (rings) {
                    lod.add(rings);
                }
            }
            
            this.scene.add(lod);
            this.planetMeshes.push(lod);
        });
    }
    
    /**
     * Crea l'atmosfera di un pianeta
     * @param {Object} planetData - Dati del pianeta
     * @returns {THREE.Mesh} Mesh dell'atmosfera
     */
    createPlanetAtmosphere(planetData) {
        const atmosphereGeometry = new THREE.SphereGeometry(1.025, 32, 32);
        const atmosphereMaterial = new THREE.MeshPhongMaterial({
            color: planetData.type === 'rocky' ? 0xff6a00 : 0x3498db,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide,
            depthWrite: false
        });
        
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        return atmosphere;
    }
    
    /**
     * Crea gli anelli di un pianeta
     * @param {Object} planetData - Dati del pianeta
     * @returns {THREE.Mesh} Mesh degli anelli
     */
    createPlanetRings(planetData) {
        const innerRadius = 1.3;
        const outerRadius = 2.2;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
        
        // Personalizza colore in base al tipo del pianeta
        const ringColor = planetData.type === 'gas' ? 0xf9d89c : 0xcccccc;
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        rings.rotation.x = Math.PI / 2;
        return rings;
    }
    
    /**
     * Aggiorna il mondo
     * @param {number} delta - Delta time
     * @param {THREE.Vector3} playerPosition - Posizione attuale del giocatore
     */
    update(delta, playerPosition) {
        if (!this.scene) return;
        
        // Aggiorna rotazione pianeti
        this.planetMeshes.forEach(planet => {
            if (planet && planet.userData && planet.userData.planetData) {
                const planetData = planet.userData.planetData;
                // Trova il primo livello (la mesh con il modello dettagliato)
                const meshLevel = planet.getObjectByProperty('type', 'Mesh');
                if (meshLevel) {
                    // Applica rotazione al pianeta
                    meshLevel.rotation.y += planetData.rotationSpeed * delta || 0.001 * delta;
                }
                
                // Se il pianeta ruota intorno a una stella, aggiorna la posizione
                if (planetData.orbitSpeed && planetData.orbitRadius && planetData.parentStar) {
                    const orbitAngle = (planetData.orbitAngle || 0) + (planetData.orbitSpeed * delta);
                    planetData.orbitAngle = orbitAngle;
                    
                    // Calcola nuova posizione in base all'orbita
                    const parentPos = planetData.parentStar.position || new THREE.Vector3();
                    const x = parentPos.x + planetData.orbitRadius * Math.cos(orbitAngle);
                    const z = parentPos.z + planetData.orbitRadius * Math.sin(orbitAngle);
                    
                    planet.position.set(x, parentPos.y, z);
                }
            }
        });
        
        // Aggiorna flare stelle
        this.scene.traverse(object => {
            if (object.userData && object.userData.isFlare) {
                if (playerPosition) {
                    // Orienta il flare verso il giocatore
                    object.lookAt(playerPosition);
                }
            }
        });
    }
    
    /**
     * Imposta la qualità del LOD per i pianeti
     * @param {string} quality - Qualità ('high', 'medium', 'low')
     */
    setLODQuality(quality) {
        console.log(`Imposto qualità LOD a: ${quality}`);
        
        // Ajusta le distanze LOD in base alla qualità
        this.planetMeshes.forEach(planet => {
            if (planet && planet.type === 'LOD') {
                const levels = planet.levels;
                const sizeFactor = planet.userData.planetData?.size || 1;
                
                switch (quality) {
                    case 'high':
                        // Distanze standard
                        if (levels.length >= 4) {
                            levels[1].distance = sizeFactor * 50;   // medium
                            levels[2].distance = sizeFactor * 150;  // low
                            levels[3].distance = sizeFactor * 300;  // ultraLow
                        }
                        break;
                    case 'medium':
                        // Riduce le distanze del 25%
                        if (levels.length >= 4) {
                            levels[1].distance = sizeFactor * 35;   // medium più vicino
                            levels[2].distance = sizeFactor * 100;  // low più vicino
                            levels[3].distance = sizeFactor * 200;  // ultraLow più vicino
                        }
                        break;
                    case 'low':
                        // Riduce le distanze del 50%
                        if (levels.length >= 4) {
                            levels[1].distance = sizeFactor * 25;   // medium molto vicino
                            levels[2].distance = sizeFactor * 50;   // low molto vicino
                            levels[3].distance = sizeFactor * 100;  // ultraLow molto vicino
                        }
                        break;
                }
            }
        });
    }
    
    /**
     * Focalizza la visualizzazione su un pianeta specifico
     * @param {string} planetId - ID del pianeta
     */
    focusOnPlanet(planetId) {
        // Trova il pianeta con l'ID specificato
        const planetMesh = this.planetMeshes.find(mesh => 
            mesh.userData && mesh.userData.planetData && mesh.userData.planetData.id === planetId
        );
        
        if (!planetMesh) {
            console.warn(`Pianeta con ID ${planetId} non trovato`);
            return;
        }
        
        // Nascondi tutti i pianeti tranne quello selezionato
        this.planetMeshes.forEach(mesh => {
            if (mesh !== planetMesh) {
                mesh.visible = false;
            }
        });
        
        // Nascondi le stelle tranne quella del sistema del pianeta
        const systemId = planetMesh.userData.planetData.systemId;
        this.starMeshes.forEach(mesh => {
            if (mesh.userData && mesh.userData.systemData) {
                mesh.visible = mesh.userData.systemData.id === systemId;
            }
        });
        
        console.log(`Focalizzato su pianeta: ${planetMesh.userData.planetData.name}`);
    }

    /**
     * Aggiorna il frustum culling in base alla posizione della camera
     * @param {THREE.Camera} camera - La camera del gioco
     * @param {boolean} isLowQuality - Se true, usa LOD di qualità inferiore
     */
    updateFrustumCulling(camera, isLowQuality) {
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(
            new THREE.Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            )
        );

        // Aggiorna visibilità e LOD dei pianeti
        this.planetMeshes.forEach(planetMesh => {
            const distance = camera.position.distanceTo(planetMesh.position);
            const isVisible = frustum.containsPoint(planetMesh.position);
            
            planetMesh.visible = isVisible;
            
            if (isVisible) {
                // Seleziona il livello di dettaglio appropriato
                if (isLowQuality) {
                    planetMesh.geometry = distance < 1000 ? 
                        this.planetLODGeometries.low : 
                        this.planetLODGeometries.ultraLow;
                } else {
                    if (distance < 500) {
                        planetMesh.geometry = this.planetLODGeometries.high;
                    } else if (distance < 1000) {
                        planetMesh.geometry = this.planetLODGeometries.medium;
                    } else {
                        planetMesh.geometry = this.planetLODGeometries.low;
                    }
                }
            }
        });

        // Aggiorna visibilità delle stelle
        this.starMeshes.forEach(starMesh => {
            starMesh.visible = frustum.containsPoint(starMesh.position);
        });
    }

    /**
     * Aggiorna gli effetti visivi di un pianeta
     * @param {Object} planet - Dati del pianeta da aggiornare
     */
    updatePlanetVisuals(planet) {
        const planetMesh = this.planetMeshes.find(mesh => 
            mesh.userData.planetData && mesh.userData.planetData.id === planet.id
        );
        
        if (!planetMesh) return;
        
        // Aggiorna aura se il pianeta è conquistato
        if (planet.isConquered) {
            if (!planetMesh.userData.aura) {
                const aura = this.createPlanetAura(planet);
                planetMesh.add(aura);
                planetMesh.userData.aura = aura;
            }
        } else if (planetMesh.userData.aura) {
            planetMesh.remove(planetMesh.userData.aura);
            planetMesh.userData.aura = null;
        }
        
        // Aggiorna effetti atmosferici
        if (planet.hasAtmosphere && !planetMesh.userData.atmosphere) {
            const atmosphere = this.createPlanetAtmosphere(planet);
            planetMesh.add(atmosphere);
            planetMesh.userData.atmosphere = atmosphere;
        }
        
        // Aggiorna anelli se presenti
        if (planet.hasRings && !planetMesh.userData.rings) {
            const rings = this.createPlanetRings(planet);
            planetMesh.add(rings);
            planetMesh.userData.rings = rings;
        }
    }

    /**
     * Crea un effetto aura per un pianeta conquistato
     * @param {Object} planet - Dati del pianeta
     * @returns {THREE.Mesh} - Mesh dell'aura
     */
    createPlanetAura(planet) {
        const auraGeometry = new THREE.SphereGeometry(
            planet.radius * 1.2, 32, 32
        );
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        
        return new THREE.Mesh(auraGeometry, auraMaterial);
    }

    /**
     * Rende visibili tutti gli elementi del mondo
     */
    showAll() {
        // Mostra tutti i pianeti
        this.planetMeshes.forEach(planetMesh => {
            planetMesh.visible = true;
            if (planetMesh.userData.atmosphere) {
                planetMesh.userData.atmosphere.visible = true;
            }
            if (planetMesh.userData.rings) {
                planetMesh.userData.rings.visible = true;
            }
        });
        
        // Mostra tutte le stelle
        this.starMeshes.forEach(starMesh => {
            starMesh.visible = true;
            // Mostra anche gli effetti delle stelle
            starMesh.children.forEach(child => {
                child.visible = true;
            });
        });
    }

    /**
     * Nasconde gli elementi non necessari durante il combattimento
     */
    hideNonCombatElements() {
        // Nascondi pianeti non coinvolti nel combattimento
        this.planetMeshes.forEach(planetMesh => {
            if (!planetMesh.userData.inCombat) {
                planetMesh.visible = false;
                if (planetMesh.userData.atmosphere) {
                    planetMesh.userData.atmosphere.visible = false;
                }
                if (planetMesh.userData.rings) {
                    planetMesh.userData.rings.visible = false;
                }
            }
        });
        
        // Nascondi stelle non necessarie
        this.starMeshes.forEach(starMesh => {
            if (!starMesh.userData.inCombat) {
                starMesh.visible = false;
                // Nascondi anche gli effetti delle stelle
                starMesh.children.forEach(child => {
                    child.visible = false;
                });
            }
        });
    }

    /**
     * Crea un portale di ingresso per un pianeta
     * @param {Object} planetData - Dati del pianeta
     * @param {THREE.Vector3} position - Posizione del portale
     * @returns {THREE.Group} - Gruppo contenente il portale
     */
    createEntrancePortal(planetData, position) {
        const portalGroup = new THREE.Group();
        
        // Crea il frame del portale
        const frameGeometry = new THREE.TorusGeometry(2, 0.2, 16, 32);
        const frameMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x004400
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // Crea l'effetto del portale
        const portalGeometry = new THREE.CircleGeometry(1.8, 32);
        const portalMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        
        // Aggiungi al gruppo
        portalGroup.add(frame);
        portalGroup.add(portal);
        
        // Posiziona il portale
        portalGroup.position.copy(position);
        portalGroup.lookAt(planetData.position);
        
        // Aggiungi dati per il portale
        portalGroup.userData = {
            type: 'entrance',
            targetPlanet: planetData.id,
            isActive: true
        };
        
        return portalGroup;
    }

    /**
     * Crea un portale di uscita per tornare nello spazio
     * @param {THREE.Vector3} position - Posizione del portale
     * @returns {THREE.Group} - Gruppo contenente il portale
     */
    createExitPortal(position) {
        const portalGroup = new THREE.Group();
        
        // Crea il frame del portale
        const frameGeometry = new THREE.TorusGeometry(2, 0.2, 16, 32);
        const frameMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0x440000
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // Crea l'effetto del portale
        const portalGeometry = new THREE.CircleGeometry(1.8, 32);
        const portalMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        
        // Aggiungi al gruppo
        portalGroup.add(frame);
        portalGroup.add(portal);
        
        // Posiziona il portale
        portalGroup.position.copy(position);
        
        // Aggiungi dati per il portale
        portalGroup.userData = {
            type: 'exit',
            isActive: true
        };
        
        return portalGroup;
    }
} 