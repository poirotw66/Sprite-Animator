import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings } from '../Icons';
import { LanguageSwitcher } from '../LanguageSwitcher';

export interface ToolPageHeaderProps {
  title: string;
  icon: React.ReactNode;
  onOpenSettings?: () => void;
  settingsActive?: boolean;
  settingsLabel?: string;
  jumpToResultHref?: string;
  jumpToResultLabel?: string;
  trailing?: React.ReactNode;
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
}) => (
  <header className="ui-header">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          aria-label="Back to home"
          className="ui-btn-ghost min-h-[44px] min-w-[44px] px-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight text-ink sm:text-xl">
          <span className="ui-icon-mark [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          <span className="truncate">{title}</span>
        </h1>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {jumpToResultHref && jumpToResultLabel ? (
          <a
            href={jumpToResultHref}
            className="rounded-lg border border-signal/20 bg-signal-soft px-3 py-2 text-xs font-semibold text-signal hover:bg-signal/10 lg:hidden"
          >
            {jumpToResultLabel}
          </a>
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
      </div>
    </div>
  </header>
);
