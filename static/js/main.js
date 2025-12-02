import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let renderer, scene, camera, controls;

function initThreeJSViewer(modelUrl) {
    const container = document.getElementById('threejs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 1. Setup Scene
    scene = new THREE.Scene();
    // REMOVED: scene.background = ... (This lets the CSS gradient show through!)

    // 2. Setup Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.set(2, 2, 5);

    // 3. Setup Renderer (Transparent & High Quality)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha: true is critical
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. "SPARKLING" LIGHTING SETUP
    // A. Bright Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Increased intensity
    scene.add(ambientLight);

    // B. Strong Key Light (Sunlight)
    const mainLight = new THREE.DirectionalLight(0xffffff, 3.5); // Very bright
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024; // Sharper shadows
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // C. Blueish Rim Light (Cool reflection)
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 2.5);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);
    
    // D. Bottom Light (Bounces light up)
    const bottomLight = new THREE.DirectionalLight(0xffffff, 1.0);
    bottomLight.position.set(0, -5, 0);
    scene.add(bottomLight);

    // 5. Controls with Auto-Rotate
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true; // <--- Makes it spin slowly (sparkles!)
    controls.autoRotateSpeed = 2.0;

    // 6. Load Model
    const loader = new GLTFLoader();
    
    loader.load(
        modelUrl,
        (gltf) => {
            const model = gltf.scene;
            
            // Add shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    // Make materials slightly shiny if possible
                    if (node.material) {
                        node.material.roughness = 0.6; // Less rough = more shiny
                        node.material.metalness = 0.1;
                    }
                }
            });

            // Center Model
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            model.position.x += (model.position.x - center.x);
            model.position.y += (model.position.y - center.y);
            model.position.z += (model.position.z - center.z);
            
            scene.add(model);
            
            // Fit Camera
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraDistance = (maxDim / 2) / Math.tan(fov / 2);
            cameraDistance *= 1.8; // Give it space
            
            camera.position.set(cameraDistance * 0.5, cameraDistance * 0.5, cameraDistance);
            controls.target.set(0, 0, 0);
        },
        undefined,
        (error) => console.error(error)
    );

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Required for auto-rotate
        renderer.render(scene, camera);
    }
    animate();
    
    // Resize
    window.addEventListener('resize', () => {
        if (!container) return;
        const w = container.clientWidth; 
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

// Main Application State
let currentTaskId = null;
let statusCheckInterval = null;
let generationStartTime = null;

// Progress tracking
let currentStep = 0;
const TOTAL_STEPS = 4;
const STEP_PROGRESS = 25;
let stepTimers = {};
let stepStartTimes = {};

// Model viewer state
let currentRotation = 0;
let currentZoom = 2.5;
const ROTATION_STEP = 30; // degrees

// DOM Elements
const elements = {
    prompt: document.getElementById('prompt'),
    charCount: document.querySelector('.char-count'),
    textGenerateBtn: document.getElementById('text-generate-btn'),
    imageGenerateBtn: document.getElementById('image-generate-btn'),
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    imagePreview: document.getElementById('image-preview'),
    previewImage: document.getElementById('preview-image'),
    placeholderView: document.getElementById('placeholder-view'),
    modelViewContainer: document.getElementById('model-view-container'),
    statusArea: document.getElementById('status-area'),
    progressContainer: document.getElementById('progress-container'),
    progressText: document.getElementById('progress-text'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
    actionsContainer: document.getElementById('actions-container'),
    modelInfo: document.getElementById('model-info'),
    genTime: document.getElementById('gen-time'),
    vertexCount: document.getElementById('vertex-count'),
    faceCount: document.getElementById('face-count'),
    serverStatus: document.getElementById('server-status'),
    toast: document.getElementById('toast')
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    initTabSwitching();
    initCharacterCount();
    initFileUpload();
    initServerHealthCheck();
    
    console.log('DreamMesh Web UI initialized');
});

function initTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function(event) {
            const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            switchTab(tabId, event);
        });
    });
}

