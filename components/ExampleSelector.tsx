import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from './Icons';
import type { ExampleData } from '../types';
import { useLanguage } from '../hooks/useLanguage';

interface ExampleSelectorProps {
  examples: readonly ExampleData[];
  onSelectExample: (example: ExampleData) => void;
}

export const ExampleSelector: React.FC<ExampleSelectorProps> = React.memo(({ 
  examples, 
  onSelectExample 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();

  // Map example IDs to translation keys
  const exampleKeyMap: Record<string, keyof typeof t.examples> = {
    'cute-smile': 'cuteSmile',
    'cutesmile': 'cuteSmile',
    'character-walk': 'characterWalk',
    'characterwalk': 'characterWalk',
    'jump-action': 'jumpAction',
    'jumpaction': 'jumpAction',
    'wave-hand': 'waveHand',
    'wavehand': 'waveHand',
    'idle-breath': 'idleBreath',
    'idlebreath': 'idleBreath',
    'attack': 'attack',
  };

  // Get localized example name and description
  const getLocalizedExample = (example: ExampleData) => {
    const key = exampleKeyMap[example.id] ?? exampleKeyMap[example.id.replace(/-/g, '')];
    const localizedData = key ? t.examples[key] : undefined;
    return localizedData ?? { name: example.name, description: example.description };
  };

  return (
    <div className="bg-signal-soft rounded-xl border border-signal/25 overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-signal-soft/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={t.exampleTitle}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-signal rounded-lg flex items-center justify-center shadow-sm">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-ink">{t.exampleTitle}</h3>
            <p className="text-xs text-signal">{t.exampleHint}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-signal" />
        ) : (
          <ChevronDown className="w-5 h-5 text-signal" />
        )}
      </button>

      {/* Examples Grid */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {examples.map((example) => {
              const localized = getLocalizedExample(example);
              return (
                <button
                  key={example.id}
                  onClick={() => {
                    onSelectExample(example);
                    setIsExpanded(false);
                  }}
                  className="group text-left bg-white hover:bg-signal-soft border-2 border-signal/25 hover:border-signal rounded-lg p-3 transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                  aria-label={`${t.exampleTitle}: ${localized.name}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-10 h-10 bg-signal rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                      <span className="text-white font-bold text-sm">
                        {example.gridCols}×{example.gridRows}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-slate-800 mb-0.5 truncate group-hover:text-ink transition-colors">
                        {localized.name}
                      </h4>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {localized.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-signal/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {example.gridCols * example.gridRows} {t.frames}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-medium ${
                        example.chromaKeyColor === 'magenta' 
                          ? 'bg-pink-500' 
                          : 'bg-signal'
                      }`}>
                        {example.chromaKeyColor === 'magenta' ? t.magentaBg : t.greenBg}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Tip */}
          <div className="mt-3 p-2.5 bg-signal-soft/50 rounded-lg border border-signal/25">
            <p className="text-xs text-signal leading-relaxed">
              {t.exampleTip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

ExampleSelector.displayName = 'ExampleSelector';
