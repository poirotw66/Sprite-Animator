import React from 'react';
import { Image } from '../Icons';
import { ToolPageHeader } from '../ui';

export interface LineStickerHeaderProps {
  title: string;
  hasCustomKey: boolean;
  onOpenSettings: () => void;
  jumpToResultLabel: string;
  resultSectionId?: string;
}

export const LineStickerHeader: React.FC<LineStickerHeaderProps> = ({
  title,
  hasCustomKey,
  onOpenSettings,
  jumpToResultLabel,
  resultSectionId = 'line-sticker-result',
}) => (
  <ToolPageHeader
    title={title}
    icon={<Image />}
    onOpenSettings={onOpenSettings}
    settingsActive={hasCustomKey}
    settingsLabel="Open API and model settings"
    jumpToResultHref={`#${resultSectionId}`}
    jumpToResultLabel={jumpToResultLabel}
  />
);
