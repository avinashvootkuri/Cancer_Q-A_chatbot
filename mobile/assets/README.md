# Cancer QA Chatbot - Icon Assets

## Icon Generation Instructions

To create proper icons for the app, you can use one of these methods:

### Option 1: Using Figma or Design Tools
1. Create a 1024x1024px canvas
2. Design the icon with:
   - Purple gradient background (#7C3AED to #9333EA)
   - White awareness ribbon emoji 🎗️ or medical cross symbol
   - "CQA" text in white
3. Export as PNG files with these sizes:
   - `icon.png` - 1024x1024px
   - `adaptive-icon.png` - 1024x1024px (foreground only, transparent background)
   - `splash.png` - 1284x2778px (or similar tall aspect ratio)
   - `favicon.png` - 48x48px

### Option 2: Using Online Icon Generators
Visit https://icon.kitchen/ or https://easyappicon.com/ and:
1. Upload a base image (use the awareness ribbon emoji or medical symbol)
2. Set background color to purple (#7C3AED)
3. Generate all required sizes
4. Download and extract to this folder

### Option 3: Quick SVG-to-PNG Conversion
If you have an SVG logo:
1. Visit https://svgtopng.com/
2. Upload your SVG
3. Generate at 1024x1024px
4. Save as required filenames

### Current Setup
The app currently uses emoji-based icons in the splash screen. For production:
- Replace placeholder images in this folder
- Keep the same filenames: icon.png, adaptive-icon.png, splash.png, favicon.png

### Design Guidelines
- **Main Icon**: Purple circular background with health/medical symbol
- **Colors**: Primary purple (#7C3AED), white text/symbols
- **Style**: Clean, modern, medical/health focused
- **Symbol ideas**: Awareness ribbon 🎗️, medical cross ⚕️, heart ❤️, or "CQA" text

### Required Files
```
assets/
├── icon.png (1024x1024)
├── adaptive-icon.png (1024x1024)
├── splash.png (1284x2778 or similar)
└── favicon.png (48x48)
```

After creating icons, no code changes needed - Expo will automatically use them!
