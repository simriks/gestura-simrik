// Gestura: Gesture Drawing Game
console.log('Welcome to Gestura - Draw with Gestures!');

// Initialize the canvas
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let hasChangedColor = false; // Track if we've already changed color for current gesture
let hasShownInitialCountdown = false; // Track if we've shown the initial countdown
let isCountingDown = false;

// Create countdown display
const countdownDisplay = document.createElement('div');
countdownDisplay.style.position = 'fixed';
countdownDisplay.style.top = '50%';
countdownDisplay.style.left = '50%';
countdownDisplay.style.transform = 'translate(-50%, -50%)';
countdownDisplay.style.fontSize = '120px';
countdownDisplay.style.fontFamily = 'Arial, sans-serif';
countdownDisplay.style.fontWeight = 'bold';
countdownDisplay.style.color = '#000';
countdownDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.3)';
countdownDisplay.style.zIndex = '1000';
countdownDisplay.style.backgroundColor = 'rgba(255,255,255,0.8)';
countdownDisplay.style.padding = '20px 40px';
countdownDisplay.style.borderRadius = '20px';
countdownDisplay.style.display = 'none';
document.body.appendChild(countdownDisplay);

// Smoothen the drawing
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.lineWidth = 5;
ctx.strokeStyle = 'black';

let lastX = null;
let lastY = null;

// MediaPipe Hands setup
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
hands.onResults(onResults);

// Access webcam
const videoElement = document.getElementById('webcam');
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 800,
  height: 600,
});
camera.start();

// Utility function to check if a finger is extended
function isFingerExtended(tip, pip) {
  return Math.abs(tip.y - pip.y) > 0.05 && tip.y < pip.y;
}

// New function to check if a finger is tightly curled
function isFingerCurled(tip, pip, mcp) {
  // Check if the tip is below both pip and mcp
  const isBelowJoints = tip.y > pip.y && tip.y > mcp.y;
  
  // Check if the tip is close to the palm
  const distanceToBase = Math.abs(tip.y - mcp.y);
  const isCloseToBase = distanceToBase < 0.1;

  return isBelowJoints && isCloseToBase;
}

// Function to start countdown
function startDrawingCountdown() {
  if (isCountingDown) return;
  
  isCountingDown = true;
  drawing = false;
  
  // Show Ready
  countdownDisplay.style.display = 'block';
  countdownDisplay.textContent = 'Ready?';
  
  // Sequence: Ready? → 3 → 2 → 1 → START!
  setTimeout(() => {
    countdownDisplay.textContent = '3';
    
    setTimeout(() => {
      countdownDisplay.textContent = '2';
      
      setTimeout(() => {
        countdownDisplay.textContent = '1';
        
        setTimeout(() => {
          countdownDisplay.textContent = 'START!';
          countdownDisplay.style.color = '#00b300';
          
          setTimeout(() => {
            countdownDisplay.style.display = 'none';
            countdownDisplay.style.color = '#000';
            isCountingDown = false;
            drawing = true;
            hasShownInitialCountdown = true; // Mark that we've shown the initial countdown
          }, 500);
        }, 500);
      }, 500);
    }, 500);
  }, 600);
}

// Start the initial countdown when the page loads
startDrawingCountdown();

