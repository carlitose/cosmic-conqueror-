import { UI_ELEMENTS } from './constants.js';

/**
 * Modulo di gestione dell'interfaccia utente
 * Gestisce tutte le interazioni con gli elementi UI, notifiche, schermate e aggiornamenti
 */

// Riferimenti agli elementi UI
let characterSelectionScreen;
let startGameButton;
let characterOptions;
let healthBarFill;
let energyBarFill;
let currencyAmount;
let planetInfoPanel;
let planetName;
let planetStatus;
let planetDefense;
let conquerButton;
let gameOverScreen;
let restartButton;
let upgradesScreen;
let closeUpgradesButton;
let upgradeButtons;
let legendScreen;
let closeLegendButton;

// Callback e funzioni esterne
let callbacks = {
    startGame: null,
    restartGame: null,
    conquerPlanet: null,
    upgrade: null
};

// Riferimento al giocatore
let player = null;

/**
 * Inizializza il gestore UI
 * @param {Object} options - Opzioni di configurazione
 */
export function initializeUIManager(options = {}) {
    // Inizializzazione callback
    callbacks = {
        startGame: options.startGame || function() { console.warn("startGame callback non impostato"); },
        restartGame: options.restartGame || function() { console.warn("restartGame callback non impostato"); },
        conquerPlanet: options.conquerPlanet || function() { console.warn("conquerPlanet callback non impostato"); },
        upgrade: options.upgrade || function() { console.warn("upgrade callback non impostato"); }
    };
    
    // Inizializzazione riferimenti agli elementi DOM
    characterSelectionScreen = document.getElementById(UI_ELEMENTS.CHARACTER_SELECTION);
    startGameButton = document.getElementById(UI_ELEMENTS.START_GAME);
    characterOptions = document.querySelectorAll('.character-option');
    healthBarFill = document.getElementById(UI_ELEMENTS.HEALTH_FILL);
    energyBarFill = document.getElementById(UI_ELEMENTS.ENERGY_FILL);
    currencyAmount = document.getElementById(UI_ELEMENTS.CURRENCY_AMOUNT);
    planetInfoPanel = document.getElementById(UI_ELEMENTS.PLANET_INFO);
    planetName = document.getElementById(UI_ELEMENTS.PLANET_NAME);
    planetStatus = document.getElementById(UI_ELEMENTS.PLANET_STATUS);
    planetDefense = document.getElementById(UI_ELEMENTS.PLANET_DEFENSE);
    conquerButton = document.getElementById(UI_ELEMENTS.CONQUER_BUTTON);
    gameOverScreen = document.getElementById(UI_ELEMENTS.GAME_OVER_SCREEN);
    restartButton = document.getElementById(UI_ELEMENTS.RESTART_BUTTON);
    upgradesScreen = document.getElementById(UI_ELEMENTS.UPGRADES_SCREEN);
    closeUpgradesButton = document.getElementById(UI_ELEMENTS.CLOSE_UPGRADES);
    upgradeButtons = document.querySelectorAll('.upgrade-btn');
    legendScreen = document.getElementById(UI_ELEMENTS.LEGEND_SCREEN);
    closeLegendButton = document.getElementById(UI_ELEMENTS.CLOSE_LEGEND);
    
    // Imposta i listener degli eventi
    setupEventListeners();
    
    console.log("UI Manager initialized");
}

/**
 * Imposta i listener degli eventi UI
 */
function setupEventListeners() {
    // Eventi schermata selezione personaggio
    characterOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Deseleziona tutti
            characterOptions.forEach(opt => {
                opt.classList.remove('selected');
                opt.style.opacity = '0.7';
            });
            // Seleziona quello cliccato
            option.classList.add('selected');
            option.style.opacity = '1';
            // Abilita il pulsante di inizio
            startGameButton.disabled = false;
            startGameButton.style.opacity = '1';
        });
    });
    
    startGameButton.addEventListener('click', () => {
        const selectedRace = document.querySelector('.character-option.selected');
        if (selectedRace) {
            const race = selectedRace.getAttribute('data-race');
            callbacks.startGame(race);
        } else {
            showMessage('Seleziona una razza per iniziare!', 'error');
        }
    });
    
    // Eventi schermata game over
    if (restartButton) {
        restartButton.addEventListener('click', callbacks.restartGame);
    }
    
    // Eventi schermata potenziamenti
    if (closeUpgradesButton) {
        closeUpgradesButton.addEventListener('click', closeUpgradesScreen);
    }
    
    upgradeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stat = button.closest('.upgrade-item').getAttribute('data-stat');
            callbacks.upgrade(stat);
        });
    });
    
    // Eventi schermata legenda
    if (closeLegendButton) {
        closeLegendButton.addEventListener('click', closeLegendScreen);
    }
    
    // Eventi pianeti
    if (conquerButton) {
        conquerButton.addEventListener('click', callbacks.conquerPlanet);
    }
    
    // Keyboard shortcuts per le schermate
    document.addEventListener('keydown', (event) => {
        // Evita che venga chiamato durante la selezione personaggio o il game over
        if (characterSelectionScreen.style.display !== 'none' || 
            (gameOverScreen && !gameOverScreen.classList.contains('hidden'))) {
            return;
        }
        
        // 'U' per potenziamenti
        if (event.code === 'KeyU') {
            if (upgradesScreen.classList.contains('hidden')) {
                openUpgradesScreen();
            } else {
                closeUpgradesScreen();
            }
        }
        
        // 'L' per legenda
        if (event.code === 'KeyL') {
            if (legendScreen.classList.contains('hidden')) {
                openLegendScreen();
            } else {
                closeLegendScreen();
            }
        }
    });
}