function initCharacterCount() {
    if (elements.prompt) {
        elements.prompt.addEventListener('input', function() {
            const count = this.value.length;
            elements.charCount.textContent = `${count}/500`;
            elements.charCount.style.color = count > 500 ? '#ef4444' : '#6b7280';
        });
        
        // Initialize count
        const count = elements.prompt.value.length;
        elements.charCount.textContent = `${count}/500`;
    }
}

function initFileUpload() {
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            elements.fileInput.files = files;
            handleFileSelect();
        } else {
            showToast('Please drop an image file (PNG, JPG, JPEG)', 'error');
        }
    });

    elements.fileInput.addEventListener('change', handleFileSelect);
}

function initServerHealthCheck() {
    checkServerHealth();
    setInterval(checkServerHealth, 30000);
}

// Tab Switching
function switchTab(tabId, event) {
    if (event) {
        event.preventDefault();
    }
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate clicked tab button
    if (event) {
        event.target.classList.add('active');
    }
    
    // Show corresponding tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    // Reset form states
    if (tabId === 'image-tab') {
        checkImageUpload();
    }
}

// File Upload Handling
function handleFileSelect() {
    const file = elements.fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            elements.previewImage.src = e.target.result;
            elements.imagePreview.classList.remove('hidden');
            elements.imageGenerateBtn.disabled = false;
            elements.uploadArea.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    elements.fileInput.value = '';
    elements.imagePreview.classList.add('hidden');
    elements.uploadArea.classList.remove('hidden');
    elements.imageGenerateBtn.disabled = true;
}

function checkImageUpload() {
    if (elements.fileInput.files.length > 0) {
        elements.imageGenerateBtn.disabled = false;
    }
}

// Text to 3D Generation
async function generateFromText() {
    const prompt = elements.prompt.value.trim();
    if (!prompt) {
        showToast('Please enter a text prompt', 'error');
        return;
    }
    
    if (prompt.length > 500) {
        showToast('Prompt is too long (max 500 characters)', 'error');
        return;
    }
    
    elements.textGenerateBtn.disabled = true;
    elements.textGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generationStartTime = Date.now();
    
    try {
        const response = await axios.post('/api/v1/text-to-3d', {
            prompt: prompt,
            seed: parseInt(document.getElementById('t2i-seed').value) || 0,
            enable_texture: document.getElementById('t2i-texture').checked,
            octree_resolution: parseInt(document.getElementById('t2i-resolution').value),
            num_inference_steps: 50,
            num_chunks: 20000,
            output_type: "trimesh"
        });
        
        currentTaskId = response.data.task_id;
        startStatusChecking();
        showStatus('processing', 'Starting text-to-3D generation...');
        
    } catch (error) {
        console.error('Generation error:', error);
        showToast(`Failed to start generation: ${error.message}`, 'error');
        resetGenerateButton('text');
    }
}

// Image to 3D Generation
async function generateFromImage() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files[0]) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    elements.imageGenerateBtn.disabled = true;
    elements.imageGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generationStartTime = Date.now();
    
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    formData.append('seed', document.getElementById('i2i-seed').value || 0);
    formData.append('enable_texture', document.getElementById('i2i-texture').checked);
    formData.append('octree_resolution', document.getElementById('i2i-resolution').value);
    formData.append('num_inference_steps', '50');
    formData.append('num_chunks', '20000');
    formData.append('output_type', "trimesh");
    
    try {
        const response = await axios.post('/api/v1/image-to-3d', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        currentTaskId = response.data.task_id;
        startStatusChecking();
        showStatus('processing', 'Starting image-to-3D generation...');
        
    } catch (error) {
        console.error('Generation error:', error);
        showToast(`Failed to start generation: ${error.message}`, 'error');
        resetGenerateButton('image');
    }
}

// ==================== PROGRESS BAR FIXES ====================

