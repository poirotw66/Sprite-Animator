import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, MessageCircle, ArrowRight, Eraser, Grid, BookOpen, Factory } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface ToolCard {
  id: string;
  path: string;
  icon: React.ReactNode;
}

const HomePage: React.FC = () => {
  const { t } = useLanguage();

  const tools: ToolCard[] = [
    {
      id: 'sprite-animation',
      path: '/sprite-animation',
      icon: <Zap className="h-6 w-6" />,
    },
    {
      id: 'line-sticker',
      path: '/line-sticker',
      icon: <MessageCircle className="h-6 w-6" />,
    },
    {
      id: 'daily-sticker-registry',
      path: '/daily-sticker-registry',
      icon: <Factory className="h-6 w-6" />,
    },
    {
      id: 'one-page-comic',
      path: '/one-page-comic',
      icon: <BookOpen className="h-6 w-6" />,
    },
    {
      id: 'rmbg',
      path: '/rmbg',
      icon: <Eraser className="h-6 w-6" />,
    },
    {
      id: 'parting',
      path: '/parting',
      icon: <Grid className="h-6 w-6" />,
    },
  ];

  const getToolInfo = (id: string) => {
    switch (id) {
      case 'sprite-animation':
        return { title: t.spriteAnimatorTool, desc: t.spriteAnimatorDesc };
      case 'line-sticker':
        return { title: t.lineStickerTool, desc: t.lineStickerDesc };
      case 'daily-sticker-registry':
        return { title: t.registryTool, desc: t.registryToolDesc };
      case 'one-page-comic':
        return { title: t.comicTool, desc: t.comicDesc };
      case 'rmbg':
        return { title: t.rmbgTitle, desc: t.rmbgDesc };
      case 'parting':
        return { title: t.partingTitle, desc: t.partingDesc };
      default:
        return { title: '', desc: '' };
    }
  };

  return (
    <div className="ui-page">
      <header className="ui-shell mb-12 md:mb-16">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="ui-icon-mark p-2.5">
                <Zap className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold tracking-wide text-signal">Sprite Studio</p>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl lg:text-6xl">
              {t.homeTitle}
            </h1>
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-ink-muted md:text-lg">
              {t.homeSubtitle}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {tools.map((tool, index) => {
          const info = getToolInfo(tool.id);
          const featured = index === 0;
          return (
            <Link
              key={tool.id}
              to={tool.path}
              className={`group relative overflow-hidden rounded-xl border border-line bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-signal/35 hover:shadow-md active:scale-[0.99] ${
                featured ? 'md:col-span-2 md:p-8' : ''
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, rgb(226 61 47 / 0.05), transparent 42%), radial-gradient(circle at 100% 0%, rgb(47 111 237 / 0.06), transparent 40%)',
                }}
              />
              <div className={`relative ${featured ? 'md:flex md:items-end md:justify-between md:gap-8' : ''}`}>
                <div className={featured ? 'md:max-w-md' : ''}>
                  <div className="mb-5 inline-flex rounded-lg border border-line bg-paper p-3 text-ink transition-colors group-hover:border-signal/30 group-hover:bg-signal-soft group-hover:text-signal">
                    {tool.icon}
                  </div>
                  <h2 className={`font-bold tracking-tight text-ink ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
                    {info.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted md:text-base">
                    {info.desc}
                  </p>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-signal md:mt-8">
                  {t.enterTool}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </main>

      <footer className="ui-shell mt-16 text-center md:mt-20">
        <p className="text-sm text-ink-faint">Powered by Google Gemini AI</p>
      </footer>
    </div>
  );
};

export default HomePage;
