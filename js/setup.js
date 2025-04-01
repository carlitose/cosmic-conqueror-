import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

/**
 * Modulo per la configurazione di base di Three.js
 * Gestisce la creazione e l'inizializzazione di scene, camera, renderer e lighting
 */

// Variabili principali Three.js che saranno accessibili tramite export
let scene, camera, renderer, controls, composer;

/**
 * Inizializza la scena, la camera e il renderer di Three.js
 * @param {HTMLElement} container - Elemento DOM in cui aggiungere il renderer
 * @returns {Object} Oggetto contenente i riferimenti agli elementi creati
 */
export function initializeSetup(container) {
    if (!container) {
        container = document.getElementById('game-container');
        if (!container) {
            console.error("Nessun container valido fornito per il renderer");
            return null;
        }
    }
    
    // --- Scene Setup ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005); // Spazio profondo
    scene.fog = new THREE.FogExp2(0x000005, 0.0005); // Nebbia spaziale

    // --- Camera Setup ---
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
    camera.position.set(0, 5, 10);

    // --- Renderer Setup ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    setupLighting();
    
    // --- Post-processing Effects ---
    composer = initializeRendererEffects();

    // --- Controls Setup (Pointer Lock) ---
    // Nota: Ora usiamo initializeControls da playerControls.js per una gestione più unificata
    // Questo è solo un placeholder per retrocompatibilità
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    // Lasciamo questi eventi base ma i controlli veri vengono inizializzati in GameIntegration
    document.addEventListener('pointerlockchange', () => {
        console.log("Pointer lock change in setup.js, isLocked:", controls.isLocked);
    });

    controls.addEventListener('lock', () => {
        console.log("Pointer locked!");
    });

    controls.addEventListener('unlock', () => {
        console.log("Pointer unlocked!");
    });
    
    // --- Window Resize Handler ---
    window.addEventListener('resize', onWindowResize);
    
    console.log("Scene setup initialized");
    
    return {
        scene,
        camera,
        renderer,
        controls,
        composer
    };
}

/**
 * Aggiunge le luci alla scena
 */
function setupLighting() {
    // Luce ambientale
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Luce solare principale
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(100, 100, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    scene.add(sunLight);
}

/**
 * Inizializza gli effetti del renderer (bloom, ecc.)
 * @returns {EffectComposer} Composer per gli effetti
 */
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

/**
 * Gestisce il ridimensionamento della finestra
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

/**
 * Ottiene la scena corrente
 * @returns {THREE.Scene}
 */
export function getScene() {
    return scene;
}

/**
 * Ottiene la camera corrente
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() {
    return camera;
}

/**
 * Ottiene il renderer corrente
 * @returns {THREE.WebGLRenderer}
 */
export function getRenderer() {
    return renderer;
}

/**
 * Ottiene i controlli correnti
 * @returns {PointerLockControls}
 */
export function getControls() {
    return controls;
}

/**
 * Ottiene il composer per gli effetti
 * @returns {EffectComposer}
 */
export function getComposer() {
    return composer;
}

// Add click event listener for pointer lock
document.getElementById('game-container').addEventListener('click', function() {
    console.log("Game container clicked, requesting pointer lock");
    const controls = getControls();
    if (controls && !controls.isLocked) {
        console.log("Attempting to lock pointer");
        controls.lock();
    }
}); 