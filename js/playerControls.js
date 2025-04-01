import { KEYS } from './constants.js';
import * as THREE from 'three';

/**
 * Modulo per gestire i controlli del giocatore
 * Si occupa di raccogliere e processare gli input da tastiera e mouse
 */

// Stato del movimento
const movementState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
};

// Riferimenti ai controlli e alla telecamera
let controls = null;
let camera = null;

/**
 * Inizializza i controlli del giocatore
 * @param {THREE.PerspectiveCamera} playerCamera - La camera per il controllo in prima persona
 * @param {HTMLElement} element - L'elemento DOM su cui applicare i controlli
 * @returns {Promise<PointerLockControls>} I controlli inizializzati
 */
export function initializeControls(playerCamera, element) {
    if (!playerCamera) {
        console.error('Camera non fornita per i controlli');
        return Promise.reject(new Error('Camera non fornita'));
    }
    
    console.log("Initializing player controls with camera:", playerCamera);
    camera = playerCamera;
    
    // Rimuovi eventuali listener esistenti in caso di reinizializzazione
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousedown', onMouseDown);
    
    // Stampa KEYS per debug
    console.log("Control keys setup:", KEYS);
    
    // Importa i controlli solo quando necessario per evitare dipendenze circolari
    return import('three/addons/controls/PointerLockControls.js')
        .then(({ PointerLockControls }) => {
            controls = new PointerLockControls(camera, element);
            
            // Imposta listener eventi
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            document.addEventListener('mousedown', onMouseDown);
            
            console.log("Player controls initialized, event listeners added");
            
            // Test degli event listener
            const testEvent = new KeyboardEvent('keydown', { code: 'KeyW' });
            onKeyDown(testEvent);
            
            return controls;
        })
        .catch(error => {
            console.error("Errore caricamento PointerLockControls:", error);
            return null;
        });
}

/**
 * Gestisce l'evento keydown
 * @param {KeyboardEvent} event - L'evento della tastiera
 */
function onKeyDown(event) {
    console.log("Key pressed:", event.code, "Lock status:", controls?.isLocked);
    
    if (!controls?.isLocked) {
        console.log("Input ignored - pointer not locked");
        return;
    }
    
    // Controlli di movimento
    if (KEYS.FORWARD.includes(event.code)) {
        console.log("Moving forward");
        movementState.forward = true;
    } else if (KEYS.BACKWARD.includes(event.code)) {
        console.log("Moving backward");
        movementState.backward = true;
    } else if (KEYS.LEFT.includes(event.code)) {
        console.log("Moving left");
        movementState.left = true;
    } else if (KEYS.RIGHT.includes(event.code)) {
        console.log("Moving right");
        movementState.right = true;
    } else if (KEYS.UP.includes(event.code)) {
        console.log("Moving up");
        movementState.up = true;
    } else if (KEYS.DOWN.includes(event.code)) {
        console.log("Moving down");
        movementState.down = true;
    }
}

/**
 * Gestisce l'evento keyup
 * @param {KeyboardEvent} event - L'evento della tastiera
 */
function onKeyUp(event) {
    // Nota: Rimuoviamo il check su isLocked per assicurarci 
    // che i tasti vengano rilasciati anche se il puntatore è sbloccato
    
    // Controlli di movimento
    if (KEYS.FORWARD.includes(event.code)) {
        console.log("Stop forward");
        movementState.forward = false;
    } else if (KEYS.BACKWARD.includes(event.code)) {
        console.log("Stop backward");
        movementState.backward = false;
    } else if (KEYS.LEFT.includes(event.code)) {
        console.log("Stop left");
        movementState.left = false;
    } else if (KEYS.RIGHT.includes(event.code)) {
        console.log("Stop right");
        movementState.right = false;
    } else if (KEYS.UP.includes(event.code)) {
        console.log("Stop up");
        movementState.up = false;
    } else if (KEYS.DOWN.includes(event.code)) {
        console.log("Stop down");
        movementState.down = false;
    }
}

/**
 * Gestisce l'evento mousedown
 * @param {MouseEvent} event - L'evento del mouse
 */
function onMouseDown(event) {
    if (!controls?.isLocked) return;
    
    // Calcola la direzione dell'attacco basata sulla direzione della camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Questi eventi saranno intercettati e gestiti dal main
    // tramite callback o event emitter nel sistema completo
    const attackEvent = new CustomEvent('player-attack', {
        detail: {
            button: event.button,
            direction: direction,
            timestamp: performance.now()
        }
    });
    
    document.dispatchEvent(attackEvent);
}

/**
 * Ottiene lo stato attuale dei movimenti
 * @returns {Object} Lo stato dei movimenti
 */
export function getMovementState() {
    return { ...movementState };
}

/**
 * Ottiene i controlli
 * @returns {PointerLockControls} I controlli
 */
export function getControls() {
    return controls;
}

/**
 * Resetta lo stato dei movimenti
 */
export function resetMovementState() {
    movementState.forward = false;
    movementState.backward = false;
    movementState.left = false;
    movementState.right = false;
    movementState.up = false;
    movementState.down = false;
}

/**
 * Disattiva e rimuove i listener dei controlli
 */
export function disposeControls() {
    if (controls) {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousedown', onMouseDown);
        controls = null;
    }
}

/**
 * Imposta la modalità di controllo
 * @param {string} mode - La modalità di controllo ('normal', 'flying', 'combat')
 */
export function setMode(mode) {
    switch(mode) {
        case 'normal':
            // Modalità normale: movimento orizzontale
            movementState.up = false;
            movementState.down = false;
            break;
            
        case 'flying':
            // Modalità volo: movimento completo 3D
            // Non serve fare nulla, tutti i movimenti sono già abilitati
            break;
            
        case 'combat':
            // Modalità combattimento: movimento limitato
            movementState.up = false;
            movementState.down = false;
            // Qui potresti anche limitare la velocità o altri parametri
            break;
            
        default:
            console.warn(`Modalità controllo non riconosciuta: ${mode}`);
    }
} 