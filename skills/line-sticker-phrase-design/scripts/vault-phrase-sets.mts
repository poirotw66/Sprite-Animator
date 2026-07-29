/**
 * Batch: generate one persona-tailored phrase-set JSON per vault character.
 * Quality template: inbox/1_na.json (40 slots, ~7 visual-only, detailed
 * Traditional Chinese actionDescs with text color/position notes).
 *
 *   npx tsx vault-phrase-sets.mts            # all registry entries, skip existing
 *   npx tsx vault-phrase-sets.mts --only SET-20260712-005
 *   npx tsx vault-phrase-sets.mts --force    # regenerate even if file exists
 *   npx tsx vault-phrase-sets.mts --dry-run  # print prompt for first pending entry
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { PHRASE_GENERATION_MODEL } from '../../../../utils/constants.ts';
import {
  auditStickerPhrases,
  isHardRejectStickerPhraseIssue,
  isLineSendablePhrase,
  polishStickerPhrases,
} from '../../../../utils/lineStickerPhraseQuality.ts';
import {
  LINE_STICKER_PHRASE_SET_SIZE,
  PHRASE_SET_FORMAT,
  PHRASE_SET_VERSION,
  parsePhraseSetJson,
  type LineStickerPhraseSetJson,
} from '../../../../utils/lineStickerPhraseSetFormat.ts';
import {
  STICKER_VOICE_PRESETS,
  DEFAULT_STICKER_VOICE_KEY,
} from '../../../../utils/lineStickerVoicePresets.ts';
import type { StickerRegistryEntry } from '../../../../utils/stickerRegistryFormat.ts';
import { parseRegistryJson } from '../../../../utils/stickerRegistryFormat.ts';
import {
  resolveVaultRoot,
  vaultRegistryPath,
  VAULT_PHRASE_SET_FILENAME,
} from '../../../../utils/registry/stickerVault.ts';
import { loadApiKey, ROOT_DIR } from './apiKey.mts';

const VISUAL_ONLY_TARGET = 7;
const VISUAL_ONLY_PREFIX = '【無字純動作】';
const MAX_GENERIC_CAPTIONS = 40;
const MAX_ROLE_FLAVORED = 12;
const MIN_SENDABLE_CAPTIONS = 28;

/** High-frequency LINE chat lines — tap-to-send, not work memos. */
const LINE_SENDABLE_SEED_PHRASES = [
  '謝謝你', '了解', '收到', '好喔', '辛苦了', '對不起', '馬上到', '等你喔', '好久不見',
  '加油', '晚安', '早安', '麻煩了', '讚喔', '再聯絡', '別鬧了', '笑死', '才不要', '真的假',
  '我懂了', '抱歉啦', '沒事', '太棒了', '我懂', '再說', '拜啦', '來了', '到了', '馬上',
  '好累', '開心', '委屈', '無語', '震驚', '期待', '害羞', '崩潰', '想你了', '等等啦',
];

const GENERIC_CAPTION_RE = /^(早安|晚安|你好|謝謝你|謝謝|謝啦|了解|了解！|收到|OK|好喔|好|加油|辛苦了|抱歉|對不起|再見|拜拜|等一下|請稍等|太棒了|讚喔|讚啦|我懂|我懂我懂|沒問題|好累|救命|笑死|蛤|哼|再聯絡|等你喔|好久不見|麻煩了|別鬧了|才不要|真的假|我懂了|沒事|再說|拜啦|來了|到了|馬上|想你了|等等啦|開心|委屈|無語|震驚|期待|害羞|崩潰)$/;

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

function voiceRulesFor(voiceKey: string): string {
  const preset =
    STICKER_VOICE_PRESETS[voiceKey] ?? STICKER_VOICE_PRESETS[DEFAULT_STICKER_VOICE_KEY]!;
  return `${preset.intro}\n${preset.rules}\n好例：${preset.goodExamples.join('、')}\n避免：${preset.badExamples.join('、')}`;
}

