# Sprite Animator
[繁體中文](./README.md) | [English](./README_en.md)

A tool for generating 2D character animations using Google Gemini AI, supporting frame-by-frame mode and sprite sheet mode.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## ✨ Features

- 🎨 **Two Generation Modes**:
  - **Frame-by-Frame Mode**: Generate animation frames one by one, suitable for complex actions
  - **Sprite Sheet Mode**: Generate complete sprite sheet in one go, saves API quota (only 1 request)

- 🖼️ **Flexible Sprite Sheet Processing**:
  - Adjustable grid slicing (Cols/Rows)
  - Support for Padding (scaling) and Shift (offset) adjustments
  - **Automatic Precise Background Removal**: Chroma key removal (supports magenta #FF00FF and green screen #00B140)
  - **Intelligent Color Normalization**: Automatically corrects AI-generated color variations for perfect background removal
  - Real-time grid slicing preview
  - **Industrial-Grade Slicing**: Integer coordinates, boundary checking, pixel-perfect alignment

- 📤 **Multiple Export Formats**:
  - APNG (high quality with transparency)
  - GIF (good compatibility)
  - ZIP (all frames as raw PNG files)

- ⚡ **Performance Optimization**:
  - React performance optimization (useMemo, useCallback, React.memo)
  - Code splitting (dynamic imports)
  - Smooth animation using requestAnimationFrame
  - **Web Worker Background Processing**: Non-blocking UI for chroma key removal
  - **Progress Indicators**: Real-time processing progress display

- 🛡️ **Stability**:
  - Full TypeScript type support
  - Error Boundary component
  - Unified error handling
  - Automatic retry mechanism (with exponential backoff)
  - Production logging management (auto-switch between dev/prod)

## 🚀 Quick Start

### Requirements

- Node.js 18+
- npm or yarn

### Installation

1. **Clone or download the project**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set environment variables** (optional):
   Create `.env.local` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   Or enter the API Key directly in the application settings.

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Visit `http://localhost:3000`

## 📖 Usage Guide

### Basic Workflow

1. **Upload character image**: Click or drag to upload character image
2. **Select mode**:
   - **Frame-by-Frame Mode**: Suitable for fine-grained control
   - **Sprite Sheet Mode**: Fast generation, saves API quota
3. **Enter action prompt**: e.g., "Run Cycle", "Jump", "Sword Attack"
4. **Adjust parameters**:
   - Frame count (Frame mode) or grid size (Sprite Sheet mode)
   - Playback speed
   - Preview scale
5. **Generate animation**: Click generate button
6. **Export results**: Choose APNG, GIF, or ZIP format

### Advanced Sprite Sheet Features

- **Grid Slicing Settings**: Adjust Cols and Rows to match generated sprite sheet
- **Padding (Scaling)**: Reduce effective area size, remove edges
- **Shift (Offset)**: Fine-tune slicing position (supports negative values, auto-adjusted to valid range)
- **Automatic Precise Background Removal**:
  - Automatic background color detection (samples four corners)
  - Uses ImageMagick-like algorithm (`-fuzz 2% -transparent "#FF00FF"`)
  - Web Worker background processing, non-blocking UI
  - Real-time progress display (0-100%)
  - Ensures no white edges, no checkerboard pattern, no frame illusion

## 📷 Usage Examples

The following examples use the same character source image with different action prompts to generate multiple animations and export as GIF.

### Source Image (Input)

Upload a character standing or bust image as the generation source:

| Source |
|--------|
| ![Source gemini](images/gemini.png) |
| **gemini.png** — Character source file |

### Generated Results (Output)

Use **Sprite Sheet Mode** or **Frame-by-Frame Mode**, enter an action prompt to generate the animation, then export as GIF:

| Action | Generated GIF |
|--------|---------------|
| Happy (開心) | ![Happy](images/開心.gif) |
| Wave (揮手) | ![Wave](images/揮手.gif) |
| Head tilt confused (偏頭疑惑) | ![Head tilt confused](images/偏頭疑惑.gif) |
| Angry (生氣) | ![Angry](images/生氣.gif) |

All GIFs above were generated from **gemini.png** using this tool with the Google Gemini API.

## 🏗️ Project Structure

```
Sprite-Animator/
├── components/          # React Components
│   ├── SettingsModal.tsx
│   ├── ImageUpload.tsx
│   ├── AnimationConfigPanel.tsx
│   ├── SpriteSheetViewer.tsx
│   ├── AnimationPreview.tsx
│   ├── FrameGrid.tsx
│   ├── ErrorBoundary.tsx
│   └── Icons.tsx
├── hooks/               # Custom Hooks
│   ├── useSettings.ts
│   ├── useAnimation.ts
│   ├── useSpriteSheet.ts
│   └── useExport.ts
├── services/            # API Services
│   └── geminiService.ts
├── utils/               # Utility Functions
│   ├── constants.ts
│   ├── imageUtils.ts
│   ├── chromaKeyProcessor.ts  # Background removal processor (Web Worker)
│   └── logger.ts              # Logging utility
├── workers/             # Web Workers
│   └── chromaKeyWorker.ts     # Background removal Worker
├── types/               # TypeScript Type Definitions
│   ├── index.ts
│   └── errors.ts
├── App.tsx              # Main Application Component
├── index.tsx            # Entry Point
└── vite.config.ts       # Vite Configuration
```

## 🔧 Development

### Build Production Version

```bash
npm run build
```

### Preview Production Version

```bash
npm run preview
```

## 🚀 Deploy to GitHub Pages

### Automatic Deployment (Recommended)

The project is configured with GitHub Actions for automatic deployment. Simply:

1. **Enable GitHub Pages**:
   - Go to repository `Settings` → `Pages`
   - Select `GitHub Actions` in the `Source` dropdown (not `Deploy from a branch`)
   - Save settings

2. **Push code**:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment"
   git push origin main
   ```
   - GitHub Actions will automatically build and deploy

3. **Check deployment status**:
   - Go to the `Actions` tab to view deployment progress
   - After deployment completes, visit: `https://poirotw66.github.io/Sprite-Animator/`

### Manual Trigger

To deploy immediately:
- Go to the `Actions` tab
- Select the `Deploy to GitHub Pages` workflow
- Click `Run workflow`

### Manual Build (Local Testing)

To test GitHub Pages build locally:

```bash
# Set GitHub Pages environment variable
export GITHUB_PAGES=true

# Build the project
npm run build

# Build output is in dist/ directory
# Preview the build result
npm run preview
```

### Important Notes

- ✅ After deployment, the app automatically uses `/Sprite-Animator/` as the base path
- ✅ Make sure to select `GitHub Actions` as the source in GitHub Pages settings
- ✅ First deployment may take 2-5 minutes
- ✅ Every push to `main` branch will automatically trigger a redeployment
- ⚠️ If repository name changes, update the base path in `vite.config.ts`

## 📝 Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **Tailwind CSS** - Styling (via CDN)
- **Google Gemini API** - AI Image Generation
- **upng-js** - APNG Encoding
- **gifenc** - GIF Encoding
- **jszip** - ZIP Packaging

## 🎯 Best Practices

### API Quota Optimization

- **Prioritize Sprite Sheet Mode**: Only requires 1 API request
- **Set reasonable frame count**: More frames in frame mode means more requests
- **Use custom API Key**: Can get higher rate limits

### Animation Quality Improvement

- **Clear action descriptions**: Use specific action names (e.g., "Run Cycle" instead of "move")
- **Consistent style**: Uploaded character images should have consistent style
- **Appropriate frame count**: 4-8 frames are usually sufficient for basic actions

## 🐛 Troubleshooting

If you run into issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

Common issues:
- **Blank page**: Check if dev server is running, clear browser cache
- **API errors**: Verify API Key is correctly set
- **Generation failed**: Check network connection and API quota

## 📄 License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](LICENSE.txt).

See [LICENSE.txt](./LICENSE.txt) for details.

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📚 Related Documentation

- [Sprite Slicing Analysis](./SPRITE_SLICING_ANALYSIS.md) - Slicing feature optimization details
- [Chroma Key Improvement](./CHROMA_KEY_IMPROVEMENT.md) - Background removal technical details
- [Project Optimization Roadmap](./PROJECT_OPTIMIZATION_ROADMAP.md) - Future optimization plans

---

**Last Updated**: 2026-01-26  
**Version**: v1.2.0
