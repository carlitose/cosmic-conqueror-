import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
// SimplexNoise viene importato altrove
// import * as SimplexNoise from 'simplex-noise';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UniverseGenerator } from './universe.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { SolarSystem } from './space/SolarSystem.js';
import { TerrainGenerator } from './planet/TerrainGenerator.js';
import { SpaceCombat } from './combat/SpaceCombat.js';
import { GroundCombat } from './combat/GroundCombat.js';
import { GameIntegration } from './GameIntegration.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let player;
let universeGenerator;
let planetMeshes = []; // Array per memorizzare le mesh dei pianeti
let starMeshes = [];   // Array per memorizzare le mesh delle stelle
let exitPortalGroup, exitPortalBox;
let returnPortalGroup, returnPortalBox;
let composer; // Renderer composer con effetti

let activeEnemies = []; // Array per i nemici attivi
let targetIndicatorArrow = null; // <-- Nuovo: Freccia indicatore

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
let prevTime = performance.now();

let activeProjectiles = []; // Array per gli attacchi attivi

let currentTargetPlanet = null; // Pianeta attualmente nel raggio d'azione

// NUOVI MODULI INTEGRATI
let solarSystem = null;
let terrainGenerator = null;
let spaceCombat = null;
let groundCombat = null;
// gameIntegration è necessario per la gestione centralizzata dei moduli di gioco
let gameIntegration = null;
let gameMode = 'space'; // 'space', 'planet', 'space-combat', 'ground-combat'

// UI Elements
const characterSelectionScreen = document.getElementById('character-selection');
const startGameButton = document.getElementById('start-game');
const characterOptions = document.querySelectorAll('.character-option');
const healthBarFill = document.getElementById('health-fill');
const energyBarFill = document.getElementById('energy-fill');
const currencyAmount = document.getElementById('currency-amount');
const planetInfoPanel = document.getElementById('planet-info');
const planetName = document.getElementById('planet-name');
const planetStatus = document.getElementById('planet-status');
const planetDefense = document.getElementById('defense-value');
const conquerButton = document.getElementById('conquer-btn');
const gameOverScreen = document.getElementById('game-over-screen'); // <-- Schermata Game Over
const restartButton = document.getElementById('restart-game'); // <-- Pulsante Restart
const upgradesScreen = document.getElementById('upgrades-screen'); // <-- Schermata Potenziamenti
const closeUpgradesButton = document.getElementById('close-upgrades'); // <-- Pulsante Chiudi
const upgradeButtons = document.querySelectorAll('.upgrade-btn'); // <-- Tutti i pulsanti Potenzia
const legendScreen = document.getElementById('legend-screen'); // <-- Nuovo: Legenda
const closeLegendButton = document.getElementById('close-legend'); // <-- Nuovo: Pulsante chiudi legenda

let isGameOver = false; // Flag per stato Game Over

let projectilePool = []; // Pool di proiettili riutilizzabili
const MAX_PROJECTILES = 50; // Numero massimo di proiettili simultanei
let lastFrustumCheck = 0; // Timestamp dell'ultimo check del frustum
let lastPhysicsUpdate = 0; // Timestamp dell'ultimo aggiornamento completo della fisica
let collisionCache = new Map(); // Cache per la collision detection
let audioPool = {}; // Pool di oggetti audio per il riutilizzo

// --- Sound Functions ---
function initAudioPool() {
    // Definisci i suoni che verranno utilizzati di frequente
    const sounds = {
        'shoot': { src: 'public/sounds/shoot.mp3', instances: 5 },
        'hit': { src: 'public/sounds/hit.mp3', instances: 5 },
        'explosion': { src: 'public/sounds/explosion.mp3', instances: 3 }
        // Aggiungi altri suoni secondo necessità
    };
    
    // Per ogni tipo di suono, pre-carica multiple istanze
    for (const [name, config] of Object.entries(sounds)) {
        audioPool[name] = [];
        
        // Controlla se il browser supporta Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Audio API non supportata dal browser');
            return;
        }
        
        for (let i = 0; i < config.instances; i++) {
            try {
                const audio = new Audio(config.src);
                audio.preload = 'auto';
                audio.load();
                
                // Aggiungi al pool
                audioPool[name].push({
                    element: audio,
                    inUse: false
                });
            } catch (e) {
                console.warn(`Impossibile caricare l'audio ${name}:`, e);
            }
        }
    }
}

// Riproduci un suono dal pool
function playSound(name, volume = 1.0) {
    if (!audioPool[name] || audioPool[name].length === 0) {
        return; // Suono non disponibile
    }
    
    // Trova un'istanza audio non in uso
    let audioInstance = audioPool[name].find(a => !a.inUse);
    
    // Se tutte le istanze sono in uso, usa la prima
    if (!audioInstance) {
        audioInstance = audioPool[name][0];
        audioInstance.element.pause();
        audioInstance.element.currentTime = 0;
    }
    
    // Configura e riproduci
    audioInstance.inUse = true;
    audioInstance.element.volume = volume;
    
    // Riproduci con controllo degli errori
    try {
        const playPromise = audioInstance.element.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Riproduzione avviata con successo
            }).catch(error => {
                // Autoplay non consentito o altro errore
                audioInstance.inUse = false;
                console.warn('Errore riproduzione audio:', error);
            });
        }
        
        // Segna come disponibile quando finisce
        audioInstance.element.onended = () => {
            audioInstance.inUse = false;
        };
    } catch (e) {
        audioInstance.inUse = false;
        console.warn('Errore avvio riproduzione audio:', e);
    }
}

// --- Initialization ---
init();