// Handle hand tracking results
function onResults(results) {
  // Check if game has ended (for singleplayer mode)
  if (window.isGameEnded) {
    drawing = false;
    hasChangedColor = false;
    return;
  }

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    drawing = false;
    hasChangedColor = false;
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  if (
    !landmarks[0] || !landmarks[4] || !landmarks[8] || !landmarks[12] ||
    !landmarks[16] || !landmarks[20] || !landmarks[6] || !landmarks[10] ||
    !landmarks[14] || !landmarks[18] || !landmarks[2]
  ) {
    drawing = false;
    hasChangedColor = false;
    return;
  }

  // Check finger states
  const indexExtended = isFingerExtended(landmarks[8], landmarks[6]);
  const middleExtended = isFingerExtended(landmarks[12], landmarks[10]);
  const ringExtended = isFingerExtended(landmarks[16], landmarks[14]);
  const pinkyExtended = isFingerExtended(landmarks[20], landmarks[18]);
  const thumbExtended = isFingerExtended(landmarks[4], landmarks[2]);

  const isPointing =
    indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

  const isOpenHand =
    indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;

  const isFistGesture = 
    !indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;

  if (isFistGesture && !window.isGameEnded) { // Only allow clearing if game hasn't ended
    drawing = false;
    hasChangedColor = false;
    console.log('Fist Gesture Detected - Clearing Canvas');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else if (isPointing) {
    if (!hasShownInitialCountdown) {
      if (!isCountingDown && !drawing) {
        console.log('Starting initial countdown');
        startDrawingCountdown();
      }
    } else {
      drawing = !window.isGameEnded; // Only allow drawing if game hasn't ended
    }
    hasChangedColor = false;
  } else if (isOpenHand && !hasChangedColor && !window.isGameEnded) { // Only allow color changes if game hasn't ended
    drawing = false;
    hasChangedColor = true;
    console.log('Open Hand Gesture Detected - Changing Pen Color');
    changeColor(getRandomColor());
  } else {
    drawing = false;
    if (!isOpenHand) {
      hasChangedColor = false;
    }
    console.log('Unrecognized Gesture - Not Drawing');
  }

  // Draw only if in drawing mode and game hasn't ended
  if (!drawing || window.isGameEnded) {
    lastX = null;
    lastY = null;
    return;
  }

  // Map index finger tip to canvas coordinates with adjusted boundaries
  const indexFingerTip = landmarks[8];
  
  // Add different padding for X and Y axes
  const paddingX = 0.1; // 10% padding for X
  
  // Adjust Y coordinate mapping to favor bottom range
  const normalizedX = (1 - indexFingerTip.x); // Invert X for mirrored view
  const normalizedY = Math.max(0, Math.min(1, (indexFingerTip.y * 1.6) - 0.3)); // Further expand bottom range, reduce top range more
  
  // Map the normalized coordinates to canvas space with padding
  const x = Math.max(0, Math.min(canvas.width, 
    canvas.width * (normalizedX * (1 + 2 * paddingX) - paddingX)
  ));
  const y = Math.max(0, Math.min(canvas.height, 
    canvas.height * normalizedY
  ));

  // Smooth drawing
  if (lastX !== null && lastY !== null) {
    const interpolatedX = (x + lastX) / 2;
    const interpolatedY = (y + lastY) / 2;

    ctx.lineTo(interpolatedX, interpolatedY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  lastX = x;
  lastY = y;
}

// Clear canvas on 'c' key press - only if game hasn't ended
document.addEventListener('keydown', (e) => {
  if (e.key === 'c' && !window.isGameEnded) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});

//List of colours 
const voiceColors = {
  red: '#FF0000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  green: '#00FF00',
  orange: '#FFA500',
  purple: '#800080',
  black: '#000000',
  pink: '#FFC0CB',
  brown: '#A52A2A'
};

// Reverse mapping for hex to name
const hexToColorName = Object.fromEntries(
  Object.entries(voiceColors).map(([name, hex]) => [hex.toUpperCase(), name])
);

// Check if the browser supports the Web Speech API
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('Speech recognition is not supported in this browser.');
} else {
  const recognition = new SpeechRecognition();
  recognition.continuous = false; // Listen for one command at a time
  recognition.interimResults = false; // Only return final results
  recognition.lang = 'en-US'; // Set language to English

  // Start listening when the user clicks a button
  document.addEventListener('keydown', (e) => {
    if (e.key === 'v') { // Press 'V' to activate voice recognition
      recognition.start();
      console.log('Listening for voice commands...');
    }
  });

  // Handle recognized speech
  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript.toLowerCase().trim();
    console.log(`You said: ${spokenText}`);

    // Check if the spoken text matches a color
    if (voiceColors[spokenText]) {
      const selectedColor = voiceColors[spokenText];
      console.log(`Changing pen color to: ${selectedColor}`);
      changeColor(selectedColor);
    } else {
      console.log('Unrecognized color. Please try again.');
    }
  };

  // Handle errors
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };
}

// Function to generate a random color
function getRandomColor() {
  const colors = Object.values(voiceColors);
  return colors[Math.floor(Math.random() * colors.length)];
}

// Create color indicator
const colorIndicator = document.createElement('div');
colorIndicator.style.position = 'fixed';
colorIndicator.style.top = '20px';
colorIndicator.style.left = '20px';
colorIndicator.style.padding = '12px 20px';
colorIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
colorIndicator.style.border = '2px solid #ddd';
colorIndicator.style.borderRadius = '10px';
colorIndicator.style.fontFamily = 'Arial, sans-serif';
colorIndicator.style.fontSize = '14px';
colorIndicator.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
colorIndicator.style.display = 'flex';
colorIndicator.style.alignItems = 'center';
colorIndicator.style.gap = '10px';
colorIndicator.style.zIndex = '1000';
document.body.appendChild(colorIndicator);

// Helper function to convert RGB to Hex
function rgbToHex(color) {
  // If it's already a hex color, return it
  if (color.startsWith('#')) return color;
  
  // Handle named colors
  if (!color.startsWith('rgb')) {
    const tempElem = document.createElement('div');
    tempElem.style.color = color;
    document.body.appendChild(tempElem);
    const computedColor = getComputedStyle(tempElem).color;
    document.body.removeChild(tempElem);
    color = computedColor;
  }
  
  // Extract RGB values
  const rgb = color.match(/\d+/g);
  if (!rgb) return color;
  
  // Convert to hex
  const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
  const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
  const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
  
  return `#${r}${g}${b}`;
}

function updateColorIndicator(color) {
  // Normalize the hex color to uppercase for consistent comparison
  const hexColor = color.startsWith('#') ? color.toUpperCase() : rgbToHex(color).toUpperCase();
  // Get the exact color name from our mapping
  const colorName = Object.entries(voiceColors).find(([_, hex]) => hex.toUpperCase() === hexColor)?.[0] || 'Custom';
  
  colorIndicator.innerHTML = `
    <div style="
      width: 20px;
      height: 20px;
      background-color: ${color};
      border-radius: 50%;
      border: 2px solid #ddd;
    "></div>
    <div style="
      display: flex;
      flex-direction: column;
      gap: 2px;
    ">
      <div style="font-weight: bold;">${colorName.charAt(0).toUpperCase() + colorName.slice(1)}</div>
      <div style="font-size: 12px; color: #666;">${hexColor}</div>
    </div>
  `;
}

