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
        this.lastFrameTimestamp = 0;
        
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
        if (fpsSelectElement) {
            fpsSelectElement.addEventListener('change', (event) => {
                this.setTargetFPS(parseInt(event.target.value));
            });
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
     * Imposta il frame rate target
     */
    setTargetFPS(fps) {
        this.targetFrameRate = fps;
        console.log(`Target frame rate set to ${fps} FPS`);
    }
    
    /**
     * Determina se il frame dovrebbe essere renderizzato in base al limitatore di frame rate
     */
    shouldRenderFrame() {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastFrameTimestamp;
        const frameDuration = 1000 / this.targetFrameRate;
        
        if (elapsed >= frameDuration) {
            this.lastFrameTimestamp = currentTime - (elapsed % frameDuration);
            return true;
        }
        
        return false;
    }
}

// Esporta una singola istanza del PerformanceMonitor
export const performanceMonitor = new PerformanceMonitor(); 