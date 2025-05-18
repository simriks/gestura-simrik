// DOM Elements
const transformBtn = document.getElementById('transformBtn');
const clearBtn = document.getElementById('clearBtn');
const aiArtDisplay = document.getElementById('aiArtDisplay');
const styleButtons = document.querySelectorAll('.style-btn');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');

// Current selected style
let currentStyle = 'van-gogh';
let isDrawing = false;

// Drawing settings
ctx.strokeStyle = '#000';
ctx.lineWidth = 5;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Event Listeners
transformBtn.addEventListener('click', transformDrawing);
clearBtn.addEventListener('click', clearCanvas);
styleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        styleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.style;
    });
});

// Initialize webcam and hand tracking
async function initializeWebcam() {
    const video = document.getElementById('webcam');
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({image: video});
        },
        width: 640,
        height: 480
    });

    await camera.start();
}

// Handle hand tracking results
function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        const indexFinger = hand[8];
        const middleFinger = hand[12];
        
        // Calculate distance between index and middle finger
        const distance = Math.sqrt(
            Math.pow(indexFinger.x - middleFinger.x, 2) +
            Math.pow(indexFinger.y - middleFinger.y, 2)
        );

        // Start drawing when fingers are close (pinched)
        if (distance < 0.08) {
            if (!isDrawing) {
                ctx.beginPath();
                ctx.moveTo(
                    indexFinger.x * canvas.width,
                    indexFinger.y * canvas.height
                );
                isDrawing = true;
            } else {
                ctx.lineTo(
                    indexFinger.x * canvas.width,
                    indexFinger.y * canvas.height
                );
                ctx.stroke();
            }
        } else {
            isDrawing = false;
        }
    }
}

// Transform drawing using Gemini
async function transformDrawing() {
    const imageData = canvas.toDataURL('image/png');

    // Show loading state
    aiArtDisplay.innerHTML = `
        <div class="placeholder loading">
            <div>Transforming your drawing into ${currentStyle} style...</div>
            <div style="font-size: 1.2rem; margin-top: 10px; opacity: 0.7">This may take a few seconds</div>
        </div>
    `;

    try {
        const response = await fetch('/api/transform', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData,
                style: currentStyle
            })
        });

        if (!response.ok) {
            throw new Error('Failed to transform drawing');
        }

        const result = await response.json();
        
        // Display the transformed art
        aiArtDisplay.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 15px; color: #666;">
                    ${result.explanation}
                </div>
                <img src="${result.transformedImage}" 
                     alt="AI transformed art"
                     style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            </div>
        `;
    } catch (error) {
        console.error('Error transforming drawing:', error);
        aiArtDisplay.innerHTML = `
            <div class="placeholder" style="color: #e74c3c;">
                <div>Sorry, there was an error transforming your drawing.</div>
                <button onclick="transformDrawing()" 
                        style="margin-top: 15px; padding: 8px 16px; border-radius: 4px; 
                               background: #3498db; color: white; border: none; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset AI display
    aiArtDisplay.innerHTML = `
        <div class="placeholder">Draw something to see the AI transformation!</div>
    `;
}

// Initialize webcam and gesture recognition on page load
window.onload = initializeWebcam; 