function characterPhraseDirection(entry: StickerRegistryEntry): string {
  const source = `${entry.characterName} ${entry.characterConcept}`;
  const rules: string[] = [];

  if (/房東|租|查房|水電|合約|鑰匙|巡/.test(source)) {
    rules.push('房東／管理角色：phrase 仍以聊天短句為主；最多幾句可帶輕口吻如「繳租囉」「別亂丢」「在忙喔」——禁止「房租進度」「水電提醒」「巡邏早安」「紀錄了」。');
  }
  if (/牧師|牧羊|聖經|祝福|祈禱|提燈|聖水|教會|平安/.test(source)) {
    rules.push('牧師／守護角色：可用「平安喔」「阿門」「慢慢來」「聽你說」——禁止「紀錄了阿門」「報告完畢」這類備忘語。');
  }
  if (/偵探|辦案|線索|煙斗|證據/.test(source)) {
    rules.push('偵探角色：可用「可疑喔」「真的假」「破案啦」「有蹊蹺」——禁止「案情不單純」「證據確鑿」「沒頭緒」這類敘事句。');
  }
  if (/咖啡|咖啡師|拿鐵|溫泉|水豚/.test(source)) {
    rules.push('咖啡師角色：可用「拿鐵呢」「慢一點」「偷懶喔」「醒醒啊」——禁止「試味中」「紀錄了」狀態回報。');
  }
  if (/甜點|草莓|奶油|麵團|甜點師|浣熊/.test(source)) {
    rules.push('甜點師角色：可用「偷吃喔」「好甜」「烤好了」「麵粉啦」——像跟朋友聊天，不是廚房 SOP。');
  }
  if (/JOJO|將軍|武將|鎧甲|戰略|披風|牧師/.test(source)) {
    rules.push('JOJO／硬派角色：可用「退下」「始動」「計畫通」「歐拉」「覺悟」——禁止「將軍巡邏」「報告進度」公文体。');
  }
  if (/貓|花貓|三花/.test(source)) {
    rules.push('貓系角色：偶爾「早安喵」「撒嬌喔」「傲嬌哼」——不要每句都喵，其餘用通用聊天短句。');
  }
  if (/犬|柴犬|拉布拉多|哈士奇/.test(source)) {
    rules.push('犬系角色：偶爾「汪好」「等我喔」「回家啦」——其餘用通用聊天短句。');
  }

  return rules.length > 0
    ? rules.map((rule) => `- ${rule}`).join('\n')
    : '- 角色個性主要放在 actionDesc；phrase 以通用 LINE 聊天短句為主，頂多 10 句輕微角色口吻。';
}

function roleFlavorTermsFor(entry: StickerRegistryEntry): string[] {
  const source = `${entry.characterName} ${entry.characterConcept}`;
  const terms: string[] = [];
  if (/房東|租|查房|水電|合約|鑰匙|巡/.test(source)) {
    terms.push('房租', '繳租', '查房', '水電', '合約', '鑰匙', '巡');
  }
  if (/牧師|牧羊|聖經|祝福|祈禱|提燈|聖水|教會|平安/.test(source)) {
    terms.push('平安', '祝福', '祈禱', '阿門', '提燈', '聖經');
  }
  if (/偵探|辦案|線索|煙斗|證據/.test(source)) {
    terms.push('線索', '可疑', '破案', '證據', '推理', '真相', '辦案');
  }
  if (/咖啡|咖啡師|拿鐵|溫泉|水豚/.test(source)) {
    terms.push('拿鐵', '咖啡', '手沖', '泡湯', '特調');
  }
  if (/甜點|草莓|奶油|麵團|甜點師|浣熊/.test(source)) {
    terms.push('草莓', '奶油', '麵粉', '甜點', '偷吃');
  }
  if (/JOJO|將軍|武將|鎧甲|戰略|披風/.test(source)) {
    terms.push('歐拉', '始動', '威壓', '將軍', '撤退', '覺悟');
  }
  if (/貓|花貓|三花/.test(source)) {
    terms.push('喵', '肉球', '尾巴', '撒嬌', '傲嬌');
  }
  if (/犬|柴犬|拉布拉多|哈士奇/.test(source)) {
    terms.push('汪', '散步', '守門', '咬你');
  }
  return [...new Set(terms)];
}

