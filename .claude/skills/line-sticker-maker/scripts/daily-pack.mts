/**
 * Daily sticker factory — plan and execute 30 LINE sticker sets per day.
 *
 *   npx tsx daily-pack.mts --backfill --plan-only
 *   npx tsx daily-pack.mts --execute --resume
 *   npx tsx daily-pack.mts --execute --count 1
 */

import { existsSync } from 'node:fs';
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { generateCharacterConcept } from '../../../../services/gemini/characterConcept.ts';
import { resolveDailyPackStyleKey } from '../../../../utils/dailyPackPresets.ts';
import { planDailyPack, type DailyPackPlan, type DailyPackSlot } from '../../../../utils/dailyPackPlanner.ts';
import {
  DEFAULT_REGISTRY_REL_PATH,
  appendEntry,
  findEntryById,
  loadRegistry,
  saveRegistry,
  updateEntryStatus,
  upsertEntry,
  type StickerRegistryEntry,
} from '../../../../utils/stickerRegistry.ts';
import {
  mergeRegistriesForPlanning,
  resolveRegistryAssetPath,
  resolveVaultRoot,
  vaultRegistryPath,
} from '../../../../utils/stickerVault.ts';
import { loadGeminiApiKey } from '../../shared/loadGeminiApiKey.mts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../..');

const CHAR_REF_SCRIPT = resolve(
  ROOT,
  '.claude/skills/line-sticker-character-ref/scripts/generate-character-ref.mts'
);
const PHRASE_SCRIPT = resolve(
  ROOT,
  '.claude/skills/line-sticker-phrase-design/scripts/design-phrase-set.mts'
);
const PIPELINE_SCRIPT = resolve(ROOT, '.claude/skills/line-sticker-maker/scripts/run-from-inputs.mts');
const BACKFILL_SCRIPT = resolve(ROOT, '.claude/skills/line-sticker-maker/scripts/backfill-sticker-registry.mts');

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function runTsx(scriptPath: string, scriptArgs: string[]): void {
  const result = spawnSync('npx', ['tsx', scriptPath, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`tsx ${relative(ROOT, scriptPath)} ${scriptArgs.join(' ')} exited ${result.status ?? 'unknown'}`);
  }
}

async function appendBatchLog(logPath: string, line: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(line)}\n`, 'utf8');
}

async function loadOrCreatePlan(
  dayDir: string,
  planPath: string,
  params: {
    date: string;
    count: number;
    ratio: string;
    registryPath: string;
    vaultRoot?: string;
  }
): Promise<DailyPackPlan> {
  if (existsSync(planPath)) {
    const raw = await readFile(planPath, 'utf8');
    return JSON.parse(raw) as DailyPackPlan;
  }

  const localRegistry = await loadRegistry(params.registryPath);
  const vaultRegistry = params.vaultRoot
    ? await loadRegistry(vaultRegistryPath(params.vaultRoot))
    : undefined;
  const registry = mergeRegistriesForPlanning(localRegistry, vaultRegistry);

  const plan = planDailyPack({
    date: params.date,
    count: params.count,
    ratio: params.ratio,
    registry,
    repoRoot: ROOT,
    vaultRoot: params.vaultRoot,
    outputBaseRel: relative(ROOT, dayDir).replace(/\\/g, '/'),
  });

  await mkdir(dayDir, { recursive: true });
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${relative(ROOT, planPath)} (${plan.slots.length} slots)`);
  for (const warning of plan.warnings) {
    console.warn(`  ⚠ ${warning}`);
  }
  return plan;
}

function slotIsCompleted(slot: DailyPackSlot, registryPath: string, registry: { entries: StickerRegistryEntry[] }): boolean {
  const entry = findEntryById(registry, slot.id);
  if (entry?.status === 'completed') return true;
  const manifest = resolve(ROOT, slot.outputDir, 'manifest.json');
  const sticker = resolve(ROOT, slot.outputDir, 'stickers', 'sticker-01.png');
  return existsSync(manifest) && existsSync(sticker);
}