// Update the changeColor function to handle game ended state
function changeColor(color) {
  if (window.isGameEnded) return; // Don't allow color changes if game has ended
  ctx.strokeStyle = color;
  updateColorIndicator(color);
  
  // Update the swatches
  const normalizedColor = color.toUpperCase();
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    const swatchColor = swatch.style.backgroundColor;
    const swatchHex = swatchColor.startsWith('rgb') 
      ? '#' + swatchColor.match(/\d+/g)
          .map(x => parseInt(x).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()
      : swatchColor.toUpperCase();
    
    if (swatchHex === normalizedColor) {
      swatch.style.border = '2px solid #000';
    } else {
      swatch.style.border = '2px solid #ddd';
    }
  });
}

// Initialize the color indicator with the current color
updateColorIndicator(ctx.strokeStyle);

// Brush color and size functions
function changeBrushSize(size) {
  if (window.isGameEnded) return; // Don't allow brush size changes if game has ended
  ctx.lineWidth = size;
}

// Create control panel
const controlPanel = document.createElement('div');
controlPanel.className = 'control-panel';
document.body.appendChild(controlPanel);

// Add title for colors
const colorsTitle = document.createElement('div');
colorsTitle.textContent = 'Colors';
colorsTitle.style.fontFamily = 'Arial, sans-serif';
colorsTitle.style.fontWeight = 'bold';
colorsTitle.style.marginBottom = '10px';
colorsTitle.style.textAlign = 'center';
controlPanel.appendChild(colorsTitle);

// Create color swatches container
const colorSwatches = document.createElement('div');
colorSwatches.style.display = 'grid';
colorSwatches.style.gridTemplateColumns = 'repeat(2, 1fr)';
colorSwatches.style.gap = '15px';
colorSwatches.style.justifyItems = 'center';
colorSwatches.style.alignItems = 'center';
colorSwatches.style.padding = '0 10px';
controlPanel.appendChild(colorSwatches);

// Add color swatches
Object.entries(voiceColors).forEach(([name, color]) => {
  const swatch = document.createElement('div');
  swatch.style.width = '35px'; // Slightly larger swatches
  swatch.style.height = '35px';
  swatch.style.backgroundColor = color;
  swatch.style.borderRadius = '50%';
  swatch.style.border = '2px solid #ddd';
  swatch.style.cursor = 'pointer';
  swatch.title = name.charAt(0).toUpperCase() + name.slice(1);
  
  // Add hover effect
  swatch.addEventListener('mouseover', () => {
    swatch.style.transform = 'scale(1.1)';
    swatch.style.transition = 'transform 0.2s';
  });
  swatch.addEventListener('mouseout', () => {
    swatch.style.transform = 'scale(1)';
  });
  
  // Add click handler
  swatch.addEventListener('click', () => {
    changeColor(color);
    // Update active swatch indication
    document.querySelectorAll('.color-swatch').forEach(s => s.style.border = '2px solid #ddd');
    swatch.style.border = '2px solid #000';
  });
  
  swatch.className = 'color-swatch';
  colorSwatches.appendChild(swatch);
});

// Add brush size controls
const brushTitle = document.createElement('div');
brushTitle.textContent = 'Brush Size';
brushTitle.style.fontFamily = 'Arial, sans-serif';
brushTitle.style.fontWeight = 'bold';
brushTitle.style.marginTop = '20px';
brushTitle.style.marginBottom = '10px';
brushTitle.style.textAlign = 'center'; // Center text
controlPanel.appendChild(brushTitle);

// Create brush size slider
const brushSlider = document.createElement('input');
brushSlider.type = 'range';
brushSlider.min = '1';
brushSlider.max = '20';
brushSlider.value = '5';
brushSlider.style.width = '90%'; // Slightly narrower than container
brushSlider.style.margin = '10px 0';
brushSlider.style.display = 'block'; // Ensure block display for proper centering
controlPanel.appendChild(brushSlider);

// Add brush size preview
const brushPreview = document.createElement('div');
brushPreview.style.width = '30px';
brushPreview.style.height = '30px';
brushPreview.style.borderRadius = '50%';
brushPreview.style.backgroundColor = 'black';
brushPreview.style.margin = '10px auto'; // Center horizontally with auto margins
controlPanel.appendChild(brushPreview);

// Update brush size preview and actual brush size
brushSlider.addEventListener('input', (e) => {
  const size = e.target.value;
  brushPreview.style.width = size + 'px';
  brushPreview.style.height = size + 'px';
  changeBrushSize(size);
});

// Update the initial brush preview size
brushPreview.style.width = brushSlider.value + 'px';
brushPreview.style.height = brushSlider.value + 'px';
