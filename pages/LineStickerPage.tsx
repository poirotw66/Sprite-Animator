import React from 'react';
import { Loader2 } from '../components/Icons';
import { RenderProfilerDebugPanel } from '../components/RenderProfilerDebugPanel';
import { SettingsModal } from '../components/SettingsModal';
import {
    LineStickerHeader,
    LineStickerResultPanel,
    LineStickerSettingsPanel,
} from '../components/LineSticker';
import { useLineStickerWorkspace } from '../hooks/useLineStickerWorkspace';

const LineStickerPage: React.FC = () => {
    const { modal, header, settings, result, profiler, resume } = useLineStickerWorkspace();

    return (
        <div className="min-h-screen bg-slate-50 font-sans px-4 pb-12 pt-4 md:px-6 md:pb-14 md:pt-6 lg:px-8">
            <SettingsModal {...modal} />
            <LineStickerHeader {...header} />

            {resume.isHydrating ? (
                <div
                    className="mx-auto mb-4 flex max-w-7xl items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-900"
                    data-testid="line-sticker-hydrating"
                >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    {resume.hydratingLabel}
                </div>
            ) : null}

            {!resume.isHydrating && resume.showRestoredNotice ? (
                <div
                    className="mx-auto mb-4 flex max-w-7xl flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between"
                    data-testid="line-sticker-restored-notice"
                >
                    <div className="space-y-1">
                        <p>{resume.restoredLabel}</p>
                        {resume.wasInterruptedOnResume ? (
                            <p className="text-amber-800" data-testid="line-sticker-resume-interrupted">
                                {resume.interruptedLabel}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={resume.onDismissRestoredNotice}
                        className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                    >
                        {resume.dismissLabel}
                    </button>
                </div>
            ) : null}

            <main
                className={`mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10 ${
                    resume.isHydrating ? 'pointer-events-none opacity-60' : ''
                }`}
                aria-busy={resume.isHydrating}
            >
                <LineStickerSettingsPanel {...settings} />
                <div id="line-sticker-result" className="scroll-mt-28 space-y-5 lg:col-span-7">
                    <LineStickerResultPanel {...result} />
                </div>
            </main>

            <RenderProfilerDebugPanel {...profiler} />
        </div>
    );
};

export default LineStickerPage;
