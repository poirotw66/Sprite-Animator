# Graph Report - .  (2026-07-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1625 nodes · 4192 edges · 117 communities (81 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.8)
- Token cost: 4,962 input · 1,369 output

## Graph Freshness
- Built from commit: `2dd16048`
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
- Project History Management
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

## God Nodes (most connected - your core abstractions)
1. `LineStickerSheetIndex` - 36 edges
2. `useLanguage()` - 35 edges
3. `LineStickerPage()` - 34 edges
4. `ChromaKeyColorType` - 32 edges
5. `SliceSettings` - 29 edges
6. `compilerOptions` - 28 edges
7. `generateOneSheet()` - 26 edges
8. `Translations` - 26 edges
9. `getErrorMessage()` - 26 edges
10. `isSliceBackgroundPixel()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `GenerateSheetParams` --references--> `ChromaKeyColorType`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/geminiSheet.mts → types.ts
- `scoreGridLayout()` --calls--> `scoreGridLayoutFromRgba()`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/nodeImage.mts → utils/sheetGridValidation.ts
- `detectBestGridLayout()` --calls--> `detectBestGridLayoutFromRgba()`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/nodeImage.mts → utils/sheetGridValidation.ts
- `ProgrammaticOverlayOptions` --references--> `ProgrammaticTextOverlayTuning`  [EXTRACTED]
  .claude/skills/line-sticker-maker/scripts/programmaticTextOverlay.mts → utils/lineStickerTextOverlayTypes.ts
- `SpriteSheetSliceControlsProps` --references--> `SliceSettings`  [EXTRACTED]
  components/SpriteSheetSliceControls.tsx → utils/spriteSlicing.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **LINE Sticker Generation Workflow** — claude_skills_line_sticker_character_ref_skill, claude_skills_line_sticker_phrase_design_skill, claude_skills_line_sticker_pipeline_skill, claude_skills_line_sticker_maker_skill, claude_skills_line_sticker_upload_skill [EXTRACTED 1.00]
- **One-Page Comic Module** — docs_superpowers_plans_one_page_comic, docs_superpowers_specs_one_page_comic_design, services_gemini_comicpage, services_gemini_comicstoryboard, services_gemini_comiccharactersheet, hooks_usecomicproject [EXTRACTED 1.00]
- **Chroma Similarity Unification** — docs_superpowers_plans_chroma_similarity_unify, docs_superpowers_specs_chroma_similarity_unify_design, utils_chromasimilarity, utils_chromakeycore, utils_normalizechromabackground [EXTRACTED 1.00]
- **Banter Chat Sticker Series** — line_s_input_706_cozy_black_cat_banter_chat_cozy_black_cat_banter_chat, line_s_input_706_cozy_bunny_banter_chat_cozy_bunny_banter_chat, line_s_input_706_cozy_capybara_banter_chat_cozy_capybara_banter_chat, line_s_input_706_cozy_cream_cat_banter_chat_cozy_cream_cat_banter_chat, line_s_input_706_cozy_giraffe_banter_chat_cozy_giraffe_banter_chat, line_s_input_706_cozy_meerkat_banter_chat_cozy_meerkat_banter_chat [EXTRACTED 0.90]
- **Daily Chat Sticker Series** — line_s_input_706_cozy_black_cat_daily_chat_cozy_black_cat_daily_chat, line_s_input_706_cozy_cream_cat_daily_chat_cozy_cream_cat_daily_chat, line_s_input_706_cozy_giraffe_daily_chat_cozy_giraffe_daily_chat, line_s_input_706_cozy_meerkat_daily_chat_cozy_meerkat_daily_chat [EXTRACTED 0.90]
- **Chroma Key & Normalization Pipeline** — md_background_color_normalization, md_chroma_key, md_quick_start_guide [EXTRACTED 1.00]
- **LINE Sticker Generation Framework** — md_line_sticker_prompt_structure, md_line_sticker_prompt_example, md_character_animation_prompt_options [EXTRACTED 0.90]
- **Cozy Animal Sticker Collection** — line_s_input_706_cozy_otter_banter_chat_cozy_otter_banter_chat, line_s_input_706_cozy_owl_banter_chat_cozy_owl_banter_chat, line_s_input_706_cozy_owl_daily_chat_cozy_owl_daily_chat, line_s_input_706_cozy_panda_banter_chat_cozy_panda_banter_chat, line_s_input_706_cozy_panda_daily_chat_cozy_panda_daily_chat, line_s_input_706_cozy_shiba_banter_chat_cozy_shiba_banter_chat, line_s_input_706_cozy_shiba_daily_chat_cozy_shiba_daily_chat [EXTRACTED 1.00]
- **Character Style Variants** — public_style_previews_chibi, public_style_previews_doodle, public_style_previews_flat, public_style_previews_linechibi, public_style_previews_minimalist, public_style_previews_pastel, public_style_previews_pixel, public_style_previews_watercolor, public_style_previews_yurukawa [EXTRACTED 1.00]

## Communities (117 total, 36 thin omitted)

### Community 0 - "Gemini Prompt Builders"
Cohesion: 0.06
Nodes (74): AttachmentIndices, buildCharacterRefBlock(), buildCompanionBlock(), buildGridTemplateInstruction(), buildGuidedGridEditAnchorBlock(), buildGuidedGridReminderBlock(), buildGuidedLayoutOverrideBlock(), buildSafeFramingInstruction() (+66 more)

### Community 1 - "Comic Creation UI"
Cohesion: 0.06
Nodes (56): ComicCharacterSheetStep, ComicCharacterSheetStepProps, ComicResultStep, ComicResultStepProps, ComicSourceMode, ComicSourceStep, ComicSourceStepProps, ComicStoryboardStep (+48 more)

### Community 2 - "Sprite Sheet Processing"
Cohesion: 0.06
Nodes (38): FrameGrid, decodePngToRgba(), useExport(), useLineStickerSlicing(), useSpriteSheet(), UseSpriteSheetSlicePipelineOptions, useSpriteSheetFlow(), APNGFrame (+30 more)

### Community 3 - "Text Overlay Engine"
Cohesion: 0.08
Nodes (47): blitRgbaOntoCanvas(), FontPresetKey, overlayPhraseOnRgbaFrame(), overlayPhrasesOnRgbaFrames(), ProgrammaticOverlayOptions, readRgbaFromCanvas(), TextColorPresetKey, getLineStickerTextPlacementLabel() (+39 more)

### Community 4 - "Chroma Key Detection"
Cohesion: 0.08
Nodes (37): Chroma Similarity Unify Plan, Chroma Similarity Unify Design, shouldUseGuidedChromaPath(), isNearWhite(), processChromaKey(), ProcessChromaKeyOptions, rgbToHsl(), greenPropOrigin() (+29 more)

### Community 5 - "Sticker Section UI"
Cohesion: 0.09
Nodes (36): LineStickerDownloadSection(), LineStickerDownloadSectionProps, LineStickerHeader(), LineStickerHeaderProps, LineStickerPhraseCell, LineStickerPhraseCellProps, LineStickerPhraseGridEditor, LineStickerPhraseGridEditorProps (+28 more)

### Community 6 - "Alpha Mask Feathering"
Cohesion: 0.08
Nodes (29): AlphaEdgeFeatherOptions, boxBlurAlpha(), erodeAlpha(), featherAlphaEdge(), markExteriorBoundary(), readAlphaAt(), readDataAlpha(), restoreInteriorStrokeWhite() (+21 more)

### Community 7 - "Project Dependencies"
Cohesion: 0.04
Nodes (46): encodeUploadZip(), dependencies, gifenc, @google/genai, @huggingface/transformers, jszip, lucide-react, react (+38 more)

### Community 8 - "Sticker Generation Hooks"
Cohesion: 0.11
Nodes (32): useLineStickerGeneration(), PhraseGenerationTexts, useLineStickerPhraseGeneration(), useLineStickerThemePresetSync(), UseLineStickerThemePresetSyncParams, CHARACTER_PRESETS, DEFAULT_CHARACTER_SLOT, DEFAULT_TEXT_SLOT (+24 more)

### Community 9 - "Upload Job Configuration"
Cohesion: 0.10
Nodes (31): JobConfig, isCli, main(), parseArgs(), DEFAULT_UPLOAD_ROOT, envFileBaseName(), isCli, main() (+23 more)

### Community 10 - "Sticker Page ViewModels"
Cohesion: 0.14
Nodes (29): useLineStickerImageInput(), UseLineStickerImageInputParams, ensureLength(), useLineStickerPhraseGrid(), UseLineStickerPhraseGridParams, useLineStickerPromptPreview(), useLineStickerResultPanelViewModel(), useLineStickerSelection() (+21 more)

### Community 11 - "LINE Provisioning Automation"
Cohesion: 0.19
Nodes (33): add_traditional_chinese(), assert_no_duplicate_title_errors(), click_add_language(), click_save(), configure_campaigns(), confirm_save_dialog(), dismiss_campaign_float(), dismiss_creator_announcements() (+25 more)

### Community 12 - "Programmatic Style Controls"
Cohesion: 0.11
Nodes (27): LineStickerProgrammaticStyleControls(), focusRing, SheetSliceProgrammaticOverlayPanelProps, ColorKey, createEmptyOverlaySheetArray(), FontKey, LineStickerProgrammaticOverlayComposeResult, LineStickerProgrammaticOverlayCore (+19 more)

### Community 13 - "Google Drive Upload"
Cohesion: 0.17
Nodes (32): Any, collect_tasks_from_dir(), collect_tasks_from_env(), collect_tasks_from_local_set(), collect_tasks_from_zip(), ensure_child_folder(), escape_drive_query(), execute_upload() (+24 more)

### Community 14 - "Sticker Generation Types"
Cohesion: 0.19
Nodes (28): StickerConfig, GenerateOneSheetParams, FrameGridProps, LineStickerProgrammaticStyleControlsProps, LineStickerResultPanelViewerViewModel, LineStickerSettingsConfigViewModel, UseLineStickerSheetGenerationOptions, GenerateSingleSheetOptions (+20 more)

### Community 15 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (31): compilerOptions, allowImportingTsExtensions, allowJs, alwaysStrict, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules, jsx (+23 more)

### Community 16 - "Sticker Metadata Normalization"
Cohesion: 0.13
Nodes (27): main(), get_storage(), load_env(), normalize_en_description(), normalize_en_title(), normalize_sticker_meta(), normalize_zh_description(), normalize_zh_text() (+19 more)

### Community 17 - "Animation Settings UI"
Cohesion: 0.15
Nodes (19): AnimationConfigPanel, AnimationConfigPanelProps, AnimationPreview, AnimationPreviewProps, ExampleSelector, ExampleSelectorProps, SettingsModalProps, LEGACY_MODEL_IDS (+11 more)

### Community 18 - "Image Upload & Download"
Cohesion: 0.12
Nodes (21): ImageUpload, ImageUploadProps, SettingsModal, SheetSliceProgrammaticOverlayPanel(), useAnimation(), DownloadFormat, mapWithConcurrency(), useLineStickerDownload() (+13 more)

### Community 19 - "LINE Upload Packaging"
Cohesion: 0.16
Nodes (21): buildLineUploadPack(), buildUploadFile(), clampIndex(), LineUploadPackFile, pickRandomShopStickerIndices(), resolveShopStickerIndices(), blitOntoCanvas(), composeCenteredOnCanvas() (+13 more)

### Community 20 - "Job Finalization Scripts"
Cohesion: 0.14
Nodes (20): args, buildUploadPackOptions(), FINALIZE_PROJECT_ROOT, finalizeFromJob(), FinalizeJobOptions, FinalizeJobResult, finalizeStickerJob(), JobManifest (+12 more)

### Community 21 - "Sticker Generation CLI"
Cohesion: 0.14
Nodes (20): applyPhraseSetFile(), buildActionDescList(), buildPhraseList(), buildSlots(), main(), mimeFromPath(), parseArgs(), PhraseSetFile (+12 more)

### Community 22 - "App Routing & Pages"
Cohesion: 0.10
Nodes (13): App(), HomePage, LineStickerPage, OnePageComicPage, PartingPage, RemoveBackgroundPage, SpriteAnimatorPage, ErrorBoundary (+5 more)

### Community 23 - "Phrase Set Design"
Cohesion: 0.22
Nodes (21): actionsOnly(), buildThemeContext(), countNonEmpty(), designPhraseSet(), findDuplicatePhrases(), main(), parseArgs(), printVoiceChoices() (+13 more)

### Community 24 - "White Divider Detection"
Cohesion: 0.15
Nodes (18): clearNearWhiteEdgeArtifacts(), columnXRange(), computeDividerCellRect(), countDetectedWhiteDividers(), detectWhiteDividerGrid(), DetectWhiteDividerOptions, DividerCellRect, findDividerBand() (+10 more)

### Community 25 - "Localization & Internationalization"
Cohesion: 0.16
Nodes (15): LanguageSwitcher, detectBrowserLanguage(), LanguageContext, LanguageContextType, LanguageProvider(), LanguageProviderProps, NavigatorWithUserLanguage, REQUIRED_COMIC_KEYS (+7 more)

### Community 26 - "Phrase Validation Logic"
Cohesion: 0.21
Nodes (18): clampStickerPhrase(), clampStickerPhrases(), isEnglishPhraseLanguage(), ALLOWED_PUNCT, cjkCharCount(), englishWordCount(), getStickerPhraseIssues(), hasForbiddenChars() (+10 more)

### Community 27 - "Upload Manifest Rebuilding"
Cohesion: 0.10
Nodes (18): LineUploadPackOptions, decodePng(), args, config, existingManifest, JobConfig, layouts, loadSheetFrames() (+10 more)

### Community 28 - "Sticker Quality Auditing"
Cohesion: 0.18
Nodes (16): ChromaFringeMetrics, isNearTransparent(), measureChromaFringe(), auditStickerFrame(), auditStickerFrames(), measureCaptionBandInkRatio(), measureForegroundRatio(), median() (+8 more)

### Community 29 - "Character Reference Generation"
Cohesion: 0.20
Nodes (15): generateCharacterRefImage(), apiKey, DEFAULT_LAYOUT_REF, main(), mimeFromPath(), parseArgs(), printStyleTable(), resolveImagePath() (+7 more)

### Community 30 - "LINE Zip Upload"
Cohesion: 0.25
Nodes (18): click_consent_if_present(), count_filled_sticker_slots(), dismiss_modals(), ensure_forty_stickers(), fill_line_login(), login_line(), main(), open_image_editor() (+10 more)

### Community 31 - "Shop Listing Text"
Cohesion: 0.24
Nodes (16): buildDescEn(), buildDescZh(), collapseWhitespace(), fitEnDescription(), fitEnTitle(), fitZhDescription(), fitZhTitle(), LINE_CREATORS_LIMITS (+8 more)

### Community 32 - "Grid Validation Metrics"
Cohesion: 0.24
Nodes (13): scoreSheetGrid(), buildGridCandidates(), buildGridRetryPromptSuffix(), columnWidthCoefficientOfVariation(), detectBestGridLayoutFromRgba(), GridValidationOptions, measureColumnUniformityFromRgba(), rankSheetAttempt() (+5 more)

### Community 33 - "Sheet Slicing Logic"
Cohesion: 0.24
Nodes (16): encodePng(), extForBytes(), RgbaImage, sliceSheet(), archiveGridAttempt(), AttemptState, generateOneSheet(), GenerateOneSheetResult (+8 more)

### Community 34 - "Sticker Set Naming"
Cohesion: 0.18
Nodes (15): formatVoiceChoicesForError(), listVoiceChoicesZh(), resolveVoiceKey(), stripLabelParenthetical(), suggestDescZh(), suggestPhraseSetNameZh(), THEME_EN_LABELS, THEME_ZH_ALIASES (+7 more)

### Community 35 - "Credential Management"
Cohesion: 0.19
Nodes (15): BatchEnvFields, CREDENTIAL_KEYS, CREDENTIALS_ENV, ensureBatchEnvReady(), ENV_KEY_ORDER, envHeader(), extractSetNameFromBatch(), LEGACY_UPLOAD_ENV (+7 more)

### Community 36 - "Sheet Slice Diagnostics"
Cohesion: 0.15
Nodes (13): decodeImage(), isJpeg(), isPng(), bleedForBounds(), bleedRatio(), cols, detected, equalX (+5 more)

### Community 37 - "Upload Execution Pipeline"
Cohesion: 0.13
Nodes (12): args, batchEnv, envSrc, PROJECT_ROOT, SKILL_ROOT, step, STEP_SCRIPTS, steps (+4 more)

### Community 38 - "Batch Submission Scripts"
Cohesion: 0.32
Nodes (13): discover_sets(), find_zip(), main(), merge_credentials(), prepare_set_env(), process_one_set(), Path, rel_posix() (+5 more)

### Community 39 - "Sticker Result ViewModels"
Cohesion: 0.23
Nodes (11): LineStickerResultPanelSheetViewModel, LineStickerResultSidePhraseEdit, LineStickerSetOverviewItem, LineStickerGenerationSetters, LineStickerGenerationTexts, LineStickerSheetStage, LineStickerSheetStatus, UseLineStickerPromptPreviewParams (+3 more)

### Community 40 - "Render Profiler Debugger"
Cohesion: 0.22
Nodes (13): RenderProfilerDebugPanel(), RenderProfilerDebugPanelProps, clearRenderProfilerEntries(), emit(), getRenderProfilerSnapshot(), Listener, listeners, profilerMap (+5 more)

### Community 41 - "Sprite Editing UI"
Cohesion: 0.22
Nodes (12): eraseCircle(), eraseLine(), getCanvasPoint(), SpriteSheetEraserModal(), SpriteSheetEraserModalProps, SliceCellInfo, SpriteSheetSliceControls(), SpriteSheetSliceControlsProps (+4 more)

### Community 42 - "Action Description Logic"
Cohesion: 0.30
Nodes (13): ACTION_DEDUPE_THRESHOLD_BY_STRENGTH, ActionDescriptionContext, buildActionTokenSet(), buildDeterministicActionFallback(), categorizePhrase(), computeJaccardSimilarity(), extractJsonArrayText(), generateActionDescriptions() (+5 more)

### Community 43 - "Grid Template Drawing"
Cohesion: 0.26
Nodes (13): buildEqualGridBounds(), buildGridSheetTemplate(), BuildGridSheetTemplateOptions, drawCellCornerTicks(), drawGuidedGridOverlay(), drawHorizontalGroove(), drawVerticalGroove(), EqualGridBounds (+5 more)

### Community 44 - "Node Image Processing"
Cohesion: 0.19
Nodes (13): detectBestGridLayout(), extractCellFrame(), normalizeChromaBackground(), processSheetChromaKey(), removeChromaKey(), scoreGridLayout(), SheetChromaKeyOptions, SliceMode (+5 more)

### Community 45 - "Batch Job Runner"
Cohesion: 0.14
Nodes (9): args, BatchJob, BatchManifest, manifest, manifestAbs, manifestDir, onlyOut, ROOT (+1 more)

### Community 46 - "Project History Management"
Cohesion: 0.23
Nodes (12): ProjectHistory, ProjectHistoryItem, ProjectHistoryItemProps, ProjectHistoryProps, deleteProjectItem(), loadList(), loadProject(), saveList() (+4 more)

### Community 47 - "Sheet Boundary Detection"
Cohesion: 0.26
Nodes (11): buildMedianRowBounds(), buildRowDensityProfile(), detectColumnRowBounds(), DetectedSheetGrid, detectSheetGridBoundaries(), DetectSheetGridOptions, enforceMonotonic(), findBestBoundary() (+3 more)

### Community 48 - "Grid Score Gating"
Cohesion: 0.31
Nodes (9): assertManifestGridGate(), assertOutDirGridGate(), ManifestGridGateInput, resolveMinGridScore(), assertGridScoresPass(), findGridScoreFailures(), formatGridGateMessage(), GridScoreFailure (+1 more)

### Community 49 - "Slice Optimization"
Cohesion: 0.27
Nodes (9): optimizeSliceForImage(), isSliceBackgroundPixel(), columnHasContent(), computeOptimizedSliceFromMargins(), ContentMargins, measureContentMargins(), OptimizeSliceOptions, optimizeSliceSettings() (+1 more)

### Community 50 - "Generate & Upload CLI"
Cohesion: 0.15
Nodes (10): args, batchPath, configPath, envBase, final, job, outDir, ROOT (+2 more)

### Community 51 - "LINE Review Submission"
Cohesion: 0.36
Nodes (12): dismiss_overlays(), Page, accept_terms_and_confirm(), click_submit_button(), collect_visible_status_labels(), detect_review_status(), ensure_logged_in(), Page (+4 more)

### Community 52 - "Sheet Reslicing Utility"
Cohesion: 0.17
Nodes (10): chromaKeyColor, cols, detected, expected, frames, image, rawBytes, rows (+2 more)

### Community 53 - "Input-to-Upload Pipeline"
Cohesion: 0.27
Nodes (11): main(), parseArgs(), ROOT, run(), SCRIPT_DIR, slugSetName(), resolveUploadConfig(), DEFAULT_SKILL_STICKER_MODEL (+3 more)

### Community 54 - "Sheet Re-overlay Utility"
Cohesion: 0.18
Nodes (10): argv, cols, frames, image, phrases, processedPath, rows, sheetDir (+2 more)

### Community 55 - "Cell Crop Logic"
Cohesion: 0.24
Nodes (7): CellCropRect, Component, ComputeCellCropOptions, computeCellCropRect(), fallbackCellRect(), findComponents(), PixelPoint

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
Cohesion: 0.60
Nodes (4): parseBoolFlag(), resolvePipelineSteps(), resolveSubmitEnabled(), UploadStepName

### Community 60 - "API Key Management"
Cohesion: 0.53
Nodes (4): loadGeminiApiKey(), readKeyFromFile(), REPO_ROOT, SHARED_DIR

### Community 61 - "Black Cat Assets"
Cohesion: 0.33
Nodes (6): Cozy Black Cat: Banter Chat, Cozy Black Cat: Daily Chat, Black Cat Banter Sprite Sheet 1, Black Cat Banter Sprite Sheet 2, Black Cat Daily Sprite Sheet 1, Black Cat Daily Sprite Sheet 2

### Community 62 - "Cream Cat Assets"
Cohesion: 0.33
Nodes (6): Cozy Cream Cat: Banter Chat, Cozy Cream Cat: Daily Chat, Cream Cat Banter Sprite Sheet 1, Cream Cat Banter Sprite Sheet 2, Cream Cat Daily Sprite Sheet 1, Cream Cat Daily Sprite Sheet 2

### Community 63 - "Giraffe Assets"
Cohesion: 0.33
Nodes (6): Cozy Giraffe: Banter Chat, Cozy Giraffe: Daily Chat, Giraffe Banter Sprite Sheet 1, Giraffe Banter Sprite Sheet 2, Giraffe Daily Sprite Sheet 1, Giraffe Daily Sprite Sheet 2

### Community 64 - "Project Design Docs"
Cohesion: 0.50
Nodes (4): Otter Model Sheet Layout, LINE Sticker Character Reference Skill, One-Page Comic Implementation Plan, One-Page Comic Module Design

### Community 65 - "Sticker Skill Modules"
Cohesion: 0.67
Nodes (4): LINE Sticker Maker Skill, LINE Sticker Phrase Design Skill, LINE Sticker Pipeline Skill, LINE Sticker Upload Skill

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
Cohesion: 0.50
Nodes (4): Cozy Meerkat: Banter Chat, Cozy Meerkat: Daily Chat, Meerkat Banter Sprite Sheet 1, Meerkat Banter Sprite Sheet 2

### Community 70 - "Workflow Documentation"
Cohesion: 0.83
Nodes (4): Background Color Normalization, Chroma Key Improvement Record, Quick Start Guide - Background Color Normalization, Slice and Align Flow

### Community 71 - "Project Readme Files"
Cohesion: 0.67
Nodes (3): Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International, Sprite Animator README, Sprite Animator README (English)

### Community 72 - "Bunny Assets"
Cohesion: 0.67
Nodes (3): Cozy Bunny: Banter Chat, Bunny Banter Sprite Sheet 1, Bunny Banter Sprite Sheet 2

### Community 73 - "Capybara Assets"
Cohesion: 0.67
Nodes (3): Cozy Capybara: Banter Chat, Capybara Banter Sprite Sheet 1, Capybara Banter Sprite Sheet 2

### Community 74 - "Prompt Engineering Guides"
Cohesion: 0.67
Nodes (3): Character Animation Prompt Options, LINE Sticker Prompt Examples, LINE Sticker Prompt Structure

## Knowledge Gaps
- **408 isolated node(s):** `SCRIPT_DIR`, `SKILL_DIR`, `ROOT_DIR`, `DEFAULT_LAYOUT_REF`, `apiKey` (+403 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `jszip` connect `Project Dependencies` to `Sprite Sheet Processing`, `Image Upload & Download`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `ChromaKeyColorType` connect `Sticker Generation Types` to `Gemini Prompt Builders`, `Sheet Slicing Logic`, `Sprite Sheet Processing`, `Chroma Key Detection`, `Sticker Section UI`, `Sticker Result ViewModels`, `Sticker Page ViewModels`, `Grid Template Drawing`, `Node Image Processing`, `Animation Settings UI`, `Sticker Generation CLI`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `SCRIPT_DIR`, `SKILL_DIR`, `ROOT_DIR` to the rest of the system?**
  _422 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gemini Prompt Builders` be split into smaller, more focused modules?**
  _Cohesion score 0.05512820512820513 - nodes in this community are weakly interconnected._
- **Should `Comic Creation UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06317954745812518 - nodes in this community are weakly interconnected._
- **Should `Sprite Sheet Processing` be split into smaller, more focused modules?**
  _Cohesion score 0.06312098188194039 - nodes in this community are weakly interconnected._
- **Should `Text Overlay Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08458646616541353 - nodes in this community are weakly interconnected._