function forbiddenRoleTermsFor(entry: StickerRegistryEntry): string[] {
  const source = `${entry.characterName} ${entry.characterConcept}`;
  const terms: string[] = [];

  if (!/偵探|辦案|線索|煙斗|證據/.test(source)) {
    terms.push('偵探', '線索', '破案', '真相', '案件', '案子', '推理');
  }
  if (!/房東|租|查房|水電|合約|鑰匙|巡/.test(source)) {
    terms.push('房東', '房租', '繳租', '查房', '水電', '合約');
  }
  if (!/牧師|牧羊|聖經|祝福|祈禱|提燈|聖水|教會|平安/.test(source)) {
    terms.push('牧師', '阿門', '聖經', '祝福', '祈禱', '平安');
  }
  if (!/咖啡|咖啡師|拿鐵|溫泉|水豚/.test(source)) {
    terms.push('拿鐵', '咖啡', '手沖', '泡湯');
  }
  if (!/甜點|草莓|奶油|麵團|甜點師|浣熊/.test(source)) {
    terms.push('草莓', '奶油', '麵粉', '甜點');
  }
  if (!/JOJO|將軍|武將|鎧甲|戰略|披風/.test(source)) {
    terms.push('歐拉', '始動', '威壓', '將軍', '撤退');
  }

  return [...new Set(terms)];
}

function buildPrompt(entry: StickerRegistryEntry, rejectionHints: string[] = []): string {
  const rejectionBlock =
    rejectionHints.length > 0
      ? `\n## 上一輪被拒（務必修正）\n${rejectionHints.map((hint) => `- ${hint}`).join('\n')}\n`
      : '';

  return `你是 LINE 貼圖文案與分鏡設計師。為以下角色設計一整組 ${LINE_STICKER_PHRASE_SET_SIZE} 格貼圖。

## 角色設定
- 名稱：${entry.characterName}
- 設定：${entry.characterConcept}
- 語氣風格：${voiceRulesFor(entry.voice)}

## 角色化文案方向（僅限輕微口吻，不可變工作備忘）
${characterPhraseDirection(entry)}
${rejectionBlock}
## phrase 最重要：LINE 聊天窗「按一下就發得出去」的短句
- phrase 是朋友聊天會真的打的字，不是工作備忘、不是分鏡描述、不是案情說明。
- 黃金例句（可改寫、勿全抄，全組至少採用 28 句這類高頻聊天短句）：${LINE_SENDABLE_SEED_PHRASES.join('、')}
- 絕對禁止：房租進度、水電提醒、巡邏早安、紀錄了、報告完畢、案情不單純、證據確鑿、請補件、已排程、先備份、表單呢、合約確認中、修繕提醒……任何像公文体或狀態回報的句子。
- 角色個性 80% 放在 actionDesc（道具、姿勢、場景）；phrase 最多 ${MAX_ROLE_FLAVORED} 句可有輕微角色口吻，其餘必須是通用聊天短句，別人看了也會按發送。
- 打招呼用「早安」「晚安」「你好」即可，不要寫「巡邏早安」「早安巡邏」。

## 輸出規則（嚴格遵守）
1. 共 ${LINE_STICKER_PHRASE_SET_SIZE} 格。其中約 ${VISUAL_ONLY_TARGET} 格為「無字純動作」：phrase 填空字串 ""，actionDesc 以「${VISUAL_ONLY_PREFIX}」開頭。
2. phrase（有字格）：
   - 繁體中文聊天用語，2～5 個字，最多 5 個中文字，絕對不可超過。可含「！？…～」，禁止 emoji 與其他標點。
   - 無字格的 phrase 必須是空字串 ""，不可把「【無字純動作】」放進 phrases。
   - 涵蓋日常聊天：打招呼、答應、感謝、道歉、加油、催促、耍廢、開心、難過、撒嬌、吐槽等——像真的在 LINE 傳訊息。
   - 不可混入其他角色職業或世界觀的詞。例如房東不要變偵探，牧師不要講催租，甜點師不要講查房。
   - 全組不得重複。
3. actionDesc（每格一句，繁體中文，25～45 字）：
   - 以角色名稱開頭，具體描述表情、姿勢、手上道具、背景特效——插畫師看了就能畫。
   - 充分運用角色設定中的專屬元素（服裝、道具、口頭禪場景）——角色感主要在這裡。
   - 有字格結尾必須註明文字顏色與位置，例如「上方寫著粉紅色『謝謝你』」；顏色請在粉紅、黃、橘、紫、藍、紅、咖啡色之間輪替，**禁止使用綠色或青色文字**（綠幕去背會吃掉），位置以上方為主、偶爾下方。
   - 無字格以「${VISUAL_ONLY_PREFIX}」開頭，只描述動作表情，不提文字。
   - 每格姿勢與構圖必須明顯不同。

## 品質範例（僅供風格參考，禁止照抄內容）
- "娜璉雙手高舉揮舞，露出燦爛無比的微笑，背景帶有亮晶晶特效，上方寫著粉紅色『謝謝你』"
- "【無字純動作】娜璉雙頰鼓起成包子臉，雙手叉腰轉過頭去，呈現極度口嫌體正直的害羞傲嬌表情"
- "娜璉慌慌張張地小跑步奔跑，長髮隨之飄動，背景帶有動態速度線，上方寫著天藍色『請稍等』"

## 輸出格式（只回傳 JSON，不要 markdown）
{"phrases": ["...", "", ...共${LINE_STICKER_PHRASE_SET_SIZE}項], "actionDescs": ["...", "${VISUAL_ONLY_PREFIX}...", ...共${LINE_STICKER_PHRASE_SET_SIZE}項]}`;
}

