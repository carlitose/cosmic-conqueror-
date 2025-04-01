import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
// SimplexNoise viene importato altrove
// import * as SimplexNoise from 'simplex-noise';
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
}

// --- Create Target Indicator Arrow ---
function createTargetIndicator() {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.5);
    arrowShape.lineTo(0.5, -0.5);
    arrowShape.lineTo(0.2, -0.5);
    arrowShape.lineTo(0.2, -1.5);
    arrowShape.lineTo(-0.2, -1.5);
    arrowShape.lineTo(-0.2, -0.5);
    arrowShape.lineTo(-0.5, -0.5);
    arrowShape.closePath();

    const extrudeSettings = { depth: 0.2, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x005500 });
    
    targetIndicatorArrow = new THREE.Mesh(geometry, material);
    targetIndicatorArrow.scale.set(5, 5, 5); // Rendi la freccia più grande
    targetIndicatorArrow.visible = false; // Inizia nascosta
    scene.add(targetIndicatorArrow);
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

    const planetGeometry = new THREE.SphereGeometry(1, 32, 32); 
    const starGeometry = new THREE.SphereGeometry(1, 32, 32);

    // Crea stelle
    systems.forEach(system => {
        const starMaterial = new THREE.MeshBasicMaterial({ color: system.starColor });
        const starMesh = new THREE.Mesh(starGeometry, starMaterial);
        starMesh.position.copy(system.position);
        starMesh.scale.setScalar(system.starSize * 5); // Scala per visibilità
        starMesh.userData.systemData = system; // Salva i dati del sistema nella mesh
        scene.add(starMesh);
        starMeshes.push(starMesh);
    });

    // Crea pianeti e le loro difese
    planets.forEach(planetData => {
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: planetData.color,
            roughness: 0.8,
            metalness: 0.2
        });
        const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
        planetMesh.position.copy(planetData.position);
        planetMesh.scale.setScalar(planetData.size * 2); // Scala per visibilità
        planetMesh.castShadow = true;
        planetMesh.receiveShadow = true;
        planetMesh.userData.planetData = planetData; 
        scene.add(planetMesh);
        planetMeshes.push(planetMesh);
        
        // --- Genera Difese Planetarie ---
        if (!planetData.isConquered) {
            const numDefenses = Math.floor(planetData.defense / 10); // Numero difese basato sulla forza
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

// --- Portal Creation (Simplified for now) ---
function createExitPortal() {
    // Create portal group
    exitPortalGroup = new THREE.Group();
    exitPortalGroup.position.set(0, 10, -50); // Posizione fissa per ora
    
    // Create portal effect
    const exitPortalGeometry = new THREE.TorusGeometry(10, 1, 16, 100);
    const exitPortalMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
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
        emissive: 0xff0000,
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
        renderer.render(scene, camera);
        return; 
    }

    // --- Update Player --- 
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    player.update(delta, moveForward, moveBackward, moveLeft, moveRight, moveUp, moveDown, cameraDirection);
    controls.getObject().position.copy(player.position);

    // --- Update based on game mode ---
    switch (gameMode) {
        case 'space':
            // --- Update Universe ---
            universeGenerator.updatePlanetPositions(delta * 10); // Accelera il movimento orbitale per visibilità
            planetMeshes.forEach(mesh => {
                mesh.position.copy(mesh.userData.planetData.position);
                mesh.rotation.y += 0.01 * delta; // Rotazione pianeti su se stessi
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

    // --- Update Enemies --- (solo in modalità appropriate)
    if (gameMode === 'space' || gameMode === 'space-combat') {
        for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const enemy = activeEnemies[i];
            if (enemy.isActive) {
                // enemy.update() ora ritorna i dati del proiettile se spara, altrimenti null.
                const enemyProjectileData = enemy.update(delta, player); 
                if (enemyProjectileData) {
                    createProjectile(enemyProjectileData); // Crea proiettile nemico
                }
            } else {
                // Rimuovi nemico inattivo (distrutto)
                enemy.removeFromScene(scene);
                activeEnemies.splice(i, 1);
            }
        }
    }

    // --- Update Projectiles ---
    updateProjectiles(delta);

    // --- Update Target Indicator ---
    updateTargetIndicator(); // <-- Nuovo: Aggiorna posizione/rotazione freccia

    // --- Check Interactions ---
    checkPlanetInteraction();
    checkPortalInteraction();

    // --- Update UI ---
    updateUI();

    // --- Update gameIntegration ---
    if (gameIntegration) {
        gameIntegration.update(delta);
    }

    // --- Render Scene ---
    renderer.render(scene, camera);
    
    prevTime = time;
}

// --- Update Target Indicator ---
function updateTargetIndicator() {
    if (!player || !targetIndicatorArrow) return;

    let targetPosition = null;

    // Se c'è un pianeta selezionato (in range), punta a quello
    if (currentTargetPlanet) {
        targetPosition = currentTargetPlanet.position;
    } else {
        // Altrimenti, trova il pianeta più vicino (ma non troppo vicino)
        const result = universeGenerator.findNearestPlanet(player.position, 5000); // Cerca più lontano
        if (result.planet && player.position.distanceTo(result.planet.position) > 30) { // Non mostrare se troppo vicini
            targetPosition = result.planet.position;
        } 
    }

    if (targetPosition) {
        targetIndicatorArrow.visible = true;

        // Posiziona la freccia leggermente davanti e sopra la camera
        const offsetDistance = 15;
        const indicatorPosition = camera.position.clone().add( 
            new THREE.Vector3(0, 0, -offsetDistance).applyQuaternion(camera.quaternion)
        );
         indicatorPosition.y += 2; // Alzala un po'
        targetIndicatorArrow.position.copy(indicatorPosition);

        // Orienta la freccia verso il target
        targetIndicatorArrow.lookAt(targetPosition);
        
        // Ruota per puntare correttamente (la geometria extrude potrebbe essere orientata su Y)
        targetIndicatorArrow.rotateX(Math.PI / 2); 

    } else {
        targetIndicatorArrow.visible = false;
    }
}

// --- Update Functions ---
function updateProjectiles(delta) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const projectile = activeProjectiles[i];
        const moveDistance = projectile.speed * delta;
        projectile.mesh.position.addScaledVector(projectile.direction, moveDistance);
        projectile.distanceTraveled += moveDistance;

        let hit = false;

        // --- Collision Detection ---
        if (projectile.isEnemyProjectile) {
            // Proiettile nemico: controlla collisione con il giocatore
            const playerCollider = new THREE.Box3().setFromCenterAndSize(player.position, new THREE.Vector3(2, 4, 2));
            const projectileCollider = new THREE.Box3().setFromObject(projectile.mesh);

            if (playerCollider.intersectsBox(projectileCollider)) {
                console.log("Player hit!");
                const playerAlive = player.takeDamage(projectile.power);
                hit = true;
                createHitEffect(projectile.mesh.position, 0xff0000);
                if (!playerAlive) {
                    handlePlayerDeath(); // <-- Chiama qui se il giocatore muore
                }
            }
        } else {
            // Proiettile giocatore: controlla collisione con i nemici
            for (let j = activeEnemies.length - 1; j >= 0; j--) {
                const enemy = activeEnemies[j];
                if (!enemy.isActive || !enemy.mesh) continue;

                const enemyCollider = new THREE.Box3().setFromObject(enemy.mesh);
                const projectileCollider = new THREE.Box3().setFromObject(projectile.mesh);

                if (enemyCollider.intersectsBox(projectileCollider)) {
                    console.log("Enemy hit!");
                    const enemyHitPosition = projectile.mesh.position.clone(); // Salva posizione impatto
                    const enemyMeshScale = enemy.mesh.scale.x; // Per scalare l'esplosione
                    const enemyStillAlive = enemy.takeDamage(projectile.power);
                    hit = true;
                    createHitEffect(enemyHitPosition, 0xffff00); // Effetto colpo giallo

                    if (!enemyStillAlive) {
                         // Il nemico è stato distrutto nel metodo takeDamage, 
                         // verrà rimosso nel ciclo di update dei nemici.
                         // --- Assegna Ricompense ---
                         const expGained = enemy.type === 'drone' ? 10 : 25; // Più exp per le torrette
                         const currencyGained = enemy.type === 'drone' ? 5 : 10;
                         player.gainExperience(expGained);
                         player.currency += currencyGained;
                         console.log(`Enemy destroyed! Gained ${expGained} EXP and ${currencyGained} currency.`);
                         createExplosionEffect(enemyHitPosition, enemyMeshScale); // Effetto esplosione
                         // TODO: Mostrare feedback visivo/sonoro per la ricompensa
                         // -------------------------
                    }
                    break; // Un proiettile colpisce solo un nemico
                }
            }
        }

        // Rimuovi proiettile se ha superato la portata o ha colpito qualcosa
        if (hit || projectile.distanceTraveled >= projectile.range) {
            scene.remove(projectile.mesh);
            activeProjectiles.splice(i, 1);
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
    let geometry, material;
    let scale = 1;

    if (data.type === 'energyWave') {
        geometry = new THREE.SphereGeometry(data.width * 0.5, 16, 8);
        material = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.8 });
        scale = data.width;
    } else if (data.type === 'laserEyes') {
        geometry = new THREE.CylinderGeometry(0.1 * data.width, 0.1 * data.width, data.range, 8);
        material = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.9 });
        // Il laser viene gestito diversamente, forse con un Raycaster o una linea visiva
        // Per ora, simuliamo con un proiettile molto veloce
    } else { // Attacco energetico normale
        geometry = new THREE.SphereGeometry(0.5, 8, 8);
        material = new THREE.MeshBasicMaterial({ color: data.color });
    }

    const projectileMesh = new THREE.Mesh(geometry, material);
    projectileMesh.position.copy(data.origin).addScaledVector(data.direction, 2); // Parte leggermente davanti al giocatore
    projectileMesh.scale.setScalar(scale);
    
    // Orienta il cilindro del laser
    if (data.type === 'laserEyes') {
        const targetPosition = new THREE.Vector3().copy(data.origin).addScaledVector(data.direction, data.range);
        projectileMesh.lookAt(targetPosition);
        projectileMesh.rotateX(Math.PI / 2); // Correggi orientamento cilindro
        projectileMesh.position.addScaledVector(data.direction, data.range / 2); // Posiziona al centro della traiettoria
    }

    scene.add(projectileMesh);

    activeProjectiles.push({
        mesh: projectileMesh,
        direction: data.direction,
        speed: data.speed,
        power: data.power,
        range: data.range,
        distanceTraveled: 0,
        type: data.type
    });
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
        spaceCombat.initialize(player.position.clone());
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
    spaceCombat = new SpaceCombat(scene, camera, gameOptions.spaceCombat);
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