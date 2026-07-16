import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Factory, RefreshCw, Upload, User, FileJson } from 'lucide-react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../hooks/useLanguage';
import { parseBatchPlanJson, type DailyPackPlanFile } from '../utils/dailyPackPlanFormat';
import {
  parsePhraseSetJson,
  type LineStickerPhraseSetJson,
} from '../utils/lineStickerPhraseSetFormat';
import {
  parseRegistryJson,
  type StickerRegistryEntry,
  type StickerRegistryFile,
} from '../utils/registry/stickerRegistryFormat';
import {
  filterCharacterProfiles,
  filterRegistryEntries,
  listCharacterProfiles,
  phraseSetPath,
  summarizeRegistry,
  toVaultAssetUrl,
  vaultRegistryFetchUrl,
  type CharacterProfile,
  type RegistryFilter,
} from '../utils/registry/stickerRegistryView';

const DEFAULT_REGISTRY_URL = vaultRegistryFetchUrl();

type RegistryTab = 'characters' | 'themes';

interface UploadedPhraseSet {
  id: string;
  fileName: string;
  data: LineStickerPhraseSetJson;
}

function statusBadgeClass(status: StickerRegistryEntry['status']): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function batchBadgeClass(batchType: StickerRegistryEntry['batchType']): string {
  return batchType === 'B' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800';
}

function tabButtonClass(active: boolean): string {
  return active
    ? 'bg-rose-500 text-white shadow-sm'
    : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-300';
}

function countNonEmptyPhrases(phrases: string[]): number {
  return phrases.filter((p) => p.trim().length > 0).length;
}

