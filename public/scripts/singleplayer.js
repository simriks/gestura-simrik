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

// Initialize the game
async function initGame() {
    try {
        // Reset canvas
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
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

        // Hide timer and current prompt
        document.getElementById('timer').style.display = 'none';
        document.getElementById('currentPrompt').style.display = 'none';
        
        // Hide AI response
        const aiResponse = document.getElementById('aiResponse');
        aiResponse.innerHTML = '';
        aiResponse.classList.remove('show');
        
        // Reset drawing state
        isDrawing = false;
        countdownActive = false;
    } catch (error) {
        console.error('Error initializing game:', error);
        const promptOptionsDiv = document.getElementById('promptOptions');
        promptOptionsDiv.innerHTML = '<p>Error loading prompts. Please try again. Details: ' + error.message + '</p>';
    }
}

// Handle prompt selection
function selectPrompt(prompt) {
    selectedPrompt = prompt;
    
    // Update UI
    document.querySelectorAll('.prompt-option').forEach(btn => {
        btn.style.display = 'none';
    });
    
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
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('timeLeft').textContent = timeLeft;
}

// End game and get AI guess
async function endGame() {
    clearInterval(timerInterval);
    isDrawing = false;
    countdownActive = false;

    // Get the canvas data
    const canvas = document.getElementById('drawingCanvas');
    const imageData = canvas.toDataURL('image/png');

    // Show loading state
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.innerHTML = '<div class="loading">AI is analyzing your drawing...</div>';
    aiResponse.classList.add('show');

    try {
        // Call GPT-4 Vision API
        const response = await analyzeDrawing(imageData);
        displayAIResponse(response);
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        aiResponse.innerHTML = '<div class="error">Sorry, there was an error analyzing your drawing.</div>';
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
                ${isCorrect ? 'Correct! Well done!' : 'Not quite what I expected, but nice try!'}
            </p>
            <button onclick="initGame()" class="prompt-option">Play Again</button>
        </div>
    `;
}

// Initialize the game when the page loads
window.onload = initGame;

// Prevent drawing before prompt selection and during countdown
const originalOnResults = window.onResults;
window.onResults = function(results) {
    if (!isDrawing || countdownActive) return;
    originalOnResults(results);
}; 