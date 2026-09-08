import React from 'react';
import { RenderProfilerDebugPanel } from '../components/RenderProfilerDebugPanel';
import { SettingsModal } from '../components/SettingsModal';
import {
    LineStickerHeader,
    LineStickerResultPanel,
    LineStickerSettingsPanel,
} from '../components/LineSticker';
import { useLineStickerWorkspace } from '../hooks/useLineStickerWorkspace';

const LineStickerPage: React.FC = () => {
    const { modal, header, settings, result, profiler } = useLineStickerWorkspace();

    return (
        <div className="min-h-screen bg-slate-50 font-sans px-4 pb-12 pt-4 md:px-6 md:pb-14 md:pt-6 lg:px-8">
            <SettingsModal {...modal} />
            <LineStickerHeader {...header} />

            <main className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
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
