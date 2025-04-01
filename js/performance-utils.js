// --- Texture Optimization ---
export function optimizeTextures(scene, THREE, isLowQualityMode) {
    console.log("Optimizing textures to reduce memory usage");
    
    // Riduce la qualità e dimensione delle texture
    scene.traverse(object => {
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
                    
                    // Disabilita textures extra
                    if (isLowQualityMode) {
                        material.displacementMap = null;
                        material.metalnessMap = null;
                        material.roughnessMap = null;
                        material.normalMap = null;
                    }
                    
                    // Riduce la qualità delle texture di tipo bump
                    if (material.bumpMap) {
                        material.bumpMap.minFilter = THREE.LinearFilter;
                        material.bumpMap.magFilter = THREE.LinearFilter;
                        material.bumpMap.generateMipmaps = false;
                        material.bumpScale = material.bumpScale * 0.5; // Riduce l'effetto bump
                        material.bumpMap.needsUpdate = true;
                    }
                    
                    // Riduce la complessità del materiale
                    material.flatShading = true;
                    material.needsUpdate = true;
                });
            }
        }
    });
    
    // Forza garbage collection delle texture rilasciate
    THREE.Cache.clear();
}

export function enableLowQualityMode(scene, camera, composer, THREE) {
    console.warn("Enabling LOW QUALITY mode to improve performance");
    
    // Disattiva post-processing
    if (composer) {
        composer.passes.forEach(pass => {
            if (pass.constructor.name === "UnrealBloomPass") {
                pass.enabled = false;
            }
        });
    }
    
    // Riduci distanza di vista
    camera.far = 5000;
    camera.updateProjectionMatrix();
    
    // Riduci numero di particelle e objetti
    scene.traverse(object => {
        if (object.type === "Points") {
            if (object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
                // Riduci particelle visibili al 50%
                const newSize = Math.floor(object.geometry.attributes.position.count / 2);
                object.geometry.setDrawRange(0, newSize);
            }
        }
    });
    
    // Ottimizza texture
    optimizeTextures(scene, THREE, true);
    
    // Disattiva luci dinamiche
    disableDynamicLights(scene);
    
    return true;
}

export function disableDynamicLights(scene) {
    // Trova e disattiva tutte le luci dinamiche tranne quella principale
    let mainLightFound = false;
    scene.traverse(object => {
        if (object.type === "PointLight" || object.type === "SpotLight") {
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

// --- Memory Management ---
export function cleanupUnusedResources(THREE, collisionCache) {
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

// --- Performance Monitoring ---
export function createPerformanceMonitor() {
    const monitor = {
        fpsHistory: [],
        lastFrameTime: 0,
        frameCount: 0,
        
        update: function() {
            const now = performance.now();
            if (this.lastFrameTime > 0) {
                const delta = now - this.lastFrameTime;
                const fps = 1000 / delta;
                
                // Mantieni gli ultimi 10 campioni
                this.fpsHistory.push(fps);
                if (this.fpsHistory.length > 10) {
                    this.fpsHistory.shift();
                }
                
                this.frameCount++;
            }
            
            this.lastFrameTime = now;
            return this.getAverageFPS();
        },
        
        getAverageFPS: function() {
            if (this.fpsHistory.length === 0) return 60;
            return this.fpsHistory.reduce((sum, val) => sum + val, 0) / this.fpsHistory.length;
        },
        
        shouldSwitchToLowQuality: function() {
            return this.getAverageFPS() < 20;
        },
        
        shouldSwitchToNormalQuality: function() {
            return this.getAverageFPS() > 40 && this.frameCount % 300 === 0;
        },
        
        logPerformance: function() {
            if (this.frameCount % 100 === 0) {
                console.log(`Performance: ${this.getAverageFPS().toFixed(2)} FPS`);
            }
        }
    };
    
    return monitor;
} 