/**
 * Imposta il riferimento al giocatore
 * @param {Player} playerObj - L'istanza del giocatore
 */
export function setPlayer(playerObj) {
    player = playerObj;
}

/**
 * Aggiorna gli elementi UI in base allo stato del giocatore
 */
export function updateUI() {
    if (!player) return;

    healthBarFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    energyBarFill.style.width = `${(player.energy / player.maxEnergy) * 100}%`;
    currencyAmount.textContent = player.currency;
}

/**
 * Mostra la schermata di selezione personaggio
 */
export function showCharacterSelection() {
    characterSelectionScreen.style.display = 'flex';
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (planetInfoPanel) planetInfoPanel.classList.add('hidden');
    
    // Imposta lo stato iniziale dei personaggi e del pulsante
    characterOptions.forEach(opt => {
        opt.classList.remove('selected');
        opt.style.opacity = '0.7';
    });
    startGameButton.disabled = true;
    startGameButton.style.opacity = '0.5';
}

/**
 * Nasconde la schermata di selezione personaggio
 */
export function hideCharacterSelection() {
    characterSelectionScreen.style.display = 'none';
}

/**
 * Mostra le informazioni del pianeta
 * @param {Object} planet - Il pianeta da mostrare
 */
export function showPlanetInfo(planet) {
    if (!planetInfoPanel || !planet) return;
    
    planetName.textContent = planet.name;
    planetStatus.textContent = planet.isConquered ? 'Conquistato' : 'Non conquistato';
    planetDefense.textContent = planet.defense;
    
    // Colora in base allo stato
    planetStatus.style.color = planet.isConquered ? '#3eff3e' : '#ff3e3e';
    
    // Mostra il pannello
    planetInfoPanel.classList.remove('hidden');
}

/**
 * Nasconde le informazioni del pianeta
 */
export function hidePlanetInfo() {
    if (!planetInfoPanel) return;
    planetInfoPanel.classList.add('hidden');
}

/**
 * Mostra la schermata di game over
 */
export function showGameOver() {
    if (!gameOverScreen) return;
    gameOverScreen.classList.remove('hidden');
}

/**
 * Nasconde la schermata di game over
 */
export function hideGameOver() {
    if (!gameOverScreen) return;
    gameOverScreen.classList.add('hidden');
}

/**
 * Apre la schermata di potenziamenti
 */
export function openUpgradesScreen() {
    if (!upgradesScreen || !player) return;
    
    upgradesScreen.classList.remove('hidden');
    updateUpgradesUI();
}

/**
 * Chiude la schermata di potenziamenti
 */
export function closeUpgradesScreen() {
    if (!upgradesScreen) return;
    upgradesScreen.classList.add('hidden');
}

/**
 * Aggiorna la UI dei potenziamenti
 */
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

/**
 * Apre la schermata della legenda
 */
export function openLegendScreen() {
    if (!legendScreen) return;
    
    closeUpgradesScreen(); // Chiudi potenziamenti se aperti
    legendScreen.classList.remove('hidden');
}

/**
 * Chiude la schermata della legenda
 */
export function closeLegendScreen() {
    if (!legendScreen) return;
    legendScreen.classList.add('hidden');
}

/**
 * Mostra un messaggio temporaneo
 * @param {string} message - Il messaggio da mostrare
 * @param {string} type - Il tipo di messaggio ('info', 'success', 'warning', 'error')
 */