function init() {
    // --- Scene Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005); // Spazio profondo
    scene.fog = new THREE.FogExp2(0x000005, 0.0005); // Nebbia spaziale

    // --- Camera Setup ---
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000); // Aumenta la distanza di rendering
    camera.position.set(0, 5, 10);

    // --- Renderer Setup ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // --- Post-processing Effects ---
    composer = initializeRendererEffects();

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Luce ambientale più soffusa
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5); // Luce solare principale
    sunLight.position.set(100, 100, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    scene.add(sunLight);

    // --- Create Target Indicator ---
    createTargetIndicator();

    // --- Controls Setup (Pointer Lock) ---
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    controls.addEventListener('lock', () => {
        console.log('Pointer locked');
        // Nascondi hint controlli quando bloccato
        document.getElementById('controls-hint').style.opacity = '0'; 
    });
    controls.addEventListener('unlock', () => {
        console.log('Pointer unlocked');
        // Mostra hint controlli quando sbloccato
        document.getElementById('controls-hint').style.opacity = '1'; 
        // Se la schermata potenziamenti è visibile, non fare nulla, altrimenti mostra hint
        if (!upgradesScreen.classList.contains('hidden')) {
             document.getElementById('controls-hint').style.opacity = '0'; // Nascondi se upgrade aperto
        }
    });

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    conquerButton.addEventListener('click', attemptConquerPlanet);
    restartButton.addEventListener('click', restartGame);
    closeUpgradesButton.addEventListener('click', closeUpgradesScreen);
    closeLegendButton.addEventListener('click', closeLegendScreen); // <-- Nuovo: Chiudi legenda
    
    // Aggiungi listener ai pulsanti di potenziamento
    upgradeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stat = button.closest('.upgrade-item').getAttribute('data-stat');
            attemptUpgrade(stat);
        });
    });
    
    // Aggiungi listener per aprire/chiudere la schermata potenziamenti e legenda
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyU' && !isGameOver && player) { // Usa 'U' per potenziamenti
            if (upgradesScreen.classList.contains('hidden')) {
                openUpgradesScreen();
            } else {
                closeUpgradesScreen();
            }
        }
        
        if (event.code === 'KeyH' && !isGameOver) { // Usa 'H' per la legenda
             if (legendScreen.classList.contains('hidden')) {
                 openLegendScreen();
             } else {
                 closeLegendScreen();
             }
        }
    });

    // --- Character Selection Setup ---
    let selectedRace = 'saiyan'; // MODIFICA: default selection
    characterOptions.forEach(option => {
        // Seleziona automaticamente il Saiyan
        if (option.getAttribute('data-race') === 'saiyan') {
            option.classList.add('selected');
        }
        
        option.addEventListener('click', () => {
            characterOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedRace = option.getAttribute('data-race');
            startGameButton.disabled = false;
        });
    });

    startGameButton.addEventListener('click', () => {
        console.log('Begin Conquest button clicked');
        if (selectedRace) {
            console.log('Starting game with:', selectedRace); // DEBUG
            try {
                startGame(selectedRace);
            } catch (error) {
                console.error('Error starting game:', error);
            }
        } else {
            console.warn('No race selected!');
        }
    });
    startGameButton.disabled = false; // MODIFICA: abilitiamo subito il pulsante

    // --- Gestione diretta dell'ID start-game per sicurezza ---
    document.getElementById('start-game').onclick = function() {
        console.log('Button clicked via direct ID handler');
        if (selectedRace) {
            try {
                startGame(selectedRace);
            } catch (error) {
                console.error('Error in direct handler:', error);
            }
        }
        return false; // Previeni comportamento di default
    };

    // Verifica se l'utente arriva da un portale
    const urlParams = new URLSearchParams(window.location.search);
    const fromPortal = urlParams.get('portal') === 'true';
    
    if (fromPortal) {
        // Skip character selection if coming from a portal
        characterSelectionScreen.classList.add('hidden');
        const username = urlParams.get('username') || 'Player';
        const color = urlParams.get('color') || 'white';
        const refUrl = urlParams.get('ref') || '';
        
        console.log('Player arriving from portal with data:', { username, color, refUrl });
        
        // Start game immediately with default or provided race
        const raceFromParams = urlParams.get('race') || 'saiyan';
        startGame(raceFromParams);
        
        // Create return portal pointing back to referrer
        if (refUrl) {
            createReturnPortal(refUrl);
        }
    } else {
        // Show Character Selection for normal start
        characterSelectionScreen.classList.remove('hidden');
    }

    // Inizializza il pool di proiettili
    initProjectilePool();
    
    // Inizializza il pool audio
    initAudioPool();
}

// --- Inizializza il pool di proiettili per il riutilizzo ---
function initProjectilePool() {
    // Pre-crea geometrie comuni per risparmiare memoria
    const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const energyGeo = new THREE.SphereGeometry(0.5, 16, 8);
    const laserGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    
    for (let i = 0; i < MAX_PROJECTILES; i++) {
        // Crea materiali per diversi tipi di proiettili
        const normalMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const energyMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.8 
        });
        const laserMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.9 
        });
        
        // Crea mesh per diversi tipi di proiettili
        const normalMesh = new THREE.Mesh(sphereGeo, normalMat);
        const energyMesh = new THREE.Mesh(energyGeo, energyMat);
        const laserMesh = new THREE.Mesh(laserGeo, laserMat);
        
        // Nascondi gli oggetti inizialmente
        normalMesh.visible = false;
        energyMesh.visible = false;
        laserMesh.visible = false;
        
        // Aggiungi alla scena
        scene.add(normalMesh);
        scene.add(energyMesh);
        scene.add(laserMesh);
        
        // Aggiungi al pool
        projectilePool.push({
            normal: { mesh: normalMesh, inUse: false },
            energy: { mesh: energyMesh, inUse: false },
            laser: { mesh: laserMesh, inUse: false }
        });
    }
}

// --- Create Target Indicator Arrow ---
function createTargetIndicator() {
    // Al posto della freccia, creiamo un puntatore del mouse semplice
    const crosshairSize = 0.02;
    const crosshairGeometry = new THREE.CircleGeometry(crosshairSize, 32);
    const crosshairMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.8 
    });
    
    targetIndicatorArrow = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
    targetIndicatorArrow.position.set(0, 0, -0.5); // Posizionato davanti alla camera
    targetIndicatorArrow.visible = true; // Sempre visibile

    // Aggiungiamo il crosshair alla camera invece che alla scena
    camera.add(targetIndicatorArrow);
}

// Aggiungere anche un CSS crosshair come backup
function addCrosshairCSS() {
    // Crea un elemento div per il crosshair
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '10px';
    crosshair.style.height = '10px';
    crosshair.style.borderRadius = '50%';
    crosshair.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    crosshair.style.pointerEvents = 'none'; // Non interferisce con gli eventi del mouse
    
    // Aggiungi al contenitore di gioco
    document.getElementById('game-container').appendChild(crosshair);
}

// --- Game Start ---
function startGame(playerRace) {
    console.log('startGame called with race:', playerRace); // DEBUG
    
    try {
        characterSelectionScreen.classList.add('hidden'); // Nascondi selezione personaggio
        
        // --- Create Player ---
        console.log('Creating player...'); // DEBUG
        player = new Player(playerRace);
        console.log('Player created:', player); // DEBUG
        
        player.createMesh(); // Crea la mesh del giocatore (anche se invisibile in prima persona)
        // Non aggiungiamo la mesh alla scena direttamente se siamo in prima persona
        
        // --- Universe Generation ---
        console.log('Generating universe...'); // DEBUG
        universeGenerator = new UniverseGenerator();
        const universeData = universeGenerator.generateUniverse(50, 5); // Genera 50 sistemi con 5 pianeti ciascuno
        console.log('Universe data:', universeData); // DEBUG
        
        createUniverseVisuals(universeData.systems, universeData.planets);
        console.log('Universe visuals created'); // DEBUG

        // --- Initialize integrated modules ---
        initializeIntegratedModules();
        
        // Aggiungi crosshair CSS
        addCrosshairCSS();

        // --- Create Portals ---
        // createPortals(); // TODO: Reimplementare la logica dei portali con i dati del giocatore
        createExitPortal(); // Per ora creiamo solo il portale di uscita
        console.log('Portals created'); // DEBUG

        // --- Lock Controls and Start Game Loop ---
        console.log('Locking controls and starting game loop'); // DEBUG
        controls.lock(); // <-- AGGIUNTO: Blocca il puntatore qui!
        animate(); 
    } catch (error) {
        console.error('Error in startGame:', error); // Catch exceptions
    }
}

