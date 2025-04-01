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
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
        });
        
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
                color: 0xaaaaaa,
                pointsOfInterest: []
            },
            {
                name: 'Venus',
                radius: 0.8,
                distance: 50,
                orbitSpeed: 0.007,
                rotationSpeed: 0.002,
                texture: 'venus.jpg',
                color: 0xd6a567,
                pointsOfInterest: []
            },
            {
                name: 'Earth',
                radius: 1,
                distance: 70,
                orbitSpeed: 0.005,
                rotationSpeed: 0.01,
                texture: 'earth.jpg',
                color: 0x3498db,
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
                        color: 0xcccccc
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
                color: 0xc0392b,
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
                pointsOfInterest: [],
                moons: [
                    {
                        name: 'Io',
                        radius: 0.3,
                        distance: 6,
                        orbitSpeed: 0.025,
                        rotationSpeed: 0.005,
                        texture: 'io.jpg',
                        color: 0xffcc00
                    },
                    {
                        name: 'Europa',
                        radius: 0.25,
                        distance: 8,
                        orbitSpeed: 0.02,
                        rotationSpeed: 0.005,
                        texture: 'europa.jpg',
                        color: 0xaaaaaa
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
                pointsOfInterest: [],
                rings: {
                    innerRadius: 4,
                    outerRadius: 8,
                    texture: 'saturn_rings.png'
                }
            },
            {
                name: 'Uranus',
                radius: 2,
                distance: 210,
                orbitSpeed: 0.0007,
                rotationSpeed: 0.009,
                texture: 'uranus.jpg',
                color: 0x1abc9c,
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
                pointsOfInterest: []
            }
        ];
        
        // Crea ogni pianeta
        planetData.forEach(data => {
            this.createPlanet(data);
        });
    }

    /**
     * Crea un singolo pianeta e lo aggiunge alla scena
     */
    createPlanet(data) {
        const planetGeometry = new THREE.SphereGeometry(data.radius, 32, 32);
        
        // Per ora usiamo un materiale colorato, poi aggiungeremo texture
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        
        // Posiziona il pianeta
        const angle = Math.random() * Math.PI * 2;
        planet.position.x = Math.cos(angle) * data.distance;
        planet.position.z = Math.sin(angle) * data.distance;
        
        // Aggiungi metadati
        planet.userData = {
            name: data.name,
            orbitSpeed: data.orbitSpeed,
            rotationSpeed: data.rotationSpeed,
            orbitDistance: data.distance,
            orbitAngle: angle,
            pointsOfInterest: data.pointsOfInterest || [],
            moons: []
        };
        
        this.scene.add(planet);
        this.planets.push(planet);
        
        // Crea lune se presenti
        if (data.moons) {
            data.moons.forEach(moonData => {
                this.createMoon(moonData, planet);
            });
        }
        
        // Crea anelli se presenti (per Saturno)
        if (data.rings) {
            this.createRings(data.rings, planet);
        }
    }

    /**
     * Crea una luna e la collega al pianeta
     */
    createMoon(data, planet) {
        const moonGeometry = new THREE.SphereGeometry(data.radius, 16, 16);
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        
        // Posiziona la luna
        const angle = Math.random() * Math.PI * 2;
        moon.position.x = Math.cos(angle) * data.distance;
        moon.position.z = Math.sin(angle) * data.distance;
        
        // Aggiungi metadati
        moon.userData = {
            name: data.name,
            orbitSpeed: data.orbitSpeed,
            rotationSpeed: data.rotationSpeed,
            orbitDistance: data.distance,
            orbitAngle: angle,
            isPlanet: false,
            isMoon: true
        };
        
        planet.add(moon);
        planet.userData.moons.push(moon);
    }

    /**
     * Crea anelli per un pianeta (es. Saturno)
     */
    createRings(ringsData, planet) {
        const ringGeometry = new THREE.RingGeometry(
            ringsData.innerRadius, 
            ringsData.outerRadius, 
            64
        );
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        rings.rotation.x = Math.PI / 2;
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
        const starCount = 5000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount * 3; i += 3) {
            // Distribuzione casuale di stelle su una sfera distante
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 500 + Math.random() * 1000;
            
            starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPositions[i + 2] = radius * Math.cos(phi);
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1
        });
        
        const starField = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(starField);
    }

    /**
     * Aggiorna le posizioni dei pianeti
     */
    update(deltaTime) {
        // Aggiorna rotazione dei pianeti
        this.planets.forEach(planet => {
            // Aggiorna rotazione del pianeta
            planet.rotation.y += planet.userData.rotationSpeed * deltaTime;
            
            // Aggiorna posizione orbitale
            planet.userData.orbitAngle += planet.userData.orbitSpeed * deltaTime;
            planet.position.x = Math.cos(planet.userData.orbitAngle) * planet.userData.orbitDistance;
            planet.position.z = Math.sin(planet.userData.orbitAngle) * planet.userData.orbitDistance;
            
            // Aggiorna lune
            planet.userData.moons.forEach(moon => {
                moon.rotation.y += moon.userData.rotationSpeed * deltaTime;
                
                moon.userData.orbitAngle += moon.userData.orbitSpeed * deltaTime;
                moon.position.x = Math.cos(moon.userData.orbitAngle) * moon.userData.orbitDistance;
                moon.position.z = Math.sin(moon.userData.orbitAngle) * moon.userData.orbitDistance;
            });
        });
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
} 