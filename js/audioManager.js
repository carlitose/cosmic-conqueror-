/**
 * Audio Manager
 * Gestisce la riproduzione dell'audio di gioco, il precaricamento e il pool di suoni
 */

// Audio pool per il riutilizzo degli oggetti audio
let audioPool = {};

/**
 * Inizializza il pool di audio con suoni predefiniti
 */
export function initAudioPool() {
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
            createDummyAudio(name, config.instances);
            continue;
        }
        
        let loadedAudio = false;
        
        for (let i = 0; i < config.instances; i++) {
            try {
                const audio = new Audio();
                
                // Aggiungi listener per gestire errori di caricamento
                audio.addEventListener('error', function(e) {
                    console.warn(`Errore caricamento audio ${name}: ${e.target.error ? e.target.error.message : 'Errore sconosciuto'}`);
                    // Inseriremo comunque un oggetto dummy per evitare errori nel gioco
                    if (audioPool[name].length === 0) {
                        createDummyAudio(name, 1);
                    }
                });
                
                audio.preload = 'auto';
                audio.src = config.src;
                
                // Aggiungi al pool
                audioPool[name].push({
                    element: audio,
                    inUse: false
                });
                
                loadedAudio = true;
            } catch (e) {
                console.warn(`Impossibile creare l'audio ${name}:`, e);
            }
        }
        
        // Se non è stato possibile caricare nessun audio, crea un dummy
        if (!loadedAudio) {
            createDummyAudio(name, config.instances);
        }
    }
    
    // Precarica comunque suoni critici, anche se non sono stati creati
    ensureAudioExists('shoot');
    ensureAudioExists('hit');
    ensureAudioExists('explosion');
    
    console.log("Audio pool initialized");
    return audioPool;
}

/**
 * Crea audio dummy che non riproduce suoni ma evita errori
 * @param {string} name - Nome dell'audio
 * @param {number} instances - Numero di istanze da creare
 */
function createDummyAudio(name, instances) {
    console.log(`Creazione audio dummy per ${name}`);
    
    // Se già esiste, non creare nuovi dummy
    if (audioPool[name] && audioPool[name].length > 0) return;
    
    audioPool[name] = [];
    
    for (let i = 0; i < instances; i++) {
        // Creiamo un oggetto con le stesse proprietà di un audio
        const dummyAudio = {
            play: function() { return Promise.resolve(); },
            pause: function() {},
            volume: 1.0,
            currentTime: 0
        };
        
        audioPool[name].push({
            element: dummyAudio,
            inUse: false
        });
    }
}

/**
 * Verifica che un suono esista o ne crea uno dummy
 * @param {string} soundId - Identificatore del suono
 */
export function ensureAudioExists(soundId) {
    if (!audioPool[soundId]) {
        console.log(`Ensuring audio exists: ${soundId}`);
        // Carica il suono o crea un dummy audio
        loadSound(soundId, `assets/audio/${soundId}.mp3`).catch(error => {
            console.warn(`Couldn't load sound ${soundId}, creating dummy sound`, error);
            createDummyAudio(soundId, 3);
        });
    }
}

/**
 * Riproduci un suono dal pool
 * @param {string} name - Nome del suono da riprodurre
 * @param {number} volume - Volume della riproduzione (default 1.0)
 */
export function playSound(name, volume = 1.0) {
    // Assicurati che l'audio esista
    ensureAudioExists(name);
    
    // Trova un'istanza audio non in uso
    let audioInstance = audioPool[name].find(a => !a.inUse);
    
    // Se tutte le istanze sono in uso, usa la prima
    if (!audioInstance) {
        audioInstance = audioPool[name][0];
        try {
            audioInstance.element.pause();
            audioInstance.element.currentTime = 0;
        } catch (e) {
            console.warn('Errore nel riutilizzo audio:', e);
        }
    }
    
    // Configura e riproduci
    audioInstance.inUse = true;
    
    try {
        audioInstance.element.volume = volume;
        
        // Riproduci con controllo degli errori
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
        if (audioInstance.element.onended !== undefined) {
            audioInstance.element.onended = () => {
                audioInstance.inUse = false;
            };
        } else {
            // Se non c'è onended, rilascia dopo 1 secondo
            setTimeout(() => {
                audioInstance.inUse = false;
            }, 1000);
        }
    } catch (e) {
        audioInstance.inUse = false;
        console.warn('Errore avvio riproduzione audio:', e);
    }
}

/**
 * Carica un suono aggiuntivo nel pool
 * @param {string} name - Nome del suono
 * @param {string} src - Path del file audio
 * @param {number} instances - Numero di istanze da creare
 * @returns {Promise} Promise che si risolve quando il suono è caricato
 */
export function loadSound(name, src, instances = 3) {
    // Se esiste già, non ricaricare
    if (audioPool[name] && audioPool[name].length > 0) {
        console.log(`Suono ${name} già caricato`);
        return Promise.resolve(audioPool[name]);
    }
    
    console.log(`Caricamento suono ${name} da ${src}`);
    return new Promise((resolve, reject) => {
        audioPool[name] = [];
        
        // Controlla se il browser supporta Audio API
        if (!window.Audio) {
            console.warn('Audio API non supportata dal browser');
            createDummyAudio(name, instances);
            reject(new Error('Audio API non supportata'));
            return;
        }
        
        let loadedAudio = false;
        
        for (let i = 0; i < instances; i++) {
            try {
                const audio = new Audio();
                
                audio.addEventListener('error', function(e) {
                    console.warn(`Errore caricamento audio ${name}: ${e.target.error ? e.target.error.message : 'Errore sconosciuto'}`);
                    if (audioPool[name].length === 0) {
                        createDummyAudio(name, 1);
                    }
                    if (!loadedAudio && i === instances - 1) {
                        reject(new Error(`Errore caricamento audio ${name}`));
                    }
                });
                
                audio.addEventListener('canplaythrough', function() {
                    loadedAudio = true;
                    if (i === instances - 1) {
                        resolve(audioPool[name]);
                    }
                }, { once: true });
                
                audio.preload = 'auto';
                audio.src = src;
                
                audioPool[name].push({
                    element: audio,
                    inUse: false
                });
            } catch (e) {
                console.warn(`Impossibile creare l'audio ${name}:`, e);
                if (i === instances - 1 && !loadedAudio) {
                    createDummyAudio(name, instances);
                    reject(e);
                }
            }
        }
    });
} 