// Status Checking
function startStatusChecking() {
    currentStep = 1;
    stepStartTimes = {1: Date.now()};
    updateProgress('Initializing generation...', 0);
    elements.progressContainer.classList.remove('hidden');
    updateStep(1);
    
    // Start step 1 timer (3 seconds to 25%)
    startStepTimer(1, 3000, 25);
    
    // Check status from API every 5 seconds
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await axios.get(`/api/v1/status/${currentTaskId}`);
            const status = response.data;
            
            // Update based on API response
            handleStatusUpdate(status);
            
            if (status.status === 'completed') {
                clearInterval(statusCheckInterval);
                clearAllStepTimers();
                onGenerationComplete(status);
            } else if (status.status === 'error') {
                clearInterval(statusCheckInterval);
                clearAllStepTimers();
                onGenerationError(status.message);
            }
            
        } catch (error) {
            console.error('Status check error:', error);
            if (error.response?.status === 404) {
                clearInterval(statusCheckInterval);
                clearAllStepTimers();
                onGenerationError('Task not found or expired');
            }
        }
    }, 10000);
}

function handleStatusUpdate(status) {
    if (status.message) {
        elements.progressText.textContent = status.message;
        
        // Check if we need to advance to next step based on API message
        const lowerMessage = status.message.toLowerCase();
        
        if (currentStep === 1 && (lowerMessage.includes('shape') || lowerMessage.includes('mesh') || lowerMessage.includes('generating'))) {
            advanceToStep(2);
        } else if (currentStep === 2 && (lowerMessage.includes('texture') || lowerMessage.includes('color') || lowerMessage.includes('material'))) {
            advanceToStep(3);
        } else if (currentStep === 3 && (lowerMessage.includes('final') || lowerMessage.includes('export') || lowerMessage.includes('complet'))) {
            advanceToStep(4);
        }
    }
}

function advanceToStep(step) {
    if (step <= currentStep) return;
    
    // Clear previous step timer
    if (stepTimers[currentStep]) {
        clearInterval(stepTimers[currentStep]);
    }
    
    // Set progress to exact percentage for completed step
    const completedProgress = (step - 1) * STEP_PROGRESS;
    updateProgress(`Step ${step - 1} completed`, completedProgress);
    
    currentStep = step;
    stepStartTimes[step] = Date.now();
    updateStep(step);
    
    // Start timer for current step
    if (step === 2) {
        // Step 2: 5 seconds to reach 50%
        startStepTimer(2, 5000, 50);
    } else if (step === 3) {
        // Step 3: 8 seconds to reach 75%
        startStepTimer(3, 8000, 75);
    }
}

function startStepTimer(step, duration, targetPercent) {
    const startTime = Date.now();
    const startPercent = (step - 1) * STEP_PROGRESS;
    
    // Clear any existing timer for this step
    if (stepTimers[step]) {
        clearInterval(stepTimers[step]);
    }
    
    stepTimers[step] = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth animation
        const currentPercent = startPercent + (targetPercent - startPercent) * progress;
        
        updateProgress(getStepMessage(step), currentPercent);
        
        if (progress >= 1) {
            clearInterval(stepTimers[step]);
            // If this is step 3 and generation hasn't completed yet,
            // hold at 75% until API says it's done
            if (step === 3) {
                updateProgress('Finalizing model...', 75);
            }
        }
    }, 100); // Update every 100ms for smooth animation
}

function getStepMessage(step) {
    switch(step) {
        case 1: return 'Processing input...';
        case 2: return 'Generating 3D shape...';
        case 3: return 'Adding textures...';
        case 4: return 'Finalizing model...';
        default: return 'Processing...';
    }
}

function clearAllStepTimers() {
    Object.values(stepTimers).forEach(timer => clearInterval(timer));
    stepTimers = {};
}

function updateProgress(message, percent) {
    elements.progressText.textContent = message;
    elements.progressPercent.textContent = `${Math.round(percent)}%`;
    
    // Smooth animation for progress fill
    const currentPercent = parseInt(elements.progressFill.style.width) || 0;
    const difference = Math.abs(percent - currentPercent);
    
    if (difference > 0) {
        animateProgress(currentPercent, percent);
    }
}

function animateProgress(from, to) {
    const duration = 300; // ms
    const startTime = Date.now();
    const element = elements.progressFill;
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease function for smooth animation
        const ease = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const currentPercent = from + (to - from) * ease;
        element.style.width = `${currentPercent}%`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateStep(stepNumber) {
    // Reset all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.remove('active');
    }
    
    // Activate current step and all previous steps
    for (let i = 1; i <= stepNumber; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.add('active');
    }
}

