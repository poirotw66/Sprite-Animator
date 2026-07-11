# Graph Report - Sprite-Animator  (2026-07-11)

## Corpus Check
- 308 files · ~3,146,761 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2350 nodes · 5170 edges · 175 communities (126 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `82331aca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Gemini Prompt Builders
- Comic Creation UI
- Sprite Sheet Processing
- Text Overlay Engine
- Chroma Key Detection
- Sticker Section UI
- Alpha Mask Feathering
- Project Dependencies
- Sticker Generation Hooks
- Upload Job Configuration
- Sticker Page ViewModels
- LINE Provisioning Automation
- Programmatic Style Controls
- Google Drive Upload
- Sticker Generation Types
- TypeScript Configuration
- Sticker Metadata Normalization
- Animation Settings UI
- Image Upload & Download
- LINE Upload Packaging
- Job Finalization Scripts
- Sticker Generation CLI
- App Routing & Pages
- Phrase Set Design
- White Divider Detection
- Localization & Internationalization
- Phrase Validation Logic
- Upload Manifest Rebuilding
- Sticker Quality Auditing
- Character Reference Generation
- LINE Zip Upload
- Shop Listing Text
- Grid Validation Metrics
- Sheet Slicing Logic
- Sticker Set Naming
- Credential Management
- Sheet Slice Diagnostics
- Upload Execution Pipeline
- Batch Submission Scripts
- Sticker Result ViewModels
- Render Profiler Debugger
- Sprite Editing UI
- Action Description Logic
- Grid Template Drawing
- Node Image Processing
- Batch Job Runner
- SpriteAnimatorPage.tsx
- Sheet Boundary Detection
- Grid Score Gating
- Slice Optimization
- Generate & Upload CLI
- LINE Review Submission
- Sheet Reslicing Utility
- Input-to-Upload Pipeline
- Sheet Re-overlay Utility
- Cell Crop Logic
- Sticker Voice Presets
- Provisioning Unit Tests
- Asset Validation Utility
- Upload Pipeline Orchestration
- API Key Management
- Black Cat Assets
- Cream Cat Assets
- Giraffe Assets
- Project Design Docs
- Sticker Skill Modules
- Sticker Pack Extraction
- Zip Preparation Utility
- Drive Playwright Upload
- Meerkat Assets
- Workflow Documentation
- Project Readme Files
- Bunny Assets
- Capybara Assets
- Prompt Engineering Guides
- Otter Banter Assets
- Owl Banter Assets
- Owl Daily Assets
- Panda Banter Assets
- Panda Daily Assets
- Shiba Banter Assets
- Shiba Daily Assets
- Chibi Style Previews
- Minimalist Style Previews
- Skill Reference Image
- Optimization Report
- Slice Consistency Design
- Angry Woman Animation
- Happy Woman Animation
- HTML Entry Point
- Optimization Roadmap
- Font Style Previews
- Doodle Style Previews
- Pastel Style Previews
- Pixel Style Previews
- Watercolor Style Previews
- Yurukawa Style Previews
- Otter Model Layout
- Meerkat Daily Sprites
- Meerkat Daily Sprites
- Otter Banter Sprites
- Owl Banter Sprites
- Owl Daily Sprites
- Panda Banter Sprites
- Panda Daily Sprites
- Shiba Banter Sprites
- Shiba Daily Sprites
- Anime Style Preview
- Cartoon Style Preview
- Gouache Style Preview
- Color Normalization Testing
- sheetComponentSlicer.ts
- geminiSheet.mts
- index.ts
- useExport
- Chroma Similarity Unify Design
- programmaticTextOverlay.mts
- Agent workflow
- preview-programmatic-font-sizes.mts
- File Map (Phase 1 MVP)
- OnePageComicPage.tsx
- audit-programmatic-overlay.mts
- compare-chroma-forge.mts
- comicStoryboard.ts
- Background Color Normalization (背景顏色標準化)
- 可修改項目（由你決定是否採用）
- LINE Sticker Maker
- LINE Sticker Upload
- File Map
- 4. **用戶體驗改進**
- 8. **開發工具**
- v1.1.0 — 精確洋紅色去背 (2026-01-25)
- 專案優化路線圖與功能建議
- PartingPage.tsx
- despillForgeGreenFringe
- English
- English
- English
- English
- 精靈圖切分與校正流程（目前實作）
- 💡 創新功能建議
- 🚀 推薦實施順序
- 🚀 Deploy to GitHub Pages
- rgbaScale.ts
- 7. **高級功能**
- 🎯 成功指標
- 📊 性能優化機會
- 📚 參考資源
- Otter Model Sheet Layout
- Chroma Similarity Unify Plan
- One-Page Comic Implementation Plan
- Black Cat Banter Sprite Sheet 1
- Black Cat Banter Sprite Sheet 2
- Black Cat Daily Sprite Sheet 1
- Black Cat Daily Sprite Sheet 2
- Bunny Banter Sprite Sheet 1
- Bunny Banter Sprite Sheet 2
- Capybara Banter Sprite Sheet 1
- Capybara Banter Sprite Sheet 2
- Cream Cat Banter Sprite Sheet 1
- Cream Cat Banter Sprite Sheet 2
- Cream Cat Daily Sprite Sheet 1
- Cream Cat Daily Sprite Sheet 2
- Giraffe Banter Sprite Sheet 1
- Giraffe Banter Sprite Sheet 2
- Giraffe Daily Sprite Sheet 1
- Giraffe Daily Sprite Sheet 2
- Meerkat Banter Sprite Sheet 1
- Meerkat Banter Sprite Sheet 2

## God Nodes (most connected - your core abstractions)
1. `LineStickerSheetIndex` - 36 edges
2. `useLanguage()` - 35 edges
3. `LineStickerPage()` - 34 edges
4. `composeStickerFrame()` - 33 edges
5. `ChromaKeyColorType` - 32 edges
6. `generateOneSheet()` - 30 edges
7. `SliceSettings` - 29 edges
8. `compilerOptions` - 28 edges
9. `ProgrammaticTextOverlayTuning` - 28 edges
10. `Translations` - 26 edges

## Surprising Connections (you probably didn't know these)
- `GenerateSheetParams` --references--> `ChromaKeyColorType`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/geminiSheet.mts → types.ts
- `scoreGridLayout()` --calls--> `scoreGridLayoutFromRgba()`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/nodeImage.mts → utils/sheetGridValidation.ts
- `detectBestGridLayout()` --calls--> `detectBestGridLayoutFromRgba()`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/nodeImage.mts → utils/sheetGridValidation.ts
- `loadBaseTuning()` --calls--> `mergeProgrammaticTextTuning()`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/preview-programmatic-font-sizes.mts → utils/lineStickerTextOverlayTypes.ts
- `LineStickerProgrammaticOverlayStyle` --references--> `ProgrammaticTextOverlayTuning`  [EXTRACTED]
  hooks/useLineStickerProgrammaticOverlay.ts → utils/lineStickerTextOverlayTypes.ts

## Import Cycles
- 3-file cycle: `utils/lineStickerComposeLayout.ts -> utils/lineStickerTextOverlayGeometry.ts -> utils/lineStickerTextOverlayTypes.ts -> utils/lineStickerComposeLayout.ts`

## Hyperedges (group relationships)
- **Banter Chat Sticker Series** — line_s_input_706_cozy_black_cat_banter_chat_cozy_black_cat_banter_chat, line_s_input_706_cozy_bunny_banter_chat_cozy_bunny_banter_chat, line_s_input_706_cozy_capybara_banter_chat_cozy_capybara_banter_chat, line_s_input_706_cozy_cream_cat_banter_chat_cozy_cream_cat_banter_chat, line_s_input_706_cozy_giraffe_banter_chat_cozy_giraffe_banter_chat, line_s_input_706_cozy_meerkat_banter_chat_cozy_meerkat_banter_chat [EXTRACTED 0.90]
- **Daily Chat Sticker Series** — line_s_input_706_cozy_black_cat_daily_chat_cozy_black_cat_daily_chat, line_s_input_706_cozy_cream_cat_daily_chat_cozy_cream_cat_daily_chat, line_s_input_706_cozy_giraffe_daily_chat_cozy_giraffe_daily_chat, line_s_input_706_cozy_meerkat_daily_chat_cozy_meerkat_daily_chat [EXTRACTED 0.90]
- **Character Style Variants** — public_style_previews_chibi, public_style_previews_doodle, public_style_previews_flat, public_style_previews_linechibi, public_style_previews_minimalist, public_style_previews_pastel, public_style_previews_pixel, public_style_previews_watercolor, public_style_previews_yurukawa [EXTRACTED 1.00]

## Communities (175 total, 49 thin omitted)

### Community 0 - "Gemini Prompt Builders"
Cohesion: 0.05
Nodes (72): generateCharacterRefImage(), main(), mimeFromPath(), parseArgs(), printStyleTable(), resolveImagePath(), ROOT_DIR, SCRIPT_DIR (+64 more)

### Community 1 - "Comic Creation UI"
Cohesion: 0.17
Nodes (17): alphaVisualization(), chromaKeyColor, cloneImage(), cols, compositeOnBlack(), cropCell(), cropZoom(), findRawSheet() (+9 more)

### Community 2 - "Sprite Sheet Processing"
Cohesion: 0.12
Nodes (31): FrameGrid, FrameGridProps, LineStickerResultPanelViewerViewModel, SpriteSheetSliceControlsProps, SpriteSheetViewerProps, SliceProcessedSheetOptions, useLineStickerSlicing(), UseLineStickerSlicingParams (+23 more)

### Community 3 - "Text Overlay Engine"
Cohesion: 0.22
Nodes (15): wrapLines(), AutoCaptionLayout, AutoCaptionLayoutParams, buildForegroundOverlapIndex(), CaptionCenterResult, CaptionCenterSearch, CaptionCenterSearchBounds, computeAutoCaptionLayout() (+7 more)

### Community 4 - "Chroma Key Detection"
Cohesion: 0.06
Nodes (49): SheetChromaKeyOptions, ChromaKeyAlgorithm, countGreenSpillNeighbors(), despillForgeGreenFringe(), distanceToGreenKey(), greenExcess(), isNearTransparency(), isNearWhite() (+41 more)

### Community 5 - "Sticker Section UI"
Cohesion: 0.11
Nodes (35): LineStickerDownloadSection(), LineStickerDownloadSectionProps, LineStickerPhraseCell, LineStickerPhraseCellProps, LineStickerPhraseGridEditor, LineStickerPhraseGridEditorProps, LineStickerPhraseSection, LineStickerPhraseSectionProps (+27 more)

### Community 6 - "Alpha Mask Feathering"
Cohesion: 0.06
Nodes (44): afterFeather, afterIslands, afterRepair, chromaKeyColor, chromaKeyed, cloneImage(), cols, compositeOnBlack() (+36 more)

### Community 7 - "Project Dependencies"
Cohesion: 0.04
Nodes (44): dependencies, gifenc, @google/genai, @huggingface/transformers, lucide-react, react, react-dom, react-router-dom (+36 more)

### Community 8 - "Sticker Generation Hooks"
Cohesion: 0.08
Nodes (45): applyPhraseSetFile(), buildActionDescList(), buildPhraseList(), buildSlots(), main(), mimeFromPath(), parseArgs(), PhraseSetFile (+37 more)

### Community 9 - "Upload Job Configuration"
Cohesion: 0.10
Nodes (31): JobConfig, isCli, main(), parseArgs(), DEFAULT_UPLOAD_ROOT, envFileBaseName(), isCli, main() (+23 more)

### Community 10 - "Sticker Page ViewModels"
Cohesion: 0.10
Nodes (36): LineStickerSettingsPanel, useLineStickerGeneration(), useLineStickerImageInput(), UseLineStickerImageInputParams, useLineStickerPhraseGeneration(), ensureLength(), useLineStickerPhraseGrid(), UseLineStickerPhraseGridParams (+28 more)

### Community 11 - "LINE Provisioning Automation"
Cohesion: 0.19
Nodes (33): add_traditional_chinese(), assert_no_duplicate_title_errors(), click_add_language(), click_save(), configure_campaigns(), confirm_save_dialog(), dismiss_campaign_float(), dismiss_creator_announcements() (+25 more)

### Community 12 - "Programmatic Style Controls"
Cohesion: 0.18
Nodes (18): ColorKey, createEmptyOverlaySheetArray(), FontKey, LineStickerProgrammaticOverlayComposeResult, LineStickerProgrammaticOverlayCore, LineStickerProgrammaticOverlayStyle, useDebouncedStyle(), useLineStickerProgrammaticOverlayCompose() (+10 more)

### Community 13 - "Google Drive Upload"
Cohesion: 0.16
Nodes (34): Any, collect_tasks_from_dir(), collect_tasks_from_env(), collect_tasks_from_local_set(), collect_tasks_from_zip(), drive_service_for_thread(), ensure_child_folder(), escape_drive_query() (+26 more)

### Community 14 - "Sticker Generation Types"
Cohesion: 0.18
Nodes (25): StickerConfig, GenerateOneSheetParams, LineStickerProgrammaticStyleControls(), LineStickerProgrammaticStyleControlsProps, LineStickerSettingsConfigViewModel, LineStickerSettingsPanelViewModel, STYLE_PREVIEW_IMAGE_MAP, STYLE_PREVIEW_PLACEHOLDER_LABELS (+17 more)

### Community 15 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (31): compilerOptions, allowImportingTsExtensions, allowJs, alwaysStrict, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules, jsx (+23 more)

### Community 16 - "Sticker Metadata Normalization"
Cohesion: 0.13
Nodes (27): main(), get_storage(), load_env(), normalize_en_description(), normalize_en_title(), normalize_sticker_meta(), normalize_zh_description(), normalize_zh_text() (+19 more)

### Community 17 - "Animation Settings UI"
Cohesion: 0.16
Nodes (17): AnimationConfigPanel, AnimationConfigPanelProps, AnimationPreview, AnimationPreviewProps, ExampleSelector, ExampleSelectorProps, SettingsModalProps, LEGACY_MODEL_IDS (+9 more)

### Community 18 - "Image Upload & Download"
Cohesion: 0.06
Nodes (33): 10. Task Breakdown (develop order), 11. Open Questions (resolve before or during spike), 12. Implementation Status (2026-07-11), 1. Problem Statement, 2. Locked Decisions (proposed defaults), 3. Objectives and Non-Objectives, 4.1 Pipeline comparison, 4.2 New module: `utils/lineStickerComposeLayout.ts` (+25 more)

### Community 19 - "LINE Upload Packaging"
Cohesion: 0.25
Nodes (13): buildLineUploadPack(), buildLineUploadZipBytes(), buildUploadFile(), clampIndex(), encodeUploadZip(), LineUploadPackFile, pickRandomShopStickerIndices(), resolveShopStickerIndices() (+5 more)

### Community 20 - "Job Finalization Scripts"
Cohesion: 0.16
Nodes (17): args, buildUploadPackOptions(), FINALIZE_PROJECT_ROOT, finalizeFromJob(), FinalizeJobOptions, FinalizeJobResult, finalizeStickerJob(), JobManifest (+9 more)

### Community 21 - "Sticker Generation CLI"
Cohesion: 0.21
Nodes (13): main(), parseArgs(), ROOT, run(), SCRIPT_DIR, slugSetName(), resolveUploadConfig(), DEFAULT_SKILL_STICKER_MODEL (+5 more)

### Community 22 - "App Routing & Pages"
Cohesion: 0.10
Nodes (12): App(), HomePage, LineStickerPage, OnePageComicPage, PartingPage, RemoveBackgroundPage, SpriteAnimatorPage, ErrorBoundary (+4 more)

### Community 23 - "Phrase Set Design"
Cohesion: 0.21
Nodes (20): actionsOnly(), buildThemeContext(), countNonEmpty(), designPhraseSet(), findDuplicatePhrases(), main(), parseArgs(), printVoiceChoices() (+12 more)

### Community 24 - "White Divider Detection"
Cohesion: 0.15
Nodes (18): clearNearWhiteEdgeArtifacts(), columnXRange(), computeDividerCellRect(), countDetectedWhiteDividers(), detectWhiteDividerGrid(), DetectWhiteDividerOptions, DividerCellRect, findDividerBand() (+10 more)

### Community 25 - "Localization & Internationalization"
Cohesion: 0.07
Nodes (28): 10. Error Handling, 11. Testing (MVP), 12. Implementation Phases, 13. Risks and Mitigations, 14. Open Items (deferred), 1. Problem Statement, 2. Locked Product Decisions (from stakeholder), 3. Objectives and Non-Objectives (+20 more)

### Community 26 - "Phrase Validation Logic"
Cohesion: 0.20
Nodes (19): clampStickerPhrase(), clampStickerPhrases(), isEnglishPhraseLanguage(), ALLOWED_PUNCT, auditStickerPhrases(), cjkCharCount(), englishWordCount(), getStickerPhraseIssues() (+11 more)

### Community 27 - "Upload Manifest Rebuilding"
Cohesion: 0.09
Nodes (21): LineUploadPackOptions, args, config, existingManifest, JobConfig, layouts, loadSheetFrames(), manifest (+13 more)

### Community 28 - "Sticker Quality Auditing"
Cohesion: 0.18
Nodes (16): ChromaFringeMetrics, isNearTransparent(), measureChromaFringe(), auditStickerFrame(), auditStickerFrames(), measureCaptionBandInkRatio(), measureForegroundRatio(), median() (+8 more)

### Community 29 - "Character Reference Generation"
Cohesion: 0.08
Nodes (25): API 配額優化, 📖 使用指南, 📷 使用範例, ✨ 功能特色, 動畫質量提升, 原圖（輸入）, 基本流程, 安裝步驟 (+17 more)

### Community 30 - "LINE Zip Upload"
Cohesion: 0.25
Nodes (18): click_consent_if_present(), count_filled_sticker_slots(), dismiss_modals(), ensure_forty_stickers(), fill_line_login(), login_line(), main(), open_image_editor() (+10 more)

### Community 31 - "Shop Listing Text"
Cohesion: 0.24
Nodes (16): buildDescEn(), buildDescZh(), collapseWhitespace(), fitEnDescription(), fitEnTitle(), fitZhDescription(), fitZhTitle(), LINE_CREATORS_LIMITS (+8 more)

### Community 32 - "Grid Validation Metrics"
Cohesion: 0.11
Nodes (25): scoreSheetGrid(), decodePng(), chromaKeyColor, cols, detected, expected, frames, image (+17 more)

### Community 33 - "Sheet Slicing Logic"
Cohesion: 0.20
Nodes (19): decodeImage(), encodePng(), extForBytes(), isJpeg(), isPng(), sliceSheet(), composePhrasesOnRgbaFrames(), overlayPhrasesOnRgbaFrames() (+11 more)

### Community 34 - "Sticker Set Naming"
Cohesion: 0.18
Nodes (17): containsCjk(), defaultTitleZhFromPhraseSet(), formatVoiceChoicesForError(), resolveVoiceKey(), stripLabelParenthetical(), suggestDescZh(), suggestPhraseSetNameZh(), suggestSetNameEn() (+9 more)

### Community 35 - "Credential Management"
Cohesion: 0.09
Nodes (25): args, batchPath, configPath, envBase, final, job, outDir, ROOT (+17 more)

### Community 36 - "Sheet Slice Diagnostics"
Cohesion: 0.13
Nodes (22): fontCssStackForPreset(), FontPresetKey, LineStickerTextOverlayOptions, resolveProgrammaticFontFamilyCss(), TextColorPresetKey, captionBandPixelRectForLabel(), centerSearchBoundsForTextBoxInBand(), correctionToFitTextBoxInFrame() (+14 more)

### Community 37 - "Upload Execution Pipeline"
Cohesion: 0.13
Nodes (16): args, batchEnv, envSrc, PROJECT_ROOT, SKILL_ROOT, step, STEP_SCRIPTS, steps (+8 more)

### Community 38 - "Batch Submission Scripts"
Cohesion: 0.32
Nodes (13): discover_sets(), find_zip(), main(), merge_credentials(), prepare_set_env(), process_one_set(), Path, rel_posix() (+5 more)

### Community 39 - "Sticker Result ViewModels"
Cohesion: 0.14
Nodes (23): SettingsModal, createInitialSheetStatuses(), isActiveSheetStage(), LineStickerGenerationSetters, LineStickerGenerationTexts, LineStickerSheetStage, UseLineStickerSheetGenerationOptions, SheetIndex (+15 more)

### Community 40 - "Render Profiler Debugger"
Cohesion: 0.18
Nodes (14): RenderProfilerDebugPanel(), RenderProfilerDebugPanelProps, RenderProfilerStats, clearRenderProfilerEntries(), emit(), getRenderProfilerSnapshot(), Listener, listeners (+6 more)

### Community 41 - "Sprite Editing UI"
Cohesion: 0.11
Nodes (24): ImageUpload, ImageUploadProps, LanguageSwitcher, LineStickerHeader(), LineStickerHeaderProps, eraseCircle(), eraseLine(), getCanvasPoint() (+16 more)

### Community 42 - "Action Description Logic"
Cohesion: 0.30
Nodes (13): ACTION_DEDUPE_THRESHOLD_BY_STRENGTH, ActionDescriptionContext, buildActionTokenSet(), buildDeterministicActionFallback(), categorizePhrase(), computeJaccardSimilarity(), extractJsonArrayText(), generateActionDescriptions() (+5 more)

### Community 43 - "Grid Template Drawing"
Cohesion: 0.26
Nodes (13): buildEqualGridBounds(), buildGridSheetTemplate(), BuildGridSheetTemplateOptions, drawCellCornerTicks(), drawGuidedGridOverlay(), drawHorizontalGroove(), drawVerticalGroove(), EqualGridBounds (+5 more)

### Community 44 - "Node Image Processing"
Cohesion: 0.15
Nodes (19): blitOntoCanvas(), composeCenteredOnCanvas(), detectBestGridLayout(), extractCellFrame(), normalizeChromaBackground(), prepareLineMainImage(), prepareLineTabImage(), processSheetChromaKey() (+11 more)

### Community 45 - "Batch Job Runner"
Cohesion: 0.14
Nodes (9): args, BatchJob, BatchManifest, manifest, manifestAbs, manifestDir, onlyOut, ROOT (+1 more)

### Community 46 - "SpriteAnimatorPage.tsx"
Cohesion: 0.10
Nodes (22): ProjectHistory, ProjectHistoryItem, ProjectHistoryItemProps, ProjectHistoryProps, useAnimation(), decodePngToRgba(), useExport(), deleteProjectItem() (+14 more)

### Community 47 - "Sheet Boundary Detection"
Cohesion: 0.26
Nodes (11): buildMedianRowBounds(), buildRowDensityProfile(), detectColumnRowBounds(), DetectedSheetGrid, detectSheetGridBoundaries(), DetectSheetGridOptions, enforceMonotonic(), findBestBoundary() (+3 more)

### Community 48 - "Grid Score Gating"
Cohesion: 0.31
Nodes (9): assertManifestGridGate(), assertOutDirGridGate(), ManifestGridGateInput, resolveMinGridScore(), assertGridScoresPass(), findGridScoreFailures(), formatGridGateMessage(), GridScoreFailure (+1 more)

### Community 49 - "Slice Optimization"
Cohesion: 0.24
Nodes (7): CellCropRect, Component, ComputeCellCropOptions, computeCellCropRect(), fallbackCellRect(), findComponents(), PixelPoint

### Community 50 - "Generate & Upload CLI"
Cohesion: 0.16
Nodes (23): asDomCanvasContext(), composeStickerFrame(), cropFrame(), drawGlyph(), drawLineWithSpacing(), drawRgbaFrameOnCanvas(), measureOpaqueBounds(), PixelBounds (+15 more)

### Community 51 - "LINE Review Submission"
Cohesion: 0.36
Nodes (12): dismiss_overlays(), Page, accept_terms_and_confirm(), click_submit_button(), collect_visible_status_labels(), detect_review_status(), ensure_logged_in(), Page (+4 more)

### Community 52 - "Sheet Reslicing Utility"
Cohesion: 0.07
Nodes (30): 1. 選擇正確的背景顏色, 2. 檢查生成結果, 3. 優化生成品質, Q1: 我需要做什麼特殊設定嗎?, Q2: 會增加處理時間嗎?, Q3: 我可以看到處理進度嗎?, Q4: 如果去背還是失敗怎麼辦?, Q5: 支援其他顏色嗎? (+22 more)

### Community 53 - "Input-to-Upload Pipeline"
Cohesion: 0.21
Nodes (11): detectBrowserLanguage(), LanguageContext, LanguageProvider(), LanguageProviderProps, NavigatorWithUserLanguage, REQUIRED_COMIC_KEYS, en, getTranslation() (+3 more)

### Community 54 - "Sheet Re-overlay Utility"
Cohesion: 0.11
Nodes (22): argv, cols, frames, image, loadOverlayConfig(), processedPath, rows, sheetDir (+14 more)

### Community 55 - "Cell Crop Logic"
Cohesion: 0.17
Nodes (12): 1. 洋紅色去背邊緣殘留, 2. 綠幕去背完全失敗, v2.0 — 邊緣殘留清理與綠幕修復 (2026-01-30), 去色算法, 向後相容性 (Backward Compatibility), 問題回報 (Issue Report), 已知限制 (Known Limitations), 技術細節 (Technical Details) (+4 more)

### Community 56 - "Sticker Voice Presets"
Cohesion: 0.57
Nodes (5): generateStickerPhrases(), buildStickerVoicePromptBlock(), listStickerVoiceKeys(), resolveStickerVoice(), STICKER_VOICE_PRESETS

### Community 57 - "Provisioning Unit Tests"
Cohesion: 0.43
Nodes (4): FakeBrowser, Path, test_create_browser_context_omits_storage_state_when_session_missing(), test_create_browser_context_reuses_storage_state_when_session_exists()

### Community 58 - "Asset Validation Utility"
Cohesion: 0.62
Nodes (6): check_file(), main(), print_report(), Path, read_png_size(), validate()

### Community 59 - "Upload Pipeline Orchestration"
Cohesion: 0.09
Nodes (23): Advanced Sprite Sheet Features, Animation Quality Improvement, API Quota Optimization, Basic Workflow, 🎯 Best Practices, Build Production Version, 🤝 Contributing, 🔧 Development (+15 more)

### Community 60 - "API Key Management"
Cohesion: 0.13
Nodes (20): captionInkWidth(), LAYOUT_PRESETS, makeSubjectBlob(), ComposeCaptionAlign, ComposeCaptionOrientation, ComposeCaptionSizing, ComposeSlots, ComposeSubjectAnchor (+12 more)

### Community 61 - "Black Cat Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 62 - "Cream Cat Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 63 - "Giraffe Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 64 - "Project Design Docs"
Cohesion: 0.18
Nodes (10): Agent workflow, API key, Command, Example follow-up, Flags, Full flow, LINE Sticker Character Reference Generator, Related skills (+2 more)

### Community 65 - "Sticker Skill Modules"
Cohesion: 0.09
Nodes (21): Add / refresh actionDescs only, Agent workflow, AI design (recommended), Commands, Flags reference, Hand-written JSON, LINE Sticker Phrase Design, Output format (+13 more)

### Community 66 - "Sticker Pack Extraction"
Cohesion: 0.83
Nodes (3): extract_pack(), main(), Path

### Community 67 - "Zip Preparation Utility"
Cohesion: 0.83
Nodes (3): flatten_zip(), main(), Path

### Community 68 - "Drive Playwright Upload"
Cohesion: 0.67
Nodes (3): collect_files(), main(), Path

### Community 69 - "Meerkat Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 72 - "Bunny Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 73 - "Capybara Assets"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 74 - "Prompt Engineering Guides"
Cohesion: 0.06
Nodes (31): LINE 貼圖 Prompt 使用範例, 動態生成多個主題, 📝 基本使用, 🎨 完整 Prompt 輸出範例, 從使用者輸入建立 Prompt, 📚 相關文件, 範例 1：使用預設設定生成日常聊天主題貼圖, 範例 2：自訂角色描述 (+23 more)

### Community 75 - "Otter Banter Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Otter Banter Sprite Sheet 1

### Community 76 - "Owl Banter Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Owl Banter Sprite Sheet 1

### Community 77 - "Owl Daily Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Owl Daily Sprite Sheet 1

### Community 78 - "Panda Banter Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Panda Banter Sprite Sheet 1

### Community 79 - "Panda Daily Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Panda Daily Sprite Sheet 1

### Community 80 - "Shiba Banter Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Shiba Banter Sprite Sheet 1

### Community 81 - "Shiba Daily Assets"
Cohesion: 0.25
Nodes (7): Description, Description, English, Title, Title, Traditional Chinese (Taiwan), Shiba Daily Sprite Sheet 1

### Community 86 - "Optimization Report"
Cohesion: 0.17
Nodes (11): 1.1 Reduce `any` usage, 1.2 Dead code, 1. TypeScript & Code Quality, 2. Error handling, 3. i18n & Accessibility, 4. Build & Environment, 5. Performance & Structure, 6. Logging (+3 more)

### Community 87 - "Slice Consistency Design"
Cohesion: 0.09
Nodes (21): 10. Open Decisions Resolved, 11. Success Criteria, 1. Problem Statement, 2. Objectives and Non-Objectives, 3. Recommended Approach, 4.1 `GridHypothesisStage` (coarse localization), 4.2 `ContentConsistencyStage` (fine scoring), 4.3 `BestFitSelector` (decision) (+13 more)

### Community 92 - "Optimization Roadmap"
Cohesion: 0.27
Nodes (8): optimizeSliceForImage(), isSliceBackgroundPixel(), columnHasContent(), computeOptimizedSliceFromMargins(), ContentMargins, measureContentMargins(), OptimizeSliceOptions, rowHasContent()

### Community 117 - "sheetComponentSlicer.ts"
Cohesion: 0.13
Nodes (12): clearEdgeConnectedResidue(), clearSmallOpaqueIslands(), EdgeCleanupOptions, SmallIslandCleanupOptions, buildCellLookup(), isDividerResidue(), LabeledSheet, labelSheetComponents() (+4 more)

### Community 118 - "geminiSheet.mts"
Cohesion: 0.10
Nodes (40): AttachmentIndices, buildCharacterRefBlock(), buildCompanionBlock(), buildGridTemplateInstruction(), buildGuidedGridEditAnchorBlock(), buildGuidedGridReminderBlock(), buildGuidedLayoutOverrideBlock(), buildSafeFramingInstruction() (+32 more)

### Community 119 - "index.ts"
Cohesion: 0.19
Nodes (11): ComicCharacterSheetStep, ComicCharacterSheetStepProps, ComicResultStep, ComicResultStepProps, ComicSourceMode, ComicSourceStep, ComicSourceStepProps, ComicWizardSteps (+3 more)

### Community 120 - "useExport"
Cohesion: 0.17
Nodes (8): APNGFrame, APNGImage, gifenc, GIFEncoderOptions, ImportMeta, ImportMetaEnv, upng-js, UpngJs

### Community 121 - "Chroma Similarity Unify Design"
Cohesion: 0.11
Nodes (18): 1. Problem Statement, 2. Locked Decisions (from stakeholder), 3. Objectives and Non-Objectives, 4.1 New module: `utils/chromaSimilarity.ts`, 4.2 Data flow (unchanged outer order), 4.3 Call-site wiring, 4.4 Guided simplify rules, 4. Architecture (+10 more)

### Community 122 - "programmaticTextOverlay.mts"
Cohesion: 0.22
Nodes (18): blitRgbaOntoCanvas(), ComposeOverlayOptions, composePhraseOnRgbaFrame(), FontPresetKey, overlayPhraseOnRgbaFrame(), ProgrammaticOverlayOptions, readRgbaFromCanvas(), TextColorPresetKey (+10 more)

### Community 123 - "Agent workflow"
Cohesion: 0.11
Nodes (17): Agent workflow, Chroma key rules (guided green), Full flow (design → generate), Inputs, Limits, LINE Sticker Pipeline, One-command entry, Re-slice workflow (chroma fix, no Gemini) (+9 more)

### Community 124 - "preview-programmatic-font-sizes.mts"
Cohesion: 0.12
Nodes (15): args, cols, frames, image, loadBaseTuning(), outDir, pad, positionals (+7 more)

### Community 125 - "File Map (Phase 1 MVP)"
Cohesion: 0.12
Nodes (16): File Map (Phase 1 MVP), One-Page Comic (4A) Implementation Plan, Out of Scope (do not implement in this plan), Self-Review (spec coverage), Task 10: OnePageComicPage orchestration, Task 11: Routing, home card, i18n, Task 12: Manual E2E verification, Task 1: Comic panel schema and validation (+8 more)

### Community 126 - "OnePageComicPage.tsx"
Cohesion: 0.28
Nodes (10): ApiError, getErrorMessage(), isApiError(), isQuotaError(), QuotaError, computeTemplateMatchScore(), cropCellFromImage(), getBestOffsetByTemplateMatch() (+2 more)

### Community 127 - "audit-programmatic-overlay.mts"
Cohesion: 0.13
Nodes (14): AuditEntry, BandSample, configPath, entries, isTextLikePixel(), missing, outDir, phrasePath (+6 more)

### Community 128 - "compare-chroma-forge.mts"
Cohesion: 0.18
Nodes (11): Pass 1: 主要色度去背, Pass 2: 邊緣清理 (改進版), Pass 3: 去色處理 (新增), 增加容差值, 改進 1: 更積極的顏色標準化, 改進 2: 三遍去背處理, 改進 3: 增強綠色檢測範圍, 改進 4: 增加 Fuzz 容差 (+3 more)

### Community 129 - "comicStoryboard.ts"
Cohesion: 0.20
Nodes (9): bleedForBounds(), bleedRatio(), cols, detected, equalX, equalY, rows, score (+1 more)

### Community 130 - "Background Color Normalization (背景顏色標準化)"
Cohesion: 0.13
Nodes (15): 1. Color Normalization Post-Processing (顏色標準化後處理), 2. Enhanced Prompt Engineering (強化提示詞), Background Color Normalization (背景顏色標準化), Benefits (優勢), Changelog (變更日誌), Color Detection Logic (顏色檢測邏輯), Detection Tolerance (檢測容差), Examples of Color Variations (色差範例) (+7 more)

### Community 131 - "可修改項目（由你決定是否採用）"
Cohesion: 0.13
Nodes (14): 10. 區塊順序改為「Layout 最先」（與 LINE 一致）, 1. 開頭加一句總述（與 LINE 一致）, 2. 章節改為 `### [N. 名稱]` 格式（與 LINE 一致）, 3. 在 Layout 區塊補上 Canvas 說明（與 LINE 一致）, 4. 新增 [Style / Art Medium] 區塊（可選）, 5. 新增 [Subject / Character] 區塊（可選）, 6. Per-cell 列表格式改為更接近 LINE 的 [5. Grid Content], 7. 結尾加一段 [Final Goal] 一句總結（與 LINE [7] 一致） (+6 more)

### Community 132 - "LINE Sticker Maker"
Cohesion: 0.14
Nodes (13): Agent workflow, Chroma safety (guided green), config.json fields, Environment files (two layers), How to run, LINE Sticker Maker, manifest.json, Notes / limits (+5 more)

### Community 133 - "LINE Sticker Upload"
Cohesion: 0.17
Nodes (11): 1. Generate stickers, 2. Manual sync (if needed), 3. Upload to LINE, Batch upload (multiple sets), Environment files, LINE Sticker Upload, Pipeline order (do not skip), Secrets (never commit) (+3 more)

### Community 134 - "File Map"
Cohesion: 0.18
Nodes (10): Chroma Similarity Unify Implementation Plan, File Map, Self-review notes, Spec coverage checklist, Task 1: `chromaSimilarity` module (TDD), Task 2: Point normalize at shared API, Task 3: Wire `processChromaKey` similarity + soft edge to shared API, Task 4: Guided simplify path + auto-detect (+2 more)

### Community 135 - "4. **用戶體驗改進**"
Cohesion: 0.18
Nodes (11): 4.1 進度指示器, 4.2 鍵盤快捷鍵, 4.3 視覺化切片調整, 4. **用戶體驗改進**, 5.1 預設配置保存/載入, 5.2 歷史記錄, 5. **配置管理**, 6.1 更多格式 (+3 more)

### Community 136 - "8. **開發工具**"
Cohesion: 0.20
Nodes (10): 1. **生產環境清理**, 2. **去背處理性能優化**, 3. **錯誤處理增強**, 8.1 測試框架, 8.2 性能監控, 8.3 文檔生成, 8. **開發工具**, 🟢 低優先級（長期規劃） (+2 more)

### Community 137 - "v1.1.0 — 精確洋紅色去背 (2026-01-25)"
Cohesion: 0.22
Nodes (9): 1. 新增函數：`removeChromaKey()`, 2. 配置參數, v1.1.0 — 精確洋紅色去背 (2026-01-25), 🛠️ 技術實現, 🎯 改進目標, 新流程（改進）, 🔄 新的處理流程, ⚠️ 注意事項 (+1 more)

### Community 138 - "專案優化路線圖與功能建議"
Cohesion: 0.22
Nodes (9): 📝 具體實施建議, 📈 專案健康度：85/100, 專案優化路線圖與功能建議, ✅ 已完成的核心功能, 🔧 技術債務, 本週可以實施的, 📊 當前專案狀態評估, 立即可以實施的（今天） (+1 more)

### Community 139 - "PartingPage.tsx"
Cohesion: 0.29
Nodes (9): focusRing, SheetSliceProgrammaticOverlayPanel(), SheetSliceProgrammaticOverlayPanelProps, buildPhrasesFromMultiline(), SheetSliceOverlayColorKey, SheetSliceOverlayFontKey, useSheetSliceProgrammaticOverlay(), overlayPhrasesOnStickerFrames() (+1 more)

### Community 140 - "despillForgeGreenFringe"
Cohesion: 0.67
Nodes (3): 構建生產版本, 🔧 開發, 預覽生產版本

### Community 142 - "English"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 143 - "English"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 144 - "English"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 145 - "English"
Cohesion: 0.29
Nodes (6): Description, Description, English, Title, Title, Traditional Chinese (Taiwan)

### Community 146 - "精靈圖切分與校正流程（目前實作）"
Cohesion: 0.29
Nodes (7): 1. 精靈圖來源與前處理, 2. 格線與「每格切割框」怎麼算, 3. frameOverrides 的來源與時機, 4. 切分觸發時機（何時用 frameOverrides 重切）, 5. 智能對齊演算法（smartAutoAlignFrames）在做什麼, 6. 流程總覽（簡表）, 精靈圖切分與校正流程（目前實作）

### Community 150 - "💡 創新功能建議"
Cohesion: 0.40
Nodes (5): 1. **智能切片檢測**, 2. **動作庫**, 3. **協作功能**, 4. **集成功能**, 💡 創新功能建議

### Community 151 - "🚀 推薦實施順序"
Cohesion: 0.40
Nodes (5): 🚀 推薦實施順序, 第一階段（1-2 週）, 第三階段（3-4 週）, 第二階段（2-3 週）, 第四階段（長期）

### Community 152 - "🚀 Deploy to GitHub Pages"
Cohesion: 0.40
Nodes (5): Automatic Deployment (Recommended), 🚀 Deploy to GitHub Pages, Important Notes, Manual Build (Local Testing), Manual Trigger

### Community 153 - "rgbaScale.ts"
Cohesion: 0.60
Nodes (3): RgbaBuffer, scaleRgbaBoxDown(), scaleRgbaNearest()

### Community 154 - "7. **高級功能**"
Cohesion: 0.50
Nodes (4): 7.1 動畫編輯, 7.2 批量處理, 7.3 AI 增強, 7. **高級功能**

### Community 155 - "🎯 成功指標"
Cohesion: 0.50
Nodes (4): 功能完整性, 性能, 🎯 成功指標, 用戶體驗

### Community 156 - "📊 性能優化機會"
Cohesion: 0.67
Nodes (3): 優化目標, 📊 性能優化機會, 當前性能指標

### Community 157 - "📚 參考資源"
Cohesion: 0.67
Nodes (3): 📚 參考資源, 工具和庫, 最佳實踐

## Knowledge Gaps
- **856 isolated node(s):** `SCRIPT_DIR`, `SKILL_DIR`, `ROOT_DIR`, `outDir`, `phrasePath` (+851 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jszip` connect `LINE Upload Packaging` to `Sprite Editing UI`, `SpriteAnimatorPage.tsx`, `Project Dependencies`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Project Dependencies` to `LINE Upload Packaging`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `SCRIPT_DIR`, `SKILL_DIR`, `ROOT_DIR` to the rest of the system?**
  _871 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gemini Prompt Builders` be split into smaller, more focused modules?**
  _Cohesion score 0.053726453726453724 - nodes in this community are weakly interconnected._
- **Should `Sprite Sheet Processing` be split into smaller, more focused modules?**
  _Cohesion score 0.12367864693446089 - nodes in this community are weakly interconnected._
- **Should `Chroma Key Detection` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `Sticker Section UI` be split into smaller, more focused modules?**
  _Cohesion score 0.11416490486257928 - nodes in this community are weakly interconnected._