# Sprite Animator & Sticker Studio (Sprite + LINE + Comic)
[繁體中文](./README.md) | [English](./README_en.md)

> Originally a “Sprite Animator”, this repo has grown into a multi-tool studio:
> - Sprite Animator (frame-by-frame / sprite sheet)
> - LINE Sticker Builder (phrases, layouts, IndexedDB restore, headless upload factory)
> - One-Page Comic wizard
> - Remove Background (AI)
> - Daily Sticker Registry for batch production
> - Parting (sprite sheet slicing)

## ✨ Features

- 🎨 **Two Generation Modes**:
  - **Frame-by-Frame Mode**: Generate animation frames one by one, suitable for complex actions
  - **Sprite Sheet Mode**: Generate complete sprite sheet in one go, saves API quota (only 1 request)

- 🖼️ **Flexible Sprite Sheet Processing**:
  - Adjustable grid slicing (Cols/Rows)
  - Support for Padding (scaling) and Shift (offset) adjustments
  - **Automatic Precise Background Removal**: Chroma key removal (supports magenta #FF00FF and green screen #00FF00)
  - **Intelligent Color Normalization**: Automatically corrects AI-generated color variations for perfect background removal
  - Real-time grid slicing preview
  - **Industrial-Grade Slicing**: Integer coordinates, boundary checking, pixel-perfect alignment

- 📤 **Multiple Export Formats**:
  - APNG (high quality with transparency)
  - GIF (good compatibility)
  - ZIP (all frames as raw PNG files)

- 💬 **LINE Sticker Workspace**:
  - Complete character upload, phrases, generation, slicing, and download in the browser
  - **IndexedDB job restore**: Resume the previous sticker job after refresh (images / phrases persisted as job SoT)
  - Corrupt local records will not crash the job list; deleting a job also clears its assets
  - Interrupted generation is marked cancelled on restore, with a dismissible notice

- 🎛️ **Signal Studio UI language**:
  - Unified cool paper surface + vermillion accent across the app (no more per-tool rainbow themes)
  - Outfit + Noto Sans TC fonts, shared header / button / banner styles
  - Consistent chrome on every tool page to reduce context switching

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
  - CI covers typecheck, lint, unit / e2e, Python checks, dist budget, and secret scanning

## 🚀 Quick Start

### Requirements

- Node.js 20–26 (`>=20 <27`)
- npm 10+ (the project is pinned to npm 10.9.2)

### Installation

1. **Clone or download the project**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set a local development key** (optional):
   When developing locally with `npm run dev`, create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   Public deployments do not embed this key; enter your own API Key in the application settings instead.

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Visit `http://localhost:3000`

## 📖 Usage Guide

### Basic Workflow (Sprite Animator)

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

### LINE Stickers (`/#/line-sticker`)

1. Upload a character reference and fill in / generate sticker phrases
2. Generate the set (multiple sheets), then slice, remove backgrounds, and download
3. After a page refresh, the app tries to restore the previous job; if it is missing or corrupt, a notice is shown and you start from a blank job
4. For advanced headless mass production / upload, see `.claude/skills/line-sticker-*` and `scripts/line-sticker/`

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
| <img src="images/gemini.webp" alt="Source gemini" width="300"> |
| **gemini.webp** — Character source file |

### Generated Results (Output)

Use **Sprite Sheet Mode** or **Frame-by-Frame Mode**, enter an action prompt to generate the animation, then export as GIF:

| Action | Generated GIF |
|--------|---------------|
| Happy (開心) | ![Happy](images/開心.webp) |
| Wave (揮手) | ![Wave](images/揮手.webp) |
| Head tilt confused (偏頭疑惑) | ![Head tilt confused](images/偏頭疑惑.webp) |
| Angry (生氣) | ![Angry](images/生氣.webp) |

All GIFs above were generated from **gemini.webp** using this tool with the Google Gemini API.

## 🏗️ Project Structure (excerpt)

```
Sprite-Animator/
├── components/          # React components
│   ├── ui/              # Shared Signal Studio chrome (e.g. ToolPageHeader)
│   ├── LineSticker/     # LINE sticker browser UI
│   ├── Comic/           # One-page comic wizard
│   ├── SettingsModal.tsx
│   ├── ImageUpload.tsx
│   ├── AnimationConfig.tsx
│   ├── SpriteSheetViewer.tsx
│   ├── AnimationPreview.tsx
│   └── ...
├── features/
│   └── line-sticker/    # LINE sticker domain / persistence (IndexedDB)
├── hooks/               # Custom hooks (incl. job restore, image / phrase SoT)
├── pages/               # Tool pages (HashRouter)
├── services/            # API services
├── utils/               # Utilities (slicing, chroma key, constants, etc.)
├── workers/             # Web Workers
├── i18n/                # Traditional Chinese / English copy
├── scripts/             # CI, font / preview thumbs, LINE headless tools
├── App.tsx
├── index.tsx
├── index.css            # Tailwind v4 + Signal Studio tokens
└── vite.config.ts
```

More routes:
- `/#/sprite-animation`: Character frame animation / sprite sheets
- `/#/line-sticker`: Build a complete LINE sticker set in browser (with job restore)
- `/#/daily-sticker-registry`: Registry/dashboard for batch production
- `/#/one-page-comic`: One-page comic wizard
- `/#/rmbg`: Background removal
- `/#/parting`: Sprite sheet slicing tool

The app uses hash routing so direct navigation and refreshes work reliably on GitHub Pages.

## 🔧 Development

After your first clone, run `graphify update .` to build the local code knowledge graph (writes to `graphify-out/`, ~15s, not versioned).

After changing `assets/style-preview-sources/*.png` or `assets/font.png`, rebuild and commit the browser thumbnails:

```bash
npm run previews:build
npm run previews:check
```

Common checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run dist:budget   # post-build asset size budget
```

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
- Select the `CI` workflow (build and deploy are merged there; there is no separate deploy workflow)
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
- **React Router 7** - Multi-tool routing (routes are lazy loaded)
- **TypeScript** - Type Safety
- **Vite 6** - Build Tool
- **Tailwind CSS 4** - Styling (built via PostCSS; Signal Studio tokens defined in `index.css`)
- **Outfit / Noto Sans TC** - UI fonts (`@fontsource`)
- **IndexedDB** - LINE sticker job and image asset persistence
- **Google Gemini API** - AI Image Generation
- **@huggingface/transformers** - AI background-removal model (loaded on demand)
- **upng-js** - APNG Encoding
- **gifenc** - GIF Encoding
- **jszip** - ZIP Packaging
- **Python 3 + uv** - LINE sticker sheet converter and upload automation (see `scripts/line-sticker/python/`)

## 🎯 Best Practices

### API Quota Optimization

- **Prioritize Sprite Sheet Mode**: Only requires 1 API request
- **Set reasonable frame count**: More frames in frame mode means more requests
- **Use custom API Key**: Can get higher rate limits

### Animation Quality Improvement

- **Clear action descriptions**: Use specific action names (e.g., "Run Cycle" instead of "move")
- **Consistent style**: Uploaded character images should have consistent style
- **Appropriate frame count**: 4-8 frames are usually sufficient for basic actions

### LINE Stickers

- For important jobs, confirm the browser allows IndexedDB / local storage for this site
- Clearing site data also deletes restored sticker jobs
- Use dedicated skills / scripts for mass production and upload; do not write API keys into job snapshots

## 🐛 Troubleshooting

If you run into issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

Common issues:
- **Blank page**: Check if dev server is running, clear browser cache
- **API errors**: Verify API Key is correctly set
- **Generation failed**: Check network connection and API quota
- **LINE sticker restore failed**: Confirm site data was not cleared; if a restore-failure notice appears, start a new job

## 📄 License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](LICENSE.txt).

See [LICENSE.txt](./LICENSE.txt) for details.

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📚 Related Documentation

- [Slice & Align Flow](./docs/animation/SLICE_AND_ALIGN_FLOW.md) - Slicing feature technical details
- [Chroma Key Improvements](./docs/chroma/CHROMA_KEY.md) - Background removal technical details
- [Background Color Normalization](./docs/chroma/BACKGROUND_COLOR_NORMALIZATION.md) - Background color unification
- [Project Optimization Roadmap](./docs/PROJECT_OPTIMIZATION_ROADMAP.md) - Future optimization plans
- [Documentation index](./docs/README.md) - Full technical docs catalog

---

**Last Updated**: 2026-09-09  
**Version**: v1.2.0
