// Video controller to handle intro video playback
class VideoController {
    constructor(videoElement) {
        this.video = videoElement;
        this.onVideoEnd = null;
        this.hasUserInteracted = false; // Track if user has interacted
        
        // Get buttons
        this.playButton = document.getElementById('playBtn');
        this.skipButton = document.getElementById('skipBtn');
        
        // Bind event handlers
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Play button click handler
        this.playButton.addEventListener('click', () => {
            this.hasUserInteracted = true;
            this.play();
        });
        
        // Skip button click handler
        this.skipButton.addEventListener('click', () => {
            this.hasUserInteracted = true;
            this.skip();
        });
        
        // Video ended handler
        this.video.addEventListener('ended', () => {
            this.handleVideoEnd();
        });
        
        // Error handling
        this.video.addEventListener('error', (e) => {
            console.error('Error playing video:', e);
            // Still proceed to 3D scene even if there's an error
            this.handleVideoEnd();
        });
    }

    play() {
        // Show the video container with semi-transparent background and hide controls
        document.getElementById('intro-video').style.display = 'flex';
        document.getElementById('intro-video').style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.video.style.display = 'block';
        document.getElementById('video-controls').style.display = 'none';
        
        this.video.play().catch(e => {
            console.error('Error playing video:', e);
            // If autoplay fails, still initialize the scene
            this.handleVideoEnd();
        });
    }

    skip() {
        // Hide video and controls completely, then initialize scene
        document.getElementById('intro-video').style.display = 'none';
        if (this.onVideoEnd) {
            this.onVideoEnd();
        }
    }

    handleVideoEnd() {
        // Hide the video container
        document.getElementById('intro-video').style.display = 'none';
        
        // Call the callback if provided
        if (this.onVideoEnd) {
            this.onVideoEnd();
        }
    }
}

// Main scene variables
let scene, camera, renderer;
let models = []; // 存储原始模型
let modelData = []; // 存储模型的数据，包括位置、名称等
let renewModels = {}; // 存储预加载的更新模型
let curve;
let pathPoints = [];
let totalModels = 0;
let currentPathPosition = 0;
let clock = new THREE.Clock();

// Variables for mouse drag controls
let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};

// Sensitivity for camera rotation
const ROTATION_SENSITIVITY = 0.002;
const MODEL_SWAP_DISTANCE = 7; // 模型替换的距离阈值

// Particle effect instance
let particleEffect;

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe3d8cc);
    scene.fog = new THREE.Fog(0xe3d8cc, 8, 40);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(15, 5, 18);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Initialize particle effect
    particleEffect = new ParticleEffect(scene);

    // Improved lighting setup following best practices
    // Ambient light - provides overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.8);
    scene.add(ambientLight);

    // Main directional light - acts as the key light
    const keyLight = new THREE.DirectionalLight(0xfce7cf, 3.5);
    keyLight.position.set(10, 20, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill light - illuminates shadowed areas
    const fillLight = new THREE.DirectionalLight(0xffffff, 2.7);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Create the path using Catmull-Rom curve
    createPath();

    // Add spotlights along the path to illuminate models
    addPathSpotlights();

    // Load all models
    loadAllModels();

    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('wheel', onMouseWheel);
    
    // Mouse event listeners for drag controls
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', onMouseUp); // Handle mouse leaving window

    // Start animation loop
    animate();
}