const DailyStickerRegistryPage: React.FC = () => {
  const { t } = useLanguage();
  const [registry, setRegistry] = useState<StickerRegistryFile | null>(null);
  const [batchPlan, setBatchPlan] = useState<DailyPackPlanFile | null>(null);
  const [activeTab, setActiveTab] = useState<RegistryTab>('characters');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [uploadedPhraseSets, setUploadedPhraseSets] = useState<UploadedPhraseSet[]>([]);
  const [phraseSetData, setPhraseSetData] = useState<LineStickerPhraseSetJson | null>(null);
  const [phraseSetError, setPhraseSetError] = useState<string | null>(null);
  const [phraseSetLoading, setPhraseSetLoading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [loadHint, setLoadHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RegistryFilter>({
    batchType: 'all',
    status: 'all',
    date: 'all',
    query: '',
  });

  const loadRegistryFromUrl = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(DEFAULT_REGISTRY_URL);
      if (!res.ok) throw new Error('not found');
      const raw = await res.text();
      setRegistry(parseRegistryJson(raw));
      setLoadHint(t.registryLoadedFromVault);
    } catch {
      setLoadHint(t.registryLoadVaultHint);
    }
  }, [t.registryLoadedFromVault, t.registryLoadVaultHint]);

  useEffect(() => {
    void loadRegistryFromUrl();
  }, [loadRegistryFromUrl]);

  const summary = useMemo(
    () => (registry ? summarizeRegistry(registry) : null),
    [registry]
  );

  const filteredEntries = useMemo(() => {
    if (!registry) return [];
    return filterRegistryEntries(registry.entries, filter);
  }, [registry, filter]);

  const characterProfiles = useMemo(() => {
    if (!registry) return [];
    return filterCharacterProfiles(listCharacterProfiles(registry.entries), filter.query);
  }, [registry, filter.query]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((e) => e.id === selectedId) ?? null,
    [filteredEntries, selectedId]
  );

  const selectedCharacter = useMemo(
    () => characterProfiles.find((p) => p.characterName === selectedCharacterName) ?? null,
    [characterProfiles, selectedCharacterName]
  );

  const selectedUpload = useMemo(
    () => uploadedPhraseSets.find((u) => u.id === selectedUploadId) ?? null,
    [uploadedPhraseSets, selectedUploadId]
  );

  useEffect(() => {
    if (activeTab !== 'themes' || !selectedEntry?.outputDir) {
      if (!selectedUpload) {
        setPhraseSetData(null);
        setPhraseSetError(null);
        setPhraseSetLoading(false);
      }
      return;
    }
    if (selectedUploadId) return;

    let cancelled = false;
    setPhraseSetLoading(true);
    setPhraseSetError(null);
    setPhraseSetData(null);

    const url = toVaultAssetUrl(phraseSetPath(selectedEntry.outputDir));
    void fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error('not found');
        const raw = await res.text();
        const parsed = parsePhraseSetJson(raw);
        if (!parsed) throw new Error('invalid');
        if (!cancelled) setPhraseSetData(parsed);
      })
      .catch(() => {
        if (!cancelled) setPhraseSetError(t.registryPhraseSetLoadError);
      })
      .finally(() => {
        if (!cancelled) setPhraseSetLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedEntry, selectedUpload, selectedUploadId, t.registryPhraseSetLoadError]);

  useEffect(() => {
    if (selectedUpload) {
      setPhraseSetData(selectedUpload.data);
      setPhraseSetError(null);
      setPhraseSetLoading(false);
    }
  }, [selectedUpload]);

  const handleRegistryFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = String(reader.result ?? '');
          setRegistry(parseRegistryJson(raw));
          setLoadHint(file.name);
          setError(null);
          setSelectedId(null);
          setSelectedCharacterName(null);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : t.registryParseError);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [t.registryParseError]
  );

  const handleBatchPlanFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = String(reader.result ?? '');
          setBatchPlan(parseBatchPlanJson(raw));
          setError(null);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : t.registryParseError);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [t.registryParseError]
  );

  const handlePhraseSetFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      e.target.value = '';

      void (async () => {
        const next: UploadedPhraseSet[] = [];
        for (const file of Array.from(files)) {
          try {
            const raw = await file.text();
            const parsed = parsePhraseSetJson(raw);
            if (!parsed) throw new Error('invalid');
            next.push({
              id: `upload-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              fileName: file.name,
              data: parsed,
            });
          } catch {
            setError(t.registryParseError);
            return;
          }
        }
        if (!next.length) return;
        setUploadedPhraseSets((prev) => [...next, ...prev]);
        setActiveTab('themes');
        setSelectedUploadId(next[0].id);
        setSelectedId(null);
        setError(null);
      })();
    },
    [t.registryParseError]
  );

  const selectThemeEntry = (entry: StickerRegistryEntry) => {
    setSelectedId(entry.id);
    setSelectedUploadId(null);
    setShowRawJson(false);
  };

  const selectUploadedPhraseSet = (upload: UploadedPhraseSet) => {
    setSelectedUploadId(upload.id);
    setSelectedId(null);
    setShowRawJson(false);
  };

  const renderPhraseSetPanel = (
    label: string,
    meta: { theme?: string; voice?: string; path?: string },
    data: LineStickerPhraseSetJson | null,
    loading: boolean,
    loadError: string | null
  ) => (
    <div className="space-y-4">
      <h3 className="font-bold text-slate-900">{label}</h3>
      {(meta.theme || meta.voice) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {meta.theme && (
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700">{meta.theme}</span>
          )}
          {meta.voice && (
            <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700">{meta.voice}</span>
          )}
        </div>
      )}
      {meta.path && (
        <p className="text-xs text-slate-500 font-mono break-all">
          {t.registryThemeSetPath}: {meta.path}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">{t.registryPhraseSetLoading}</p>}
      {loadError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}
      {data && (
        <>
          <dl className="text-xs grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <dt className="font-semibold text-slate-500">{t.registryPhraseSetName}</dt>
              <dd>{data.name || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">{t.registryPhraseSetPhrases}</dt>
              <dd>
                {countNonEmptyPhrases(data.phrases)} / {data.phrases.length}
                {' · '}
                {data.phrases.length - countNonEmptyPhrases(data.phrases)} {t.registryPhraseSetVisualOnly}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t.registryPhraseSetSample}</p>
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {data.phrases
                .map((phrase, i) => ({ phrase, i }))
                .filter(({ phrase }) => phrase.trim())
                .slice(0, 12)
                .map(({ phrase, i }) => (
                  <li key={i} className="text-slate-700 px-2 py-1 bg-slate-50 rounded">
                    {phrase}
                  </li>
                ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            className="text-xs text-rose-600 hover:text-rose-800 font-medium"
          >
            {showRawJson ? '▲' : '▼'} {t.registryPhraseSetRawJson}
          </button>
          {showRawJson && (
            <pre className="text-[10px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-64">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );

  const renderCharacterDetail = (profile: CharacterProfile) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-24 space-y-4">
      <h3 className="font-bold text-slate-900">{profile.characterName}</h3>
      <dl className="text-xs space-y-2 text-slate-600">
        <div>
          <dt className="font-semibold text-slate-500">{t.registryDetailConcept}</dt>
          <dd className="mt-0.5">{profile.characterConcept || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{t.registryDetailStyle}</dt>
          <dd>{profile.style}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{t.registryCharacterSets}</dt>
          <dd>{profile.setCount}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{t.registryCharacterThemes}</dt>
          <dd className="flex flex-wrap gap-1 mt-1">
            {profile.themeVoicePairs.map((pair) => (
              <span key={pair} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100">
                {pair}
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {profile.refImagePath && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">{t.registryDetailRef}</p>
          <img
            src={toVaultAssetUrl(profile.refImagePath)}
            alt={profile.characterName}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 object-contain max-h-64"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <p className="text-[11px] text-slate-400">{t.registryPreviewHint}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 font-sans">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">{t.backToHome}</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <Factory className="w-6 h-6 text-rose-500 shrink-0" />
              <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{t.registryTitle}</h1>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <p className="text-slate-600 text-sm md:text-base">{t.registrySubtitle}</p>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-rose-300 transition-colors text-sm font-medium text-slate-700">
            <Upload className="w-4 h-4 text-rose-500" />
            {t.registryUploadRegistry}
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleRegistryFile} />
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-rose-300 transition-colors text-sm font-medium text-slate-700">
            <ClipboardList className="w-4 h-4 text-rose-500" />
            {t.registryUploadBatchPlan}
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleBatchPlanFile} />
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-rose-300 transition-colors text-sm font-medium text-slate-700">
            <FileJson className="w-4 h-4 text-rose-500" />
            {t.registryUploadPhraseSet}
            <input
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={handlePhraseSetFile}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadRegistryFromUrl()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-rose-300 transition-colors text-sm font-medium text-slate-700"
          >
            <RefreshCw className="w-4 h-4 text-rose-500" />
            {t.registryReloadOutput}
          </button>
        </div>

        {loadHint && <p className="text-xs text-slate-500">{loadHint}</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</p>
        )}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: t.registryStatTotal, value: summary.total },
              { label: t.registryStatB, value: summary.bCount },
              { label: t.registryStatA, value: summary.aCount },
              { label: t.registryStatCompleted, value: summary.completed },
              { label: t.registryStatPlanned, value: summary.planned },
              { label: t.registryStatFailed, value: summary.failed },
              { label: t.registryStatCharacters, value: summary.characterCount },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-xl border border-slate-200 px-3 py-3 text-center shadow-sm"
              >
                <div className="text-xl font-bold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {batchPlan && (
          <section className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 md:p-5">
            <h2 className="text-base font-bold text-slate-900 mb-2">
              {t.registryBatchPlanTitle} — {batchPlan.date}
            </h2>
            <p className="text-sm text-slate-600 mb-3">
              {t.registryBatchPlanMeta
                .replace('{count}', String(batchPlan.count))
                .replace('{b}', String(batchPlan.bSlots))
                .replace('{a}', String(batchPlan.aSlots))
                .replace('{ratio}', batchPlan.ratio)}
            </p>
            {batchPlan.warnings.length > 0 && (
              <ul className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 space-y-1 mb-3">
                {batchPlan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {batchPlan.slots.slice(0, 12).map((slot) => (
                <span
                  key={slot.id}
                  className={`text-xs px-2 py-1 rounded-lg ${batchBadgeClass(slot.batchType)}`}
                >
                  {slot.id} {slot.theme}/{slot.voice}
                </span>
              ))}
              {batchPlan.slots.length > 12 && (
                <span className="text-xs text-slate-400 self-center">+{batchPlan.slots.length - 12}</span>
              )}
            </div>
          </section>
        )}

        {registry && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('characters')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tabButtonClass(activeTab === 'characters')}`}
              >
                <User className="w-4 h-4" />
                {t.registryTabCharacters}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('themes')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tabButtonClass(activeTab === 'themes')}`}
              >
                <FileJson className="w-4 h-4" />
                {t.registryTabThemeSets}
              </button>
            </div>

            {activeTab === 'characters' && (
              <div className="flex flex-col lg:flex-row gap-6">
                <section className="flex-1 min-w-0 space-y-4">
                  <p className="text-sm text-slate-500">{t.registryCharactersSubtitle}</p>
                  <input
                    type="search"
                    placeholder={t.registrySearchPlaceholder}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                    value={filter.query}
                    onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
                  />
                  {characterProfiles.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                      {t.registryNoCharacters}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                      {characterProfiles.map((profile) => (
                        <button
                          key={profile.characterName}
                          type="button"
                          onClick={() => setSelectedCharacterName(profile.characterName)}
                          className={`text-left bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors hover:border-rose-300 ${
                            selectedCharacterName === profile.characterName
                              ? 'border-rose-400 ring-2 ring-rose-100'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="aspect-square bg-slate-50 flex items-center justify-center p-2">
                            {profile.refImagePath ? (
                              <img
                                src={toVaultAssetUrl(profile.refImagePath)}
                                alt={profile.characterName}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <User className="w-12 h-12 text-slate-300" />
                            )}
                          </div>
                          <div className="p-3">
                            <p className="font-semibold text-slate-900 truncate">{profile.characterName}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {profile.characterConcept || profile.style}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2">
                              {profile.setCount} {t.registryCharacterSets}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
                <aside className="w-full lg:w-80 shrink-0">
                  {selectedCharacter ? (
                    renderCharacterDetail(selectedCharacter)
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      {t.registrySelectCharacter}
                    </div>
                  )}
                </aside>
              </div>
            )}

            {activeTab === 'themes' && (
              <div className="flex flex-col lg:flex-row gap-6">
                <section className="flex-1 min-w-0 space-y-4">
                  <p className="text-sm text-slate-500">{t.registryThemeSetsSubtitle}</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <select
                      className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      value={filter.batchType}
                      onChange={(e) =>
                        setFilter((f) => ({ ...f, batchType: e.target.value as RegistryFilter['batchType'] }))
                      }
                    >
                      <option value="all">{t.registryFilterAllBatch}</option>
                      <option value="B">{t.registryFilterB}</option>
                      <option value="A">{t.registryFilterA}</option>
                    </select>
                    <select
                      className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      value={filter.status}
                      onChange={(e) =>
                        setFilter((f) => ({ ...f, status: e.target.value as RegistryFilter['status'] }))
                      }
                    >
                      <option value="all">{t.registryFilterAllStatus}</option>
                      <option value="completed">{t.registryStatusCompleted}</option>
                      <option value="planned">{t.registryStatusPlanned}</option>
                      <option value="failed">{t.registryStatusFailed}</option>
                    </select>
                    <select
                      className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      value={filter.date}
                      onChange={(e) => setFilter((f) => ({ ...f, date: e.target.value }))}
                    >
                      <option value="all">{t.registryFilterAllDates}</option>
                      {summary?.dates.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="search"
                      placeholder={t.registrySearchPlaceholder}
                      className="flex-1 min-w-[12rem] text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      value={filter.query}
                      onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
                    />
                  </div>

                  {uploadedPhraseSets.length > 0 && (
                    <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3">{t.registryUploadPhraseSet}</h3>
                      <div className="flex flex-wrap gap-2">
                        {uploadedPhraseSets.map((upload) => (
                          <button
                            key={upload.id}
                            type="button"
                            onClick={() => selectUploadedPhraseSet(upload)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              selectedUploadId === upload.id
                                ? 'border-violet-400 bg-violet-50 text-violet-800'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300'
                            }`}
                          >
                            {upload.data.name || upload.fileName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3">{t.registryColId}</th>
                            <th className="px-4 py-3">{t.registryColCharacter}</th>
                            <th className="px-4 py-3">{t.registryColBatch}</th>
                            <th className="px-4 py-3">{t.registryColTheme}</th>
                            <th className="px-4 py-3">{t.registryColVoice}</th>
                            <th className="px-4 py-3">{t.registryColStatus}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntries.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                {t.registryNoEntries}
                              </td>
                            </tr>
                          ) : (
                            filteredEntries.map((entry) => (
                              <tr
                                key={entry.id}
                                onClick={() => selectThemeEntry(entry)}
                                className={`border-t border-slate-100 cursor-pointer hover:bg-rose-50/50 transition-colors ${
                                  selectedId === entry.id && !selectedUploadId ? 'bg-rose-50' : ''
                                }`}
                              >
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">{entry.id}</td>
                                <td className="px-4 py-3 font-medium text-slate-900">
                                  {entry.characterName || '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${batchBadgeClass(entry.batchType)}`}
                                  >
                                    {entry.batchType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{entry.theme}</td>
                                <td className="px-4 py-3 text-slate-600">{entry.voice}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClass(entry.status)}`}
                                  >
                                    {entry.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <aside className="w-full lg:w-96 shrink-0">
                  {selectedEntry && !selectedUploadId ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-24">
                      {renderPhraseSetPanel(
                        `${selectedEntry.characterName || selectedEntry.id} · ${selectedEntry.theme}/${selectedEntry.voice}`,
                        {
                          theme: selectedEntry.theme,
                          voice: selectedEntry.voice,
                          path: phraseSetPath(selectedEntry.outputDir),
                        },
                        phraseSetData,
                        phraseSetLoading,
                        phraseSetError
                      )}
                    </div>
                  ) : selectedUpload ? (
                    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-4 sticky top-24">
                      {renderPhraseSetPanel(
                        selectedUpload.data.name || selectedUpload.fileName,
                        {},
                        phraseSetData,
                        false,
                        null
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      {t.registrySelectThemeSet}
                    </div>
                  )}
                </aside>
              </div>
            )}
          </>
        )}

        {!registry && !error && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            <Factory className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p>{t.registryEmpty}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DailyStickerRegistryPage;