// --- Create Universe Visuals ---
function createUniverseVisuals(systems, planets) {
    planetMeshes = [];
    starMeshes = [];
    activeEnemies = []; // Resetta l'array dei nemici

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
            scene.background = new THREE.Color(0x000000);
        });
        scene.background = environmentMap;
    } catch {
        console.warn('Environment map non disponibile, utilizzo colore nero di base');
        scene.background = new THREE.Color(0x000000);
    }

    // Crea effetto starfield di background (cielo stellato)
    createStarfieldBackground();

    // Usa geometria con più triangoli per stelle e pianeti
    const planetGeometry = new THREE.SphereGeometry(1, 64, 64); 
    const starGeometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Crea StarFlares (effetti luminosi per le stelle)
    const createStarFlare = (position, color, size) => {
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
        flare.lookAt(camera.position);
        
        // RIMUOVO la sovrascrittura di updateMatrix che causa ricorsione infinita
        // Invece, segniamo il flare per aggiornamento manuale in ogni frame
        flare.userData.isFlare = true;
        
        scene.add(flare);
        return flare;
    };

    // Crea stelle
    systems.forEach(system => {
        // Crea materiale luminoso per la stella, senza emissive che non è supportato in MeshBasicMaterial
        const starMaterial = new THREE.MeshBasicMaterial({ 
            color: system.starColor,
            transparent: true,
            opacity: 0.9
        });
        
        const starMesh = new THREE.Mesh(starGeometry, starMaterial);
        starMesh.position.copy(system.position);
        starMesh.scale.setScalar(system.starSize * 6); // Stelle più grandi
        starMesh.userData.systemData = system;
        
        // Aggiungi luce per illuminare il sistema
        const starLight = new THREE.PointLight(system.starColor, 1.5, 0, 2);
        starLight.position.copy(system.position);
        scene.add(starLight);
        
        // Aggiungi effetto flare alla stella
        createStarFlare(system.position, system.starColor, system.starSize * 2);
        
        scene.add(starMesh);
        starMeshes.push(starMesh);
        
        // Crea percorsi orbitali
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
            scene.add(orbit);
        });
    });

    // Usa Level of Detail (LOD) per i pianeti distanti
    createPlanetsWithLOD(planets, planetGeometry);
}

// --- Creare pianeti con Level of Detail ---
function createPlanetsWithLOD(planets, highDetailGeometry) {
    planets.forEach(planetData => {
        // Crea geometrie a diversi livelli di dettaglio
        const highLOD = highDetailGeometry;
        const medLOD = new THREE.SphereGeometry(1, 32, 32);
        const lowLOD = new THREE.SphereGeometry(1, 16, 16);
        
        // Scegli texture in base al tipo di pianeta
        let diffuseTexture = null;
        let bumpTexture = null;
        
        // Eliminiamo i try-catch per semplificare, ma gestiamo il controllo delle texture
        switch(planetData.type) {
            case 'rocky':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/mars.jpg', 
                    undefined, undefined, function() { console.warn('Errore caricamento texture mars.jpg'); });
                // Carica il bump map solo se necessario e disponibile
                try {
                    bumpTexture = new THREE.TextureLoader().load('public/textures/mars-bump.jpg');
                } catch {
                    console.warn('Texture mars-bump.jpg non trovata, uso pianeta senza bump mapping');
                }
                break;
            case 'gas':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/jupiter.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture jupiter.jpg'); });
                break;
            case 'desert':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/mercury.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture mercury.jpg'); });
                try {
                    bumpTexture = new THREE.TextureLoader().load('public/textures/mercury-bump.jpg');
                } catch {
                    console.warn('Texture mercury-bump.jpg non trovata');
                }
                break;
            case 'ice':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/neptune.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture neptune.jpg'); });
                break;
            case 'lava':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/venus.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture venus.jpg'); });
                try {
                    bumpTexture = new THREE.TextureLoader().load('public/textures/venus-bump.jpg');
                } catch {
                    console.warn('Texture venus-bump.jpg non trovata');
                }
                break;
            case 'ocean':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/earth.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture earth.jpg'); });
                try {
                    bumpTexture = new THREE.TextureLoader().load('public/textures/earth-bump.jpg');
                } catch {
                    console.warn('Texture earth-bump.jpg non trovata');
                }
                break;
            case 'forest':
                diffuseTexture = new THREE.TextureLoader().load('public/textures/earth.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture earth.jpg'); });
                try {
                    bumpTexture = new THREE.TextureLoader().load('public/textures/earth-bump.jpg');
                } catch {
                    console.warn('Texture earth-bump.jpg non trovata');
                }
                break;
            default:
                diffuseTexture = new THREE.TextureLoader().load('public/textures/earth.jpg',
                    undefined, undefined, function() { console.warn('Errore caricamento texture earth.jpg'); });
        }
        
        // Crea materiale avanzato per i pianeti, solo con le texture disponibili
        const planetMaterial = new THREE.MeshPhongMaterial({
            color: planetData.color,
            shininess: 30,
            specular: 0x333333
        });
        
        // Aggiungi texture solo se disponibili
        if (diffuseTexture) {
            planetMaterial.map = diffuseTexture;
        }
        
        if (bumpTexture) {
            planetMaterial.bumpMap = bumpTexture;
            planetMaterial.bumpScale = 0.05;
        }
        
        // Crea il LOD
        const lod = new THREE.LOD();
        
        // Aggiungi i livelli
        const highMesh = new THREE.Mesh(highLOD, planetMaterial);
        const medMesh = new THREE.Mesh(medLOD, planetMaterial.clone());
        const lowMesh = new THREE.Mesh(lowLOD, planetMaterial.clone());
        
        // Semplifica i materiali per i livelli più lontani
        medMesh.material.bumpMap = null;
        lowMesh.material.bumpMap = null;
        
        // Aggiungi i livelli al LOD, la distanza è relativa al diametro del pianeta
        lod.addLevel(highMesh, 0);                         // Vicino
        lod.addLevel(medMesh, planetData.size * 50);       // Medio
        lod.addLevel(lowMesh, planetData.size * 150);      // Lontano
        
        // Posiziona il LOD
        lod.position.copy(planetData.position);
        lod.scale.setScalar(planetData.size * 2);
        lod.userData.planetData = planetData;
        lod.castShadow = true;
        lod.receiveShadow = true;
        
        // Aggiungi atmosfera per certi tipi di pianeti
        if (planetData.type === 'gas' || planetData.type === 'ocean' || planetData.type === 'forest') {
            const atmosphereGeometry = new THREE.SphereGeometry(1.015, 32, 32);
            const atmosphereColor = planetData.type === 'gas' ? 0xffffcc : 0x8888ff;
            const atmosphereMaterial = new THREE.MeshPhongMaterial({
                color: atmosphereColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
            atmosphere.scale.setScalar(1);
            highMesh.add(atmosphere.clone());
            medMesh.add(atmosphere.clone());
            // Non aggiungere l'atmosfera al modello lowLOD per risparmiare risorse
        }
        
        // Aggiungi anelli per pianeti gassosi grandi (come Saturno)
        if (planetData.type === 'gas' && planetData.size > 3) {
            // Aggiungi gli anelli solo ai livelli di dettaglio alto e medio
            addRingsToMesh(highMesh, 1);
            addRingsToMesh(medMesh, 1);
            // Non aggiungere anelli al modello lowLOD
        }
        
        scene.add(lod);
        planetMeshes.push(lod);
        
        // --- Genera Difese Planetarie ---
        if (!planetData.isConquered) {
            const numDefenses = Math.floor(planetData.defense / 10);
            for (let i = 0; i < numDefenses; i++) {
                // Posiziona nemici sulla superficie del pianeta
                const enemyType = Math.random() < 0.7 ? 'drone' : 'turret';
                const planetRadius = planetData.size * 2;
                
                // Punto casuale sulla sfera del pianeta
                const phi = Math.acos(2 * Math.random() - 1);
                const theta = Math.random() * Math.PI * 2;
                
                const enemyLocalPos = new THREE.Vector3();
                enemyLocalPos.setFromSphericalCoords(planetRadius + (enemyType === 'turret' ? 2 : 3), phi, theta);
                
                const enemyWorldPos = new THREE.Vector3().copy(planetData.position).add(enemyLocalPos);
                
                const enemy = new Enemy(enemyType, enemyWorldPos, planetData);
                const enemyMesh = enemy.createMesh();
                
                // Orienta la torretta verso l'esterno del pianeta
                if (enemyType === 'turret') {
                   enemyMesh.lookAt(planetData.position);
                   enemyMesh.rotateX(Math.PI / 2); // Correggi orientamento cilindro
                }
                
                scene.add(enemyMesh);
                activeEnemies.push(enemy);
            }
        }
    });
}

