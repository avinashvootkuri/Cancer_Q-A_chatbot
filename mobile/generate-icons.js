const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate a purple gradient icon with a ribbon emoji/symbol
async function generateIcon(size, outputPath) {
  try {
    // Create SVG with purple gradient and awareness ribbon
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#6366F1;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
        <text x="50%" y="50%" font-size="${size * 0.5}" text-anchor="middle" 
              dominant-baseline="central" fill="white" font-family="Arial">🎗️</text>
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Error generating ${outputPath}:`, error.message);
  }
}

async function generateAllIcons() {
  console.log('Generating app icons...\n');
  
  // Generate icon.png (1024x1024)
  await generateIcon(1024, path.join(assetsDir, 'icon.png'));
  
  // Generate adaptive-icon.png (1024x1024)
  await generateIcon(1024, path.join(assetsDir, 'adaptive-icon.png'));
  
  // Generate splash.png (1242x2436 - iPhone size)
  const splashSvg = `
    <svg width="1242" height="2436" xmlns="http://www.w3.org/2000/svg">
      <rect width="1242" height="2436" fill="#FFFFFF"/>
      <g transform="translate(621, 1218)">
        <circle r="150" fill="#F3F4F6"/>
        <circle r="120" fill="#E5E7EB"/>
        <circle r="90" fill="#8B5CF6"/>
        <text x="0" y="0" font-size="100" text-anchor="middle" 
              dominant-baseline="central" fill="white" font-family="Arial">🎗️</text>
      </g>
      <text x="621" y="1450" font-size="48" font-weight="bold" text-anchor="middle" 
            fill="#111827" font-family="Arial">Cancer QA</text>
    </svg>
  `;
  
  await sharp(Buffer.from(splashSvg))
    .resize(1242, 2436)
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  
  console.log('✓ Generated: splash.png');
  
  // Generate favicon.png (48x48)
  await generateIcon(48, path.join(assetsDir, 'favicon.png'));
  
  console.log('\n✅ All icons generated successfully!');
}

generateAllIcons().catch(console.error);
