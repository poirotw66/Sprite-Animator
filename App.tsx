import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, RefreshCw, Wand2, ImageIcon, Download, Loader2, Layers, Zap, FileVideo, Archive, Film, Settings, X } from './components/Icons';
import { generateAnimationFrames } from './services/geminiService';
import { AnimationConfig } from './types';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const App: React.FC = () => {
  // Global Settings State
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image');
  const [showSettings, setShowSettings] = useState(false);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AnimationConfig>({
    prompt: '',
    frameCount: 4, // Default to 4 frames for quick sprites
    speed: 5,      // 5 * 2 = 10 FPS default
    scale: 100,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationIntervalRef = useRef<number | null>(null);

  // Load settings from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedModel = localStorage.getItem('gemini_model');
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setSelectedModel(storedModel);

    // If no key is found, show settings automatically
    if (!storedKey && !process.env.API_KEY) {
      setShowSettings(true);
    }
  }, []);

  // Save settings helper
  const saveSettings = (key: string, model: string) => {
    setApiKey(key);
    setSelectedModel(model);
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('gemini_model', model);
    setShowSettings(false);
  };

  // Animation Loop
  useEffect(() => {
    if (generatedFrames.length > 0) {
      const fps = Math.max(1, config.speed * 2); 
      const intervalMs = 1000 / fps;

      animationIntervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % generatedFrames.length);
      }, intervalMs);
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [generatedFrames, config.speed]);

  const handleReset = () => {
    setSourceImage(null);
    setGeneratedFrames([]);
    setError(null);
    setCurrentFrameIndex(0);
    setConfig(prev => ({ ...prev, prompt: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setGeneratedFrames([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        setGeneratedFrames([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    const effectiveKey = apiKey || process.env.API_KEY;

    if (!effectiveKey) {
      setShowSettings(true);
      setError("請先設定 API Key");
      return;
    }

    if (!sourceImage) {
      setError("請先上傳圖片");
      return;
    }
    if (!config.prompt.trim()) {
      setError("請輸入動作提示詞");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedFrames([]);

    try {
      const frames = await generateAnimationFrames(
        sourceImage, 
        config.prompt, 
        config.frameCount,
        effectiveKey,
        selectedModel
      );
      setGeneratedFrames(frames);
      
    } catch (err: any) {
      setError("生成失敗: " + (err.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to load images to get raw data
  const loadImagesData = async (frames: string[]) => {
    const imagesData: { data: Uint8ClampedArray, width: number, height: number }[] = [];
    let width = 0;
    let height = 0;

    for (const frameSrc of frames) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (width === 0) {
            width = img.width;
            height = img.height;
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);
            imagesData.push({ data: imgData.data, width: img.width, height: img.height });
          }
          resolve();
        };
        img.onerror = reject;
        img.src = frameSrc;
      });
    }
    return { imagesData, width, height };
  };

  const handleDownloadApng = async () => {
    if (generatedFrames.length === 0) return;
    
    setIsExporting(true);
    try {
      const { imagesData, width, height } = await loadImagesData(generatedFrames);
      
      const buffers = imagesData.map(d => d.data.buffer);
      const fps = Math.max(1, config.speed * 2);
      const delayMs = Math.round(1000 / fps);
      const delays = generatedFrames.map(() => delayMs);

      const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);

      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'animation.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("APNG Export failed", err);
      setError("APNG 導出失敗");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadGif = async () => {
    if (generatedFrames.length === 0) return;

    setIsExporting(true);
    try {
      const { imagesData, width, height } = await loadImagesData(generatedFrames);
      
      const gif = new GIFEncoder();
      const fps = Math.max(1, config.speed * 2);
      const delayMs = Math.round(1000 / fps);

      for (const { data } of imagesData) {
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, width, height, { 
          palette, 
          delay: delayMs,
          transparent: true,
          dispose: -1 
        });
      }

      gif.finish();
      const buffer = gif.bytes();

      const blob = new Blob([buffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'animation.gif';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("GIF Export failed", err);
      setError("GIF 導出失敗");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = async () => {
    if (generatedFrames.length === 0) return;
    
    setIsExporting(true);
    try {
      const zip = new JSZip();
      
      generatedFrames.forEach((frame, index) => {
        const base64Data = frame.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        const fileName = `frame_${String(index + 1).padStart(3, '0')}.png`;
        zip.file(fileName, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'frames_archive.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Zip Export failed", err);
      setError("ZIP 打包失敗");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 md:p-8 font-sans">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                設定
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  您的 Key 僅會儲存在本地瀏覽器中。
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline ml-1">
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
                >
                  <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (推薦)</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => saveSettings(apiKey, selectedModel)}
                  className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  儲存設定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <div className="bg-orange-500 p-1.5 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          角色幀動畫小工具
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white bg-white/50 rounded-full transition-all shadow-sm border border-transparent hover:border-gray-200"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleReset}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-white bg-white/50 rounded-full transition-all shadow-sm border border-transparent hover:border-gray-200"
            title="重置畫布"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Upload & Settings */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
              <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              上傳角色圖片
            </h2>
            
            <div 
              className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group
                ${sourceImage ? 'border-orange-200 bg-orange-50' : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              
              {sourceImage ? (
                <img 
                  src={sourceImage} 
                  alt="Uploaded character" 
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="text-gray-600 font-medium text-sm">點擊或拖拽圖片</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Settings Section */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
              <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              幀動畫參數
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">動作提示詞</label>
                <textarea
                  value={config.prompt}
                  onChange={(e) => setConfig({...config, prompt: e.target.value})}
                  placeholder="描述動作，例如：跑步、揮手、跳躍..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none resize-none h-20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex justify-between">
                      幀數 (Frame Count) <span className="text-orange-500 font-bold">{config.frameCount}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-gray-400" />
                      <input 
                        type="range" 
                        min="2" 
                        max="30" 
                        step="1"
                        value={config.frameCount}
                        onChange={(e) => setConfig({...config, frameCount: Number(e.target.value)})}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 text-right">建議 4-12 幀 (上限 30)</div>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 flex justify-between">
                      播放速度 (FPS) <span className="bg-gray-100 px-1.5 rounded text-gray-600">{Math.max(1, config.speed * 2)}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-gray-400" />
                      <input 
                        type="range" 
                        min="1" 
                        max="12" 
                        value={config.speed}
                        onChange={(e) => setConfig({...config, speed: Number(e.target.value)})}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 flex justify-between">
                   預覽縮放 <span className="text-gray-400">{config.scale}%</span>
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="200" 
                  step="10"
                  value={config.scale}
                  onChange={(e) => setConfig({...config, scale: Number(e.target.value)})}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all
                  ${isGenerating 
                    ? 'bg-orange-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 hover:shadow-lg transform hover:-translate-y-0.5'}`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    AI 規劃與繪製 {config.frameCount} 張動作幀...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    開始生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Result Preview */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm p-6 h-full flex flex-col">
            <h2 className="text-sm font-semibold text-gray-500 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                動畫預覽
              </div>
              {generatedFrames.length > 0 && (
                <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
                  Frame {currentFrameIndex + 1} / {generatedFrames.length}
                </span>
              )}
            </h2>
            
            <div className="flex-1 min-h-[400px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
              
              {!isGenerating && generatedFrames.length === 0 && (
                <div className="text-center p-8 opacity-50">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-gray-400 ml-1" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-600">動畫預覽區域</h3>
                  <p className="text-gray-400 mt-2">將生成多張靜態圖並串接播放</p>
                </div>
              )}

              {isGenerating && (
                <div className="text-center z-10">
                   <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                   </div>
                   <h3 className="text-lg font-medium text-gray-800 animate-pulse">正在繪製...</h3>
                   <p className="text-gray-500 mt-2 text-sm">Gemini 正在規劃分鏡並生成每一幀</p>
                </div>
              )}

              {generatedFrames.length > 0 && (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-[url('https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png')] bg-repeat bg-[length:20px_20px] rounded-lg overflow-hidden">
                  
                  {/* The Frame Player */}
                  <img 
                    src={generatedFrames[currentFrameIndex]}
                    alt={`Frame ${currentFrameIndex}`}
                    className="object-contain pixelated transition-none"
                    style={{
                      transform: `scale(${config.scale / 100})`,
                      imageRendering: 'pixelated', // Keep sprites crisp
                      maxHeight: '400px',
                      maxWidth: '100%'
                    }}
                  />

                  {/* Controls Overlay */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                     <button 
                      onClick={handleDownloadApng}
                      disabled={isExporting}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center justify-center gap-2 transition-all backdrop-blur-sm disabled:opacity-70 disabled:cursor-wait"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileVideo className="w-4 h-4" />}
                      下載 APNG (高清)
                    </button>
                    
                    <div className="flex gap-2">
                        <button 
                          onClick={handleDownloadGif}
                          disabled={isExporting}
                          className="flex-1 bg-white/90 hover:bg-white text-gray-800 px-3 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center justify-center gap-2 transition-all backdrop-blur-sm disabled:opacity-70"
                        >
                          <Film className="w-4 h-4 text-purple-600" />
                          GIF
                        </button>
                        <button 
                          onClick={handleDownloadZip}
                          disabled={isExporting}
                          className="flex-1 bg-white/90 hover:bg-white text-gray-800 px-3 py-2 rounded-lg text-sm font-medium shadow-lg flex items-center justify-center gap-2 transition-all backdrop-blur-sm disabled:opacity-70"
                        >
                          <Archive className="w-4 h-4 text-blue-600" />
                          ZIP
                        </button>
                    </div>
                  </div>
                  
                  {/* Frame Strip Preview at bottom */}
                  <div className="absolute bottom-4 left-4 flex gap-1 bg-black/20 p-1 rounded-lg backdrop-blur-sm">
                    {generatedFrames.map((frame, idx) => (
                      <div 
                        key={idx}
                        className={`w-8 h-8 rounded border-2 overflow-hidden cursor-pointer bg-white ${idx === currentFrameIndex ? 'border-orange-500' : 'border-transparent opacity-60'}`}
                        onClick={() => setCurrentFrameIndex(idx)}
                      >
                        <img src={frame} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-gray-400 text-center">
               提示：APNG 支援全彩半透明，GIF 支援 256 色透明。ZIP 包含原始 PNG 序列。
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;