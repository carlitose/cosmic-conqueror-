import * as THREE from 'three';
import { PERFORMANCE } from './constants.js';

/**
 * Modulo per il monitoraggio e la gestione delle prestazioni di gioco
 */
class PerformanceMonitor {
    constructor() {
        this.fpsHistory = [];
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lowQualityMode = false;
        this.targetFrameRate = PERFORMANCE.TARGET_FPS;
        this.lastFrameTimestamp = performance.now();
        
        // Riferimenti esterni che verranno inizializzati
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
    }
    
    /**
     * Inizializza il monitor con gli elementi necessari
     */
    initialize(scene, camera, renderer, composer, fpsSelectElement) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.composer = composer;
        
        // Configura il selettore FPS se presente
        console.log("FPS select element:", fpsSelectElement?.id);
        
        if (fpsSelectElement) {
            // Funzione per gestire il cambio di FPS
            const handleFpsChange = (event) => {
                const newFps = parseInt(event.target.value, 10);
                console.log("FPS selector changed to:", newFps);
                this.setTargetFPS(newFps);
            };
            
            // Aggiungi il listener senza clonare l'elemento
            fpsSelectElement.addEventListener('change', handleFpsChange);
            
            // Imposta il valore iniziale
            const initialFps = parseInt(fpsSelectElement.value, 10);
            if (!isNaN(initialFps)) {
                this.setTargetFPS(initialFps);
                console.log("Initial FPS set to:", initialFps);
            } else {
                this.setTargetFPS(PERFORMANCE.TARGET_FPS);
                console.log("Using default FPS:", PERFORMANCE.TARGET_FPS);
            }
        } else {
            console.warn("FPS selector element not found");
            this.setTargetFPS(PERFORMANCE.TARGET_FPS);
        }
        
