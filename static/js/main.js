        let currentTaskId = null;
        let statusCheckInterval = null;
        
        // Tab switching
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
        
        // File upload handling
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                const preview = document.getElementById('file-preview');
                const img = document.getElementById('preview-image');
                const btn = document.getElementById('image-generate-btn');
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    img.src = e.target.result;
                    preview.classList.remove('hidden');
                    btn.disabled = false;
                };
                reader.readAsDataURL(file);
            }
        }
        
        // Drag and drop
        const fileUploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect({ target: fileInput });
            }
        });
        
        // Text to 3D generation
        async function generateFromText() {
            const prompt = document.getElementById('prompt').value.trim();
            if (!prompt) {
                alert('Please enter a text prompt');
                return;
            }
            
            const btn = document.getElementById('text-generate-btn');
            btn.disabled = true;
            btn.textContent = 'Generating...';
            
            try {
                const response = await axios.post('/api/v1/text-to-3d', {
                    prompt: prompt,
                    seed: parseInt(document.getElementById('t2i-seed').value),
                    enable_texture: document.getElementById('t2i-texture').checked,
                    octree_resolution: parseInt(document.getElementById('t2i-resolution').value),
                    num_inference_steps: 30,
                    guidance_scale: 5.0,
                    face_count: 40000
                });
                
                currentTaskId = response.data.task_id;
                startStatusChecking();
                
            } catch (error) {
                console.error('Generation error:', error);
                showStatus('error', 'Failed to start generation: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Generate 3D Model';
            }
        }
        
        // Image to 3D generation
        async function generateFromImage() {
            const fileInput = document.getElementById('file-input');
            if (!fileInput.files[0]) {
                alert('Please select an image file');
                return;
            }
            
            const btn = document.getElementById('image-generate-btn');
            btn.disabled = true;
            btn.textContent = 'Generating...';
            
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('seed', document.getElementById('i2i-seed').value);
            formData.append('enable_texture', document.getElementById('i2i-texture').checked);
            formData.append('octree_resolution', document.getElementById('i2i-resolution').value);
            formData.append('num_inference_steps', '30');
            formData.append('guidance_scale', '5.0');
            formData.append('face_count', '40000');
            
            try {
                const response = await axios.post('/api/v1/image-to-3d', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                currentTaskId = response.data.task_id;
                startStatusChecking();
                
            } catch (error) {
                console.error('Generation error:', error);
                showStatus('error', 'Failed to start generation: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Generate 3D Model';
            }
        }
        
        // Status checking
        function startStatusChecking() {
            showStatus('processing', 'Starting generation process...');
            document.getElementById('progress-bar').classList.remove('hidden');
            
            statusCheckInterval = setInterval(async () => {
                try {
                    const response = await axios.get(`/api/status/${currentTaskId}`);
                    const status = response.data;
                    
                    updateProgress(status.message);
                    
                    if (status.status === 'completed') {
                        clearInterval(statusCheckInterval);
                        showStatus('completed', 'Generation completed successfully!');
                        document.getElementById('download-btn').classList.remove('hidden');
                        showModelPreview();
                        resetGenerateButtons();
                    } else if (status.status === 'error') {
                        clearInterval(statusCheckInterval);
                        showStatus('error', 'Generation failed: ' + status.message);
                        resetGenerateButtons();
                    }
                    
                } catch (error) {
                    console.error('Status check error:', error);
                }
            }, 2000);
        }
        
        function updateProgress(message) {
            const statusArea = document.getElementById('status-area');
            statusArea.innerHTML = `<div class="status-message status-processing">${message}</div>`;
        }
        
        function showStatus(type, message) {
            const statusArea = document.getElementById('status-area');
            statusArea.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
        }
        
        function showModelPreview() {
            document.getElementById('placeholder').classList.add('hidden');
            const viewer = document.getElementById('model-viewer');
            viewer.classList.remove('hidden');
            viewer.src = `/download/${currentTaskId}`;
        }
        
        function resetGenerateButtons() {
            document.getElementById('text-generate-btn').disabled = false;
            document.getElementById('text-generate-btn').textContent = 'Generate 3D Model';
            document.getElementById('image-generate-btn').disabled = false;
            document.getElementById('image-generate-btn').textContent = 'Generate 3D Model';
        }
        
        function downloadModel() {
            window.open(`/download/${currentTaskId}`, '_blank');
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            // Check server health
            axios.get('/api/v1/health')
                .then(response => {
                    console.log('Server is healthy:', response.data);
                })
                .catch(error => {
                    console.error('Server health check failed:', error);
                });
        });