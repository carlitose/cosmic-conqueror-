import { GameIntegration } from './GameIntegration.js';

/**
 * Punto di ingresso principale del gioco
 * 
 * Questo file ha il solo scopo di inizializzare l'orchestratore centrale
 * GameIntegration che gestisce tutti gli altri moduli del gioco.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Trova il container del gioco
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        console.error("Elemento container del gioco non trovato!");
        return;
    }

    // Crea una configurazione in base all'ambiente
    const gameOptions = {
        targetFPS: 60,
        quality: window.innerWidth < 1024 ? 'low' : 'normal',
        initialMode: 'space',
        debug: window.location.search.includes('debug=true')
    };

    console.log("Inizializzazione gioco con opzioni:", gameOptions);

    // Crea l'istanza del gioco
    const game = new GameIntegration(gameOptions);

    // Inizializza il gioco
    game.initialize(gameContainer)
        .then(() => {
            console.log("Gioco inizializzato con successo!");
            
            // Aggiungi handler per la chiusura della pagina
            window.addEventListener('beforeunload', () => {
                game.dispose();
            });

            // Esponi l'istanza di gioco globalmente solo per debug
            if (gameOptions.debug) {
                window.gameInstance = game;
                console.log("Debug mode attiva: l'istanza di gioco è disponibile come window.gameInstance");
            }
        })
        .catch(error => {
            console.error("Errore durante l'inizializzazione:", error);
            
            // Mostra un messaggio di errore all'utente
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `
                <h2>Errore di inizializzazione</h2>
                <p>Si è verificato un errore durante l'avvio del gioco.</p>
                <p>Dettaglio: ${error.message || 'Errore sconosciuto'}</p>
                <button onclick="location.reload()">Riprova</button>
            `;
            gameContainer.appendChild(errorDiv);
        });
});