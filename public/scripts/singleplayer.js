// Update the API URL based on environment
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

let currentPromptSet = [];
let selectedPrompt = '';
let timeLeft = 30;
let timerInterval = null;
let isDrawing = false;
let countdownActive = false;
let isGameEnded = false; // New flag to track if game has ended

// Initialize the game
async function initGame() {
    try {
        // Reset game state
        selectedPrompt = '';
        isDrawing = false;
        countdownActive = false;
        isGameEnded = false; // Reset game ended flag
        clearInterval(timerInterval);
        
        // Reset canvas
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Reset webcam
        const webcam = document.getElementById('webcam');
        const frozenFrame = webcam.parentNode.querySelector('img');
        if (frozenFrame) {
            frozenFrame.remove();
        }
        webcam.style.display = 'block';
        
        // Restart webcam if needed
        if (!webcam.srcObject) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcam.srcObject = stream;
            } catch (err) {
                console.error('Error accessing webcam:', err);
            }
        }
        
        // Show word selection screen, hide drawing screen
        document.getElementById('wordSelectionScreen').style.display = 'flex';
        document.getElementById('drawingScreen').style.display = 'none';
        
        // Hide timer and current prompt
        document.getElementById('timer').style.display = 'none';
        document.getElementById('currentPrompt').style.display = 'none';
        
        // Hide AI response
        const aiResponse = document.getElementById('aiResponse');
        aiResponse.innerHTML = '';
        aiResponse.classList.remove('show');
        
        // Get AI-generated prompts
        const response = await fetch(`${API_URL}/api/prompts`);
        if (!response.ok) {
            throw new Error('Failed to fetch prompts');
        }
        const promptsData = await response.json();
        currentPromptSet = Array.isArray(promptsData) ? promptsData : [];
        
        if (currentPromptSet.length === 0) {
            throw new Error('No prompts received');
        }
        
        // Create prompt buttons
        const promptOptionsDiv = document.getElementById('promptOptions');
        promptOptionsDiv.innerHTML = '';
        
        currentPromptSet.forEach(promptText => {
            const button = document.createElement('button');
            button.className = 'prompt-option';
            button.textContent = promptText;
            button.onclick = () => selectPrompt(promptText);
            promptOptionsDiv.appendChild(button);
        });
        
    } catch (error) {
        console.error('Error initializing game:', error);
        const promptOptionsDiv = document.getElementById('promptOptions');
        promptOptionsDiv.innerHTML = '<p>Error loading prompts. Please try again. Details: ' + error.message + '</p>';
    }
}

// Handle prompt selection
function selectPrompt(prompt) {
    selectedPrompt = prompt;
    
    // Hide word selection screen, show drawing screen
    document.getElementById('wordSelectionScreen').style.display = 'none';
    document.getElementById('drawingScreen').style.display = 'block';
    
    // Update UI
    document.getElementById('currentPrompt').textContent = `Draw: ${prompt}`;
    document.getElementById('currentPrompt').style.display = 'block';
    document.getElementById('timer').style.display = 'block';
    
    // Start countdown
    startCountdown();
}

// Countdown before drawing starts
function startCountdown() {
    countdownActive = true;
    const countdownDiv = document.createElement('div');
    countdownDiv.className = 'countdown';
    document.body.appendChild(countdownDiv);

    const messages = ['Ready?', '2', '1', 'START!'];
    let index = 0;

    function showMessage() {
        if (index < messages.length) {
            countdownDiv.textContent = messages[index];
            countdownDiv.style.color = messages[index] === 'START!' ? '#2ecc71' : '#ffffff';
            index++;
            
            const delay = messages[index - 1] === 'START!' ? 500 : 1000;
            setTimeout(() => {
                if (countdownActive) {
                    showMessage();
                }
            }, delay);
        } else {
            countdownDiv.remove();
            startDrawing();
        }
    }

    showMessage();
}

// Start drawing phase
function startDrawing() {
    if (!countdownActive) return;
    
    isDrawing = true;
    startTimer();
}

