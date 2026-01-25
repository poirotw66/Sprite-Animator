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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            設定
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="關閉設定"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasEnvKey ? '已檢測到系統 Key (可覆蓋)' : 'AIzaSy...'}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none pr-10"
                aria-label="Gemini API Key"
              />
              {hasCustomKey && (
                <div className="absolute right-3 top-2.5 text-green-500" title="使用中">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Status Indicator */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              {hasCustomKey ? (
                <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                  <ShieldCheck className="w-3 h-3" /> 使用自訂 Key (優先)
                </span>
              ) : (
                <span className="text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <ShieldAlert className="w-3 h-3" /> 使用預設/系統 Key
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              您的 Key 僅會儲存在本地瀏覽器中。
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-orange-500 hover:underline ml-1"
              >
                獲取 Key
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">模型選擇</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              aria-label="選擇模型"
            >
              {SUPPORTED_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model === 'gemini-2.5-flash-image' ? 'Gemini 2.5 Flash Image (推薦)' : 'Gemini 2.0 Flash Exp'}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onSave(apiKey, selectedModel)}
              className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
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
