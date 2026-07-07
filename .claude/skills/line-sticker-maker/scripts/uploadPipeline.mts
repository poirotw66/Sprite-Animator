/**
 * Upload pipeline step resolution (Drive → provision → zip → optional submit).
 */

export type UploadStepName = 'gdrive' | 'provision' | 'zip' | 'submit';

export function parseBoolFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return defaultValue;
}

export function resolveSubmitEnabled(options: {
  step: 'all' | UploadStepName;
  cliSubmit?: string;
  envSubmit?: string;
  defaultValue?: boolean;
}): boolean {
  const { step, cliSubmit, envSubmit, defaultValue = true } = options;
  if (step === 'submit') return true;
  if (cliSubmit !== undefined) return parseBoolFlag(cliSubmit, defaultValue);
  if (envSubmit !== undefined && envSubmit !== '') {
    return parseBoolFlag(envSubmit, defaultValue);
  }
  return defaultValue;
}

export function resolvePipelineSteps(
  step: 'all' | UploadStepName,
  submitEnabled: boolean
): UploadStepName[] {
  if (step !== 'all') return [step];
  const pipeline: UploadStepName[] = ['gdrive', 'provision', 'zip'];
  if (submitEnabled) pipeline.push('submit');
  return pipeline;
}
