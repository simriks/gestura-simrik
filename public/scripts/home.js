// Select the canvas element
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions to match the viewport
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Variables for tracking mouse position and drawing
let hue = Math.random() * 360; // Initial random color
let brushSize = 10; // Initial brush size
let sizeDirection = 1; // Direction for brush size animation (1 = increase, -1 = decrease)

// Function to generate a random color
function getRandomColor() {
  return Math.random() * 360; // Random hue value between 0 and 360
}

// Change color every 2-3 seconds
setInterval(() => {
  hue = getRandomColor(); // Update hue to a random value
}, 2000 + Math.random() * 1000); // Random interval between 2 and 3 seconds

// Event listener for mouse move
document.addEventListener('mousemove', (e) => {
  // Dynamically change brush size
  brushSize += sizeDirection; // Increase or decrease brush size
  if (brushSize > 30 || brushSize < 5) {
    sizeDirection *= -1; // Reverse direction when reaching min/max size
  }

  // Set brush properties
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`; // Smooth color transition
  ctx.lineWidth = brushSize; // Dynamic brush size
  ctx.lineCap = 'round'; // Smooth edges
  ctx.lineJoin = 'round';

  // Draw a circle at the mouse position
  ctx.beginPath();
  ctx.arc(e.clientX, e.clientY, brushSize / 2, 0, Math.PI * 2); // Circle at mouse position
  ctx.fill();
});