import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, RefreshCw, Wand2, ImageIcon, Download, Loader2, Layers, Zap, FileVideo, Archive, Film, Settings, X, Grid3X3, Film as FilmIcon, Eraser } from './components/Icons';
import { generateAnimationFrames, generateSpriteSheet } from './services/geminiService';
import { AnimationConfig } from './types';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const App: React.FC = () => {
  // Global Settings State
  const [apiKey, setApiKey] = useState('');
  // Default to gemini-2.5-flash-image as requested
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image');
  const [showSettings, setShowSettings] = useState(false);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  
  const [config, setConfig] = useState<AnimationConfig>({
    prompt: '',
    frameCount: 4, // Default to 4 frames for quick sprites
    speed: 5,      // 5 * 2 = 10 FPS default
    scale: 100,
    mode: 'sheet', // Default mode changed to 'sheet'
    gridCols: 3,
    gridRows: 2,
  });
  
  // New: Background removal state
  const [removeBackground, setRemoveBackground] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("AI 正在思考中..."); 
  const [isExporting, setIsExporting] = useState(false);
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [spriteSheetImage, setSpriteSheetImage] = useState<string | null>(null); // New: Store raw sheet
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // Control playback state manually
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationIntervalRef = useRef<number | null>(null);

  // Load settings from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedModel = localStorage.getItem('gemini_model');
    
    if (storedKey) setApiKey(storedKey);
    
    // Validate stored model or force update to the recommended one
    if (storedModel && (storedModel === 'gemini-2.5-flash-image' || storedModel === 'gemini-2.0-flash-exp')) {
      setSelectedModel(storedModel);
    } else {
      // Force default if stored model is old or invalid
      setSelectedModel('gemini-2.5-flash-image');
      localStorage.setItem('gemini_model', 'gemini-2.5-flash-image');
    }

    // If no key is found, show settings automatically
    if (!storedKey && !process.env.API_KEY) {
      setShowSettings(true);
    }
  }, []);

  // Save settings helper
  const saveSettings = (key: string, model: string) => {
    const trimmedKey = key.trim();
    setApiKey(trimmedKey);
    setSelectedModel(model);
    localStorage.setItem('gemini_api_key', trimmedKey);
    localStorage.setItem('gemini_model', model);
    setShowSettings(false);
  };

  // Animation Loop
  useEffect(() => {
    if (generatedFrames.length > 0 && isPlaying) {
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
  }, [generatedFrames, config.speed, isPlaying]);

  // Re-slice when toggle changes or sheet image updates
  useEffect(() => {
    if (spriteSheetImage && config.mode === 'sheet') {
        const reSlice = async () => {
            try {
                const frames = await sliceSpriteSheet(
                    spriteSheetImage, 
                    config.gridCols, 
                    config.gridRows, 
                    removeBackground
                );
                setGeneratedFrames(frames);
            } catch (e) {
                console.error("Re-slice failed", e);
            }
        };
        reSlice();
    }
  }, [removeBackground, spriteSheetImage, config.gridCols, config.gridRows]);

  const handleReset = () => {
    setSourceImage(null);
    setGeneratedFrames([]);
    setSpriteSheetImage(null);
    setError(null);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
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
        setSpriteSheetImage(null);
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
        setSpriteSheetImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Slice a single sprite sheet image into multiple frames.
   * Uses "Strict Grid" logic with floating point precision.
   * This assumes the sprite sheet is perfectly divided into [cols] x [rows].
   */
  const sliceSpriteSheet = async (
      base64Image: string, 
      cols: number, 
      rows: number, 
      removeBg: boolean
  ): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const frames: string[] = [];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (!ctx) {
                reject(new Error("Canvas context failed"));
                return;
            }

            const totalWidth = img.width;
            const totalHeight = img.height;

            // Strict Grid Calculation (Floating Point)
            // This ensures we cover 100% of the image without gaps or drift.
            const cellWidth = totalWidth / cols;
            const cellHeight = totalHeight / rows;

            // Standardize Output Size (Integers)
            // We use floor to ensure we don't accidentally grab a sub-pixel transparent edge from outside bounds.
            const frameWidth = Math.floor(cellWidth);
            const frameHeight = Math.floor(cellHeight);

            canvas.width = frameWidth;
            canvas.height = frameHeight;

            // Optional: Disable smoothing to keep pixel art crisp during the slice copy
            ctx.imageSmoothingEnabled = false;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    ctx.clearRect(0, 0, frameWidth, frameHeight);
                    
                    // Precise Source Coordinates
                    const sx = c * cellWidth;
                    const sy = r * cellHeight;
                    
                    // Draw strict grid cell to canvas
                    // This maps the float source rectangle (sx, sy, cellWidth, cellHeight)
                    // exactly to the integer destination canvas (0, 0, frameWidth, frameHeight).
                    // This handles any sub-pixel scaling automatically.
                    ctx.drawImage(
                        img,
                        sx, sy, cellWidth, cellHeight, 
                        0, 0, frameWidth, frameHeight 
                    );

                    // Background Removal (White Keying)
                    if (removeBg) {
                        const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
                        const data = imageData.data;
                        const threshold = 230; // Threshold for "white"
                        
                        for (let i = 0; i < data.length; i += 4) {
                            const red = data[i];
                            const green = data[i + 1];
                            const blue = data[i + 2];
                            
                            // If pixel is very light (white/near white), make it transparent
                            if (red > threshold && green > threshold && blue > threshold) {
                                data[i + 3] = 0; // Alpha = 0
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }
                    
                    frames.push(canvas.toDataURL('image/png'));
                }
            }
            resolve(frames);
        };
        img.onerror = (e) => reject(e);
        img.src = base64Image;
    });
  };

  const handleGenerate = async () => {
    // Explicitly prefer the user's key state over environment
    const userKey = apiKey.trim();
    const effectiveKey = userKey || process.env.API_KEY;

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
    setSpriteSheetImage(null); // Clear previous
    setIsPlaying(true);
    
    // Strategy Optimization based on 17 RPM (approx 1 req every 3.53s)
    const delayBetweenFrames = userKey ? 2000 : 5000;

    try {
      if (config.mode === 'sheet') {
          setStatusText(`準備生成精靈圖 (使用模型: ${selectedModel})...`);
          
          // 1. Generate single big image
          const sheetImage = await generateSpriteSheet(
              sourceImage,
              config.prompt,
              config.gridCols,
              config.gridRows,
              effectiveKey,
              selectedModel,
              (status) => setStatusText(status)
          );

          setSpriteSheetImage(sheetImage); // Save the raw sheet

          // 2. Slice it (using current removeBackground setting)
          setStatusText("正在裁切網格...");
          const frames = await sliceSpriteSheet(
              sheetImage, 
              config.gridCols, 
              config.gridRows,
              removeBackground
          );
          setGeneratedFrames(frames);

      } else {
          // Frame by Frame mode
          setStatusText(`準備開始逐幀生成 (使用模型: ${selectedModel})`);
          const frames = await generateAnimationFrames(
            sourceImage, 
            config.prompt, 
            config.frameCount,
            effectiveKey,
            selectedModel,
            (status) => setStatusText(status),
            delayBetweenFrames
          );
          setGeneratedFrames(frames);
      }
      
    } catch (err: any) {
      const rawMsg = err.message || "Unknown error";
      let displayMsg = "生成失敗";
      
      if (rawMsg.includes("429") || rawMsg.includes("Quota") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
         displayMsg = "API 請求過於頻繁 (429)。系統正在冷卻中，請稍後再試。";
      } else {
         displayMsg = `生成發生錯誤: ${rawMsg}`;
      }
      
      setError(displayMsg);
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

  const handleDownloadSpriteSheet = () => {
    if (!spriteSheetImage) return;
    const link = document.createElement('a');
    link.href = spriteSheetImage;
    link.download = `sprite_sheet_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleFrameClick = (index: number) => {
    setCurrentFrameIndex(index);
    setIsPlaying(false); // Pause when user manually selects a frame
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
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
            className={`p-2 rounded-full transition-all shadow-sm border border-transparent 
              ${apiKey ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200' : 'text-gray-500 hover:text-gray-800 bg-white/50 hover:bg-white hover:border-gray-200'}`}
            title={apiKey ? "使用自訂 Key" : "使用系統 Key (設定)"}
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

            {/* Mode Switcher */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                  onClick={() => setConfig({...config, mode: 'frame'})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all
                  ${config.mode === 'frame' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <FilmIcon className="w-4 h-4" />
                  逐幀模式
                </button>
                <button 
                  onClick={() => setConfig({...config, mode: 'sheet'})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all
                  ${config.mode === 'sheet' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  精靈圖模式
                </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">動作提示詞</label>
                <textarea
                  value={config.prompt}
                  onChange={(e) => setConfig({...config, prompt: e.target.value})}
                  placeholder="描述連續動作，例如：跑步循環 (Run Cycle)、跳躍 (Jump)、揮劍攻擊 (Sword Attack)..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none resize-none h-20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 
                 {/* Conditionally Render Frame Count OR Grid Controls */}
                 {config.mode === 'frame' ? (
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
                      <div className="text-[10px] text-gray-400 mt-1 text-right">API 請求次數: {config.frameCount}</div>
                   </div>
                 ) : (
                    <>
                       <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 flex justify-between">
                          網格列 (Cols) <span className="text-orange-500 font-bold">{config.gridCols}</span>
                        </label>
                        <input 
                          type="range" 
                          min="2" 
                          max="6" 
                          step="1"
                          value={config.gridCols}
                          onChange={(e) => setConfig({...config, gridCols: Number(e.target.value)})}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                       </div>
                       <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 flex justify-between">
                          網格行 (Rows) <span className="text-orange-500 font-bold">{config.gridRows}</span>
                        </label>
                        <input 
                          type="range" 
                          min="1" 
                          max="4" 
                          step="1"
                          value={config.gridRows}
                          onChange={(e) => setConfig({...config, gridRows: Number(e.target.value)})}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                       </div>
                    </>
                 )}
                 
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

               {/* Hint Text for Modes */}
              {config.mode === 'sheet' && (
                  <div className="space-y-2">
                    <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100 flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        精靈圖模式僅需消耗 1 次 API 請求，大幅節省配額！
                    </div>
                    
                    {/* Background Removal Toggle */}
                    <div className="flex items-center justify-between p-2 rounded border border-gray-100 bg-gray-50">
                        <span className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                            <Eraser className="w-3.5 h-3.5" />
                            去除白色背景
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={removeBackground}
                                onChange={(e) => setRemoveBackground(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                    </div>
                  </div>
              )}

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
                    <span className="truncate max-w-[200px]">{statusText}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    {config.mode === 'sheet' ? '生成精靈圖 (1 Request)' : '開始逐幀生成'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Result Preview */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* New Sprite Sheet Block (Only in Sheet Mode) */}
          {config.mode === 'sheet' && (
            <div className="bg-white rounded-2xl shadow-sm p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">S</span>
                    精靈圖原圖 (Sprite Sheet)
                  </h2>
                  {spriteSheetImage && (
                    <button 
                      onClick={handleDownloadSpriteSheet}
                      className="text-xs flex items-center gap-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition-colors font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下載原圖
                    </button>
                  )}
               </div>

               <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 min-h-[200px] flex items-center justify-center relative overflow-hidden group">
                   
                   {!spriteSheetImage && !isGenerating && (
                      <div className="text-center p-6 opacity-50">
                        <Grid3X3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">生成的網格原圖將顯示於此</p>
                      </div>
                   )}

                   {!spriteSheetImage && isGenerating && (
                      <div className="flex flex-col items-center">
                         <Loader2 className="w-8 h-8 text-orange-400 animate-spin mb-2" />
                         <p className="text-xs text-gray-400">生成中...</p>
                      </div>
                   )}

                   {spriteSheetImage && (
                      <img 
                        src={spriteSheetImage} 
                        alt="Sprite Sheet" 
                        className="max-w-full max-h-[300px] object-contain pixelated shadow-sm rounded-lg"
                      />
                   )}
               </div>
            </div>
          )}

          {/* Existing Animation Preview Block */}
          <div className="bg-white rounded-2xl shadow-sm p-6 flex-1 flex flex-col min-h-[500px]">
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
            
            <div className="flex-1 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group min-h-[300px]"
                 onClick={togglePlay}
                 title="點擊暫停/播放"
            >
              
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
                <div className="text-center z-10 p-6 max-w-sm">
                   <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                   </div>
                   <h3 className="text-lg font-medium text-gray-800 animate-pulse">正在繪製...</h3>
                   <p className="text-gray-500 mt-2 text-sm">{statusText}</p>
                </div>
              )}

              {generatedFrames.length > 0 && (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-[url('https://bg-patterns.com/wp-content/uploads/2021/04/check-pattern-d01.png')] bg-repeat bg-[length:20px_20px] rounded-lg overflow-hidden cursor-pointer">
                  
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

                  {/* Playback Status Icon */}
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                       <div className="bg-black/50 text-white p-3 rounded-full backdrop-blur-sm">
                          <Play className="w-6 h-6 fill-white" />
                       </div>
                    </div>
                  )}

                  {/* Controls Overlay */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
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
                  
                </div>
              )}
            </div>

            {/* Sliced Frames Grid */}
            {generatedFrames.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center justify-between">
                       動作分解 (Extracted Frames)
                       <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">點擊切換</span>
                    </h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {generatedFrames.map((frame, idx) => (
                            <div 
                                key={idx}
                                className={`aspect-square rounded-lg border-2 overflow-hidden cursor-pointer bg-white transition-all hover:scale-105 active:scale-95 shadow-sm
                                    ${idx === currentFrameIndex ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-200 hover:border-orange-300'}`}
                                onClick={() => handleFrameClick(idx)}
                            >
                                <img src={frame} className="w-full h-full object-contain p-1" style={{imageRendering: 'pixelated'}} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 text-xs text-gray-400 text-center">
               提示：點擊上方預覽區可暫停/播放。APNG 支援全彩半透明。
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;