function extractJson(text: string): { phrases: string[]; actionDescs: string[] } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      phrases?: unknown;
      actionDescs?: unknown;
    };
    if (!Array.isArray(parsed.phrases) || !Array.isArray(parsed.actionDescs)) return null;
    return {
      phrases: parsed.phrases.map((p) => String(p ?? '').trim()),
      actionDescs: parsed.actionDescs.map((a) => String(a ?? '').trim()),
    };
  } catch {
    return null;
  }
}

function validateSet(
  phrases: string[],
  actionDescs: string[],
  entry: StickerRegistryEntry
): string[] {
  const errors: string[] = [];
  if (phrases.length !== LINE_STICKER_PHRASE_SET_SIZE) errors.push(`phrases length ${phrases.length} != ${LINE_STICKER_PHRASE_SET_SIZE}`);
  if (actionDescs.length !== LINE_STICKER_PHRASE_SET_SIZE) errors.push(`actionDescs length ${actionDescs.length} != ${LINE_STICKER_PHRASE_SET_SIZE}`);

  for (const entry of auditStickerPhrases(phrases, 'Traditional Chinese')) {
    for (const issue of entry.issues) {
      if (isHardRejectStickerPhraseIssue(issue.code)) {
        errors.push(`phrase[${entry.index + 1}] "${entry.phrase}": ${issue.message}`);
      }
    }
  }

  const seen = new Set<string>();
  let genericCount = 0;
  let sendableCount = 0;
  let roleFlavoredCount = 0;
  const forbiddenTerms = forbiddenRoleTermsFor(entry);
  const roleTerms = roleFlavorTermsFor(entry);
  for (const phrase of phrases) {
    const key = phrase.trim();
    if (!key) continue;
    if (seen.has(key)) errors.push(`duplicate phrase "${key}"`);
    if (GENERIC_CAPTION_RE.test(key)) genericCount++;
    if (isLineSendablePhrase(key)) sendableCount++;
    if (roleTerms.some((term) => key.includes(term))) roleFlavoredCount++;
    const forbidden = forbiddenTerms.find((term) => key.includes(term));
    if (forbidden) errors.push(`phrase "${key}" contains off-character term "${forbidden}"`);
    seen.add(key);
  }
  if (genericCount > MAX_GENERIC_CAPTIONS) {
    errors.push(`too many generic captions: ${genericCount} > ${MAX_GENERIC_CAPTIONS}`);
  }
  if (sendableCount < MIN_SENDABLE_CAPTIONS) {
    errors.push(`too few sendable chat phrases: ${sendableCount} < ${MIN_SENDABLE_CAPTIONS}`);
  }
  if (roleFlavoredCount > MAX_ROLE_FLAVORED) {
    errors.push(`too many role-flavored phrases: ${roleFlavoredCount} > ${MAX_ROLE_FLAVORED}`);
  }

  for (let i = 0; i < Math.min(phrases.length, actionDescs.length); i++) {
    const isBlank = !phrases[i]!.trim();
    const hasPrefix = actionDescs[i]!.startsWith(VISUAL_ONLY_PREFIX);
    if (isBlank && !hasPrefix) errors.push(`slot ${i + 1}: blank phrase without ${VISUAL_ONLY_PREFIX} action`);
    if (!isBlank && hasPrefix) errors.push(`slot ${i + 1}: captioned phrase with visual-only action`);
    if (!actionDescs[i]!.trim()) errors.push(`slot ${i + 1}: empty actionDesc`);
  }

  const visualOnly = phrases.filter((p) => !p.trim()).length;
  if (visualOnly < 4 || visualOnly > 12) {
    errors.push(`visual-only count ${visualOnly} outside 4-12`);
  }
  return errors;
}

