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
        <div className="ui-page">
            <SettingsModal {...modal} />
            <LineStickerHeader {...header} />

            {resume.isHydrating ? (
                <div className="ui-banner-ok" data-testid="line-sticker-hydrating">
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ok" />
                        {resume.hydratingLabel}
                    </div>
                </div>
            ) : null}

            {!resume.isHydrating && resume.showRestoredNotice ? (
                <div className="ui-banner-info" data-testid="line-sticker-restored-notice">
                    <div className="space-y-1">
                        <p>{resume.restoredLabel}</p>
                        {resume.wasInterruptedOnResume ? (
                            <p className="text-warn" data-testid="line-sticker-resume-interrupted">
                                {resume.interruptedLabel}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={resume.onDismissRestoredNotice}
                        className="ui-btn-secondary min-h-[40px] px-3 py-2 text-xs"
                    >
                        {resume.dismissLabel}
                    </button>
                </div>
            ) : null}

            {!resume.isHydrating && resume.hydrateIssue ? (
                <div className="ui-banner-warn" data-testid="line-sticker-hydrate-issue">
                    <p>
                        {resume.hydrateIssue === 'missing'
                            ? resume.hydrateMissingLabel
                            : resume.hydrateFailedLabel}
                    </p>
                    <button
                        type="button"
                        onClick={resume.onDismissHydrateIssue}
                        className="ui-btn-secondary min-h-[40px] px-3 py-2 text-xs"
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