function onGenerationComplete(status) {
    clearAllStepTimers();
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    
    currentStep = 4;
    updateProgress('Generation completed!', 100);
    updateStep(4);
    
    // FIX: Check if genTime element exists before trying to update it
    if (elements.genTime && generationStartTime) {
        const generationTime = Math.round((Date.now() - generationStartTime) / 1000);
        elements.genTime.textContent = `${generationTime}s`;
    }
    
    // FIX: Show the actions (Download button) IMMEDIATELY
    // We do not wait for the model viewer or anything else
    if (elements.actionsContainer) {
        elements.actionsContainer.classList.remove('hidden');
    }

    // Try to show the preview, but catch errors so we don't break the UI
    try {
        showModelPreview();
    } catch (e) {
        console.error("Error showing preview:", e);
    }

    showStatus('completed', '3D model generated successfully!');
    showToast('3D model generated successfully!', 'success');
    
    resetGenerateButtons();
}

function onGenerationError(message) {
    clearAllStepTimers();
    clearInterval(statusCheckInterval);
    
    updateProgress('Generation failed', 0);
    showStatus('error', `Generation failed: ${message}`);
    resetGenerateButtons();
    showToast(`Generation failed: ${message}`, 'error');
}

function showStatus(type, message) {
    const statusClass = `status-${type}`;
    elements.statusArea.innerHTML = `
        <div class="status-message ${statusClass}">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'completed' ? 'check-circle' : 'spinner fa-spin'}"></i>
            <span>${message}</span>
        </div>
    `;
}

// ==================== MODEL VIEWER FIXES ====================

async function showModelPreview() {
    // 1. Hide the placeholder
    if (elements.placeholderView) {
        elements.placeholderView.classList.add('hidden');
    }

    // 2. Show the Three.js container
    const threeContainer = document.getElementById('threejs-container');
    if (threeContainer) {
        threeContainer.classList.remove('hidden');
    }

    // 3. Construct URL
    const timestamp = Date.now();
    // Ensure this path matches your backend exactly
    const modelUrl = `/api/v1/view/${currentTaskId}?t=${timestamp}`;
    
    console.log("Loading model from:", modelUrl);

    // 4. Initialize Three.js
    initThreeJSViewer(modelUrl);
}

// ==================== UTILITY FUNCTIONS ====================

function resetGenerateButtons() {
    elements.textGenerateBtn.disabled = false;
    elements.textGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
    elements.imageGenerateBtn.disabled = false;
    elements.imageGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
}

function resetGenerateButton(type) {
    if (type === 'text') {
        elements.textGenerateBtn.disabled = false;
        elements.textGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
    } else {
        elements.imageGenerateBtn.disabled = false;
        elements.imageGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
    }
}

function downloadModel() {
    const modelUrl = `/api/v1/download/${currentTaskId}`;
    
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = modelUrl;
    link.download = `dreammesh-model-${currentTaskId}.glb`;
    link.target = '_blank';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Download started. Check your downloads folder.', 'success');
}

function resetGeneration() {
    clearAllStepTimers();
    clearInterval(statusCheckInterval);
    
    elements.progressContainer.classList.add('hidden');
    elements.actionsContainer.classList.add('hidden');
    elements.statusArea.innerHTML = '';
    elements.placeholderView.classList.remove('hidden');
    elements.modelViewContainer.classList.add('hidden');
    
    currentTaskId = null;
    currentStep = 0;
}

// Toast Notifications
function showToast(message, type = 'info') {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    elements.toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    elements.toast.style.display = 'flex';
    elements.toast.className = `toast ${type}`;
    
    setTimeout(() => {
        elements.toast.style.display = 'none';
    }, 3000);
}

// Server Health Check
function checkServerHealth() {
    axios.get('/health')
        .then(response => {
            if (response.data.status === 'healthy') {
                elements.serverStatus.classList.add('online');
            }
        })
        .catch(() => {
            elements.serverStatus.classList.remove('online');
        });
}

window.switchTab = switchTab;
window.handleFileSelect = handleFileSelect;
window.removeImage = removeImage;
window.generateFromText = generateFromText;
window.generateFromImage = generateFromImage;
window.downloadModel = downloadModel;