// Mouse event handlers for camera control
function onMouseDown(event) {
    if (event.button === 0) { // Left mouse button
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseMove(event) {
    if (isDragging) {
        // Calculate the difference from the previous mouse position
        const deltaX = event.clientX - previousMousePosition.x;
        const deltaY = event.clientY - previousMousePosition.y;

        // Get the current camera position along the path
        const pathIndex = Math.floor(currentPathPosition * (pathPoints.length - 1));
        const targetPoint = pathPoints[pathIndex];
        
        // Calculate a point slightly ahead for reference
        const lookAheadDistance = 30;
        const lookAheadSteps = Math.floor(lookAheadDistance * (pathPoints.length / curve.getLength()));
        const lookAhedIndex = Math.min(pathIndex + lookAheadSteps, pathPoints.length - 1);
        const lookAtPoint = pathPoints[lookAhedIndex];

        // Create a coordinate system based on the current camera orientation
        const direction = new THREE.Vector3();
        direction.subVectors(lookAtPoint, targetPoint).normalize();
        
        // Calculate the up vector (slightly adjusted for better dragging feel)
        const up = new THREE.Vector3(0, 1, 0);
        
        // Calculate right vector (perpendicular to look direction and up)
        const right = new THREE.Vector3();
        right.crossVectors(direction, up).normalize();
        
        // Calculate the upward direction vector
        const upwardDir = new THREE.Vector3();
        upwardDir.crossVectors(right, direction).normalize();

        // Move camera position based on mouse drag
        camera.position.addScaledVector(right, deltaX * ROTATION_SENSITIVITY);
        camera.position.addScaledVector(upwardDir, -deltaY * ROTATION_SENSITIVITY);

        // Update the lookAt point accordingly
        const newLookAt = new THREE.Vector3(
            lookAtPoint.x + deltaX * ROTATION_SENSITIVITY,
            lookAtPoint.y + 2 - deltaY * ROTATION_SENSITIVITY,
            lookAtPoint.z
        );

        camera.lookAt(newLookAt);

        // Update previous mouse position
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseUp() {
    isDragging = false;
}

// Add spotlights along the path to illuminate models
function addPathSpotlights() {
    // Add lights every 50 points along the path
    for (let i = 0; i < pathPoints.length; i += 100) {
        const point = pathPoints[i];
        
        // Create spotlight pointing down toward the models
        const spotLight = new THREE.SpotLight(0xffffff, 0.8, 30, 45, 0.5, 1);
        spotLight.position.set(point.x, point.y + 10, point.z);
        spotLight.target.position.set(point.x, point.y, point.z);
        
        // Enable shadows for more realistic lighting
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 256;
        spotLight.shadow.mapSize.height = 256;
        
        scene.add(spotLight);
        scene.add(spotLight.target);
    }
}

// Create the Catmull-Rom spline path
function createPath() {
    // Create a curved path with multiple control points
    const points = [
        new THREE.Vector3(-30, 0, 0),
        new THREE.Vector3(-20, 0, -10),
        new THREE.Vector3(-10, 2, -5),
        new THREE.Vector3(0, 3, 0),
        new THREE.Vector3(10, 2, 5),
        new THREE.Vector3(20, 0, 0),
        new THREE.Vector3(30, -1, -5),
        new THREE.Vector3(40, 0, 0),
        new THREE.Vector3(50, 1, 5),
        new THREE.Vector3(60, 0, 0),
        new THREE.Vector3(70, -1, -3),
        new THREE.Vector3(80, 0, 0)
    ];

    curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    pathPoints = curve.getPoints(1000); // 1000 points along the path
    
    // Visualize the path (optional, for debugging)
    // const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    // const pathMaterial = new THREE.LineBasicMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.3 });
    // const pathLine = new THREE.Line(pathLine);
    // scene.add(pathLine);
    
    // Create a tube geometry along the path to represent a continuous plane/ground
    // const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.2, 4, false);
    // const tubeMaterial = new THREE.MeshStandardMaterial({ 
    //     color: 0x7fb069, // Green color for ground
    //     wireframe: false,
    //     side: THREE.DoubleSide,
    //     transparent: true,
    //     opacity: 0.7
    // });
    
    // const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    // scene.add(tubeMesh);
    
    // Alternatively, create a ribbon/path plane along the curve
    createRibbonPath();
}

// Helper function to create a ribbon-like path
function createRibbonPath() {
    // Define the ribbon/tape shape along the path
    const pointsCount = 100;
    const ribbonWidth = 1.2;
    const heightOffset = -1;
    
    // Create vertices for both sides of the ribbon
    const vertices = [];
    const indices = [];
    
    for (let i = 0; i <= pointsCount; i++) {
        // Calculate position along the curve
        const t = i / pointsCount;
        const point = curve.getPointAt(t);
        
        // Calculate the tangent to determine the perpendicular direction
        const tangent = curve.getTangentAt(t).normalize();
        // Create a perpendicular vector to the tangent in the XZ plane
        const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        // Create two vertices on either side of the centerline
        // const leftPoint = new THREE.Vector3().copy(point).add(perp.multiplyScalar(ribbonWidth));
        // const rightPoint = new THREE.Vector3().copy(point).sub(perp.multiplyScalar(ribbonWidth));
        const leftPoint = new THREE.Vector3()
            .copy(point)
            .add(perp.multiplyScalar(ribbonWidth))
            .add(new THREE.Vector3(0, heightOffset, 0));  // 添加高度偏移

        const rightPoint = new THREE.Vector3()
            .copy(point)
            .sub(perp.multiplyScalar(ribbonWidth))
            .add(new THREE.Vector3(0, heightOffset, 0));  // 添加高度偏移

        // Add vertices (left and right for each point along the path)
        vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
        vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);
    }
    
    // Create indices to form triangles
    for (let i = 0; i < pointsCount; i++) {
        const a = i * 2;
        const b = (i * 2) + 1;
        const c = (i * 2) + 2;
        const d = (i * 2) + 3;
        
        // First triangle
        indices.push(a, b, c);
        // Second triangle
        indices.push(b, d, c);
    }
    
    // Create geometry from vertices and indices
    const ribbonGeometry = new THREE.BufferGeometry();
    ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    ribbonGeometry.setIndex(indices);
    ribbonGeometry.computeVertexNormals(); // Calculate normals for proper lighting
    
    // Create material for the ribbon
    const ribbonMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a7d8c, // Blue-gray color
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    scene.add(ribbon);
}

// Load all GLB models from the specified folder
async function loadAllModels() {
    // In a real implementation, we would dynamically fetch the list of files
    // For this example, I'll define the filenames manually
    const modelNames = [
        'a11.glb', 'a2.glb', 'a22.glb', 'a23.glb', 'a4.glb', 'a5.glb', 'a6.glb', 'a7.glb',
        'b11.glb', 'b2.glb', 'b23.glb', 'b24.glb', 'b25.glb', 'b3.glb', 'b7.glb', 'b8.glb',
        'c10.glb', 'c19.glb', 'c26.glb', 'c27.glb', 'c29.glb', 'c32.glb', 'c37.glb', 'c39.glb', 
        'c40.glb', 'c41.glb', 'c42.glb', 'c44.glb', 'c45.glb', 'c47.glb',
        'd1.glb', 'd15.glb', 'd16.glb', 'd19.glb', 'd22.glb', 'd27.glb', 'd28.glb', 'd31.glb', 
        'd33.glb', 'd34.glb', 'd38.glb', 'd48.glb', 'd7.glb'
    ];

    const loader = new THREE.GLTFLoader();
    const promises = [];

    // Create promises for loading all models
    modelNames.forEach(name => {
        promises.push(
            new Promise((resolve, reject) => {
                loader.load(
                    `assets/model_original/${name}`,
                    (gltf) => {
                        // Clone the model to optimize rendering
                        const model = gltf.scene;
                        model.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                // Improve material appearance by increasing brightness
                                if (child.material) {
                                    child.material.side = THREE.DoubleSide;
                                    
                                    // Enhance material properties for better lighting
                                    if (child.material.color) {
                                        // Increase the material's roughness and metalness for better light reflection
                                        if (child.material.roughness !== undefined) {
                                            child.material.roughness = Math.max(0.2, child.material.roughness * 0.5);
                                        }
                                        if (child.material.metalness !== undefined) {
                                            child.material.metalness = Math.min(0.8, child.material.metalness * 1.2);
                                        }
                                    }
                                    
                                    // If it's a MeshStandardMaterial or similar, adjust for better lighting
                                    if (child.material instanceof THREE.MeshStandardMaterial) {
                                        child.material.envMapIntensity = 1.5; // Increase environment map intensity
                                    }
                                }
                            }
                        });
                        
                        resolve(model);
                    },
                    (progress) => {
                        // Progress callback
                        console.log(`Loading ${name}: ${(progress.loaded / progress.total * 100)}%`);
                    },
                    (error) => {
                        console.error(`Error loading model ${name}:`, error);
                        reject(error);
                    }
                );
            })
        );
    });

    try {
        // Wait for all models to load
        const loadedModels = await Promise.all(promises);
        
        // Hide loading message
        document.getElementById('loading').style.display = 'none';
        
        // Place models along the path
        placeModelsOnPath(loadedModels, modelNames);
        
        // Preload renewal models
        preloadRenewModels(modelNames);
        
        // Update model count display
        totalModels = loadedModels.length;
        document.getElementById('modelCount').textContent = totalModels;
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

// Preload renewal models from model_renew folder
async function preloadRenewModels(modelNames) {
    const loader = new THREE.GLTFLoader();
    const renewPromises = [];

    modelNames.forEach(name => {
        renewPromises.push(
            new Promise((resolve) => {
                loader.load(
                    `assets/model_renew/${name}`,
                    (gltf) => {
                        // Process the renewal model the same way as original
                        const renewModel = gltf.scene;
                        renewModel.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                if (child.material) {
                                    child.material.side = THREE.DoubleSide;
                                    
                                    if (child.material.color) {
                                        if (child.material.roughness !== undefined) {
                                            child.material.roughness = Math.max(0.2, child.material.roughness * 0.5);
                                        }
                                        if (child.material.metalness !== undefined) {
                                            child.material.metalness = Math.min(0.8, child.material.metalness * 1.2);
                                        }
                                    }
                                    
                                    if (child.material instanceof THREE.MeshStandardMaterial) {
                                        child.material.envMapIntensity = 1.5;
                                    }
                                }
                            }
                        });
                        
                        // Store the renewal model
                        renewModels[name] = renewModel;
                        console.log(`Preloaded renewal model: ${name}`);
                        resolve(renewModel);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Renewal model not found for ${name}:`, error.message);
                        // If renewal model doesn't exist, we don't store anything
                        resolve(null);
                    }
                );
            })
        );
    });

    // Wait for all renewal models to load
    await Promise.all(renewPromises);
}

// Place models along the path with alternating sides
function placeModelsOnPath(loadedModels, modelNames) {
    const spacing = pathPoints.length / loadedModels.length;
    const sideOffset = 3; // Distance from the path
    
    // Calculate how many path points correspond to 8 units of distance
    // Assuming the path is uniformly sampled, we calculate the index that corresponds to 8 units
    let startIndex = 0;
    for (let i = 1; i < pathPoints.length; i++) {
        const distance = pathPoints[i].distanceTo(pathPoints[i - 1]);
        if (distance > 0) {
            startIndex = Math.ceil(18 / distance);
            break;
        }
    }
    // Ensure the start index doesn't exceed the total available points
    startIndex = Math.min(startIndex, pathPoints.length - 1);

    for (let i = 0; i < loadedModels.length; i++) {
        // Calculate the index accounting for the start offset
        const idx = Math.floor(startIndex + i * spacing);
        if (idx >= pathPoints.length) break;

        const point = pathPoints[idx];
        const nextPoint = idx + 1 < pathPoints.length ? pathPoints[idx + 1] : pathPoints[Math.max(0, idx - 1)];
        
        // Calculate direction vector along the path
        const direction = new THREE.Vector3();
        if(idx < pathPoints.length - 1) {
            direction.subVectors(nextPoint, point).normalize();
        } else if(idx > 0) {
            direction.subVectors(point, pathPoints[idx - 1]).normalize();
        } else {
            direction.set(1, 0, 0); // Default direction
        }

        // Calculate perpendicular vector for offsetting from the path
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        
        // Alternate placing models on either side of the path
        const side = (i % 2 === 0) ? 1 : -1;
        const offset = perpendicular.multiplyScalar(side * sideOffset);

        const position = new THREE.Vector3().addVectors(point, offset);
        
        const model = loadedModels[i];
        model.position.copy(position);
        
        // Scale down models if they are too large
        const scale = 2;
        model.scale.set(scale, scale, scale);
        
        // Make the model face the camera by calculating the look-at direction
        // We'll orient it to generally face toward the central path
        const lookTarget = new THREE.Vector3(point.x, position.y, point.z);
        model.lookAt(lookTarget);
        
        // Add a bit of random rotation to make it look more natural
        // model.rotation.y += (Math.random() - 0.5) * 0.8;
        
        scene.add(model);
        models.push(model);
        
        // Store model data for later use in swapping
        modelData.push({
            model: model,
            position: position.clone(),
            name: modelNames[i],
            isSwapped: false, // Track if this model has been swapped
            originalModel: model // Keep reference to original
        });
    }
}

// Swap original model with renewal model
function swapModel(modelData) {
    const originalModel = modelData.model;
    const renewModel = renewModels[modelData.name];
    
    if (!renewModel) return; // If no renewal model exists, do nothing
    
    // Create a clone of the renewal model to avoid reusing the same object
    const newModel = renewModel.clone();
    
    // Copy position, rotation, and scale from original model
    newModel.position.copy(originalModel.position);
    newModel.rotation.copy(originalModel.rotation);
    newModel.scale.copy(originalModel.scale);
    
    // Set a unique name for the new model to identify it in particle effects
    newModel.name = `building${originalModel.id + 1}`;
    
    // Add new model to scene but keep it invisible initially
    newModel.visible = false;
    scene.add(newModel);
    
    // Trigger disintegration effect for the original model
    originalModel.name = `building${originalModel.id}`;
    particleEffect.createDisintegrationEffect(originalModel, originalModel.id % 2);
    
    // After disintegration completes, remove original and show new
    setTimeout(() => {
        // Remove original model from scene
        scene.remove(originalModel);
        
        // Show the new model
        newModel.visible = true;
        
        // Update the model data
        modelData.model = newModel;
        modelData.isSwapped = true;
        
        // Trigger reconstruction effect to form the new model from particles
        setTimeout(() => {
            particleEffect.createReconstructionEffect(newModel, newModel.id % 2, originalModel);
        }, 100); // Small delay to ensure original is removed
        
        console.log(`Swapped model: ${modelData.name}`);
    }, 2000); // Delay to allow particle effect to finish
}

// Restore original model when camera moves away
function restoreOriginalModel(modelData) {
    if (!modelData.originalModel) return;
    
    const currentModel = modelData.model;
    
    // Clone the original model to avoid reusing the same object
    const originalClone = modelData.originalModel.clone();
    
    // Copy position, rotation, and scale from current model
    originalClone.position.copy(currentModel.position);
    originalClone.rotation.copy(currentModel.rotation);
    originalClone.scale.copy(currentModel.scale);
    
    // Set a unique name for the original model to identify it in particle effects
    originalClone.name = `building${currentModel.id}`;
    
    // Add original model to scene but keep it invisible initially
    originalClone.visible = false;
    scene.add(originalClone);
    
    // Trigger disintegration effect for the renewal model
    particleEffect.createDisintegrationEffect(currentModel, currentModel.id % 2);
    
    // After disintegration completes, remove current and show original
    setTimeout(() => {
        // Remove current model from scene
        scene.remove(currentModel);
        
        // Show the original model
        originalClone.visible = true;
        
        // Update the model data
        modelData.model = originalClone;
        modelData.isSwapped = false;
        
        // Trigger reconstruction effect to form the original model from particles
        setTimeout(() => {
            particleEffect.createReconstructionEffect(originalClone, originalClone.id % 2, currentModel);
        }, 100); // Small delay to ensure current is removed
        
        console.log(`Restored original model: ${modelData.name}`);
    }, 2000); // Delay to allow particle effect to finish
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    // Update particle effects
    particleEffect.update();
    
    // Check for model swaps based on camera position
    checkModelSwaps();
    
    // Render the scene
    renderer.render(scene, camera);
}

// Check if any models need to be swapped based on camera proximity
function checkModelSwaps() {
    // Calculate the lookAt point (where the camera is looking)
    const pathIndex = Math.floor(currentPathPosition * (pathPoints.length - 1));
    const lookAheadDistance = 5;
    const lookAheadSteps = Math.floor(lookAheadDistance * (pathPoints.length / curve.getLength()));
    const lookAhedIndex = Math.min(pathIndex + lookAheadSteps, pathPoints.length - 1);
    const lookAtPoint = pathPoints[lookAhedIndex];
    
    // Check each model to see if it should be swapped
    modelData.forEach(data => {
        const distance = lookAtPoint.distanceTo(data.position);
        
        // If close enough and has a renewal model
        if (distance < MODEL_SWAP_DISTANCE) {
            if (!data.isSwapped && renewModels[data.name]) {
                swapModel(data);
            }
        } else {
            // If far away but model is swapped, swap back to original
            if (data.isSwapped && renewModels[data.name]) {
                restoreOriginalModel(data);
            }
        }
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle mouse wheel for camera movement along the path
function onMouseWheel(event) {
    // Adjust the path position based on scroll direction
    const scrollSensitivity = 0.001;
    currentPathPosition += event.deltaY > 0 ? scrollSensitivity : -scrollSensitivity;
    
    // Keep the position within the path bounds
    currentPathPosition = Math.max(0, Math.min(1, currentPathPosition));
    
    // Get the corresponding point on the path
    const pathIndex = Math.floor(currentPathPosition * (pathPoints.length - 1));
    const targetPoint = pathPoints[pathIndex];
    
    // Position the camera ahead of the target point
    const lookAheadDistance = 10; // How far ahead to look
    const lookAheadSteps = Math.floor(lookAheadDistance * (pathPoints.length / curve.getLength()));
    const lookAhedIndex = Math.min(pathIndex + lookAheadSteps, pathPoints.length - 1);
    const lookAtPoint = pathPoints[lookAhedIndex];
    
    // Set camera position and look direction
    camera.position.copy(targetPoint);
    camera.position.y += 2; // Raise the camera above the path
    
    // Make camera look slightly forward along the path
    camera.lookAt(lookAtPoint.x, lookAtPoint.y + 2, lookAtPoint.z);
}

// DOM Content Loaded Event - Entry point
document.addEventListener('DOMContentLoaded', () => {
    // Get the video element and create a video controller
    const videoElement = document.getElementById('videoElement');
    const videoController = new VideoController(videoElement);
    
    // Set the callback to initialize the 3D scene when video ends
    videoController.onVideoEnd = () => {
        init();
    };
    
    // Note: We no longer auto-play the video. 
    // User needs to click the play button to start the video.
    // The skip button allows bypassing the video entirely.
});