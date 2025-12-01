// Main Application State
let currentTaskId = null;
let statusCheckInterval = null;
let generationStartTime = null;
let modelViewer = null;

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
    modelViewer: document.getElementById('model-viewer'),
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

document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', function(event) {
        const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
        switchTab(tabId, event);
    });
});

// Character Count for Textarea
if (elements.prompt) {
    elements.prompt.addEventListener('input', function() {
        const count = this.value.length;
        elements.charCount.textContent = `${count}/500`;
        elements.charCount.style.color = count > 500 ? '#ef4444' : '#6b7280';
    });
}

// File Upload Handling
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

// Status Checking
function startStatusChecking() {
    updateProgress('Initializing...', 0);
    elements.progressContainer.classList.remove('hidden');
    updateStep(1);
    
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await axios.get(`/api/v1/status/${currentTaskId}`);
            const status = response.data;
            
            updateStatus(status);
            
            if (status.status === 'completed') {
                clearInterval(statusCheckInterval);
                onGenerationComplete(status);
            } else if (status.status === 'error') {
                clearInterval(statusCheckInterval);
                onGenerationError(status.message);
            }
            
        } catch (error) {
            console.error('Status check error:', error);
            if (error.response?.status === 404) {
                clearInterval(statusCheckInterval);
                onGenerationError('Task not found or expired');
            }
        }
    }, 30000);
}

function updateStatus(status) {
    let progress = 0;
    let step = 1;
    
    if (status.message) {
        elements.progressText.textContent = status.message;
        
        if (status.message.includes('image')) {
            progress = 25;
            step = 1;
        } else if (status.message.includes('shape')) {
            progress = 50;
            step = 2;
        } else if (status.message.includes('texture')) {
            progress = 75;
            step = 3;
        }
        
        updateProgress(status.message, progress);
        updateStep(step);
    }
}

function updateProgress(message, percent) {
    elements.progressText.textContent = message;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
}

function updateStep(stepNumber) {
    // Reset all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.remove('active');
    }
    
    // Activate current step
    for (let i = 1; i <= stepNumber; i++) {
        const step = document.getElementById(`step-${i}`);
        step.classList.add('active');
    }
}

function onGenerationComplete(status) {
    updateProgress('Generation completed!', 100);
    updateStep(4);
    
    const generationTime = Math.round((Date.now() - generationStartTime) / 1000);
    elements.genTime.textContent = `${generationTime}s`;
    
    showModelPreview();
    showStatus('completed', '3D model generated successfully!');
    
    elements.actionsContainer.classList.remove('hidden');
    resetGenerateButtons();
    
    showToast('3D model generated successfully!', 'success');
}

function onGenerationError(message) {
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

function showModelPreview() {
    elements.placeholderView.classList.add('hidden');
    elements.modelViewContainer.classList.remove('hidden');

    elements.modelViewer.onload = function() {
        elements.modelInfo.textContent = 'Model loaded successfully';
    };
    
    elements.modelViewer.onerror = function() {
        elements.modelInfo.textContent = 'Failed to load model';
        showToast('Failed to load 3D model viewer', 'error');
    };

    elements.modelViewer.src = `/api/v1/download/${currentTaskId}`;
    
    // Update model info
    elements.modelInfo.textContent = 'Model loaded successfully';
}

function resetGenerateButtons() {
    elements.textGenerateBtn.disabled = false;
    elements.textGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate 3D Model';
    elements.imageGenerateBtn.disabled = false;
    elements.imageGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate 3D Model';
}

function resetGenerateButton(type) {
    if (type === 'text') {
        elements.textGenerateBtn.disabled = false;
        elements.textGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate 3D Model';
    } else {
        elements.imageGenerateBtn.disabled = false;
        elements.imageGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate 3D Model';
    }
}

function downloadModel() {
    window.open(`/api/v1/download/${currentTaskId}`, '_blank');
}

function shareModel() {
    if (navigator.share) {
        navigator.share({
            title: 'My 3D Model from DreamMesh',
            text: 'Check out this 3D model I created with DreamMesh AI!',
            url: window.location.origin + `/api/v1/download/${currentTaskId}`,
        }).catch(error => {
            console.log('Sharing cancelled or failed:', error);
            copyToClipboardFallback();
        });
    } else {
        copyToClipboardFallback();
    }
}

function copyToClipboardFallback() {
    const url = window.location.origin + `/api/v1/download/${currentTaskId}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Download link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy link. Please manually copy the URL.', 'error');
    });
}

function resetGeneration() {
    elements.progressContainer.classList.add('hidden');
    elements.actionsContainer.classList.add('hidden');
    elements.statusArea.innerHTML = '';
    elements.placeholderView.classList.remove('hidden');
    elements.modelViewContainer.classList.add('hidden');
    currentTaskId = null;
}

// Model Viewer Controls
function rotateModel(direction) {
    // This would control the 3D viewer rotation
    // Implement based on your 3D viewer library
    console.log(`Rotate ${direction}`);
}

function zoomModel(action) {
    // This would control the 3D viewer zoom
    console.log(`Zoom ${action}`);
}

function resetView() {
    // Reset 3D viewer to default view
    console.log('Reset view');
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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check server health
    checkServerHealth();
    setInterval(checkServerHealth, 30000);
    
    // Initialize character count
    if (elements.prompt) {
        const count = elements.prompt.value.length;
        elements.charCount.textContent = `${count}/500`;
    }
    
    console.log('DreamMesh Web UI initialized');
});

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
    } else {
        // Fallback if called without event
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
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