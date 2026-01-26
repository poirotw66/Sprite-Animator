import React from 'react';
import { Settings, X, ShieldCheck, ShieldAlert } from './Icons';
import { SUPPORTED_MODELS } from '../utils/constants';

interface SettingsModalProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showSettings: boolean;
  onClose: () => void;
  onSave: (key: string, model: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = React.memo(({
  apiKey,
  setApiKey,
  selectedModel,
  setSelectedModel,
  showSettings,
  onClose,
  onSave,
}) => {
  if (!showSettings) return null;

  const hasCustomKey = !!apiKey.trim();
  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  // Handle Escape key to close modal
  React.useEffect(() => {
    if (!showSettings) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSettings, onClose]);

  // Focus trap for modal
  const modalRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (showSettings && modalRef.current) {
      const firstInput = modalRef.current.querySelector('input') as HTMLInputElement;
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [showSettings]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <h3 id="settings-modal-title" className="font-bold text-slate-900 flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-slate-600" aria-hidden="true" />
            設定
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors duration-200 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="關閉設定"
            type="button"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="api-key-input" className="block text-sm font-semibold text-slate-700 mb-2">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasEnvKey ? '已檢測到系統 Key (可覆蓋)' : 'AIzaSy...'}
                className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none pr-10 bg-white transition-all"
                aria-label="Gemini API Key"
                aria-describedby="api-key-description"
                autoComplete="off"
              />
              {hasCustomKey && (
                <div className="absolute right-3 top-3 text-green-600" title="使用中">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              {hasCustomKey ? (
                <span className="text-green-700 flex items-center gap-1.5 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> 使用自訂 Key (優先)
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5" /> 使用預設/系統 Key
                </span>
              )}
            </div>

            <p id="api-key-description" className="text-xs text-slate-500 mt-3">
              您的 Key 僅會儲存在本地瀏覽器中。
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 hover:text-orange-700 hover:underline ml-1 font-medium transition-colors"
                aria-label="在新視窗中打開獲取 API Key 頁面"
              >
                獲取 Key
              </a>
            </p>
          </div>

          <div>
            <label htmlFor="model-select" className="block text-sm font-semibold text-slate-700 mb-2">
              模型選擇
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none bg-white transition-all cursor-pointer"
              aria-label="選擇模型"
            >
              {SUPPORTED_MODELS.map((model) => {
                let displayName = '';
                if (model === 'gemini-2.5-flash-image') {
                  displayName = 'Gemini 2.5 Flash Image (推薦)';
                } else if (model === 'gemini-3-pro-image-preview') {
                  displayName = 'Gemini 3 Pro Image Preview';
                } else {
                  displayName = model;
                }
                return (
                  <option key={model} value={model}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onSave(apiKey, selectedModel)}
              className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white py-3 rounded-lg font-semibold hover:from-slate-800 hover:to-slate-700 transition-all duration-200 focus:ring-2 focus:ring-orange-500/50 focus:outline-none shadow-md hover:shadow-lg cursor-pointer"
              type="button"
              aria-label="儲存設定並關閉對話框"
            >
              儲存並應用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsModal.displayName = 'SettingsModal';