// Funzione helper per aggiungere anelli ai pianeti
function addRingsToMesh(mesh, scale) {
    const ringsGeometry = new THREE.RingGeometry(1.5, 2.5, 32);
    const ringsMaterial = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    
    try {
        const ringTexture = new THREE.TextureLoader().load('public/textures/saturn-ring.png');
        if (ringTexture) {
            ringsMaterial.map = ringTexture;
        }
    } catch (error) {
        console.warn("Errore caricamento texture anelli:", error);
    }
    
    const rings = new THREE.Mesh(ringsGeometry, ringsMaterial);
    rings.rotation.x = Math.PI / 2;
    rings.scale.setScalar(scale);
    mesh.add(rings);
}

// --- Create Starfield Background ---
function createStarfieldBackground() {
    // Crea un campo stellare di background
    const starCount = 5000; // Ridotto da 10,000 a 5,000 per migliorare le performance
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        
        // Posizione stellare (sfera molto grande)
        const radius = 5000 + Math.random() * 5000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i3 + 2] = radius * Math.cos(phi);
        
        // Colore stellare (bianco con variazioni)
        const color = new THREE.Color();
        const hue = Math.random();
        const saturation = Math.random() * 0.3;
        color.setHSL(hue, saturation, 0.9 + Math.random() * 0.1);
        
        starColors[i3] = color.r;
        starColors[i3 + 1] = color.g;
        starColors[i3 + 2] = color.b;
        
        // Dimensione stellare
        starSizes[i] = Math.random() * 3;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        depthWrite: false
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// --- Portal Creation (Simplified for now) ---
function createExitPortal() {
    // Create portal group
    exitPortalGroup = new THREE.Group();
    exitPortalGroup.position.set(0, 10, -50); // Posizione fissa per ora
    
    // Create portal effect
    const exitPortalGeometry = new THREE.TorusGeometry(10, 1, 16, 100);
    const exitPortalMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8
    });
    const exitPortal = new THREE.Mesh(exitPortalGeometry, exitPortalMaterial);
    exitPortalGroup.add(exitPortal);
    
    // Create portal inner surface
    const exitPortalInnerGeometry = new THREE.CircleGeometry(9, 32);
    const exitPortalInnerMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const exitPortalInner = new THREE.Mesh(exitPortalInnerGeometry, exitPortalInnerMaterial);
    exitPortalGroup.add(exitPortalInner);
    
    // Add label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = '#00ff00';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.fillText('VIBEVERSE PORTAL', canvas.width/2, canvas.height/2);
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(20, 5);
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 15;
    exitPortalGroup.add(label);
    
    // Add portal to scene
    scene.add(exitPortalGroup);
    
    // Create portal collision box
    exitPortalBox = new THREE.Box3().setFromObject(exitPortalGroup);
}

// Create a return portal that points back to the referring game
function createReturnPortal(refUrl) {
    // Create portal group
    returnPortalGroup = new THREE.Group();
    // Position it behind the player's spawn point
    returnPortalGroup.position.set(0, 10, 50); // Opposite to exit portal
    
    // Create portal effect
    const returnPortalGeometry = new THREE.TorusGeometry(10, 1, 16, 100);
    const returnPortalMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000, // Red color to distinguish from exit portal
        transparent: true,
        opacity: 0.8
    });
    const returnPortal = new THREE.Mesh(returnPortalGeometry, returnPortalMaterial);
    returnPortalGroup.add(returnPortal);
    
    // Create portal inner surface
    const returnPortalInnerGeometry = new THREE.CircleGeometry(9, 32);
    const returnPortalInnerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const returnPortalInner = new THREE.Mesh(returnPortalInnerGeometry, returnPortalInnerMaterial);
    returnPortalGroup.add(returnPortalInner);
    
    // Add label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = '#ff0000';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    
    // Create a display name from the URL
    let displayName = refUrl;
    if (displayName.startsWith('http://')) displayName = displayName.substring(7);
    if (displayName.startsWith('https://')) displayName = displayName.substring(8);
    if (displayName.length > 20) displayName = displayName.substring(0, 20) + '...';
    
    context.fillText('RETURN TO ' + displayName.toUpperCase(), canvas.width/2, canvas.height/2);
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(20, 5);
    const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 15;
    returnPortalGroup.add(label);
    
    // Add portal to scene
    scene.add(returnPortalGroup);
    
    // Create portal collision box
    returnPortalBox = new THREE.Box3().setFromObject(returnPortalGroup);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Non aggiornare se il gioco non è iniziato, se il puntatore non è bloccato o se è Game Over
    if (!player || !controls.isLocked || isGameOver) { 
        prevTime = time;
        composer.render();
        return; 
    }

    // --- Throttling per task pesanti ---
    // Suddividiamo le operazioni in vari frame per mantenere FPS costanti
    
    // --- Frustum Culling (ogni 500ms) ---
    const shouldUpdateFrustum = time - lastFrustumCheck > 500;
    if (shouldUpdateFrustum) {
        updateFrustumCulling();
        lastFrustumCheck = time;
    }
    
    // --- Update Player (ogni frame) --- 
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    player.update(delta, moveForward, moveBackward, moveLeft, moveRight, moveUp, moveDown, cameraDirection);
    
    // Mantieni la telecamera sincronizzata con la posizione del giocatore
    controls.getObject().position.copy(player.position);

    // --- Update specifici per modalità di gioco (ogni frame) ---
    updateActiveGameMode(delta);

    // --- Update Enemies (ogni frame per nemici vicini, throttled per lontani) ---
    const playerPosition = player.position;
    for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        if (!enemy.isActive) {
            // Rimuovi nemico inattivo (distrutto)
            enemy.removeFromScene(scene);
            activeEnemies.splice(i, 1);
            continue;
        }
        
        // Distanza dal giocatore
        const distance = enemy.mesh ? 
            enemy.mesh.position.distanceTo(playerPosition) : 1000;
            
        // Aggiorna ogni frame se vicino, altrimenti con frequenza ridotta
        const shouldUpdate = distance < 100 || // Sempre aggiorna i nemici vicini
            (distance < 500 && time % 100 < 20) || // Aggiorna ogni 100ms quelli a media distanza
            (time % 500 < 20); // Aggiorna ogni 500ms quelli lontani
            
        if (shouldUpdate) {
            const enemyProjectileData = enemy.update(delta, player);
            if (enemyProjectileData) {
                createProjectile(enemyProjectileData);
            }
        }
    }

    // --- Update Projectiles (ogni frame per proiettili attivi) ---
    updateProjectiles(delta);
    
    // --- Update Star Flares (ogni 100ms) ---
    if (time % 100 < 20) {
        updateStarFlares();
    }

    // --- Update Target Indicator ---
    updateTargetIndicator();

    // --- Check Interactions (ogni 200ms) ---
    if (time % 200 < 20) {
        checkPlanetInteraction();
        checkPortalInteraction();
    }

    // --- Update UI (ogni 300ms) ---
    if (time % 300 < 20) {
        updateUI();
    }

    // --- Update gameIntegration (dipende dalla modalità) ---
    if (gameIntegration && time % 100 < 20) {
        gameIntegration.update(delta);
    }

    // --- Render Scene (ogni frame) ---
    composer.render();
    
    prevTime = time;
}

