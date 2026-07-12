import React, { Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from './components/Icons';
import { useLanguage } from './hooks/useLanguage';

// Lazy load pages for code splitting
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const SpriteAnimatorPage = lazyWithRetry(() => import('./pages/SpriteAnimatorPage'));
const LineStickerPage = lazyWithRetry(() => import('./pages/LineStickerPage'));
const OnePageComicPage = lazyWithRetry(() => import('./pages/OnePageComicPage'));
const RemoveBackgroundPage = lazyWithRetry(() => import('./pages/RemoveBackgroundPage'));
const PartingPage = lazyWithRetry(() => import('./pages/PartingPage'));
const DailyStickerRegistryPage = lazyWithRetry(() => import('./pages/DailyStickerRegistryPage'));

// Loading fallback component
const PageLoader: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-slate-500 font-medium">{t.pageLoading}</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sprite-animation" element={<SpriteAnimatorPage />} />
          <Route path="/line-sticker" element={<LineStickerPage />} />
          <Route path="/one-page-comic" element={<OnePageComicPage />} />
          <Route path="/rmbg" element={<RemoveBackgroundPage />} />
          <Route path="/parting" element={<PartingPage />} />
          <Route path="/daily-sticker-registry" element={<DailyStickerRegistryPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
