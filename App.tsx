import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from './components/Icons';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const SpriteAnimatorPage = lazy(() => import('./pages/SpriteAnimatorPage'));
const LineStickerPage = lazy(() => import('./pages/LineStickerPage'));
const RemoveBackgroundPage = lazy(() => import('./pages/RemoveBackgroundPage'));

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      <p className="text-slate-500 font-medium">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sprite-animation" element={<SpriteAnimatorPage />} />
          <Route path="/line-sticker" element={<LineStickerPage />} />
          <Route path="/rmbg" element={<RemoveBackgroundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
