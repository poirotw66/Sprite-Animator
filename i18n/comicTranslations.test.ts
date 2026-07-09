import { describe, expect, it } from 'vitest';
import { en } from './en';
import { zhTW } from './zh-TW';

const REQUIRED_COMIC_KEYS = [
  'comicTool',
  'comicDesc',
  'comicTitle',
  'comicStepSource',
  'comicStepSheet',
  'comicStepStoryboard',
  'comicStepGenerate',
  'comicSourceUpload',
  'comicSourceConcept',
  'comicConceptLabel',
  'comicConceptPlaceholder',
  'comicStyleLabel',
  'comicGenerateSheet',
  'comicRegenerateSheet',
  'comicSynopsisLabel',
  'comicSynopsisPlaceholder',
  'comicFillStoryboard',
  'comicPanelSceneLabel',
  'comicPanelDialogueLabel',
  'comicGeneratePage',
  'comicDownloadPng',
  'comicErrorNeedConcept',
  'comicErrorNeedUpload',
  'comicErrorNeedSheet',
  'comicErrorNeedPanels',
  'comicNext',
  'comicBack',
] as const;

describe('comic translations', () => {
  it.each(REQUIRED_COMIC_KEYS)('includes %s in English', (key) => {
    expect(en[key]).toBeTruthy();
  });

  it.each(REQUIRED_COMIC_KEYS)('includes %s in Traditional Chinese', (key) => {
    expect(zhTW[key]).toBeTruthy();
  });
});