// Timer function
function startTimer() {
    timeLeft = 30;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            isGameEnded = true; // Set game ended flag
            
            // Freeze the webcam feed
            const webcam = document.getElementById('webcam');
            const canvas = document.createElement('canvas');
            canvas.width = webcam.videoWidth;
            canvas.height = webcam.videoHeight;
            canvas.getContext('2d').drawImage(webcam, 0, 0);
            
            // Create an img element with the frozen frame
            const frozenFrame = document.createElement('img');
            frozenFrame.src = canvas.toDataURL();
            frozenFrame.style.width = '100%';
            frozenFrame.style.height = 'auto';
            frozenFrame.style.borderRadius = '10px';
            
            // Replace video with frozen frame
            webcam.style.display = 'none';
            webcam.parentNode.insertBefore(frozenFrame, webcam);
            
            // Stop the webcam stream
            if (webcam.srcObject) {
                const tracks = webcam.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            
            showTimeUpMessage();
            setTimeout(() => {
                endGame();
            }, 1500);
        }
    }, 1000);
}

function showTimeUpMessage() {
    const timeUpDiv = document.createElement('div');
    timeUpDiv.className = 'times-up';
    timeUpDiv.textContent = 'Time\'s Up!';
    document.body.appendChild(timeUpDiv);

    setTimeout(() => {
        timeUpDiv.style.opacity = '0';
        timeUpDiv.style.transform = 'translate(-50%, -50%) scale(0.8)';
        timeUpDiv.style.transition = 'all 0.3s ease-out';
        setTimeout(() => {
            timeUpDiv.remove();
        }, 300);
    }, 1500);
}

function updateTimerDisplay() {
    document.getElementById('timeLeft').textContent = timeLeft;
}

// End game and get AI guess
async function endGame() {
    isDrawing = false;
    countdownActive = false;

    // Get the canvas data
    const canvas = document.getElementById('drawingCanvas');
    const imageData = canvas.toDataURL('image/png');

    // Show loading state with larger, centered display
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.innerHTML = `
        <div class="loading">
            <div>AI is analyzing your drawing...</div>
            <div style="font-size: 1.2rem; margin-top: 10px; opacity: 0.7">This may take a few seconds</div>
        </div>
    `;
    aiResponse.classList.add('show');

    try {
        // Call GPT-4 Vision API
        const response = await analyzeDrawing(imageData);
        displayAIResponse(response);
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        aiResponse.innerHTML = `
            <div class="ai-result incorrect">
                <h3>Error</h3>
                <p>Sorry, there was an error analyzing your drawing.</p>
                <button onclick="initGame()">Try Again</button>
            </div>
        `;
    }
}

// Function to call GPT-4 Vision API
async function analyzeDrawing(imageData) {
    const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: imageData,
            prompt: selectedPrompt
        })
    });

    if (!response.ok) {
        throw new Error('Failed to analyze drawing');
    }

    return await response.json();
}

// Display AI response
function displayAIResponse(response) {
    const aiResponse = document.getElementById('aiResponse');
    const isCorrect = response.guess.toLowerCase() === selectedPrompt.toLowerCase();
    
    aiResponse.innerHTML = `
        <div class="ai-result ${isCorrect ? 'correct' : 'incorrect'}">
            <h3>AI's Guess: ${response.guess}</h3>
            <p>Confidence: ${(response.confidence * 100).toFixed(1)}%</p>
            <p>${response.explanation}</p>
            <p class="result-message">
                ${isCorrect ? 'Correct! Well done! 🎉' : 'Not quite what I expected, but nice try! 🎨'}
            </p>
            <button onclick="initGame()">Play Again</button>
        </div>
    `;
}

// Prevent drawing before prompt selection and during countdown
const originalOnResults = window.onResults;
window.onResults = function(results) {
    if (!isDrawing || countdownActive) return;
    originalOnResults(results);
};

// Export the isGameEnded flag for script.js to use
window.isGameEnded = isGameEnded;

// Initialize the game when the page loads
window.onload = initGame; 