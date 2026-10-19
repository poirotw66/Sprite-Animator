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

  const optionalTools: ToolCard[] = [
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

  const spriteInfo = getToolInfo('sprite-animation');

  return (
    <div className="ui-page">
      <header className="ui-shell mb-10 md:mb-12">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="ui-icon-mark p-2.5">
                <Zap className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold tracking-wide text-signal">Sprite Animator</p>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl lg:text-6xl">
              {t.homeTitle}
            </h1>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-ink-muted md:text-lg">
              {t.homeSubtitle}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 md:gap-12">
        <Link
          to="/sprite-animation"
          className="group relative overflow-hidden rounded-xl border border-line bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-signal/35 hover:shadow-md active:scale-[0.99] md:p-8"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgb(226 61 47 / 0.05), transparent 42%), radial-gradient(circle at 100% 0%, rgb(47 111 237 / 0.06), transparent 40%)',
            }}
          />
          <div className="relative md:flex md:items-end md:justify-between md:gap-8">
            <div className="md:max-w-xl">
              <div className="mb-5 inline-flex rounded-lg border border-line bg-paper p-3 text-ink transition-colors group-hover:border-signal/30 group-hover:bg-signal-soft group-hover:text-signal">
                <Zap className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                {spriteInfo.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted md:text-base">
                {spriteInfo.desc}
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-signal md:mt-0">
              {t.openSpriteAnimator}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        <section aria-labelledby="optional-studio-tools">
          <div className="mb-4 max-w-2xl">
            <h2
              id="optional-studio-tools"
              className="text-lg font-semibold tracking-tight text-ink md:text-xl"
            >
              {t.optionalStudioTools}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {t.optionalStudioToolsHint}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {optionalTools.map((tool) => {
              const info = getToolInfo(tool.id);
              return (
                <Link
                  key={tool.id}
                  to={tool.path}
                  className="group relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-signal/35 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="mb-4 inline-flex rounded-lg border border-line bg-paper p-2.5 text-ink transition-colors group-hover:border-signal/30 group-hover:bg-signal-soft group-hover:text-signal">
                    {tool.icon}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-ink">{info.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{info.desc}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-signal">
                    {t.enterTool}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="ui-shell mt-16 text-center md:mt-20">
        <p className="text-sm text-ink-faint">Powered by Google Gemini AI</p>
      </footer>
    </div>
  );
};

export default HomePage;
