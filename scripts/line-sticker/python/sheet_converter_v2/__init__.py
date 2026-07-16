"""
ChatGPT Sticker Sheet Converter V2 — additive pipeline.

Does NOT replace TypeScript chroma (legacy/core/forge) or ownership/detect/divider slicing.
Use for light-background 4×5 sheets from ChatGPT / similar generators.

Typical flow:
  input/*.png  →  python -m sheet_converter_v2  →  output/setN/*.png (+ zip)
"""

__version__ = "2.0.0"

# LINE Creators Market sticker max box (mirrors utils/lineStickerUploadSpec.ts)
LINE_STICKER_MAX_WIDTH = 370
LINE_STICKER_MAX_HEIGHT = 320