// Function to update the active game mode
function updateActiveGameMode(delta) {
    const playerPos = player.position; // Sposta la dichiarazione fuori dai case
    
    switch (gameMode) {
        case 'space':
            // --- Update Universe ---
            universeGenerator.updatePlanetPositions(delta * 10); // Accelera il movimento orbitale per visibilità
            
            // Ottimizzazione: aggiorna solo pianeti visibili o vicini al giocatore
            planetMeshes.forEach(mesh => {
                const distance = mesh.position.distanceTo(playerPos);
                
                // Aggiorna sempre pianeti visibili
                if (mesh.visible || distance < 500) {
                    mesh.position.copy(mesh.userData.planetData.position);
                    mesh.rotation.y += 0.01 * delta; // Rotazione pianeti su se stessi
                }
            });
            
            // Aggiorna anche il modulo solare integrato
            if (solarSystem) {
                solarSystem.update(delta);
            }
            break;
            
        case 'planet':
            // Aggiorna il generatore di terreno quando in modalità pianeta
            if (terrainGenerator) {
                terrainGenerator.update(delta, player.position);
            }
            break;
            
        case 'space-combat':
            // Aggiorna il sistema di combattimento spaziale
            if (spaceCombat) {
                spaceCombat.update(delta);
                
                // Ritorna alla modalità spazio se il combattimento è finito
                if (spaceCombat.isCombatComplete && spaceCombat.isCombatComplete()) {
                    switchGameMode('space');
                }
            }
            break;
            
        case 'ground-combat':
            // Aggiorna il sistema di combattimento terrestre
            if (groundCombat) {
                groundCombat.update(delta);
                
                // Ritorna alla modalità pianeta se il combattimento è finito
                if (groundCombat.isCombatComplete && groundCombat.isCombatComplete()) {
                    switchGameMode('planet');
                }
            }
            break;
    }
}

// --- Update Target Indicator ---
function updateTargetIndicator() {
    // Rimuoviamo tutta la logica precedente per la freccia che punterebe ai pianeti
    // Il mirino rimarrà sempre al centro dello schermo
    return;
    
    // La funzione originale è stata rimossa perché ora utilizziamo un mirino fisso
}