async function generateForEntry(
  ai: GoogleGenAI,
  entry: StickerRegistryEntry
): Promise<LineStickerPhraseSetJson> {
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 6; attempt++) {
    const prompt = buildPrompt(entry, lastErrors);
    const response = await ai.models.generateContent({
      model: PHRASE_GENERATION_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: { temperature: 0.8, maxOutputTokens: 16384 },
    });
    const parsed = extractJson(response.text ?? '');
    if (!parsed) {
      lastErrors = ['response was not valid JSON'];
      continue;
    }
    const phrases = polishStickerPhrases(parsed.phrases, 'Traditional Chinese');
    const errors = validateSet(phrases, parsed.actionDescs, entry);
    if (errors.length === 0) {
      return {
        format: PHRASE_SET_FORMAT,
        version: PHRASE_SET_VERSION,
        mode: 'set',
        name: `${entry.characterName}·日常聊天`,
        phrases,
        actionDescs: parsed.actionDescs,
      };
    }
    lastErrors = errors;
    console.warn(`  attempt ${attempt} rejected: ${errors.slice(0, 3).join(' | ')}`);
  }
  throw new Error(`Failed after 6 attempts: ${lastErrors.slice(0, 5).join(' | ')}`);
}

async function writePhraseSet(outPath: string, data: LineStickerPhraseSetJson): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (!parsePhraseSetJson(json)) {
    throw new Error('generated JSON failed parsePhraseSetJson schema check');
  }
  await writeFile(outPath, json, 'utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const force = Boolean(args.force);
  const dryRun = Boolean(args['dry-run']);
  const only = typeof args.only === 'string' ? args.only : undefined;

  const vaultRoot = resolveVaultRoot(
    ROOT_DIR,
    typeof args.vault === 'string' ? args.vault : undefined
  );
  if (!vaultRoot) {
    throw new Error('Vault not found. Clone line-sticker-vault as sibling or pass --vault.');
  }

  const raw = await readFile(vaultRegistryPath(vaultRoot), 'utf8');
  const registry = parseRegistryJson(raw);
  if (!registry) throw new Error('Invalid vault sticker-registry.json');

  const targets = registry.entries.filter(
    (entry) => !only || entry.id === only || entry.refImagePath.includes(`/${only}/`)
  );
  console.log(`Vault: ${vaultRoot}`);
  console.log(`Targets: ${targets.length} entries\n`);

  const apiKey = loadApiKey();
  if (!dryRun && !apiKey) throw new Error('GEMINI_API_KEY not found (env or .env.local).');
  const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });

  let done = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const entry of targets) {
    const outPath = resolve(vaultRoot, entry.outputDir, VAULT_PHRASE_SET_FILENAME);
    if (!force && existsSync(outPath)) {
      console.log(`skip ${entry.id} ${entry.characterName} (phrase-set.json exists)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`=== Prompt for ${entry.id} ${entry.characterName} ===\n`);
      console.log(buildPrompt(entry));
      return;
    }

    console.log(`▶ ${entry.id} ${entry.characterName} (${entry.voice})`);
    try {
      const data = await generateForEntry(ai, entry);
      await writePhraseSet(outPath, data);
      const visualOnly = data.phrases.filter((p) => !p.trim()).length;
      console.log(`  ✓ ${entry.outputDir}/${VAULT_PHRASE_SET_FILENAME} (${LINE_STICKER_PHRASE_SET_SIZE - visualOnly} captioned, ${visualOnly} visual-only)`);
      done++;
    } catch (err) {
      console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
      failed.push(`${entry.id} ${entry.characterName}`);
    }
  }

  console.log(`\nDone: ${done}, skipped: ${skipped}, failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`Failed entries (re-run to retry):\n  ${failed.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
