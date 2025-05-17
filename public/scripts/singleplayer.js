// Update the API URL based on environment
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

// Drawing prompts
const prompts = [
    ['Apple', 'Banana', 'Orange'],
    ['Cat', 'Dog', 'Bird'],
    ['Car', 'Bicycle', 'Boat'],
    ['House', 'Tree', 'Flower'],
    ['Sun', 'Moon', 'Star'],
    ['Chair', 'Table', 'Lamp'],
    ['Pizza', 'Burger', 'Hotdog'],
    ['Book', 'Pencil', 'Paper']
];

let currentPromptSet = [];
let selectedPrompt = '';
let timeLeft = 30;
let timerInterval = null;
let isDrawing = false;

// Initialize the game
async function initGame() {
    try {
        // Get AI-generated prompts
        const response = await fetch(`${API_URL}/api/prompts`);
        const prompts = await response.json();
        
        // Get random prompt set
        currentPromptSet = prompts[Math.floor(Math.random() * prompts.length)];
        
        // Create prompt buttons
        const promptOptionsDiv = document.getElementById('promptOptions');
        promptOptionsDiv.innerHTML = '';
        
        currentPromptSet.forEach(prompt => {
            const button = document.createElement('button');
            button.className = 'prompt-option';
            button.textContent = prompt;
            button.onclick = () => selectPrompt(prompt);
            promptOptionsDiv.appendChild(button);
        });

        // Hide timer initially
        document.getElementById('timer').style.display = 'none';
        document.getElementById('currentPrompt').style.display = 'none';
    } catch (error) {
        console.error('Error fetching prompts:', error);
        const promptOptionsDiv = document.getElementById('promptOptions');
        promptOptionsDiv.innerHTML = '<p>Error loading prompts. Please refresh the page.</p>';
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
    
    // Start timer and enable drawing
    startTimer();
    isDrawing = true;
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

    // Get the canvas data
    const canvas = document.getElementById('drawingCanvas');
    const imageData = canvas.toDataURL('image/png');

    // Show loading state
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.innerHTML = 'AI is analyzing your drawing...';
    aiResponse.classList.add('show');

    try {
        // Call GPT-4 Vision API
        const response = await analyzeDrawing(imageData);
        displayAIResponse(response);
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        aiResponse.innerHTML = 'Sorry, there was an error analyzing your drawing.';
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
        <h3>AI's Guess: ${response.guess}</h3>
        <p>Confidence: ${(response.confidence * 100).toFixed(1)}%</p>
        <p>${response.explanation}</p>
        <p style="color: ${isCorrect ? '#2ecc71' : '#e74c3c'}">
            ${isCorrect ? 'Correct! Well done!' : 'Not quite what I expected, but nice try!'}
        </p>
        <button onclick="initGame()" class="prompt-option">Play Again</button>
    `;
}

// Initialize the game when the page loads
window.onload = initGame;

// Prevent drawing before prompt selection
const originalOnResults = window.onResults;
window.onResults = function(results) {
    if (!isDrawing) return;
    originalOnResults(results);
}; 