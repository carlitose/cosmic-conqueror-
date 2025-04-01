import { GameIntegration } from './GameIntegration.js';
// Importa le costanti se servono qui, altrimenti verranno usate internamente
// import { CONSTANTS } from './constants.js'; // Esempio

/**
 * Punto di ingresso principale del gioco
 * 
 * Questo file ha il solo scopo di inizializzare l'orchestratore centrale
 * GameIntegration che gestisce tutti gli altri moduli del gioco.
 */
document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        console.error("Game container element not found! ID='game-container'");
        // Mostra un messaggio all'utente nell'HTML
        document.body.innerHTML = '<div style="color: red; padding: 20px;">Errore critico: Impossibile trovare il contenitore del gioco (#game-container).</div>';
        return;
    }

    // Opzioni di configurazione iniziali
    const gameOptions = {
        targetFPS: 60,
        quality: window.innerWidth < 1024 ? 'low' : 'normal',
        initialMode: 'space',
        debug: window.location.search.includes('debug=true')
    };

    console.log("Initializing game with options:", gameOptions);

    // Crea l'istanza principale
    const game = new GameIntegration(gameOptions);

    // Inizializza il gioco
    game.initialize(gameContainer)
        .then(() => {
            console.log("Game Initialized Successfully!");
            
            // Aggiungi handler per la pulizia prima di chiudere la pagina
            window.addEventListener('beforeunload', () => {
                game.dispose();
            });

            // Esponi globalmente per debug se necessario
            if (gameOptions.debug) {
                window.gameInstance = game;
                console.log("Debug mode active: game instance available as window.gameInstance");
            }
        })
        .catch(error => {
            console.error("Failed to initialize game:", error);
            
            // Mostra un messaggio di errore più visibile
            gameContainer.innerHTML = `<div class="error-message">
                <h2>Initialization Error</h2>
                <p>An error occurred while starting the game.</p>
                <p>Details: ${error.message || 'Unknown error'}</p>
                <button onclick="location.reload()">Retry</button>
            </div>`;
        });
});