async function executeSlot(
  slot: DailyPackSlot,
  registryPath: string,
  logPath: string,
  vaultRoot?: string
): Promise<void> {
  const outDir = resolve(ROOT, slot.outputDir);
  await mkdir(outDir, { recursive: true });

  let registry = await loadRegistry(registryPath);
  const plannedEntry: StickerRegistryEntry = {
    id: slot.id,
    date: slot.date,
    batchType: slot.batchType,
    characterName: slot.characterName ?? '',
    characterConcept: slot.characterConcept ?? '',
    style: slot.style,
    theme: slot.theme,
    voice: slot.voice,
    refImagePath: slot.refImagePath ?? `${slot.outputDir}/character-ref.png`,
    outputDir: slot.outputDir,
    status: 'planned',
  };

  if (!findEntryById(registry, slot.id)) {
    registry = appendEntry(registry, plannedEntry);
    await saveRegistry(registryPath, registry);
  }

  const startedAt = new Date().toISOString();
  await appendBatchLog(logPath, { event: 'start', slot: slot.id, batchType: slot.batchType, startedAt });

  try {
    let characterName = slot.characterName ?? '';
    let characterConcept = slot.characterConcept ?? '';
    let refImagePath = slot.refImagePath ?? `${slot.outputDir}/character-ref.png`;
    const refOut = resolve(ROOT, refImagePath);

    if (slot.batchType === 'B') {
      const apiKey = loadGeminiApiKey();
      const concept = await generateCharacterConcept(apiKey, {
        theme: slot.theme,
        voice: slot.voice,
        style: slot.style,
        excludeConcepts: registry.entries
          .map((e) => e.characterConcept)
          .filter(Boolean),
      });
      characterName = concept.characterName;
      characterConcept = concept.characterConcept;
      refImagePath = `${slot.outputDir}/character-ref.png`;

      const stylePreset = resolveDailyPackStyleKey(slot.style);
      runTsx(CHAR_REF_SCRIPT, [
        '--concept',
        characterConcept,
        '--style',
        stylePreset,
        '--name',
        characterName,
        '--out',
        refImagePath,
      ]);
    } else {
      const srcRef = resolveRegistryAssetPath(slot.refImagePath!, ROOT, vaultRoot);
      if (!existsSync(srcRef)) {
        throw new Error(`A-plan ref image missing: ${slot.refImagePath} (resolved ${srcRef})`);
      }
      await copyFile(srcRef, refOut);
    }

    const phraseOut = `${slot.outputDir}/phrase-set.json`;
    runTsx(PHRASE_SCRIPT, [
      '--theme',
      slot.theme,
      '--voice',
      slot.voice,
      '--character',
      characterName,
      '--mode',
      'set',
      '--count',
      '40',
      '--language',
      'zh-TW',
      '--out',
      phraseOut,
    ]);

    runTsx(PIPELINE_SCRIPT, [
      '--image',
      refImagePath,
      '--phrase-set',
      phraseOut,
      '--out',
      slot.outputDir,
    ]);

    registry = await loadRegistry(registryPath);
    registry = upsertEntry(registry, {
      id: slot.id,
      date: slot.date,
      batchType: slot.batchType,
      characterName,
      characterConcept,
      style: slot.style,
      theme: slot.theme,
      voice: slot.voice,
      refImagePath,
      outputDir: slot.outputDir,
      status: 'completed',
    });
    await saveRegistry(registryPath, registry);

    await appendBatchLog(logPath, {
      event: 'completed',
      slot: slot.id,
      characterName,
      finishedAt: new Date().toISOString(),
    });
    console.log(`✓ ${slot.id} ${slot.batchType} ${characterName}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    registry = await loadRegistry(registryPath);
    registry = updateEntryStatus(registry, slot.id, 'failed');
    await saveRegistry(registryPath, registry);
    await appendBatchLog(logPath, {
      event: 'failed',
      slot: slot.id,
      error: message,
      finishedAt: new Date().toISOString(),
    });
    console.error(`✗ ${slot.id}: ${message}`);
    throw err;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const planOnly = Boolean(args['plan-only']);
  const execute = Boolean(args.execute);
  const resume = Boolean(args.resume);
  const backfill = !args['no-backfill'];
  const date = typeof args.date === 'string' ? args.date : todayIso();
  const count = typeof args.count === 'string' ? Number.parseInt(args.count, 10) : 30;
  const ratio = typeof args.ratio === 'string' ? args.ratio : '2:1';
  const fromSet = typeof args['from-set'] === 'string' ? Number.parseInt(args['from-set'], 10) : 1;

  if (!planOnly && !execute) {
    throw new Error('Specify --plan-only to preview or --execute to run generation');
  }
  if (!Number.isFinite(count) || count < 1) {
    throw new Error('Invalid --count');
  }
  if (!Number.isFinite(fromSet) || fromSet < 1) {
    throw new Error('Invalid --from-set');
  }

  const registryPath = resolve(
    ROOT,
    typeof args.registry === 'string' ? args.registry : DEFAULT_REGISTRY_REL_PATH
  );
  const useVault = !args['no-vault'];
  const vaultRoot = useVault
    ? resolveVaultRoot(ROOT, typeof args.vault === 'string' ? args.vault : undefined)
    : undefined;
  if (useVault && vaultRoot) {
    console.log(`▶ Vault registry: ${relative(ROOT, vaultRegistryPath(vaultRoot))}`);
  } else if (useVault) {
    console.warn('⚠ Vault not found — A slots use local registry only (pass --vault or clone line-sticker-vault)');
  }

  const dayDir = resolve(ROOT, 'output', date);
  const planPath = resolve(dayDir, 'batch-plan.json');
  const logPath = resolve(dayDir, 'batch-log.jsonl');

  if (backfill) {
    console.log('▶ Backfill registry…');
    runTsx(BACKFILL_SCRIPT, ['--merge']);
  }

  const plan = await loadOrCreatePlan(dayDir, planPath, {
    date,
    count,
    ratio,
    registryPath,
    vaultRoot,
  });

  if (planOnly) {
    console.log('\nPlan summary:');
    console.log(`  B slots target: ${plan.bSlots}, A slots target: ${plan.aSlots}`);
    console.log(`  Planned: ${plan.slots.length} slots`);
    const b = plan.slots.filter((s) => s.batchType === 'B').length;
    const a = plan.slots.filter((s) => s.batchType === 'A').length;
    console.log(`  Actual: ${b} B + ${a} A`);
    for (const slot of plan.slots.slice(0, 5)) {
      console.log(
        `  ${slot.id} ${slot.batchType} theme=${slot.theme} voice=${slot.voice} style=${slot.style}`
      );
    }
    if (plan.slots.length > 5) {
      console.log(`  … and ${plan.slots.length - 5} more`);
    }
    return;
  }

  let registry = await loadRegistry(registryPath);
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const slot of plan.slots) {
    if (slot.slotIndex < fromSet) {
      skipped++;
      continue;
    }
    if (resume && slotIsCompleted(slot, registryPath, registry)) {
      console.log(`↷ skip ${slot.id} (already completed)`);
      skipped++;
      continue;
    }

    try {
      await executeSlot(slot, registryPath, logPath, vaultRoot);
      completed++;
    } catch {
      failed++;
    }
    registry = await loadRegistry(registryPath);
  }

  console.log(`\nDaily batch done: completed=${completed} failed=${failed} skipped=${skipped}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
