import * as THREE from 'three';

/**
 * Classe che gestisce la visualizzazione e l'interazione con il sistema solare.
 * Basata sul progetto: https://github.com/KyleGough/solar-system
 */
export class SolarSystem {
    constructor(scene) {
        this.scene = scene;
        this.planets = [];
        this.stars = [];
        this.orbits = [];
        this.labels = [];
        this.activePlanet = null;
    }

    /**
     * Inizializza il sistema solare
     */
    initialize() {
        // Creazione del sole
        this.createSun();
        
        // Creazione dei pianeti
        this.createPlanets();
        
        // Creazione delle orbite
        this.createOrbits();
        
        // Aggiungi etichette per i punti di interesse
        this.createLabels();
        
        // Aggiungi illuminazione
        this.setupLighting();
        
        // Aggiungi stars in background
        this.createStarfield();
    }

    /**
     * Crea il sole al centro del sistema
     */
    createSun() {
        const sunGeometry = new THREE.SphereGeometry(10, 64, 64);
        
        // Usa la texture del sole se disponibile
        const textureLoader = new THREE.TextureLoader();
        let sunMaterial;
        
        try {
            const sunTexture = textureLoader.load('public/textures/sun.jpg');
            sunMaterial = new THREE.MeshBasicMaterial({
                map: sunTexture,
                emissive: 0xffff00,
                emissiveIntensity: 0.5
            });
        } catch {
            // Fallback se la texture non è disponibile
            sunMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                emissive: 0xffff00,
            });
        }
        
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);
        
        // Aggiungi glow effect al sole
        const sunGlow = new THREE.PointLight(0xffff00, 1.5, 1000);
        this.sun.add(sunGlow);
    }

    /**
     * Crea i pianeti del sistema solare
     */
    createPlanets() {
        const planetData = [
            {
                name: 'Mercury',
                radius: 0.5,
                distance: 30,
                orbitSpeed: 0.01,
                rotationSpeed: 0.005,
                texture: 'mercury.jpg',
                bumpTexture: 'mercury-bump.jpg',
                color: 0xaaaaaa,
                tilt: 0.03, // Inclinazione asse in radianti
                pointsOfInterest: []
            },
            {
                name: 'Venus',
                radius: 0.8,
                distance: 50,
                orbitSpeed: 0.007,
                rotationSpeed: 0.002,
                texture: 'venus.jpg',
                bumpTexture: 'venus-bump.jpg',
                color: 0xd6a567,
                tilt: 0.04,
                pointsOfInterest: []
            },
            {
                name: 'Earth',
                radius: 1,
                distance: 70,
                orbitSpeed: 0.005,
                rotationSpeed: 0.01,
                texture: 'earth.jpg',
                bumpTexture: 'earth-bump.jpg',
                specularTexture: 'earth-specular.jpg',
                color: 0x3498db,
                tilt: 0.41, // ~23.5 gradi
                atmosphere: true,
                pointsOfInterest: [
                    { name: 'North Pole', position: new THREE.Vector3(0, 1, 0), description: 'Arctic region' },
                    { name: 'Mount Everest', position: new THREE.Vector3(0.6, 0.8, 0.1), description: 'Highest mountain on Earth' }
                ],
                moons: [
                    {
                        name: 'Moon',
                        radius: 0.25,
                        distance: 3,
                        orbitSpeed: 0.02,
                        rotationSpeed: 0.005,
                        texture: 'moon.jpg',
                        bumpTexture: 'moon-bump.jpg',
                        color: 0xcccccc,
                        tilt: 0.05
                    }
                ]
            },
            {
                name: 'Mars',
                radius: 0.7,
                distance: 90,
                orbitSpeed: 0.004,
                rotationSpeed: 0.008,
                texture: 'mars.jpg',
                bumpTexture: 'mars-bump.jpg',
                color: 0xc0392b,
                tilt: 0.44, // ~25 gradi
                atmosphere: true,
                pointsOfInterest: [
                    { name: 'Olympus Mons', position: new THREE.Vector3(0.3, 0.5, 0.7), description: 'Largest volcano in the solar system' }
                ]
            },
            {
                name: 'Jupiter',
                radius: 4,
                distance: 130,
                orbitSpeed: 0.002,
                rotationSpeed: 0.015,
                texture: 'jupiter.jpg',
                color: 0xe67e22,
                tilt: 0.05,
                pointsOfInterest: [],
                moons: [
                    {
                        name: 'Io',
                        radius: 0.3,
                        distance: 6,
                        orbitSpeed: 0.025,
                        rotationSpeed: 0.005,
                        texture: 'io.jpg',
                        color: 0xffcc00,
                        tilt: 0.02
                    },
                    {
                        name: 'Europa',
                        radius: 0.25,
                        distance: 8,
                        orbitSpeed: 0.02,
                        rotationSpeed: 0.005,
                        texture: 'europa.jpg',
                        color: 0xaaaaaa,
                        tilt: 0.03
                    },
                    {
                        name: 'Ganymede',
                        radius: 0.4,
                        distance: 10,
                        orbitSpeed: 0.015,
                        rotationSpeed: 0.004,
                        texture: 'ganymede.jpg',
                        color: 0xbbbbaa,
                        tilt: 0.01
                    },
                    {
                        name: 'Callisto',
                        radius: 0.35,
                        distance: 12,
                        orbitSpeed: 0.01,
                        rotationSpeed: 0.003,
                        texture: 'callisto.jpg',
                        color: 0x999999,
                        tilt: 0.04
                    }
                ]
            },
            {
                name: 'Saturn',
                radius: 3.5,
                distance: 170,
                orbitSpeed: 0.001,
                rotationSpeed: 0.012,
                texture: 'saturn.jpg',
                color: 0xf1c40f,
                tilt: 0.47, // ~27 gradi
                pointsOfInterest: [],
                rings: {
                    innerRadius: 4,
                    outerRadius: 8,
                    texture: 'saturn-ring.png'
                },
                moons: [
                    {
                        name: 'Titan',
                        radius: 0.4,
                        distance: 10,
                        orbitSpeed: 0.015,
                        rotationSpeed: 0.004,
                        texture: 'titan.webp',
                        color: 0xddaa77,
                        tilt: 0.02,
                        atmosphere: true
                    }
                ]
            },
            {
                name: 'Uranus',
                radius: 2,
                distance: 210,
                orbitSpeed: 0.0007,
                rotationSpeed: 0.009,
                texture: 'uranus.jpg',
                color: 0x1abc9c,
                tilt: 1.71, // ~98 gradi - inclinazione estrema di Urano
                pointsOfInterest: []
            },
            {
                name: 'Neptune',
                radius: 1.8,
                distance: 240,
                orbitSpeed: 0.0005,
                rotationSpeed: 0.007,
                texture: 'neptune.jpg',
                color: 0x3498db,
                tilt: 0.49, // ~28 gradi
                pointsOfInterest: [],
                moons: [
                    {
                        name: 'Triton',
                        radius: 0.3,
                        distance: 7,
                        orbitSpeed: -0.01, // Orbita retrograda
                        rotationSpeed: 0.004,
                        texture: 'triton.jpg',
                        color: 0xaabbcc,
                        tilt: 0.05
                    }
                ]
            }
        ];
        
        // Distribuisci i pianeti in modo più uniformemente distanziato sull'orbita
        const totalPlanets = planetData.length;
        const angleStep = (Math.PI * 2) / totalPlanets;
        
        // Crea ogni pianeta
        planetData.forEach((data, index) => {
            // Impostiamo un angolo iniziale specifico per ogni pianeta per distribuirli
            const initialAngle = index * angleStep;
            this.createPlanet(data, initialAngle);
        });
    }

    /**
     * Crea un singolo pianeta e lo aggiunge alla scena
     */
    createPlanet(data, initialAngle = Math.random() * Math.PI * 2) {
        const planetGeometry = new THREE.SphereGeometry(data.radius, 32, 32);
        
        // Carica texture se disponibile
        let planetMaterial;
        
        if (data.texture) {
            // Usa un TextureLoader per caricare la texture
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(`public/textures/${data.texture}`);
            
            const materialOptions = {
                map: texture,
                roughness: 0.8,
                metalness: 0.1
            };
            
            // Se c'è una bump map specificata, caricala
            if (data.bumpTexture) {
                try {
                    const bumpMap = textureLoader.load(`public/textures/${data.bumpTexture}`);
                    materialOptions.bumpMap = bumpMap;
                    materialOptions.bumpScale = 0.02;
                } catch {
                    // Bump map non disponibile, ignora
                }
            }
            
            // Se c'è una specular map, caricala
            if (data.specularTexture) {
                try {
                    const specularMap = textureLoader.load(`public/textures/${data.specularTexture}`);
                    materialOptions.specularMap = specularMap;
                    materialOptions.shininess = 30;
                } catch {
                    // Specular map non disponibile, ignora
                }
            }
            
            // Crea il materiale con le opzioni determinate
            planetMaterial = new THREE.MeshStandardMaterial(materialOptions);
            
            // Per la Terra, aggiungi anche le nuvole
            if (data.name === 'Earth') {
                try {
                    const cloudsTexture = textureLoader.load('public/textures/earth-clouds.jpg');
                    const cloudsAlpha = textureLoader.load('public/textures/earth-clouds-alpha.jpg');
                    
                    // Crea una sfera esterna per le nuvole
                    const cloudsGeometry = new THREE.SphereGeometry(data.radius * 1.02, 32, 32);
                    const cloudsMaterial = new THREE.MeshStandardMaterial({
                        map: cloudsTexture,
                        alphaMap: cloudsAlpha,
                        transparent: true,
                        opacity: 0.8
                    });
                    
                    const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
                    
                    // Memorizza il riferimento per l'animazione
                    this.clouds = clouds;
                } catch {
                    // Ignora se le texture non sono disponibili
                }
            }
        } else {
            // Fallback al colore semplice
            planetMaterial = new THREE.MeshStandardMaterial({
                color: data.color,
                roughness: 0.8,
                metalness: 0.1
            });
        }
        
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        
        // Posiziona il pianeta
        planet.position.x = Math.cos(initialAngle) * data.distance;
        planet.position.z = Math.sin(initialAngle) * data.distance;
        
        // Imposta inclinazione asse se specificata
        if (data.tilt) {
            planet.rotation.x = data.tilt;
        } else {
            // Aggiungi una leggera inclinazione all'asse del pianeta per naturalezza
            planet.rotation.x = Math.random() * 0.4 - 0.2;
        }
        
        // Aggiungi metadati
        planet.userData = {
            name: data.name,
            orbitSpeed: data.orbitSpeed,
            rotationSpeed: data.rotationSpeed,
            orbitDistance: data.distance,
            orbitAngle: initialAngle,
            pointsOfInterest: data.pointsOfInterest || [],
            moons: []
        };
        
        this.scene.add(planet);
        this.planets.push(planet);
        
        // Aggiungi le nuvole se sono state create (solo per la Terra)
        if (this.clouds) {
            planet.add(this.clouds);
            planet.userData.clouds = this.clouds;
            this.clouds = null; // Reset per il prossimo uso
        }
        
        // Crea lune se presenti
        if (data.moons) {
            data.moons.forEach((moonData, index) => {
                // Distribuiamo le lune attorno al pianeta
                const moonAngle = index * ((Math.PI * 2) / data.moons.length);
                this.createMoon(moonData, planet, moonAngle);
            });
        }
        
        // Crea anelli se presenti (per Saturno)
        if (data.rings) {
            this.createRings(data.rings, planet);
        }
        
        // Aggiungi effetto atmosferico per pianeti con atmosfera
        if (data.atmosphere) {
            this.addAtmosphereEffect(planet, data);
        }
        
        return planet;
    }

    /**
     * Aggiunge un effetto atmosferico al pianeta
     */
    addAtmosphereEffect(planet, data) {
        // Crea una sfera leggermente più grande del pianeta per simulare l'atmosfera
        const atmosphereGeometry = new THREE.SphereGeometry(data.radius * 1.05, 32, 32);
        
        // Determina il colore dell'atmosfera in base al pianeta
        let atmosphereColor;
        switch(data.name) {
            case 'Earth':
                atmosphereColor = 0x15a6ff; // Blu
                break;
            case 'Venus':
                atmosphereColor = 0xffd700; // Giallo
                break;
            case 'Mars':
                atmosphereColor = 0xff6347; // Rosso chiaro
                break;
            default:
                atmosphereColor = 0x88ccff; // Blu chiaro predefinito
        }
        
        // Crea un materiale semi-trasparente per l'atmosfera
        const atmosphereMaterial = new THREE.MeshLambertMaterial({
            color: atmosphereColor,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        planet.add(atmosphere);
    }

    /**
     * Crea una luna e la collega al pianeta
     */
    createMoon(data, planet, moonAngle = Math.random() * Math.PI * 2) {
        const moonGeometry = new THREE.SphereGeometry(data.radius, 16, 16);
        
        // Carica texture se disponibile
        let moonMaterial;
        
        if (data.texture) {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(`public/textures/${data.texture}`);
            
            moonMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.9,
                metalness: 0.0
            });
            
            // Prova a caricare una bump map se disponibile
            try {
                const bumpMapName = data.texture.replace('.jpg', '-bump.jpg');
                const bumpMap = textureLoader.load(`public/textures/${bumpMapName}`);
                moonMaterial.bumpMap = bumpMap;
                moonMaterial.bumpScale = 0.02;
            } catch {
                // Bump map non disponibile, ignora
            }
        } else {
            moonMaterial = new THREE.MeshStandardMaterial({
                color: data.color,
                roughness: 0.9,
                metalness: 0.0
            });
        }
        
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        
        // Posiziona la luna
        moon.position.x = Math.cos(moonAngle) * data.distance;
        moon.position.z = Math.sin(moonAngle) * data.distance;
        
        // Aggiungi inclinazione asse se specificata
        if (data.tilt) {
            moon.rotation.x = data.tilt;
        }
        
        // Aggiungi metadati
        moon.userData = {
            name: data.name,
            orbitSpeed: data.orbitSpeed,
            rotationSpeed: data.rotationSpeed,
            orbitDistance: data.distance,
            orbitAngle: moonAngle,
            isPlanet: false,
            isMoon: true
        };
        
        planet.add(moon);
        planet.userData.moons.push(moon);
        
        // Aggiungi effetto atmosferico per le lune con atmosfera (es. Titano)
        if (data.atmosphere) {
            this.addAtmosphereEffect(moon, data);
        }
        
        return moon;
    }

    /**
     * Crea anelli per un pianeta (es. Saturno)
     */
    createRings(ringsData, planet) {
        // Usa una geometria di disco per gli anelli
        const ringsGeometry = new THREE.RingGeometry(
            ringsData.innerRadius,
            ringsData.outerRadius,
            64, // segmenti
            8   // anelli concentrici
        );
        
        let ringsMaterial;
        
        // Usa texture se disponibile, altrimenti usa un materiale base
        if (ringsData.texture) {
            const textureLoader = new THREE.TextureLoader();
            
            // Correggi il nome del file per adattarlo a quello disponibile (saturn-ring.png anziché saturn_rings.png)
            const textureFile = ringsData.texture.replace('saturn_rings.png', 'saturn-ring.png');
            const texture = textureLoader.load(`public/textures/${textureFile}`);
            
            ringsMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                alphaTest: 0.1
            });
        } else {
            // Colore di default per gli anelli
            ringsMaterial = new THREE.MeshStandardMaterial({
                color: 0xCCAA88,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
        }
        
        const rings = new THREE.Mesh(ringsGeometry, ringsMaterial);
        
        // Ruota gli anelli per mostrare l'inclinazione
        rings.rotation.x = Math.PI / 3;
        
        // Aggiungi gli anelli al pianeta
        planet.add(rings);
    }

    /**
     * Crea le orbite visibili per i pianeti
     */
    createOrbits() {
        this.planets.forEach(planet => {
            const orbitGeometry = new THREE.BufferGeometry();
            const orbitMaterial = new THREE.LineBasicMaterial({ 
                color: 0x444444,
                transparent: true,
                opacity: 0.3
            });
            
            const orbitPoints = [];
            const segments = 128;
            const radius = planet.userData.orbitDistance;
            
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                orbitPoints.push(
                    Math.cos(theta) * radius,
                    0,
                    Math.sin(theta) * radius
                );
            }
            
            orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
            const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
            this.scene.add(orbit);
            this.orbits.push(orbit);
        });
    }

    /**
     * Crea etichette per punti di interesse sui pianeti
     */
    createLabels() {
        this.planets.forEach(planet => {
            if (planet.userData.pointsOfInterest.length > 0) {
                planet.userData.pointsOfInterest.forEach(poi => {
                    // Per ora è un placeholder, implementeremo le etichette più avanti
                    console.log(`Label for ${poi.name} on ${planet.userData.name}`);
                });
            }
        });
    }

    /**
     * Configura l'illuminazione per il sistema solare
     */
    setupLighting() {
        // Luce ambientale per illuminazione base
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Luce direzionale dal sole
        const sunLight = new THREE.PointLight(0xffffff, 1.5, 1000);
        sunLight.position.set(0, 0, 0);
        this.scene.add(sunLight);
    }

    /**
     * Crea un campo di stelle per lo sfondo
     */
    createStarfield() {
        // Crea un sistema di particelle per le stelle in background
        const starCount = 10000;
        const starfieldGeometry = new THREE.BufferGeometry();
        
        // Coordinate casuali per le stelle
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        // Genera le posizioni e i colori delle stelle
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Posizione in una sfera di raggio 1000
            const radius = 1000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Colori variabili per le stelle
            // Aggiungi varietà di colori per rendere il cielo stellato più realistico
            const starType = Math.random();
            if (starType < 0.6) {
                // Stelle bianche-blu (più comuni)
                colors[i3] = 0.9 + Math.random() * 0.1; // r
                colors[i3 + 1] = 0.9 + Math.random() * 0.1; // g
                colors[i3 + 2] = 1.0; // b
            } else if (starType < 0.8) {
                // Stelle giallastre
                colors[i3] = 1.0; // r
                colors[i3 + 1] = 0.9 + Math.random() * 0.1; // g
                colors[i3 + 2] = 0.6 + Math.random() * 0.2; // b
            } else if (starType < 0.95) {
                // Stelle rossastre
                colors[i3] = 1.0; // r
                colors[i3 + 1] = 0.5 + Math.random() * 0.3; // g
                colors[i3 + 2] = 0.5 + Math.random() * 0.2; // b
            } else {
                // Stelle blu brillanti (rare)
                colors[i3] = 0.5 + Math.random() * 0.2; // r
                colors[i3 + 1] = 0.5 + Math.random() * 0.3; // g
                colors[i3 + 2] = 1.0; // b
            }
            
            // Dimensioni variabili delle stelle
            sizes[i] = Math.random() * 2.5 + 0.5;
        }
        
        // Aggiungi attributi alla geometria
        starfieldGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starfieldGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starfieldGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Crea material per point sprites
        const starsMaterial = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            alphaTest: 0.01
        });
        
        // Creiamo una texture di base per la stella se non esiste
        try {
            const textureLoader = new THREE.TextureLoader();
            // Prova a caricare una texture dalla cartella environment se esiste
            textureLoader.load('public/textures/environment/star.png', (texture) => {
                starsMaterial.map = texture;
                starsMaterial.needsUpdate = true;
            });
        } catch {
            // Se non possiamo caricare una texture, creiamo una texture procedurale
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            
            const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            starsMaterial.map = texture;
            starsMaterial.needsUpdate = true;
        }
        
        // Crea il sistema di particelle
        const starfield = new THREE.Points(starfieldGeometry, starsMaterial);
        this.scene.add(starfield);
    }

    /**
     * Aggiorna le posizioni dei pianeti
     */
    update(deltaTime) {
        // Aggiorna rotazione dei pianeti
        this.planets.forEach(planet => {
            // Controlla se è un pianeta importato (ha mesh) o un pianeta nativo
            if (planet.mesh) {
                // Pianeta importato con riferimento a mesh esterna
                
                // Aggiorna angolo orbitale
                planet.orbitAngle = (planet.orbitAngle || 0) + (planet.orbitSpeed || 0.01) * deltaTime;
                
                // Aggiorna posizione orbitale se c'è un raggio di orbita
                if (planet.orbitRadius) {
                    const newX = Math.cos(planet.orbitAngle) * planet.orbitRadius;
                    const newZ = Math.sin(planet.orbitAngle) * planet.orbitRadius;
                    
                    // Aggiorna posizione dell'oggetto pianeta
                    if (planet.position) {
                        planet.position.set(newX, planet.position.y, newZ);
                    }
                    
                    // Aggiorna anche la mesh associata se esiste
                    if (planet.mesh && planet.mesh.position) {
                        planet.mesh.position.set(newX, planet.mesh.position.y, newZ);
                    }
                }
            } else if (planet.rotation && planet.userData) {
                // Pianeta nativo (è una mesh Three.js diretta)
                
                // Aggiorna rotazione del pianeta
                planet.rotation.y += planet.userData.rotationSpeed * deltaTime;
                
                // Aggiorna posizione orbitale
                planet.userData.orbitAngle += planet.userData.orbitSpeed * deltaTime;
                planet.position.x = Math.cos(planet.userData.orbitAngle) * planet.userData.orbitDistance;
                planet.position.z = Math.sin(planet.userData.orbitAngle) * planet.userData.orbitDistance;
                
                // Aggiorna le nuvole della Terra se presenti
                if (planet.userData.clouds) {
                    planet.userData.clouds.rotation.y += planet.userData.rotationSpeed * 0.5 * deltaTime;
                }
                
                // Aggiorna lune
                if (planet.userData.moons) {
                    planet.userData.moons.forEach(moon => {
                        moon.rotation.y += moon.userData.rotationSpeed * deltaTime;
                        
                        moon.userData.orbitAngle += moon.userData.orbitSpeed * deltaTime;
                        moon.position.x = Math.cos(moon.userData.orbitAngle) * moon.userData.orbitDistance;
                        moon.position.z = Math.sin(moon.userData.orbitAngle) * moon.userData.orbitDistance;
                    });
                }
            }
        });
        
        // Rotazione lenta del sole
        if (this.sun) {
            this.sun.rotation.y += 0.001 * deltaTime;
        }
    }

    /**
     * Trova il pianeta più vicino alla posizione data
     */
    findNearestPlanet(position, maxDistance = Infinity) {
        let nearestPlanet = null;
        let minDistance = maxDistance;
        
        this.planets.forEach(planet => {
            const distance = position.distanceTo(planet.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        });
        
        return {
            planet: nearestPlanet,
            distance: minDistance
        };
    }

    /**
     * Atterra su un pianeta (transizione a modalità planetaria)
     */
    landOnPlanet(planet) {
        if (!planet) return false;
        
        // Implementeremo questa funzione più avanti quando integreremo
        // il sistema di terreni planetari da OpenWorldJS
        console.log(`Landing on ${planet.userData.name}`);
        
        return true;
    }

    /**
     * Importa dati dal sistema esistente
     * @param {Array} systems - Array di sistemi stellari esistenti
     * @param {Array} planetMeshes - Array di mesh dei pianeti esistenti
     */
    importLegacyData(systems, planetMeshes) {
        if (!systems || !planetMeshes) return;
        
        // Reset di qualsiasi dato esistente
        this.planets = [];
        this.orbits = [];
        
        // Importa le stelle dai sistemi
        systems.forEach(system => {
            // Crea una stella dal sistema esistente
            const star = {
                position: system.position.clone(),
                radius: system.starSize * 5, // Usiamo la stessa scala del codice esistente
                color: system.starColor,
                luminosity: system.starSize * 2, // Derivato dal size
                name: system.name || `Star-${this.stars.length}`
            };
            
            this.stars.push(star);
        });
        
        // Importa i pianeti dalle mesh esistenti
        planetMeshes.forEach(mesh => {
            if (mesh.userData && mesh.userData.planetData) {
                const planetData = mesh.userData.planetData;
                
                // Crea un pianeta basato sui dati esistenti
                const planet = {
                    position: planetData.position.clone(),
                    radius: planetData.size * 2, // Usiamo la stessa scala del codice esistente
                    orbitRadius: planetData.orbitRadius || 0,
                    orbitSpeed: planetData.orbitSpeed || 0.1,
                    rotationSpeed: 0.01, // Valore di default
                    color: planetData.color,
                    name: planetData.name || `Planet-${this.planets.length}`,
                    texture: null, // Da determinare in base al tipo di pianeta
                    isConquered: planetData.isConquered || false,
                    defense: planetData.defense || 0,
                    resources: planetData.resources || 0,
                    mesh: mesh
                };
                
                // Aggiungi il pianeta alla collezione
                this.planets.push(planet);
                
                // Se il pianeta è in orbita, crea anche l'orbita
                if (planetData.parentStar) {
                    const orbit = {
                        center: new THREE.Vector3().copy(planetData.parentStar.position),
                        radius: planetData.orbitRadius || 
                                planetData.position.distanceTo(planetData.parentStar.position),
                        planet: planet
                    };
                    
                    this.orbits.push(orbit);
                }
            }
        });
        
        console.log(`Imported ${this.stars.length} stars and ${this.planets.length} planets from legacy data`);
    }
}
