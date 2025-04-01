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
 * @returns {PointerLockControls} I controlli inizializzati
 */
export function initializeControls(playerCamera, element) {
    if (!playerCamera) {
        console.error('Camera non fornita per i controlli');
        return null;
    }
    
    camera = playerCamera;
    
    // Importa i controlli solo quando necessario per evitare dipendenze circolari
    return import('three/addons/controls/PointerLockControls.js')
        .then(({ PointerLockControls }) => {
            controls = new PointerLockControls(camera, element);
            
            // Imposta listener eventi
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            document.addEventListener('mousedown', onMouseDown);
            
            console.log("Player controls initialized");
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
    if (!controls?.isLocked) return;
    
    // Controlli di movimento
    if (KEYS.FORWARD.includes(event.code)) {
        movementState.forward = true;
    } else if (KEYS.BACKWARD.includes(event.code)) {
        movementState.backward = true;
    } else if (KEYS.LEFT.includes(event.code)) {
        movementState.left = true;
    } else if (KEYS.RIGHT.includes(event.code)) {
        movementState.right = true;
    } else if (KEYS.UP.includes(event.code)) {
        movementState.up = true;
    } else if (KEYS.DOWN.includes(event.code)) {
        movementState.down = true;
    }
}

/**
 * Gestisce l'evento keyup
 * @param {KeyboardEvent} event - L'evento della tastiera
 */
function onKeyUp(event) {
    // Controlli di movimento
    if (KEYS.FORWARD.includes(event.code)) {
        movementState.forward = false;
    } else if (KEYS.BACKWARD.includes(event.code)) {
        movementState.backward = false;
    } else if (KEYS.LEFT.includes(event.code)) {
        movementState.left = false;
    } else if (KEYS.RIGHT.includes(event.code)) {
        movementState.right = false;
    } else if (KEYS.UP.includes(event.code)) {
        movementState.up = false;
    } else if (KEYS.DOWN.includes(event.code)) {
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