        console.log("Performance monitor initialized");
    }
    
    /**
     * Aggiorna le statistiche FPS e applica ottimizzazioni se necessario
     */
    update() {
        const now = performance.now();
        if (this.lastFrameTime > 0) {
            const delta = now - this.lastFrameTime;
            const fps = 1000 / delta;
            
            // Mantieni gli ultimi campioni FPS
            this.fpsHistory.push(fps);
            if (this.fpsHistory.length > PERFORMANCE.FPS_SAMPLE_SIZE) {
                this.fpsHistory.shift();
            }
            
            // Log ogni 100 frame
            if (this.frameCount % 100 === 0) {
                console.log(`Performance: ${this.getAverageFPS().toFixed(2)} FPS (Quality: ${this.lowQualityMode ? 'LOW' : 'NORMAL'}, Target: ${this.targetFrameRate})`);
            }
            
            // Verifica se cambiare modalità qualità
            this.checkQualityMode();
            
            this.frameCount++;
        }
        
        this.lastFrameTime = now;
    }
    
    /**
     * Calcola la media degli FPS
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return this.targetFrameRate;
        return this.fpsHistory.reduce((sum, val) => sum + val, 0) / this.fpsHistory.length;
    }
    
    /**
     * Verifica se è necessario cambiare la modalità di qualità
     */
    checkQualityMode() {
        const avgFps = this.getAverageFPS();
        
        // Passa a bassa qualità se gli FPS scendono sotto la soglia
        if (avgFps < PERFORMANCE.LOW_QUALITY_THRESHOLD && !this.lowQualityMode) {
            this.enableLowQuality();
        } 
        // Prova a tornare a qualità normale occasionalmente
        else if (avgFps > PERFORMANCE.NORMAL_QUALITY_THRESHOLD && 
                 this.lowQualityMode && 
                 this.frameCount % PERFORMANCE.QUALITY_CHECK_INTERVAL === 0) {
            this.enableNormalQuality();
        }
    }
    
    /**
     * Attiva modalità bassa qualità
     */
    enableLowQuality() {
        if (!this.scene || !this.camera) {
            console.warn("Cannot enable low quality mode: scene or camera not initialized");
            return;
        }
        
        console.warn("Enabling LOW QUALITY mode to improve performance");
        this.lowQualityMode = true;
        
        // Riduzione distanza visiva
        this.camera.far = 5000;
        this.camera.updateProjectionMatrix();
        
        // Disattiva effetti di post-processing
        if (this.composer) {
            this.composer.passes.forEach(pass => {
                if (pass.constructor.name === "UnrealBloomPass") {
                    pass.enabled = false;
                }
            });
        }
        
        // Riduzione particelle
        this.scene.traverse(object => {
            if (object instanceof THREE.Points) {
                if (object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
                    const newSize = Math.floor(object.geometry.attributes.position.count / 2);
                    object.geometry.setDrawRange(0, newSize);
                }
            }
        });
        
        // Ottimizza texture
        this.optimizeTextures(true);
        
        // Riduzione luci
        this.reduceLights();
    }
    
    /**
     * Ripristina qualità normale
     */
    enableNormalQuality() {
        if (!this.scene || !this.camera) {
            console.warn("Cannot enable normal quality mode: scene or camera not initialized");
            return;
        }
        
        console.warn("Switching back to NORMAL quality mode");
        this.lowQualityMode = false;
        
        // Ripristina distanza visiva
        this.camera.far = 20000;
        this.camera.updateProjectionMatrix();
        
        // Riattiva effetti
        if (this.composer) {
            this.composer.passes.forEach(pass => {
                if (pass.constructor.name === "UnrealBloomPass") {
                    pass.enabled = true;
                }
            });
        }
        
        // Ripristina particelle
        this.scene.traverse(object => {
            if (object instanceof THREE.Points) {
                if (object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
                    object.geometry.setDrawRange(0, Infinity);
                }
            }
        });
        
        // Ottimizza texture (modalità normale)
        this.optimizeTextures(false);
    }
    
    /**
     * Ottimizza le texture della scena
     */
    optimizeTextures(isLowQualityMode) {
        if (!this.scene) return;
        
        console.log("Optimizing textures to reduce memory usage");
        
        this.scene.traverse(object => {
            if (object.isMesh) {
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    
                    materials.forEach(material => {
                        // Downscale delle texture con meno filtri
                        if (material.map) {
                            material.map.minFilter = THREE.LinearFilter;
                            material.map.magFilter = THREE.LinearFilter;
                            material.map.generateMipmaps = false;
                            material.map.needsUpdate = true;
                        }
                        
                        // Disabilita textures extra in modalità low quality
                        if (isLowQualityMode) {
                            material.displacementMap = null;
                            material.metalnessMap = null;
                            material.roughnessMap = null;
                            material.normalMap = null;
                            material.flatShading = true;
                        }
                        
                        // Riduce la qualità delle texture di tipo bump
                        if (material.bumpMap) {
                            material.bumpMap.minFilter = THREE.LinearFilter;
                            material.bumpMap.magFilter = THREE.LinearFilter;
                            material.bumpMap.generateMipmaps = false;
                            if (isLowQualityMode) {
                                material.bumpScale = material.bumpScale * 0.5; // Riduce l'effetto bump
                            }
                            material.bumpMap.needsUpdate = true;
                        }
                        
                        material.needsUpdate = true;
                    });
                }
            }
        });
        
        // Forza garbage collection delle texture rilasciate
        THREE.Cache.clear();
    }
    
    /**
     * Riduce l'intensità delle luci
     */
    reduceLights() {
        if (!this.scene) return;
        
        // Trova e riduce intensità luci
        let mainLightFound = false;
        this.scene.traverse(object => {
            if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) {
                if (!mainLightFound) {
                    mainLightFound = true;
                    // Riduce intensità della luce principale
                    object.intensity *= 0.7;
                } else {
                    // Disattiva completamente altre luci
                    object.intensity = 0;
                }
            }
        });
    }
    
    /**
     * Pulisce le risorse non utilizzate
     */
    cleanupUnusedResources(collisionCache) {
        // Rimuovi le cache non necessarie
        if (collisionCache) {
            collisionCache.clear();
        }
        
        // Pulizia di TextureLoader
        THREE.Cache.clear();

        // Raccolta forzata
        if (typeof window.gc === 'function') {
            try {
                window.gc();
            } catch {
                console.log('Manual GC not available');
            }
        }
    }
    
    /**
     * Helper method to sleep for a given time
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} A promise that resolves after ms milliseconds
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Forces the frame rate to stay at or below the target
     * Uses more aggressive techniques beyond just skipping frames
     * @returns {Promise<boolean>} Promise that resolves to true when it's OK to render the next frame
     */
    async throttleFPS() {
        // Skip throttling for unlimited framerates
        if (this.targetFrameRate === 0 || this.targetFrameRate === Infinity) {
            return true;
        }
        
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastFrameTimestamp;
        const frameDuration = 1000 / this.targetFrameRate;
        
        // If we're rendering too fast, actively wait until the next frame time
        if (elapsed < frameDuration) {
            const waitTime = frameDuration - elapsed;
            if (this.frameCount % 60 === 0) {
                console.log(`FPS Throttle - Waiting ${waitTime.toFixed(2)}ms to maintain ${this.targetFrameRate} FPS`);
            }
            
            // Actually wait using setTimeout
            await this.sleep(waitTime);
            
            // Update timestamp after waiting
            this.lastFrameTimestamp = performance.now();
            return true;
        }
        
        // We've waited long enough, update timestamp and render
        this.lastFrameTimestamp = currentTime;
        return true;
    }

    /**
     * Verifica se è il momento di renderizzare un frame
     * @returns {boolean} true se il frame dovrebbe essere renderizzato
     */
    shouldRenderFrame() {
        // Handle unlimited case
        if (this.targetFrameRate === 0 || this.targetFrameRate === Infinity) {
            return true;
        }
        
        const currentTime = performance.now();
        
        // Safety check - if lastFrameTimestamp is invalid, reset it
        if (!this.lastFrameTimestamp || isNaN(this.lastFrameTimestamp)) {
            console.warn("Invalid lastFrameTimestamp detected, resetting to current time");
            this.lastFrameTimestamp = currentTime;
            return true;
        }
        
        const elapsed = currentTime - this.lastFrameTimestamp;
        const frameDuration = 1000 / this.targetFrameRate;
        
        // Enhanced debug logging
        if (this.frameCount % 60 === 0) {
            console.log(`FPS Limiter - Target: ${this.targetFrameRate}, elapsed: ${elapsed.toFixed(2)}ms, frameDuration: ${frameDuration.toFixed(2)}ms, shouldRender: ${elapsed >= frameDuration}`);
        }
        
        // Check if enough time has passed since the last frame
        if (elapsed >= frameDuration) {
            // Important: update the timestamp based on the current time
            // This prevents stuttering by ensuring we're not trying to "catch up" to an ideal frame time
            this.lastFrameTimestamp = currentTime;
            
            // Additionally, if we're significantly behind (e.g., after tab switch), 
            // let's avoid massive catch-up and just treat this as a reset point
            if (elapsed > frameDuration * 3) {
                if (this.frameCount % 60 === 0) {
                    console.log(`FPS Limiter - Detected large time gap (${elapsed.toFixed(2)}ms), resetting frame timing`);
                }
            }
            
            return true;
        } else {
            // If we need to skip this frame (e.g. we're trying to render too quickly)
            // The browser will still call requestAnimationFrame at about every 16.7ms (60fps)
            // or faster on high refresh displays, so we need to skip frames to achieve our target
            return false;
        }
    }
    
    /**
     * Imposta il target FPS
     * @param {number} fps - Target frame rate
     */
    setTargetFPS(fps) {
        // Ensure fps is a number
        const newFps = Number(fps);
        if (isNaN(newFps)) {
            console.warn(`Invalid FPS value received: ${fps}. Using previous: ${this.targetFrameRate}`);
            return;
        }
        
        // Limita ad un minimo di 15 FPS o nessun limite (0)
        let finalFps = newFps;
        if (finalFps !== 0 && finalFps < 15) finalFps = 15;
        
        // Se il valore non è cambiato, non fare nulla
        if (this.targetFrameRate === finalFps) return;
        
        this.targetFrameRate = finalFps;
        console.log(`Target frame rate changed to ${finalFps === 0 ? 'unlimited' : finalFps + ' FPS'}`);
        
        // Reset timestamp to avoid a potentially long first frame after change
        this.lastFrameTimestamp = performance.now();
        
        // Aggiorna l'UI se c'è un select element con id fps-select
        const fpsSelector = document.getElementById('fps-select');
        if (fpsSelector && fpsSelector.value !== String(finalFps)) {
            console.log("Updating FPS select UI to", finalFps);
            fpsSelector.value = String(finalFps);
        }
    }
}

// Esporta una singola istanza del PerformanceMonitor
export const performanceMonitor = new PerformanceMonitor(); 