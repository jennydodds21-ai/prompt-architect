import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Copy, 
  Check, 
  RotateCcw, 
  AlertCircle,
  Layout,
  MapPin,
  Activity,
  Smile,
  Palette,
  Camera,
  Sun,
  ShieldAlert,
  Zap
} from 'lucide-react';

/**
 * API Key Handling:
 * We use a try-catch block to safely access environment variables in different build targets.
 * On Vercel, this will pull from the Environment Variables you set in the dashboard.
 */
let apiKey = "";
try {
  apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
} catch (e) {
  apiKey = ""; 
}

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const App = () => {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Categories defined by the user
  const categories = [
    { id: 'subject', label: 'Subject', icon: ImageIcon, color: 'text-blue-500' },
    { id: 'location', label: 'Location', icon: MapPin, color: 'text-emerald-500' },
    { id: 'action', label: 'Action', icon: Activity, color: 'text-orange-500' },
    { id: 'mood', label: 'Mood', icon: Smile, color: 'text-purple-500' },
    { id: 'style', label: 'Style', icon: Palette, color: 'text-pink-500' },
    { id: 'composition', label: 'Composition', icon: Layout, color: 'text-indigo-500' },
    { id: 'lighting', label: 'Lighting & Color', icon: Sun, color: 'text-yellow-500' },
    { id: 'quality', label: 'Quality & Realism', icon: Camera, color: 'text-cyan-500' },
    { id: 'negative', label: 'Negative Constraints', icon: ShieldAlert, color: 'text-red-500' },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setError("Please upload a valid image file.");
      return;
    }
    setError(null);
    setResults(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      setImage(reader.result.split(',')[1]); // Base64 part
    };
    reader.readAsDataURL(file);
  };

  const fetchWithRetry = async (url, options, maxRetries = 5) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return await response.json();
        if (response.status === 429 || response.status >= 500) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`API Error: ${response.status}`);
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    // Safety check for API key
    if (!apiKey && typeof __firebase_config === 'undefined') {
      setError("API Key missing. Ensure VITE_GEMINI_API_KEY is set in Vercel Environment Variables.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const systemPrompt = `You are an expert prompt engineer for advanced image generation models. 
    Analyze the provided image and provide a JSON response breaking it down into these exact categories:
    1. subject: Specific details about the main anchor.
    2. location: Where the scene takes place.
    3. action: What is happening.
    4. mood: Emotional tone and implied narrative.
    5. style: Overall aesthetic, medium, and era.
    6. composition: Framing and camera angles.
    7. lighting: Lighting setup and color palette.
    8. quality: Sharpness, fidelity, and realism level.
    9. negative: Elements to avoid (common failures, artifacts).
    10. master_prompt: A synthesized, high-quality prompt that combines all elements into a cohesive instruction.
    
    Ensure the JSON is valid and strictly follows the keys above.`;

    const userQuery = "Please analyze this image based on the framework provided and generate a master prompt.";

    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: userQuery },
                { inlineData: { mimeType: "image/png", data: image } }
              ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  subject: { type: "string" },
                  location: { type: "string" },
                  action: { type: "string" },
                  mood: { type: "string" },
                  style: { type: "string" },
                  composition: { type: "string" },
                  lighting: { type: "string" },
                  quality: { type: "string" },
                  negative: { type: "string" },
                  master_prompt: { type: "string" }
                },
                required: ["subject", "location", "action", "mood", "style", "composition", "lighting", "quality", "negative", "master_prompt"]
              }
            }
          })
        }
      );

      const data = JSON.parse(result.candidates[0].content.parts[0].text);
      setResults(data);
    } catch (err) {
      setError("Analysis failed. Please try again later.");
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setImage(null);
    setPreviewUrl(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <Zap className="text-yellow-500 fill-yellow-500" size={32} />
              Prompt Architect
            </h1>
            <p className="text-slate-500 mt-1 text-lg">Deconstruct visuals into refined AI prompts.</p>
          </div>
          {results && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm transition-all"
            >
              <RotateCcw size={16} />
              Start New Analysis
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Upload & Preview */}
          <div className="lg:col-span-5 space-y-6">
            <div 
              className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all bg-white shadow-sm ${
                !previewUrl ? 'border-slate-300 hover:border-blue-400 p-12 cursor-pointer' : 'border-transparent p-0'
              }`}
              onClick={() => !previewUrl && fileInputRef.current.click()}
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept="image/*"
              />
              
              {!previewUrl ? (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Drop your image here</h3>
                  <p className="text-slate-400 text-sm">PNG, JPG, or WEBP (Max 10MB)</p>
                </div>
              ) : (
                <div className="relative group">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-auto block rounded-2xl object-cover max-h-[600px]"
                  />
                  {!results && !analyzing && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
                        className="bg-white text-slate-900 px-4 py-2 rounded-full font-medium shadow-lg hover:bg-slate-50 flex items-center gap-2"
                      >
                        <ImageIcon size={18} />
                        Change Image
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {previewUrl && !results && (
              <button
                onClick={analyzeImage}
                disabled={analyzing}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
              >
                {analyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing Visuals...
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    Deconstruct Image
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Breakdown & Master Prompt */}
          <div className="lg:col-span-7 space-y-6">
            {analyzing ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-32 bg-slate-200 rounded-2xl w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-200 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : results ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Master Prompt Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-200 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles size={20} className="text-yellow-300 fill-yellow-300" />
                      Refined Master Prompt
                    </h3>
                    <button 
                      onClick={() => copyToClipboard(results.master_prompt)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={20} className="text-green-300" /> : <Copy size={20} />}
                    </button>
                  </div>
                  <p className="text-lg leading-relaxed font-medium text-blue-50">
                    {results.master_prompt}
                  </p>
                </div>

                {/* Categorized Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const content = results[cat.id];
                    return (
                      <div key={cat.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg bg-slate-50 ${cat.color} group-hover:scale-110 transition-transform`}>
                            <Icon size={20} />
                          </div>
                          <h4 className="font-bold text-slate-800">{cat.label}</h4>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {content || "No specific details identified."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                  <Sparkles size={32} className="text-slate-300" />
                </div>
                <p className="text-center max-w-xs font-medium">
                  Upload an image on the left to begin the architectural deconstruction.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer info */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
            Optimized for <strong>Gemini 2.5</strong> &bull; Framework Version 1.0
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
