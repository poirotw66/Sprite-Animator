/**
 * ponytail: minimal self-check for upload config normalization.
 */
import { resolveUploadConfig, validateUploadConfig } from './uploadConfig.mts';
import { buildBatchEnvContent } from './uploadCredentials.mts';

const legacy = resolveUploadConfig({
  lineS: {
    syncToLineS: true,
    setName: 'Test Set',
    titleZh: '測試',
    descZh: '描述',
    titleEn: 'Test',
    descEn: 'Desc',
  },
});
if (!legacy?.syncToUploadRoot) throw new Error('legacy syncToLineS should map to syncToUploadRoot');
validateUploadConfig(legacy);

const modern = resolveUploadConfig({
  upload: {
    syncToUploadRoot: false,
    setName: 'Modern',
    titleZh: '新',
    descZh: '新描述',
    titleEn: 'Modern',
    descEn: 'Modern desc',
  },
});
if (modern?.syncToUploadRoot !== false) throw new Error('syncToUploadRoot should be preserved');

const batch = buildBatchEnvContent(
  { setName: 'Test', titleZh: '測', descZh: '述', titleEn: 'T', descEn: 'D' },
  '.line-upload/input/706/Test'
);
if (batch.includes('LINE_EMAIL=')) throw new Error('batch template must not include account secrets');
if (!batch.includes('LINE_UPLOAD_SUBMIT=false')) {
  throw new Error('batch template should default LINE_UPLOAD_SUBMIT=false');
}
const batchSubmit = buildBatchEnvContent(
  {
    setName: 'Test',
    titleZh: '測',
    descZh: '述',
    titleEn: 'T',
    descEn: 'D',
    submitForReview: true,
  },
  '.line-upload/input/706/Test'
);
if (!batchSubmit.includes('LINE_UPLOAD_SUBMIT=true')) {
  throw new Error('batch template should honor submitForReview=true');
}
const batchNoSubmit = buildBatchEnvContent(
  {
    setName: 'Test',
    titleZh: '測',
    descZh: '述',
    titleEn: 'T',
    descEn: 'D',
    submitForReview: false,
  },
  '.line-upload/input/706/Test'
);
if (!batchNoSubmit.includes('LINE_UPLOAD_SUBMIT=false')) {
  throw new Error('batch template should honor submitForReview=false');
}

console.log('uploadConfig self-check ok');
