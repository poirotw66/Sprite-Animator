import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from './Icons';
import { CHUNK_LOAD_ERROR_MESSAGE } from '../utils/lazyWithRetry';
import { getTranslation, type Language } from '../i18n';

const LANGUAGE_STORAGE_KEY = 'sprite_animator_language';

function resolveStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'zh-TW') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  const browserLang = navigator.language ?? 'en';
  return browserLang.startsWith('zh') ? 'zh-TW' : 'en';
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and display React errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ErrorBoundary errors should always be logged, even in production
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const t = getTranslation(resolveStoredLanguage());
      const isChunkError =
        this.state.error?.message.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message.includes(CHUNK_LOAD_ERROR_MESSAGE);

      return (
        <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{t.errorBoundaryTitle}</h1>
                <p className="text-gray-500 mt-1">{t.errorBoundarySubtitle}</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h2 className="font-semibold text-red-800 mb-2">{t.errorBoundaryMessageLabel}</h2>
                <p className="text-red-700 text-sm break-all">
                  {isChunkError ? t.errorBoundaryChunkReload : this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="mt-4">
                    <summary className="text-red-600 text-sm cursor-pointer hover:text-red-800">
                      {t.errorBoundaryStackSummary}
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-60 bg-red-100 p-2 rounded">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                {t.errorBoundaryRetry}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {t.errorBoundaryReload}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">{t.errorBoundaryHint}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
