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
  - **Automatic Precise Background Removal**: ImageMagick-like magenta chroma key removal (#FF00FF, 2% tolerance)
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

**Last Updated**: 2026-01-25  
**Version**: v1.1.0
