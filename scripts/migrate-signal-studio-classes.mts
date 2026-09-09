/**
 * One-shot class migration toward Signal Studio accents.
 * Idempotent-ish: re-running may no-op once accents are gone.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['pages', 'components', 'App.tsx'];

const REPLACEMENTS: Array<[RegExp, string]> = [
  // Gradient CTAs → flat signal
  [/bg-gradient-to-r from-green-500 to-emerald-600/g, 'bg-signal'],
  [/bg-gradient-to-r from-green-600 to-emerald-600/g, 'bg-signal'],
  [/hover:from-green-600 hover:to-emerald-700/g, 'hover:bg-signal-hover'],
  [/hover:from-green-700 hover:to-emerald-700/g, 'hover:bg-signal-hover'],
  [/disabled:hover:from-green-500 disabled:hover:to-emerald-600/g, 'disabled:hover:bg-signal'],
  [/bg-gradient-to-r from-orange-500 to-orange-600/g, 'bg-signal'],
  [/bg-gradient-to-br from-orange-500 to-orange-600/g, 'bg-signal'],
  [/bg-gradient-to-br from-green-500 to-emerald-600/g, 'bg-signal'],
  [/bg-gradient-to-br from-orange-400 to-orange-600/g, 'bg-signal'],
  [/bg-gradient-to-br from-orange-50 to-orange-100/g, 'bg-signal-soft'],
  [/bg-gradient-to-br from-orange-50 to-amber-50/g, 'bg-signal-soft'],
  [/from-orange-500 to-amber-500/g, 'from-signal to-signal-hover'],
  [/from-green-500 to-emerald-500/g, 'from-signal to-signal-hover'],
  [/from-rose-500 to-pink-600/g, 'from-ink to-ink-soft'],
  [/from-indigo-500 to-violet-600/g, 'from-ink to-ink-soft'],
  [/from-purple-500 to-indigo-600/g, 'from-ink to-ink-soft'],
  [/from-teal-500 to-cyan-500/g, 'from-ink to-ink-soft'],
  [/from-orange-600 to-red-600/g, 'from-signal to-signal-hover'],
  [/from-indigo-500\/600 to-violet-600/g, 'from-ink to-ink-soft'],

  // Focus rings / borders
  [/focus(?:-visible)?:ring-green-500/g, 'focus-visible:ring-signal'],
  [/focus:ring-green-500/g, 'focus:ring-signal'],
  [/focus(?:-visible)?:ring-orange-500(?:\/\d+)?/g, 'focus-visible:ring-signal'],
  [/focus:ring-orange-500(?:\/\d+)?/g, 'focus:ring-signal'],
  [/focus:ring-indigo-500/g, 'focus:ring-signal'],
  [/focus:border-green-400/g, 'focus:border-signal'],
  [/focus:border-green-500/g, 'focus:border-signal'],
  [/focus:border-orange-500/g, 'focus:border-signal'],
  [/focus-visible:ring-slate-400/g, 'focus-visible:ring-signal'],

  // Text accents
  [/text-green-700/g, 'text-signal'],
  [/text-green-800/g, 'text-signal-hover'],
  [/hover:text-green-800/g, 'hover:text-signal-hover'],
  [/text-orange-500/g, 'text-signal'],
  [/text-orange-600/g, 'text-signal'],
  [/text-emerald-700/g, 'text-ok'],
  [/text-emerald-900/g, 'text-ink'],
  [/text-emerald-800/g, 'text-ok'],
  [/text-sky-950/g, 'text-ink'],
  [/text-sky-800/g, 'text-info'],
  [/text-amber-800/g, 'text-warn'],
  [/text-amber-900/g, 'text-ink'],
  [/text-amber-950/g, 'text-ink'],
  [/text-indigo-600/g, 'text-signal'],
  [/text-rose-500/g, 'text-signal'],
  [/text-violet-\d+/g, 'text-signal'],

  // Background accents
  [/bg-green-50(?:\/\d+)?/g, 'bg-signal-soft'],
  [/bg-green-100/g, 'bg-signal-soft'],
  [/bg-orange-50(?:\/\d+)?/g, 'bg-signal-soft'],
  [/bg-orange-500/g, 'bg-signal'],
  [/bg-orange-600/g, 'bg-signal-hover'],
  [/hover:bg-orange-600/g, 'hover:bg-signal-hover'],
  [/bg-green-600/g, 'bg-signal'],
  [/bg-green-500/g, 'bg-signal'],
  [/bg-emerald-50(?:\/\d+)?/g, 'bg-ok-soft'],
  [/bg-emerald-600/g, 'bg-ok'],
  [/bg-sky-50(?:\/\d+)?/g, 'bg-info-soft'],
  [/bg-amber-50(?:\/\d+)?/g, 'bg-warn-soft'],
  [/hover:bg-green-50/g, 'hover:bg-signal-soft'],
  [/hover:bg-green-100/g, 'hover:bg-signal-soft'],
  [/hover:bg-emerald-50\/30/g, 'hover:bg-signal-soft'],
  [/hover:bg-sky-100/g, 'hover:bg-info-soft'],
  [/hover:bg-amber-100/g, 'hover:bg-warn-soft'],

  // Borders
  [/border-green-200(?:\/\d+)?/g, 'border-signal/25'],
  [/border-green-300/g, 'border-signal/40'],
  [/border-green-500/g, 'border-signal'],
  [/border-orange-200/g, 'border-signal/25'],
  [/border-orange-300/g, 'border-signal/40'],
  [/border-orange-400/g, 'border-signal'],
  [/hover:border-green-400/g, 'hover:border-signal'],
  [/hover:border-orange-400/g, 'hover:border-signal'],
  [/hover:border-orange-300/g, 'hover:border-signal/40'],
  [/hover:border-green-300/g, 'hover:border-signal/40'],
  [/border-emerald-200(?:\/\d+)?/g, 'border-ok/25'],
  [/border-sky-200(?:\/\d+)?/g, 'border-info/25'],
  [/border-sky-300/g, 'border-info/40'],
  [/border-amber-200/g, 'border-warn/30'],
  [/border-amber-300/g, 'border-warn/40'],
  [/border-indigo-200/g, 'border-line'],
  [/border-rose-200/g, 'border-line'],
  [/border-purple-200/g, 'border-line'],
  [/border-teal-200/g, 'border-line'],
  [/hover:border-rose-300/g, 'hover:border-signal/40'],
  [/hover:border-violet-300/g, 'hover:border-signal/40'],

  // Shadows
  [/shadow-green-600\/25/g, 'shadow-signal/25'],
  [/shadow-orange-200\/50/g, 'shadow-signal/20'],
  [/shadow-green-200\/50/g, 'shadow-signal/20'],
  [/shadow-rose-200\/50/g, 'shadow-ink/10'],
  [/shadow-indigo-200\/50/g, 'shadow-ink/10'],
  [/shadow-purple-200\/50/g, 'shadow-ink/10'],
  [/shadow-teal-200\/50/g, 'shadow-ink/10'],

  // Page shell leftovers
  [/bg-gradient-to-br from-slate-50 via-white to-slate-100/g, 'bg-transparent'],
  [/bg-gradient-to-br from-slate-50 via-white to-slate-50/g, 'bg-transparent'],
  [/min-h-screen bg-slate-50/g, 'min-h-[100dvh] bg-transparent'],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(extname(name))) out.push(path);
  }
  return out;
}

const files: string[] = [];
for (const root of ROOTS) {
  const path = join(process.cwd(), root);
  try {
    const st = statSync(path);
    if (st.isDirectory()) walk(path, files);
    else files.push(path);
  } catch {
    // skip missing
  }
}

let changed = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let next = before;
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  if (next !== before) {
    writeFileSync(file, next);
    changed += 1;
    console.log('updated', file.replace(process.cwd() + '/', ''));
  }
}
console.log(`done: ${changed} files`);
