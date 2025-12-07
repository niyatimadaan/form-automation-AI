const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(0, 0, size, size);
  
  // Form lines
  ctx.fillStyle = 'white';
  const lineHeight = size * 0.06;
  const lineSpacing = size * 0.15;
  const startY = size * 0.3;
  
  for (let i = 0; i < 3; i++) {
    const y = startY + (i * lineSpacing);
    const width = i === 2 ? size * 0.5 : size * 0.7;
    ctx.fillRect(size * 0.15, y, width, lineHeight);
  }
  
  // Checkmark circle
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(size * 0.75, size * 0.75, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  
  // Checkmark
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.moveTo(size * 0.70, size * 0.75);
  ctx.lineTo(size * 0.73, size * 0.78);
  ctx.lineTo(size * 0.80, size * 0.70);
  ctx.stroke();
  
  return canvas;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../dist/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ${filePath}`);
});

console.log('All icons generated successfully!');
