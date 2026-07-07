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

console.log('uploadConfig self-check ok');