// --- Update Functions ---
function updateProjectiles(delta) {
    const time = performance.now();
    const doFullPhysics = time - lastPhysicsUpdate > 20; // Aggiorna la fisica completa ogni 20ms
    
    if (doFullPhysics) {
        lastPhysicsUpdate = time;
    }
    
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const projectile = activeProjectiles[i];
        const moveDistance = projectile.speed * delta;
        projectile.mesh.position.addScaledVector(projectile.direction, moveDistance);
        projectile.distanceTraveled += moveDistance;

        let hit = false;

        // --- Ottimizzazione della detection delle collisioni ---
        // Esegui la detection completa solo periodicamente o per proiettili vicini
        if (doFullPhysics || projectile.distanceTraveled < 50) {
            if (projectile.isEnemyProjectile) {
                // Proiettile nemico: controlla collisione con il giocatore
                // Usiamo direttamente intersectsBox senza cache per il giocatore (è un solo oggetto)
                const playerCollider = new THREE.Box3().setFromCenterAndSize(
                    player.position, 
                    new THREE.Vector3(2, 4, 2)
                );
                const projectileCollider = new THREE.Box3().setFromObject(projectile.mesh);
                
                if (playerCollider.intersectsBox(projectileCollider)) {
                    console.log("Player hit!");
                    const playerAlive = player.takeDamage(projectile.power);
                    hit = true;
                    createHitEffect(projectile.mesh.position, 0xff0000);
                    playSound('hit', 0.7);
                    
                    if (!playerAlive) {
                        handlePlayerDeath();
                    }
                }
            } else {
                // Ottimizza: controlla solo nemici vicini
                for (let j = activeEnemies.length - 1; j >= 0; j--) {
                    const enemy = activeEnemies[j];
                    if (!enemy.isActive || !enemy.mesh) continue;
                    
                    // Calcola distanza approssimativa
                    const distance = enemy.mesh.position.distanceTo(projectile.mesh.position);
                    
                    // Controlla solo se abbastanza vicino
                    if (distance < 20) {
                        const cacheKey = `proj_${i}_enemy_${j}`;
                        
                        // Usa la funzione ottimizzata
                        if (optimizedCollisionCheck(enemy.mesh, projectile.mesh, cacheKey)) {
                            console.log("Enemy hit!");
                            const enemyHitPosition = projectile.mesh.position.clone();
                            const enemyMeshScale = enemy.mesh.scale.x;
                            const enemyStillAlive = enemy.takeDamage(projectile.power);
                            hit = true;
                            createHitEffect(enemyHitPosition, 0xffff00);
                            playSound('hit', 0.5);
                            
                            if (!enemyStillAlive) {
                                // Logica esistente per la distruzione dei nemici
                                const expGained = enemy.type === 'drone' ? 10 : 25;
                                const currencyGained = enemy.type === 'drone' ? 5 : 10;
                                player.gainExperience(expGained);
                                player.currency += currencyGained;
                                createExplosionEffect(enemyHitPosition, enemyMeshScale);
                                playSound('explosion', 0.6);
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Rimuovi proiettile se ha superato la portata o ha colpito qualcosa
        if (hit || projectile.distanceTraveled >= projectile.range) {
            // Invece di rimuovere, ricicliamo il proiettile
            projectile.mesh.visible = false;
            projectile.poolItem.inUse = false;
            activeProjectiles.splice(i, 1);
        } 
    }
    
    // Pulisci periodicamente la cache delle collisioni (ogni 5 secondi)
    if (time % 5000 < 20) {
        const currentTime = performance.now();
        for (const [key, value] of collisionCache.entries()) {
            if (currentTime - value.timestamp > 5000) {
                collisionCache.delete(key);
            }
        }
    }
}

function checkPlanetInteraction() {
    const result = universeGenerator.findNearestPlanet(player.position, 50); // Raggio di interazione
    
    if (result.planet && result.distance < (result.planet.size * 2 + 5)) { // Se abbastanza vicino
        if (currentTargetPlanet !== result.planet) {
            currentTargetPlanet = result.planet;
            showPlanetInfo(result.planet);
        }
    } else {
        if (currentTargetPlanet) {
            hidePlanetInfo();
            currentTargetPlanet = null;
        }
    }
}

function checkPortalInteraction() {
    // Create a simple collision box for the player
    const playerCollider = new THREE.Box3().setFromCenterAndSize(
        player.position,
        new THREE.Vector3(2, 4, 2) // Approximate player dimensions
    );
    
    // Check exit portal interaction
    if (exitPortalBox && playerCollider.intersectsBox(exitPortalBox)) {
        // --- Redirect Logic ---
        const playerData = player.getPortalData();
        const currentParams = new URLSearchParams(window.location.search);
        const newParams = new URLSearchParams();

        newParams.append('portal', 'true');
        newParams.append('ref', window.location.host + window.location.pathname);

        // Add player data
        for (const key in playerData) {
            newParams.append(key, playerData[key]);
        }

        // Keep other relevant parameters (if any)
        for (const [key, value] of currentParams) {
            if (!newParams.has(key) && key !== 'ref' && key !== 'portal') {
                newParams.append(key, value);
            }
        }

        const paramString = newParams.toString();
        window.location.href = 'http://portal.pieter.com' + (paramString ? '?' + paramString : '');
    }
    
    // Check return portal interaction
    if (returnPortalBox && playerCollider.intersectsBox(returnPortalBox)) {
        // Get ref from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const refUrl = urlParams.get('ref');
        if (refUrl) {
            // Add https if not present
            let url = refUrl;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // Forward all current parameters except 'ref'
            const currentParams = new URLSearchParams(window.location.search);
            const newParams = new URLSearchParams();
            
            // Add player data
            const playerData = player.getPortalData();
            for (const key in playerData) {
                newParams.append(key, playerData[key]);
            }
            
            // Keep portal flag
            newParams.append('portal', 'true');
            
            // Keep other relevant parameters
            for (const [key, value] of currentParams) {
                if (!newParams.has(key) && key !== 'ref') {
                    newParams.append(key, value);
                }
            }
            
            const paramString = newParams.toString();
            window.location.href = url + (paramString ? '?' + paramString : '');
        }
    }
}

function updateUI() {
    if (!player) return;

    healthBarFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    energyBarFill.style.width = `${(player.energy / player.maxEnergy) * 100}%`;
    currencyAmount.textContent = player.currency;

    // TODO: Implementare minimappa
}

function showPlanetInfo(planet) {
    planetName.textContent = planet.name;
    planetStatus.textContent = `Status: ${planet.isConquered ? 'Conquered by ' + planet.conqueredBy : 'Unconquered'}`;
    planetDefense.textContent = planet.defense;
    conquerButton.disabled = planet.isConquered;
    planetInfoPanel.classList.remove('hidden');
}

function hidePlanetInfo() {
    planetInfoPanel.classList.add('hidden');
}

// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (!controls.isLocked) return;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (!player.isFlying) {
                player.toggleFlight();
                moveUp = true; // Salto iniziale per decollare
                setTimeout(() => moveUp = false, 200); // Ferma la salita iniziale dopo un po'
            } else {
                moveUp = true;
            }
            break;
        case 'ShiftLeft':
        case 'KeyC': // Usa C per scendere in volo
             if (player.isFlying) {
                 moveDown = true;
             }
            break;
        // NUOVI CONTROLLI PER MODALITÀ DI GIOCO
        case 'Digit1': // Tasto 1 - Modalità spazio
            switchGameMode('space');
            break;
        case 'Digit2': // Tasto 2 - Modalità pianeta
            // Solo se c'è un pianeta target
            if (currentTargetPlanet) {
                switchGameMode('planet');
            }
            break;
        case 'Digit3': // Tasto 3 - Modalità combattimento spaziale
            switchGameMode('space-combat');
            break;
        case 'Digit4': // Tasto 4 - Modalità combattimento terrestre
            // Solo se siamo in modalità pianeta
            if (gameMode === 'planet') {
                switchGameMode('ground-combat');
            }
            break;
        case 'KeyM': // Tasto M - Cambia modalità ciclicamente
            if (gameMode === 'space') {
                switchGameMode('planet');
            } else if (gameMode === 'planet') {
                switchGameMode('ground-combat');
            } else if (gameMode === 'ground-combat') {
                switchGameMode('space-combat');
            } else {
                switchGameMode('space');
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'Space':
             moveUp = false;
            break;
        case 'ShiftLeft':
        case 'KeyC':
             moveDown = false;
            break;
    }
}

function onMouseDown(event) {
    if (!controls.isLocked || !player) return;

    const attackDirection = new THREE.Vector3();
    camera.getWorldDirection(attackDirection);

    let attackData = null;
    if (event.button === 0) { // Tasto sinistro - Attacco normale
        attackData = player.attackEnergy(attackDirection);
    } else if (event.button === 2) { // Tasto destro - Attacco speciale
        attackData = player.attackSpecial(attackDirection);
    }

    if (attackData) {
        createProjectile(attackData);
    }
}

// --- Game Logic Functions ---
function createProjectile(data) {
    // Cerca un proiettile disponibile nel pool
    let projectile = null;
    let projectileType = 'normal';
    
    if (data.type === 'energyWave') {
        projectileType = 'energy';
    } else if (data.type === 'laserEyes') {
        projectileType = 'laser';
    }
    
    // Trova un proiettile non utilizzato nel pool
    for (let i = 0; i < projectilePool.length; i++) {
        const poolItem = projectilePool[i][projectileType];
        if (!poolItem.inUse) {
            projectile = poolItem;
            break;
        }
    }
    
    // Se non ci sono proiettili disponibili, non ne creiamo di nuovi
    if (!projectile) {
        console.warn('Limite di proiettili raggiunto');
        return;
    }
    
    // Configura il proiettile
    const projectileMesh = projectile.mesh;
    projectileMesh.visible = true;
    projectileMesh.position.copy(data.origin).addScaledVector(data.direction, 2);
    projectileMesh.material.color.set(data.color);
    
    // Scala il proiettile in base al tipo
    if (projectileType === 'energy') {
        projectileMesh.scale.setScalar(data.width);
    } else if (projectileType === 'laser') {
        projectileMesh.scale.set(data.width, data.range, data.width);
        
        // Orienta il cilindro del laser
        const targetPosition = new THREE.Vector3().copy(data.origin).addScaledVector(data.direction, data.range);
        projectileMesh.lookAt(targetPosition);
        projectileMesh.rotateX(Math.PI / 2);
        projectileMesh.position.addScaledVector(data.direction, data.range / 2);
    } else {
        projectileMesh.scale.setScalar(1);
    }
    
    // Marca come in uso
    projectile.inUse = true;
    
    // Aggiungi all'array dei proiettili attivi
    activeProjectiles.push({
        poolItem: projectile,
        mesh: projectileMesh,
        direction: data.direction,
        speed: data.speed,
        power: data.power,
        range: data.range,
        distanceTraveled: 0,
        type: data.type,
        isEnemyProjectile: data.isEnemyProjectile || false
    });
    
    // Riproduci suono appropriato
    if (data.isEnemyProjectile) {
        playSound('shoot', 0.3); // Volume più basso per proiettili nemici
    } else {
        // Volume basato sul tipo di attacco
        const volume = data.type === 'energyWave' ? 0.8 : 
                      (data.type === 'laserEyes' ? 0.6 : 0.4);
        playSound('shoot', volume);
    }
}

function attemptConquerPlanet() {
    if (currentTargetPlanet && player) {
        const result = universeGenerator.conquerPlanet(currentTargetPlanet, player.race, player.attackPower);
        console.log(result.message); // Mostra messaggio in console per ora

        if (result.success) {
            player.currency += result.resources;
            player.addConqueredPlanet(currentTargetPlanet);
            showPlanetInfo(currentTargetPlanet); // Aggiorna UI
            updatePlanetVisuals(currentTargetPlanet); // Cambia aspetto pianeta?

            // --- Rimuovi i nemici dal pianeta conquistato ---
            for (let i = activeEnemies.length - 1; i >= 0; i--) {
                const enemy = activeEnemies[i];
                if (enemy.targetPlanet && enemy.targetPlanet.id === currentTargetPlanet.id) {
                    enemy.isActive = false; // Segna come inattivo per la rimozione nel ciclo animate
                    enemy.removeFromScene(scene); // Rimuovi subito la mesh
                    activeEnemies.splice(i, 1); // Rimuovi dall'array
                }
            }
            // -------------------------------------------------
            
            // NUOVO: Passa alla modalità pianeta dopo la conquista
            switchGameMode('planet');
        } else {
            // Se fallisce la conquista pacifica, passa al combattimento terrestre
            switchGameMode('ground-combat');
        }
        // TODO: Mostrare il messaggio all'utente in modo più visibile
    }
}

function updatePlanetVisuals(planet) {
    const mesh = planetMeshes.find(m => m.userData.planetData.id === planet.id);
    if (mesh) {
        // Esempio: Aggiungi un'aura al pianeta conquistato
        const conquestAuraGeo = new THREE.SphereGeometry(planet.size * 2 + 1, 32, 32);
        const conquestAuraMat = new THREE.MeshBasicMaterial({ 
            color: player.race === 'saiyan' ? 0x0000ff : 0xff0000, 
            transparent: true, 
            opacity: 0.3, 
            side: THREE.BackSide 
        });
        const aura = new THREE.Mesh(conquestAuraGeo, conquestAuraMat);
        mesh.add(aura); // Aggiungi l'aura come figlio della mesh del pianeta
    }
}

// --- Visual Effects ---
function createHitEffect(position, color = 0xffff00) {
    const effectDuration = 0.2; // Secondi
    const geometry = new THREE.SphereGeometry(0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.8 
    });
    const effectMesh = new THREE.Mesh(geometry, material);
    effectMesh.position.copy(position);
    scene.add(effectMesh);

    // Anima l'effetto (dissolvenza)
    let elapsed = 0;
    function animateEffect(time) {
        elapsed += time;
        if (elapsed < effectDuration) {
            effectMesh.scale.multiplyScalar(1 + 3 * time); // Espandi rapidamente
            effectMesh.material.opacity = 0.8 * (1 - elapsed / effectDuration);
            requestAnimationFrame(animateEffect);
        } else {
            scene.remove(effectMesh);
        }
    }
    requestAnimationFrame(animateEffect);
}

function createExplosionEffect(position, scale = 1, color = 0xff8800) {
    const effectDuration = 0.5; // Secondi
    const particles = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const material = new THREE.PointsMaterial({ 
        color: color, 
        size: 0.5 * scale,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < particles; i++) {
        positions.push(0, 0, 0); // Inizia tutte le particelle al centro
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.position.copy(position);
    scene.add(particleSystem);

    // Anima l'esplosione
    const initialVelocities = [];
    for (let i = 0; i < particles; i++) {
        initialVelocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.random() * 10 * scale));
    }

    let elapsed = 0;
    function animateExplosion(delta) {
        elapsed += delta;
        if (elapsed < effectDuration) {
            const posAttribute = particleSystem.geometry.attributes.position;
            for (let i = 0; i < particles; i++) {
                posAttribute.setXYZ(
                    i,
                    posAttribute.getX(i) + initialVelocities[i].x * delta,
                    posAttribute.getY(i) + initialVelocities[i].y * delta,
                    posAttribute.getZ(i) + initialVelocities[i].z * delta
                );
            }
            posAttribute.needsUpdate = true;
            particleSystem.material.opacity = 1.0 * (1 - elapsed / effectDuration);
            requestAnimationFrame(animateExplosion);
        } else {
            scene.remove(particleSystem);
        }
    }
    requestAnimationFrame(animateExplosion);
}

// --- Player Death Handling ---
function handlePlayerDeath() {
    if (isGameOver) return; // Evita esecuzioni multiple
    
    console.log("GAME OVER!");
    isGameOver = true;
    controls.unlock(); // Sblocca il puntatore
    closeUpgradesScreen(); // Chiudi schermate UI
    closeLegendScreen();
    
    // Mostra la schermata di Game Over
    gameOverScreen.classList.remove('hidden');
    
    // Stoppa l'animazione principale o impedisci aggiornamenti
    // (Il check `if (!player || !controls.isLocked)` in animate() dovrebbe bastare se isGameOver è true)
}

function restartGame() {
    // Ricarica semplicemente la pagina per riavviare
    // Questo è il modo più semplice per resettare tutto lo stato
    location.reload(); 
}

// --- Upgrades Screen Logic ---
function openUpgradesScreen() {
    if (!player) return;
    controls.unlock(); // Sblocca il puntatore per interagire con la UI
    closeLegendScreen(); // Chiudi la legenda se aperta
    upgradesScreen.classList.remove('hidden');
    updateUpgradesUI();
}

function closeUpgradesScreen() {
    upgradesScreen.classList.add('hidden');
    // Non bloccare automaticamente il puntatore, l'utente dovrà cliccare di nuovo
}

function updateUpgradesUI() {
    if (!player) return;
    
    upgradeButtons.forEach(button => {
        const item = button.closest('.upgrade-item');
        const stat = item.getAttribute('data-stat');
        const levelSpan = item.querySelector('.upgrade-level');
        const costSpan = item.querySelector('.upgrade-cost');
        
        const currentLevel = player.upgrades[stat];
        const maxLevel = 10;
        const baseCost = 100;
        const cost = baseCost * Math.pow(2, currentLevel); // Costo esponenziale
        
        levelSpan.textContent = currentLevel;
        costSpan.textContent = cost;
        
        if (currentLevel >= maxLevel) {
            button.textContent = 'MAX';
            button.disabled = true;
            costSpan.textContent = '--';
        } else if (player.currency < cost) {
            button.textContent = 'POTENZIA';
            button.disabled = true;
        } else {
            button.textContent = 'POTENZIA';
            button.disabled = false;
        }
    });
}

function attemptUpgrade(stat) {
    if (!player) return;
    
    const currentLevel = player.upgrades[stat];
    const baseCost = 100;
    const cost = baseCost * Math.pow(2, currentLevel);
    
    const result = player.upgrade(stat, cost);
    
    if (result.success) {
        console.log(result.message);
        updateUpgradesUI(); // Aggiorna UI dopo il potenziamento
        updateUI(); // Aggiorna anche le barre e la valuta principale
    } else {
        console.warn(result.message); // Mostra errore in console
        // TODO: Mostrare messaggio di errore all'utente
    }
}

// --- Legend Screen Logic ---
function openLegendScreen() {
    controls.unlock(); // Sblocca il puntatore per interagire con la UI
    closeUpgradesScreen(); // Chiudi potenziamenti se aperti
    legendScreen.classList.remove('hidden');
}

function closeLegendScreen() {
    legendScreen.classList.add('hidden');
    // Non bloccare automaticamente il puntatore
}

// --- Game Mode Logic ---
function switchGameMode(newMode) {
    // Disattiva tutti i sistemi
    deactivateAllSystems();
    
    // Imposta la nuova modalità
    gameMode = newMode;
    
    // Attiva i sistemi appropriati
    switch (newMode) {
        case 'space':
            setupSpaceMode();
            break;
            
        case 'planet':
            setupPlanetMode();
            break;
            
        case 'space-combat':
            setupSpaceCombatMode();
            break;
            
        case 'ground-combat':
            setupGroundCombatMode();
            break;
    }
    
    console.log(`Game mode switched to: ${newMode}`);
}

// NUOVA FUNZIONE: Disattiva tutti i sistemi
function deactivateAllSystems() {
    if (solarSystem) solarSystem.active = false;
    if (terrainGenerator) terrainGenerator.active = false;
    if (spaceCombat) spaceCombat.deactivate();
    if (groundCombat) groundCombat.deactivate();
}

// NUOVA FUNZIONE: Configura la modalità spazio
function setupSpaceMode() {
    if (solarSystem) solarSystem.active = true;
    // Altre configurazioni...
}

// NUOVA FUNZIONE: Configura la modalità pianeta
function setupPlanetMode() {
    if (terrainGenerator) {
        // Configura il tipo di pianeta in base a currentTargetPlanet
        if (currentTargetPlanet) {
            terrainGenerator.setPlanetType(getPlanetTypeForTerrain(currentTargetPlanet));
        } else {
            terrainGenerator.setPlanetType('earth'); // Tipo di default
        }
        terrainGenerator.initialize();
        terrainGenerator.active = true;
    }
    // Altre configurazioni...
}

// NUOVA FUNZIONE: Configura la modalità combattimento spaziale
function setupSpaceCombatMode() {
    if (spaceCombat) {
        // Assicurati che player sia impostato correttamente
        if (player && player.isObject3D) {
            spaceCombat.player = player;
        } else if (!spaceCombat.player || !spaceCombat.player.isObject3D) {
            // Crea un player temporaneo se necessario
            const tempPlayer = new THREE.Group();
            tempPlayer.position.copy(player ? player.position : new THREE.Vector3());
            tempPlayer.userData = {
                health: 100,
                maxHealth: 100,
                attackPower: 10
            };
            tempPlayer.takeDamage = function(damage) {
                this.userData.health = Math.max(0, this.userData.health - damage);
                return this.userData.health > 0;
            };
            
            spaceCombat.player = tempPlayer;
            scene.add(tempPlayer);
        }
        
        // Passa la posizione del giocatore all'inizializzazione
        const playerPosition = player ? player.position.clone() : new THREE.Vector3();
        spaceCombat.initialize(playerPosition);
        spaceCombat.activate();
    }
    // Altre configurazioni...
}

// NUOVA FUNZIONE: Configura la modalità combattimento terrestre
function setupGroundCombatMode() {
    if (groundCombat) {
        groundCombat.initialize();
        groundCombat.activate();
        
        // Collega il terreno al sistema di fisica
        if (terrainGenerator) {
            groundCombat.physics.setTerrain(terrainGenerator);
        }
    }
    // Altre configurazioni...
}

// NUOVA FUNZIONE: Determina il tipo di pianeta per il generatore di terreno
function getPlanetTypeForTerrain(planet) {
    // Mappa il tipo di pianeta ai tipi supportati dal generatore di terreno
    if (!planet) return 'earth';
    
    // Usa il colore o altre proprietà del pianeta per determinare il tipo
    const color = new THREE.Color(planet.color);
    
    if (color.r > 0.6 && color.g < 0.4) return 'mars'; // Rosso = Marte
    if (color.b > 0.6 && color.g < 0.4) return 'ice'; // Blu = Ghiaccio
    if (color.g > 0.6 && color.r < 0.4) return 'alien'; // Verde = Alieno
    if (color.r > 0.7 && color.g > 0.7) return 'desert'; // Giallo = Deserto
    
    return 'earth'; // Default
}

// NUOVA FUNZIONE: Inizializza i moduli integrati
function initializeIntegratedModules() {
    // Opzioni per i moduli
    const gameOptions = {
        debugMode: false,
        solarSystem: {
            starCount: 1000,
            showLabels: true
        },
        terrain: {
            chunkSize: 32,
            heightScale: 20,
            resolution: 64
        },
        spaceCombat: {
            difficulty: 1
        },
        groundCombat: {
            difficulty: 1
        }
    };
    
    // Inizializza i moduli singolarmente
    solarSystem = new SolarSystem(scene, gameOptions.solarSystem);
    terrainGenerator = new TerrainGenerator(scene, gameOptions.terrain);
    spaceCombat = new SpaceCombat(scene, camera, player);
    groundCombat = new GroundCombat(scene, camera, gameOptions.groundCombat);
    
    // Inizializza il sistema di gestione centrale
    gameIntegration = new GameIntegration(gameOptions);
    
    // Collega moduli esistenti e nuovi moduli
    linkLegacyAndNewModules();
    
    console.log('Integrated modules initialized');
}

// NUOVA FUNZIONE: Collega i moduli esistenti con quelli nuovi
function linkLegacyAndNewModules() {
    // Trasferisci i dati dal sistema universo esistente al nuovo sistema solare
    if (universeGenerator && universeGenerator.systems) {
        solarSystem.importLegacyData(universeGenerator.systems, planetMeshes);
    }
    
    // Aggiorna le configurazioni basate sul giocatore
    if (player) {
        spaceCombat.setPlayerStats(player.attackPower, player.maxHealth);
        groundCombat.setPlayerStats(player.attackPower, player.maxHealth);
    }
}

// --- Initialize Renderer Effects ---
function initializeRendererEffects() {
    // Implementa un effetto bloom per far brillare stelle e oggetti luminosi
    const renderScene = new RenderPass(scene, camera);
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,   // strength
        0.4,   // radius
        0.85   // threshold
    );
    
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    
    return composer;
}

// Funzione per aggiornare gli effetti flare delle stelle
function updateStarFlares() {
    // Trova tutti gli oggetti marcati come flare e fa in modo che guardino verso la camera
    scene.traverse(object => {
        if (object.userData && object.userData.isFlare) {
            object.lookAt(camera.position);
        }
    });
}

// --- Frustum Culling ---
function updateFrustumCulling() {
    // Crea un frustum basato sulla camera
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    // Controlla i pianeti
    planetMeshes.forEach(planet => {
        // Per i LOD, Three.js gestisce automaticamente quale livello mostrare
        // Ma possiamo disabilitare completamente quelli fuori dal frustum
        if (planet instanceof THREE.LOD) {
            const planetPosition = planet.position;
            const planetSize = planet.scale.x;
            const boundingSphere = new THREE.Sphere(planetPosition, planetSize * 1.5);
            
            planet.visible = frustum.intersectsSphere(boundingSphere);
        }
    });
    
    // Controlla le stelle - disabilita quelle fuori dal frustum
    starMeshes.forEach(star => {
        const starPosition = star.position;
        const starSize = star.scale.x;
        const boundingSphere = new THREE.Sphere(starPosition, starSize);
        
        star.visible = frustum.intersectsSphere(boundingSphere);
    });
    
    // Controlla i nemici - disabilita quelli fuori dal frustum
    activeEnemies.forEach(enemy => {
        if (enemy.mesh) {
            const enemyPosition = enemy.mesh.position;
            const boundingSphere = new THREE.Sphere(enemyPosition, 10); // Approssimazione
            
            enemy.mesh.visible = frustum.intersectsSphere(boundingSphere);
        }
    });
}

// --- Collision Optimization ---
function optimizedCollisionCheck(object1, object2, cacheKey) {
    // Usa la cache se disponibile e ancora valida
    if (collisionCache.has(cacheKey)) {
        const cachedResult = collisionCache.get(cacheKey);
        // Usa il risultato in cache se è recente (meno di 100ms)
        if (performance.now() - cachedResult.timestamp < 100) {
            return cachedResult.intersects;
        }
    }
    
    // Calcola le bounding box
    const box1 = new THREE.Box3().setFromObject(object1);
    const box2 = new THREE.Box3().setFromObject(object2);
    
    // Controlla intersezione
    const intersects = box1.intersectsBox(box2);
    
    // Aggiorna la cache
    collisionCache.set(cacheKey, {
        intersects: intersects,
        timestamp: performance.now()
    });
    
    return intersects;
} 