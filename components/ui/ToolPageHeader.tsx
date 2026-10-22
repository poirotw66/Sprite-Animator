import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings } from '../Icons';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useLanguage } from '../../hooks/useLanguage';

export interface ToolPageHeaderProps {
  title: string;
  icon: React.ReactNode;
  onOpenSettings?: () => void;
  settingsActive?: boolean;
  settingsLabel?: string;
  jumpToResultHref?: string;
  jumpToResultLabel?: string;
  trailing?: React.ReactNode;
  leadingActions?: React.ReactNode;
  endActions?: React.ReactNode;
}

/** Shared sticky chrome for every tool page. */
export const ToolPageHeader: React.FC<ToolPageHeaderProps> = ({
  title,
  icon,
  onOpenSettings,
  settingsActive = false,
  settingsLabel = 'Open settings',
  jumpToResultHref,
  jumpToResultLabel,
  trailing,
  leadingActions,
  endActions,
}) => {
  const { t } = useLanguage();

  const jumpToResult = () => {
    const target = jumpToResultHref?.replace(/^#/, '');
    if (!target) return;
    const section = document.getElementById(target);
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  };

  return (
    <header className="ui-header">
      <div className="tool-header-layout">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/studio"
            aria-label={t.backToHome}
            title={t.backToHome}
            className="ui-btn-ghost min-h-[44px] min-w-[44px] px-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight text-ink sm:text-xl">
            <span className="ui-icon-mark [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
            <span className="truncate" title={title}>{title}</span>
          </h1>
        </div>
        <div className="tool-header-actions">
          {leadingActions}
          {jumpToResultHref && jumpToResultLabel ? (
            <button
              type="button"
              onClick={jumpToResult}
              className="ui-btn-secondary mr-auto px-3 text-xs text-signal lg:hidden"
            >
              {jumpToResultLabel}
            </button>
          ) : null}
          <LanguageSwitcher />
          {trailing}
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={settingsLabel}
              className={`ui-btn-ghost min-h-[44px] min-w-[44px] px-0 ${
                settingsActive ? 'border-signal/30 bg-signal-soft text-signal' : ''
              }`}
            >
              <Settings className="h-5 w-5" />
            </button>
          ) : null}
          {endActions}
        </div>
      </div>
    </header>
  );
};