export function showMessage(message, type = 'info') {
    // Crea l'elemento del messaggio
    const messageElement = document.createElement('div');
    messageElement.className = `game-message ${type}`;
    messageElement.textContent = message;
    
    // Aggiungi al DOM
    document.body.appendChild(messageElement);
    
    // Animazione di fade-in
    messageElement.style.opacity = '0';
    setTimeout(() => {
        messageElement.style.opacity = '1';
    }, 10);
    
    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 300);
    }, 3000);
}

/**
 * Aggiorna la UI dei potenziamenti del giocatore
 * @param {Object} playerData - Dati del giocatore
 */
export function updatePlayerStatsUI(playerData) {
    // Aggiorna statistiche base
    document.getElementById(UI_ELEMENTS.PLAYER_LEVEL).textContent = `Livello ${playerData.level}`;
    document.getElementById(UI_ELEMENTS.PLAYER_EXP).textContent = `${playerData.expPoints}/${playerData.nextLevelExp} EXP`;
    
    // Aggiorna barre progresso potenziamenti
    Object.entries(playerData.upgrades).forEach(([stat, level]) => {
        const progressBar = document.querySelector(`#upgrade-${stat} .progress-bar`);
        if (progressBar) {
            progressBar.style.width = `${(level / 10) * 100}%`;
            progressBar.textContent = `${level}/10`;
        }
    });
    
    // Aggiorna statistiche dettagliate
    document.getElementById(UI_ELEMENTS.ATTACK_POWER).textContent = playerData.attackPower;
    document.getElementById(UI_ELEMENTS.DEFENSE).textContent = playerData.maxHealth;
    document.getElementById(UI_ELEMENTS.SPEED).textContent = playerData.speed;
    document.getElementById(UI_ELEMENTS.ENERGY_CAPACITY).textContent = playerData.maxEnergy;
}

/**
 * Nasconde la schermata del titolo
 */
export function hideTitleScreen() {
    const titleScreen = document.getElementById(UI_ELEMENTS.TITLE_SCREEN);
    if (titleScreen) {
        titleScreen.style.display = 'none';
    }
}

/**
 * Mostra la mappa del mondo
 */
export function showMap() {
    const mapScreen = document.getElementById(UI_ELEMENTS.MAP_SCREEN);
    if (mapScreen) {
        mapScreen.classList.remove('hidden');
        // Aggiorna la mappa con i pianeti conquistati
        if (player) {
            player.conqueredPlanets.forEach(planet => {
                const planetMarker = document.querySelector(`#planet-${planet.id}`);
                if (planetMarker) {
                    planetMarker.classList.add('conquered');
                }
            });
        }
    }
}

/**
 * Chiude la mappa del mondo
 */
export function closeMap() {
    const mapScreen = document.getElementById(UI_ELEMENTS.MAP_SCREEN);
    if (mapScreen) {
        mapScreen.classList.add('hidden');
    }
}

/**
 * Mostra l'inventario del giocatore
 */
export function showInventory() {
    const inventoryScreen = document.getElementById(UI_ELEMENTS.INVENTORY_SCREEN);
    if (inventoryScreen && player) {
        inventoryScreen.classList.remove('hidden');
        
        // Aggiorna lista oggetti
        const itemsList = document.getElementById(UI_ELEMENTS.INVENTORY_ITEMS);
        itemsList.innerHTML = '';
        
        player.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = `inventory-item ${item.equipped ? 'equipped' : ''}`;
            itemElement.innerHTML = `
                <img src="public/textures/items/${item.icon}" alt="${item.name}">
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p>${item.description}</p>
                </div>
                <div class="item-actions">
                    ${item.equippable ? 
                        `<button onclick="equipItem('${item.id}')">${item.equipped ? 'Unequip' : 'Equip'}</button>` : 
                        `<button onclick="useItem('${item.id}')">Use</button>`
                    }
                </div>
            `;
            itemsList.appendChild(itemElement);
        });
    }
}

/**
 * Chiude l'inventario
 */
export function closeInventory() {
    const inventoryScreen = document.getElementById(UI_ELEMENTS.INVENTORY_SCREEN);
    if (inventoryScreen) {
        inventoryScreen.classList.add('hidden');
    }
}

/**
 * Mostra il menu di pausa
 */
export function showPauseMenu() {
    const pauseMenu = document.getElementById(UI_ELEMENTS.PAUSE_MENU);
    if (pauseMenu) {
        pauseMenu.classList.remove('hidden');
    }
}

/**
 * Chiude il menu di pausa
 */
export function closePauseMenu() {
    const pauseMenu = document.getElementById(UI_ELEMENTS.PAUSE_MENU);
    if (pauseMenu) {
        pauseMenu.classList.add('hidden');
    }
} 