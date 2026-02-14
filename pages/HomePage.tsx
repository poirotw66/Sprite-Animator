import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, MessageCircle, ArrowRight, Eraser, Grid } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// Tool card data
interface ToolCard {
    id: string;
    path: string;
    icon: React.ReactNode;
    gradient: string;
    borderColor: string;
    hoverGlow: string;
}

const HomePage: React.FC = () => {
    const { t } = useLanguage();

    const tools: ToolCard[] = [
        {
            id: 'sprite-animation',
            path: '/sprite-animation',
            icon: <Zap className="w-10 h-10 md:w-12 md:h-12 text-white" />,
            gradient: 'from-orange-500 to-amber-500',
            borderColor: 'border-orange-200 hover:border-orange-300',
            hoverGlow: 'hover:shadow-orange-200/50',
        },
        {
            id: 'line-sticker',
            path: '/line-sticker',
            icon: <MessageCircle className="w-10 h-10 md:w-12 md:h-12 text-white" />,
            gradient: 'from-green-500 to-emerald-500',
            borderColor: 'border-green-200 hover:border-green-300',
            hoverGlow: 'hover:shadow-green-200/50',
        },
        {
            id: 'rmbg',
            path: '/rmbg',
            icon: <Eraser className="w-10 h-10 md:w-12 md:h-12 text-white" />,
            gradient: 'from-purple-500 to-indigo-600',
            borderColor: 'border-purple-200 hover:border-purple-300',
            hoverGlow: 'hover:shadow-purple-200/50',
        },
        {
            id: 'parting',
            path: '/parting',
            icon: <Grid className="w-10 h-10 md:w-12 md:h-12 text-white" />,
            gradient: 'from-teal-500 to-cyan-500',
            borderColor: 'border-teal-200 hover:border-teal-300',
            hoverGlow: 'hover:shadow-teal-200/50',
        },
    ];

    const getToolInfo = (id: string) => {
        switch (id) {
            case 'sprite-animation':
                return { title: t.spriteAnimatorTool, desc: t.spriteAnimatorDesc };
            case 'line-sticker':
                return { title: t.lineStickerTool, desc: t.lineStickerDesc };
            case 'rmbg':
                return { title: t.rmbgTitle, desc: t.rmbgDesc };
            case 'parting':
                return { title: t.partingTitle, desc: t.partingDesc };
            default:
                return { title: '', desc: '' };
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 font-sans px-4 py-8 md:px-8 lg:px-12">
            {/* Header */}
            <header className="max-w-5xl mx-auto mb-12 md:mb-16">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-xl shadow-lg">
                            <Zap className="w-7 h-7 md:w-8 md:h-8 text-white" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            {t.homeTitle}
                        </h1>
                    </div>
                    <LanguageSwitcher />
                </div>
                <p className="mt-4 text-slate-600 text-lg md:text-xl max-w-2xl">
                    {t.homeSubtitle}
                </p>
            </header>

            {/* Tool Cards */}
            <main className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {tools.map((tool) => {
                        const info = getToolInfo(tool.id);
                        return (
                            <Link
                                key={tool.id}
                                to={tool.path}
                                className={`group relative bg-white rounded-2xl md:rounded-3xl shadow-sm border-2 ${tool.borderColor} ${tool.hoverGlow} transition-all duration-300 overflow-hidden hover:shadow-xl hover:-translate-y-1`}
                            >
                                {/* Decorative background pattern */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                                    <div className="absolute inset-0 bg-repeat" style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Ccircle cx='3' cy='3' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
                                        backgroundSize: '20px 20px'
                                    }} />
                                </div>

                                <div className="relative p-6 md:p-8">
                                    {/* Icon */}
                                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${tool.gradient} shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}>
                                        {tool.icon}
                                    </div>

                                    {/* Content */}
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-3 group-hover:text-slate-700 transition-colors">
                                        {info.title}
                                    </h2>
                                    <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
                                        {info.desc}
                                    </p>

                                    {/* CTA Button */}
                                    <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r ${tool.gradient} text-white font-semibold text-sm md:text-base shadow-md group-hover:shadow-lg transition-all duration-300`}>
                                        {t.enterTool}
                                        <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform duration-300" />
                                    </div>
                                </div>

                                {/* Bottom accent line */}
                                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${tool.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            </Link>
                        );
                    })}
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-5xl mx-auto mt-16 md:mt-20 text-center">
                <p className="text-slate-400 text-sm">
                    Powered by Google Gemini AI
                </p>
            </footer>
        </div>
    );
};

export default HomePage;
