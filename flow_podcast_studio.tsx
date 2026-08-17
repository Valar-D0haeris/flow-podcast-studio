import React, { useState, useEffect, useRef } from 'react';
import { 
    Play, Pause, Download, Clock, FileText, Loader2, AlertCircle, Volume2, VolumeX, 
    Trash2, User, Wand2, RefreshCw, Edit3, MessageSquare, Key, Sparkles, Copy, 
    Upload, Check, RotateCcw, FastForward, Settings, HelpCircle, X, Cpu,
    Activity, CheckCircle2, XCircle, AlertTriangle, Gauge, Zap, ShieldCheck,
    PauseOctagon, PlaySquare, StopCircle, AlertOctagon, Sliders, Shield
} from 'lucide-react';

const DEFAULT_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";

const GEMINI_VOICES = [
    { id: 'Puck', name: 'Puck (Grave & Chaleureux)', style: 'Masculin - Chaleureux' },
    { id: 'Charon', name: 'Charon (Posé & Professionnel)', style: 'Masculin - Professionnel' },
    { id: 'Fenrir', name: 'Fenrir (Dynamique & Enthousiaste)', style: 'Masculin - Énergique' },
    { id: 'Aoede', name: 'Aoede (Doux & Narration)', style: 'Féminin - Narration' },
    { id: 'Kore', name: 'Kore (Clair & Énergique)', style: 'Féminin - Enthousiaste' },
    { id: 'Puma', name: 'Puma (Affirmé & Direct)', style: 'Féminin - Direct' },
    { id: 'Zephyr', name: 'Zephyr (Lumineux & Naturel)', style: 'Masculin - Expressif' },
    { id: 'Leda', name: 'Leda (Jeune & Doux)', style: 'Féminin - Doux' },
    { id: 'Encelade', name: 'Encelade (Intime & Calme)', style: 'Masculin - Calme' },
    { id: 'Algieba', name: 'Algieba (Fluide & Élégant)', style: 'Féminin - Élégant' }
];

const GEMINI_MODELS = [
    { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS', category: 'TTS Dédié', tag: 'Recommandé v3.1' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash TTS', category: 'TTS Dédié', tag: 'Flash TTS' },
    { id: 'gemini-2.5-pro-preview-tts', name: 'Gemini 2.5 Pro TTS', category: 'TTS Dédié', tag: 'Pro TTS' }
];

const TEMPLATES = [
    {
        id: 'tech_ai',
        title: '🤖 Débat IA & Futurs',
        description: 'Discussion passionnante sur la conscience des IA.',
        script: `Léo : Bienvenue dans Flow Podcast ! Aujourd'hui, on se pose une question captivante : l'intelligence artificielle peut-elle développer une forme de créativité authentique ?
Maya : Salut Léo ! C'est un sujet fascinant. Les algorithmes génératifs combinent des milliards de motifs appris pour composer de nouvelles idées, mais créent-ils avec une réelle intention ?
Léo : Exactement. Il y a une nuance fondamentale entre combiner des données et ressentir une émotion créative.
Maya : Tout à fait ! Mais pour l'utilisateur final, le résultat artistique est souvent bluffant.`
    },
    {
        id: 'space_science',
        title: '🌌 L\'Énigme de Mars',
        description: 'Exploration scientifique sur la planète rouge.',
        script: `Prof. Astro : Avez-vous déjà imaginé ce que nous découvririons sous la surface glacée de Mars ?
Élodie : Les récentes analyses radar suggèrent la présence de poches d'eau liquide sous la calotte polaire !
Prof. Astro : En effet Élodie. Et là où l'eau persiste, la possibilité d'une vie microbienne fossile devient une hypothèse captivante.
Élodie : C'est le Graal absolu pour les prochaines missions d'exploration spatiale.`
    },
    {
        id: 'business_startup',
        title: '💡 Pitch Startup',
        description: 'Échange entre un investisseur et un fondateur.',
        script: `Sophie : Thomas, expliquez-nous votre vision pour révolutionner le domaine des contenus audio.
Thomas : Bonjour Sophie. Nous permettons aux créateurs de transformer n'importe quel texte en podcast studio réaliste à deux voix en quelques secondes.
Sophie : Très prometteur ! Comment assurez-vous la naturalité des intonations et le respect des personnages ?
Thomas : Grâce aux modèles Gemini TTS et à une personnalisation fine des voix et du ton de chaque intervenant.`
    }
];

const base64ToArrayBuffer = (base64) => {
    const cleanBase64 = base64.replace(/[\r\n\s]/g, '');
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const buildWavHeader = (mergedPcm, sampleRate = 24000) => {
    const wavBuffer = new ArrayBuffer(44 + mergedPcm.byteLength);
    const view = new DataView(wavBuffer);
    
    const writeString = (v, off, str) => {
        for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + mergedPcm.byteLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true); 
    view.setUint32(28, sampleRate * 2, true); 
    view.setUint16(32, 2, true); 
    view.setUint16(34, 16, true); 
    writeString(view, 36, 'data');
    view.setUint32(40, mergedPcm.byteLength, true);

    const audioDataView = new Int16Array(wavBuffer, 44);
    audioDataView.set(mergedPcm);
    
    return wavBuffer;
};

// Custom Audio Player Component
const AudioPlayer = ({ src, onDownload }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration || 0);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (e) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        if (audioRef.current) {
            audioRef.current.volume = newVol;
            setIsMuted(newVol === 0);
        }
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        if (isMuted) {
            audioRef.current.volume = volume || 1;
            setIsMuted(false);
        } else {
            audioRef.current.volume = 0;
            setIsMuted(true);
        }
    };

    const skipTime = (seconds) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
        }
    };

    const formatTime = (timeInSec) => {
        if (isNaN(timeInSec)) return '00:00';
        const mins = Math.floor(timeInSec / 60);
        const secs = Math.floor(timeInSec % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-[#1e1e22] border border-indigo-500/30 p-5 rounded-2xl flex flex-col gap-4 shadow-xl animate-in fade-in slide-in-from-bottom-3">
            <audio ref={audioRef} src={src} preload="metadata" />
            
            {/* Header info & Wave visualizer */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white">Podcast Studio - Rendu Audio</h4>
                        <p className="text-xs text-zinc-400 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</p>
                    </div>
                </div>

                {/* Animated Waveform Visualizer */}
                <div className="flex items-end gap-1 h-6 px-2">
                    {[40, 70, 30, 90, 60, 100, 50, 80, 40, 60, 85, 45].map((h, i) => (
                        <div 
                            key={i} 
                            className={`w-1 bg-indigo-500/80 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : 'opacity-30'}`} 
                            style={{ height: isPlaying ? `${Math.max(15, (h * ((i % 3) + 1)) % 100)}%` : '20%' }}
                        />
                    ))}
                </div>
            </div>

            {/* Seek Bar */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 min-w-[38px]">{formatTime(currentTime)}</span>
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={handleSeek} 
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
                <span className="text-xs font-mono text-zinc-400 min-w-[38px]">{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => skipTime(-10)} 
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        title="Reculer de 10s"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    
                    <button 
                        onClick={togglePlay} 
                        className="w-11 h-11 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>

                    <button 
                        onClick={() => skipTime(10)} 
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        title="Avancer de 10s"
                    >
                        <FastForward className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-3 py-1.5 rounded-lg">
                        <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={isMuted ? 0 : volume} 
                            onChange={handleVolumeChange} 
                            className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    <button 
                        onClick={onDownload}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exporter (.WAV)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [script, setScript] = useState("");
    const [viewMode, setViewMode] = useState("editor"); // "editor" or "preview"
    
    // API Key State & Storage
    const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('flow_gemini_api_key') || "");
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('flow_gemini_model') || "gemini-3.1-flash-tts-preview");
    const [showKeySettings, setShowKeySettings] = useState(false);
    
    // Quota Checker State
    const [quotaStatuses, setQuotaStatuses] = useState<Record<string, { status: string, message?: string }>>({});
    const [isCheckingQuota, setIsCheckingQuota] = useState(false);
    
    // Anti-Quota Guardrail Settings for 30+ Min Podcasts
    const [antiQuotaMode, setAntiQuotaMode] = useState(true);
    const [chunkSizeLimit, setChunkSizeLimit] = useState(1200); // 1200 chars max per segment
    const [safetyDelayMs, setSafetyDelayMs] = useState(3000); // 3 sec delay between segments
    
    // Generation Control States
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const isCancelledRef = useRef(false);
    const [partialAudioUrl, setPartialAudioUrl] = useState(null);
    
    // Character Detection State
    const [characters, setCharacters] = useState<string[]>([]);
    
    // Character configurations
    const [voiceConfigs, setVoiceConfigs] = useState<Record<string, { voice: string, prompt: string }>>({});

    // Generation State
    const [progressStats, setProgressStats] = useState({ status: '', percent: 0, currentChunk: 0, totalChunks: 0 });
    const [errorMsg, setErrorMsg] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    
    // Preview Audio State
    const [previewingChar, setPreviewingChar] = useState(null);
    const [copied, setCopied] = useState(false);
    const [isFormatting, setIsFormatting] = useState(false);

    const activeApiKey = userApiKey.trim() || DEFAULT_API_KEY;

    // Fixed & Enhanced Unicode Regex for Speaker Parsing (Supports Accents like Léo, Élodie, Benoît, etc.)
    const parseScriptToBlocks = (text) => {
        if (!text) return { blocks: [], detectedChars: [] };
        
        const blocks = [];
        const foundSpeakers = new Set();
        const lines = text.split('\n');
        
        let currentSpeaker = null;
        let currentText = [];

        // Unicode regex for character/speaker matching
        const regex = /^([\p{L}\p{N}\s_\-\.']+)\s*:/u;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                if (currentSpeaker && currentText.length > 0) {
                    blocks.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
                }
                currentSpeaker = match[1].trim();
                foundSpeakers.add(currentSpeaker);
                currentText = [line.substring(match[0].length).trim()];
            } else if (line.trim().length > 0) {
                if (currentSpeaker) {
                    currentText.push(line.trim());
                } else {
                    currentSpeaker = "Intervenant 1";
                    foundSpeakers.add(currentSpeaker);
                    currentText.push(line.trim());
                }
            }
        }
        
        if (currentSpeaker && currentText.length > 0) {
            blocks.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
        }

        const detectedArray: string[] = Array.from(foundSpeakers) as string[];
        if (detectedArray.length === 0 && text.trim().length > 0) {
            detectedArray.push("Intervenant 1", "Intervenant 2");
        } else if (detectedArray.length === 1) {
            detectedArray.push("Intervenant 2");
        }

        return { blocks, detectedChars: detectedArray }; 
    };

    useEffect(() => {
        const { detectedChars } = parseScriptToBlocks(script);
        setCharacters(detectedChars);
        
        setVoiceConfigs(prev => {
            const newConfigs = { ...prev };
            let updated = false;
            detectedChars.forEach((char: string, index: number) => {
                if (!newConfigs[char]) {
                    newConfigs[char] = {
                        voice: GEMINI_VOICES[index % GEMINI_VOICES.length].id,
                        prompt: ''
                    };
                    updated = true;
                }
            });
            return updated ? newConfigs : prev;
        });
    }, [script]);

    const estimateDuration = (text) => {
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const seconds = Math.round((words / 130) * 60);
        return { words, minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
    };
    
    const stats = estimateDuration(script);

    const handleSaveApiKey = (key) => {
        setUserApiKey(key);
        localStorage.setItem('flow_gemini_api_key', key);
    };

    const handleSaveModel = (modelId) => {
        setSelectedModel(modelId);
        localStorage.setItem('flow_gemini_model', modelId);
    };

    const runQuotaCheck = async () => {
        setIsCheckingQuota(true);
        const initialStatuses = {};
        GEMINI_MODELS.forEach(m => { initialStatuses[m.id] = { status: 'checking' }; });
        setQuotaStatuses(initialStatuses);

        for (const model of GEMINI_MODELS) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${activeApiKey}`;
                const payload = {
                    contents: [{ parts: [{ text: "Ping test" }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
                    }
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    setQuotaStatuses(prev => ({ ...prev, [model.id]: { status: 'ok', message: '🟢 Disponible (200 OK)' } }));
                } else if (res.status === 429) {
                    setQuotaStatuses(prev => ({ ...prev, [model.id]: { status: 'quota', message: '🟡 Quota Atteint (429 Rate Limit)' } }));
                } else if (res.status === 404) {
                    setQuotaStatuses(prev => ({ ...prev, [model.id]: { status: 'unavailable', message: '⚪ Endpoint TTS non disponible' } }));
                } else {
                    const errData = await res.json().catch(() => ({}));
                    setQuotaStatuses(prev => ({ ...prev, [model.id]: { status: 'error', message: `🔴 Erreur ${res.status}: ${errData?.error?.message || 'Accès refusé'}` } }));
                }
            } catch (err) {
                setQuotaStatuses(prev => ({ ...prev, [model.id]: { status: 'error', message: `🔴 Erreur réseau` } }));
            }
        }
        setIsCheckingQuota(false);
    };

    // Resolve locked voice name for a character
    const getLockedVoice = (character: string): string => {
        const charLower = character.toLowerCase();
        if (charLower.includes('maya') || character === characters[0]) return 'Aoede';
        if (charLower.includes('leo') || character === characters[1]) return 'Puck';
        const config = voiceConfigs[character];
        return config ? config.voice : GEMINI_VOICES[0].id;
    };

    // Build systemInstruction text combining both speaker personas
    const buildSystemInstruction = (): string => {
        return [
            "You are narrating a podcast with two hosts.",
            "Speaker 1 is Maya: a warm, steady, and clear podcast host speaking conversational English. Keep her tone natural, calm, and educational. Do not exaggerate emotions.",
            "Speaker 2 is Leo: a friendly, dynamic, and casual podcast co-host speaking conversational English with natural energy. Keep it engaging and grounded.",
            "Read the dialogue naturally in its original language, maintaining authentic conversational pacing, subtle emotions, and natural breathing pauses."
        ].join('\n');
    };

    // Single-speaker TTS for voice preview tests
    const callGeminiSingleTTS = async (character: string, textToSpeak: string, targetModel = selectedModel) => {
        const voiceName = getLockedVoice(character);
        const charLower = character.toLowerCase();
        let sysText = "Read naturally.";
        if (charLower.includes('maya') || character === characters[0]) {
            sysText = "You are Maya, a warm, steady, and clear podcast host speaking conversational English. Keep your tone natural, calm, and educational. Do not exaggerate emotions.";
        } else if (charLower.includes('leo') || character === characters[1]) {
            sysText = "You are Leo, a friendly, dynamic, and casual podcast co-host speaking conversational English with natural energy. Keep it engaging and grounded.";
        }

        const payload = {
            contents: [{ parts: [{ text: textToSpeak }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            },
            systemInstruction: { parts: [{ text: sysText }] }
        };

        const urlModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;
        const url = `https://generativelanguage.googleapis.com/v1beta/${urlModel}:generateContent?key=${activeApiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Erreur API (${response.status}): ${errData?.error?.message || 'Erreur lors de la communication avec Gemini'}`);
        }

        const data = await response.json();
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) throw new Error("L'API Gemini n'a pas retourné d'audio valide.");
        return base64ToArrayBuffer(audioBase64);
    };

    // Smart chunk TTS: multi-speaker with locked voices + systemInstruction
    const callGeminiChunkTTS = async (chunkBlocks: {speaker: string; text: string}[], allDetected: string[], targetModel = selectedModel) => {
        const chunkText = chunkBlocks.map(b => `${b.speaker}: ${b.text}`).join('\n');

        // Collect unique speakers in this chunk
        const uniqueSpeakers = [...new Set(chunkBlocks.map(b => b.speaker))];
        // Ensure we always have at least 2 speakers for multiSpeakerVoiceConfig
        let finalSpeakers = [...uniqueSpeakers];
        if (finalSpeakers.length < 2) {
            const missing = allDetected.find(s => !finalSpeakers.includes(s));
            if (missing) finalSpeakers.push(missing);
            else finalSpeakers.push(finalSpeakers[0] === (characters[0] || 'Maya') ? (characters[1] || 'Leo') : (characters[0] || 'Maya'));
        }
        finalSpeakers = finalSpeakers.slice(0, 2);

        const speakerVoiceConfigs = finalSpeakers.map(speaker => ({
            speaker,
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName: getLockedVoice(speaker)
                }
            }
        }));

        const promptText = `Read the following dialogue naturally in its original language, acting out the roles with authentic emotions and natural conversational pacing:\n\nDialogue:\n${chunkText}`;

        const payload = {
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs
                    }
                }
            },
            systemInstruction: {
                parts: [{ text: buildSystemInstruction() }]
            }
        };

        const urlModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;
        const url = `https://generativelanguage.googleapis.com/v1beta/${urlModel}:generateContent?key=${activeApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Erreur API (${response.status}): ${errData?.error?.message || 'Erreur lors de la communication avec Gemini'}`);
        }

        const data = await response.json();
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) throw new Error("L'API Gemini n'a pas retourné de contenu audio valide.");
        return base64ToArrayBuffer(audioBase64);
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleTestVoice = async (character) => {
        if (previewingChar) return;
        setPreviewingChar(character);
        setErrorMsg(null);
        
        try {
            const audioBuffer = await callGeminiSingleTTS(character, `Bonjour, ceci est un test de la voix de ${character}.`);
            const pcmBytes = Math.floor(audioBuffer.byteLength / 2) * 2;
            const int16View = new Int16Array(audioBuffer, 0, pcmBytes / 2);
            
            const wavBuffer = buildWavHeader(int16View);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            const audio = new Audio(url);
            audio.onended = () => {
                setPreviewingChar(null);
                URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                setErrorMsg("Erreur lors de la lecture audio.");
                setPreviewingChar(null);
                URL.revokeObjectURL(url);
            };
            audio.play();
            
        } catch (err) {
            setErrorMsg(`Erreur Test Voix: ${err.message}`);
            setPreviewingChar(null);
        }
    };

    const togglePauseGeneration = () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        isPausedRef.current = nextState;
    };

    const cancelGeneration = () => {
        isCancelledRef.current = true;
        setIsGenerating(false);
        setIsPaused(false);
        isPausedRef.current = false;
        setProgressStats({ status: 'Génération annulée.', percent: 0, currentChunk: 0, totalChunks: 0 });
    };

    const buildWavBlobFromBuffers = (audioBuffers) => {
        const validBuffers = audioBuffers.filter(Boolean);
        if (validBuffers.length === 0) return null;

        const viewArrays = [];
        const SILENCE_MS = 300;
        const silenceSamples = Math.floor((24000 * SILENCE_MS) / 1000);
        const silenceBuffer = new Int16Array(silenceSamples);

        let totalSamples = 0;
        for (let i = 0; i < validBuffers.length; i++) {
            const buf = validBuffers[i];
            const pcmBytes = Math.floor(buf.byteLength / 2) * 2;
            const int16View = new Int16Array(buf, 0, pcmBytes / 2);
            viewArrays.push(int16View);
            totalSamples += int16View.length;
            if (i < validBuffers.length - 1) {
                totalSamples += silenceSamples;
            }
        }

        const mergedPcm = new Int16Array(totalSamples);
        let offset = 0;
        for (let i = 0; i < viewArrays.length; i++) {
            mergedPcm.set(viewArrays[i], offset);
            offset += viewArrays[i].length;
            if (i < viewArrays.length - 1) {
                mergedPcm.set(silenceBuffer, offset);
                offset += silenceSamples;
            }
        }

        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const dataSize = mergedPcm.length * 2;
        const chunkSize = 36 + dataSize;

        const wavHeader = new ArrayBuffer(44);
        const headerView = new DataView(wavHeader);

        const writeString = (v, off, str) => {
            for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
        };

        writeString(headerView, 0, 'RIFF');
        headerView.setUint32(4, chunkSize, true);
        writeString(headerView, 8, 'WAVE');
        writeString(headerView, 12, 'fmt ');
        headerView.setUint32(16, 16, true);
        headerView.setUint16(20, 1, true);
        headerView.setUint16(22, numChannels, true);
        headerView.setUint32(24, sampleRate, true);
        headerView.setUint32(28, byteRate, true);
        headerView.setUint16(32, blockAlign, true);
        headerView.setUint16(34, bitsPerSample, true);
        writeString(headerView, 36, 'data');
        headerView.setUint32(40, dataSize, true);

        const wavBlob = new Blob([wavHeader, mergedPcm], { type: 'audio/wav' });
        return URL.createObjectURL(wavBlob);
    };

    const handleGenerate = async () => {
        if (script.trim().length === 0) return;
        
        setIsGenerating(true);
        setIsPaused(false);
        isPausedRef.current = false;
        isCancelledRef.current = false;
        setErrorMsg(null);
        
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        if (partialAudioUrl) {
            URL.revokeObjectURL(partialAudioUrl);
            setPartialAudioUrl(null);
        }
        
        const { blocks, detectedChars } = parseScriptToBlocks(script);
        
        // ── Smart Chunking Engine ──
        // Group consecutive blocks into chunks of ~2500-3500 characters.
        // Never split mid-sentence. Reduces a 32-min script from ~100 API calls down to 8-12.
        const CHUNK_TARGET = 3000; // target chars per chunk
        const CHUNK_MAX    = 3500; // hard max
        const chunks: {speaker: string; text: string}[][] = [];
        let currentChunk: {speaker: string; text: string}[] = [];
        let currentLen = 0;

        for (const block of blocks) {
            const blockLen = `${block.speaker}: ${block.text}\n`.length;
            // If adding this block would exceed the hard max AND we already have content, flush
            if (currentLen + blockLen > CHUNK_MAX && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [block];
                currentLen = blockLen;
            } else {
                currentChunk.push(block);
                currentLen += blockLen;
                // If we've passed the target, flush on the next iteration
                if (currentLen >= CHUNK_TARGET) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentLen = 0;
                }
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        setProgressStats({ status: `Initialisation du studio (${chunks.length} segments optimisés)...`, percent: 5, currentChunk: 0, totalChunks: chunks.length });
        
        const audioBuffers = new Array(chunks.length);

        try {
            for (let idx = 0; idx < chunks.length; idx++) {
                if (isCancelledRef.current) break;

                // Handle Pause
                while (isPausedRef.current) {
                    setProgressStats(prev => ({ ...prev, status: '⏸️ Génération en pause (Anti-Quota)...' }));
                    await sleep(1000);
                    if (isCancelledRef.current) break;
                }
                if (isCancelledRef.current) break;

                const chunk = chunks[idx];

                let success = false;
                let retries = 0;
                const modelsToTry = [selectedModel, ...GEMINI_MODELS.map(m => m.id).filter(id => id !== selectedModel)];
                let modelIdx = 0;

                while (!success && retries < 5) {
                    if (isCancelledRef.current) break;
                    
                    const currentTargetModel = modelsToTry[modelIdx % modelsToTry.length];
                    
                    try {
                        const chunkChars = chunk.reduce((sum, b) => sum + b.text.length, 0);
                        setProgressStats({
                            status: `🎙️ Generating audio batch ${idx + 1} of ${chunks.length} (~${chunkChars} chars, model: ${currentTargetModel})...`,
                            percent: 10 + Math.floor((idx / chunks.length) * 80),
                            currentChunk: idx + 1,
                            totalChunks: chunks.length
                        });

                        const audioData = await callGeminiChunkTTS(chunk, detectedChars, currentTargetModel);
                        audioBuffers[idx] = audioData;
                        success = true;
                        
                        // Update partial audio URL for safety
                        const currentPartialUrl = buildWavBlobFromBuffers(audioBuffers);
                        if (currentPartialUrl) setPartialAudioUrl(currentPartialUrl);

                        // Anti-Quota Delay between chunks (Default: 3.5s)
                        if (antiQuotaMode && idx < chunks.length - 1) {
                            const delaySec = (safetyDelayMs / 1000).toFixed(1);
                            for (let countdown = Math.ceil(safetyDelayMs / 1000); countdown > 0; countdown--) {
                                if (isCancelledRef.current || isPausedRef.current) break;
                                setProgressStats(prev => ({ 
                                    ...prev, 
                                    status: `🛡️ Pause Anti-Quota (${countdown}s avant segment ${idx + 2}/${chunks.length})...`
                                }));
                                await sleep(1000);
                            }
                        }
                    } catch (err) {
                        const is429 = err.message.includes("429") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("503");
                        if (is429) {
                            retries++;
                            modelIdx++; // Auto-rotate model on 429
                            const backoffSec = Math.min(30, Math.pow(2, retries) * 3 + Math.floor(Math.random() * 2));
                            setProgressStats(prev => ({ 
                                ...prev, 
                                status: `⚠️ Quota 429 atteint sur segment ${idx + 1} - Attente de ${backoffSec}s puis bascule modèle...`
                            }));
                            await sleep(backoffSec * 1000);
                        } else {
                            throw err;
                        }
                    }
                }

                if (!success && !isCancelledRef.current) {
                    throw new Error(`Échec de la génération sur le segment ${idx + 1} après 5 tentatives.`);
                }
            }

            if (!isCancelledRef.current) {
                setProgressStats({ status: 'Assemblage final du podcast WAV...', percent: 95, currentChunk: chunks.length, totalChunks: chunks.length });
                const finalUrl = buildWavBlobFromBuffers(audioBuffers);
                if (finalUrl) {
                    setAudioUrl(finalUrl);
                    setViewMode("preview");
                }
            }
        } catch (err) {
            console.error("Erreur de génération :", err);
            setErrorMsg(err.message || "Une erreur est survenue lors de la génération.");
            // Keep partial audio URL available if generated
            const fallbackPartial = buildWavBlobFromBuffers(audioBuffers);
            if (fallbackPartial) setPartialAudioUrl(fallbackPartial);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyScript = () => {
        if (!script) return;
        navigator.clipboard.writeText(script);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFormatScript = async () => {
        if (!script.trim() || isFormatting) return;
        setIsFormatting(true);
        setErrorMsg(null);

        const systemPrompt = `You are a strict script formatting assistant for a TTS engine. The user will provide a raw or messy podcast transcript. Your ONLY job is to format it perfectly.
Rules:
1. Every single spoken line MUST begin with either 'Speaker 1:' (Maya, the female host) or 'Speaker 2:' (Leo, the male host).
2. Fix any missing, misspelled, or reversed speaker tags based on the context of the conversation.
3. Remove any timestamps (e.g., [00:15]) or unnecessary stage directions, BUT keep small emotion tags like (Rire) or (Sourire) as they help the TTS intonation.
4. Output ONLY the cleaned script. Do not add conversational filler like 'Here is your script'.`;

        const payload = {
            contents: [{ parts: [{ text: script }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        try {
            const textModel = 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${activeApiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`Erreur API (${response.status}): ${errData?.error?.message || 'Impossible de formater le script.'}`);
            }

            const data = await response.json();
            const formattedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!formattedText) throw new Error("L'IA n'a pas retourné de texte formaté.");
            setScript(formattedText.trim());
        } catch (err) {
            setErrorMsg(`Erreur Auto-Format: ${err.message}`);
        } finally {
            setIsFormatting(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                setScript(content);
                setViewMode("editor");
            }
        };
        reader.readAsText(file);
    };

    const handleDownloadWav = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `Flow_Podcast_Export.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="min-h-screen bg-[#111113] text-zinc-300 font-sans p-4 md:p-8 flex justify-center selection:bg-indigo-500/30">
            <div className="w-full max-w-3xl flex flex-col gap-6 pb-20">
                
                {/* BRANDING & HEADER BAR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Wand2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                Flow Podcast <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Studio Pro</span>
                            </h1>
                            <p className="text-xs text-zinc-500">Générez des podcasts audio avec l'IA Gemini TTS</p>
                        </div>
                    </div>

                    {/* API KEY & MODEL CONFIG BADGES */}
                    <div className="flex items-center gap-2">
                        {/* Model Selector Dropdown */}
                        <div className="flex items-center gap-1.5 bg-[#1a1a1c] border border-zinc-800 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <input 
                                type="text"
                                list="gemini-models-list"
                                value={selectedModel}
                                onChange={(e) => handleSaveModel(e.target.value)}
                                className="bg-transparent text-xs text-zinc-200 focus:outline-none placeholder-zinc-600 w-40"
                                placeholder="ex: models/gemini-..."
                            />
                            <datalist id="gemini-models-list">
                                {GEMINI_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </datalist>
                        </div>

                        <button 
                            onClick={() => setShowKeySettings(!showKeySettings)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${userApiKey ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white'}`}
                        >
                            <Key className="w-3.5 h-3.5" />
                            {userApiKey ? 'Clé Personnalisée' : 'Clé Démo'}
                        </button>
                    </div>
                </div>

                {/* API KEY SETTINGS MODAL / PANEL */}
                {showKeySettings && (
                    <div className="bg-[#1a1a1c] border border-indigo-500/30 p-4 rounded-xl flex flex-col gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white flex items-center gap-2">
                                <Key className="w-4 h-4 text-indigo-400" />
                                Clé API Google Gemini
                            </span>
                            <span className="text-[11px] text-zinc-500">Stockée localement</span>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="password" 
                                value={userApiKey} 
                                onChange={(e) => handleSaveApiKey(e.target.value)}
                                placeholder="Collez votre clé API Gemini (AI Studio)..."
                                className="w-full bg-[#111113] border border-zinc-800 text-xs rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            {userApiKey && (
                                <button 
                                    onClick={() => handleSaveApiKey("")}
                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors flex-shrink-0"
                                >
                                    Réinitialiser
                                </button>
                            )}
                        </div>

                        {/* QUOTA CHECKER PANEL */}
                        <div className="mt-2 border-t border-zinc-800/80 pt-3 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                    Statut des Quotas (3 Modèles TTS Officiels)
                                </span>
                                <button 
                                    onClick={runQuotaCheck}
                                    disabled={isCheckingQuota}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg transition-colors disabled:opacity-50 font-medium"
                                >
                                    {isCheckingQuota ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
                                    {isCheckingQuota ? "Vérification..." : "Tester les Quotas API"}
                                </button>
                            </div>

                            {/* QUOTA RESULTS GRID */}
                            {Object.keys(quotaStatuses).length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                    {GEMINI_MODELS.map(m => {
                                        const q = quotaStatuses[m.id];
                                        if (!q) return null;
                                        return (
                                            <div 
                                                key={m.id}
                                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                                                    q.status === 'ok' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' :
                                                    q.status === 'quota' ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' :
                                                    q.status === 'checking' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' :
                                                    'bg-zinc-900/50 border-zinc-800/50 text-zinc-500'
                                                }`}
                                            >
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                                                        {q.status === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0" />}
                                                        {q.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                                        {q.status === 'quota' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                                                        {(q.status === 'error' || q.status === 'unavailable') && <XCircle className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />}
                                                        {m.name}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 truncate">{q.message || "En attente"}</span>
                                                </div>
                                                {q.status === 'ok' && selectedModel !== m.id && (
                                                    <button 
                                                        onClick={() => handleSaveModel(m.id)}
                                                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-medium rounded transition-colors flex-shrink-0 ml-2"
                                                    >
                                                        Utiliser
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* NAVIGATION TABS & ACTIONS */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-1 bg-[#1a1a1c] p-1 rounded-lg border border-zinc-800/50">
                        <button 
                            onClick={() => setViewMode("editor")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'editor' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <Edit3 className="w-4 h-4" />
                            Éditeur
                        </button>
                        <button 
                            onClick={() => setViewMode("preview")}
                            disabled={script.trim().length === 0}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${viewMode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Visualisation
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {script.length > 0 && (
                            <div className="flex items-center gap-3 text-xs text-indigo-300/80 font-medium bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ~{stats.minutes}m {stats.seconds}s</span>
                                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {stats.words} mots</span>
                            </div>
                        )}
                        
                        <label className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Importer un fichier (.txt)">
                            <Upload className="w-4 h-4" />
                            <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
                        </label>

                        {script.length > 0 && (
                            <button 
                                onClick={handleFormatScript}
                                disabled={isFormatting || isGenerating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    isFormatting 
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-wait' 
                                        : 'bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/50'
                                }`}
                                title="Nettoyer et formater le script avec l'IA Gemini"
                            >
                                {isFormatting ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Formatting...</>
                                ) : (
                                    <><Sparkles className="w-3.5 h-3.5" /> Auto-Format (AI)</>
                                )}
                            </button>
                        )}

                        {script.length > 0 && (
                            <button 
                                onClick={handleCopyScript}
                                className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Copier le script"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        )}

                        <button 
                            onClick={() => { setScript(""); setViewMode("editor"); }}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors group"
                            title="Vider le script"
                        >
                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* SCRIPT TEMPLATES SELECTOR */}
                {script.trim().length === 0 && (
                    <div className="flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1">Exemples de scripts rapides</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {TEMPLATES.map((tmpl) => (
                                <button 
                                    key={tmpl.id}
                                    onClick={() => { setScript(tmpl.script); setErrorMsg(null); }}
                                    className="bg-[#1a1a1c] hover:bg-[#222226] border border-zinc-800/80 hover:border-indigo-500/40 p-3 rounded-xl text-left transition-all flex flex-col gap-1 group shadow-sm"
                                >
                                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">{tmpl.title}</span>
                                    <span className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{tmpl.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* SCRIPT INPUT OR CHAT VIEW */}
                <div className="bg-[#1a1a1c] rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden focus-within:border-zinc-600 transition-colors">
                    {viewMode === "editor" ? (
                        <textarea 
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder="Collez votre script ici...&#10;&#10;Format recommandé :&#10;Léo : Bonjour tout le monde !&#10;Maya : Salut Léo, comment ça va ?"
                            className="w-full min-h-[300px] p-6 bg-transparent text-zinc-200 resize-y focus:outline-none placeholder-zinc-700 leading-relaxed text-[15px] font-sans"
                        />
                    ) : (
                        <div className="w-full h-[320px] p-6 bg-transparent overflow-y-auto flex flex-col gap-4">
                            {parseScriptToBlocks(script).blocks.map((block, i) => {
                                const isFirstChar = block.speaker === characters[0];
                                return (
                                    <div key={i} className={`flex flex-col max-w-[85%] ${isFirstChar ? 'self-start' : 'self-end'}`}>
                                        <span className={`text-xs font-medium mb-1 ${isFirstChar ? 'text-indigo-400 ml-1' : 'text-violet-400 mr-1 self-end'}`}>
                                            {block.speaker}
                                        </span>
                                        <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${isFirstChar ? 'bg-zinc-800/70 rounded-tl-sm text-zinc-200 border border-zinc-700/40' : 'bg-indigo-500/10 border border-indigo-500/20 rounded-tr-sm text-indigo-100'}`}>
                                            {block.text}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* VOICES CONFIGURATION SECTION */}
                {characters.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between pl-1">
                            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Configuration des Voix ({characters.length})</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {characters.map((char, charIdx) => {
                                const config = voiceConfigs[char] || { voice: GEMINI_VOICES[charIdx % GEMINI_VOICES.length].id, prompt: '' };
                                const isTesting = previewingChar === char;
                                
                                return (
                                    <div key={char} className="bg-[#1a1a1c] border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:border-zinc-700 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${charIdx === 0 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'}`}>
                                                    {char.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-zinc-200 text-sm">{char}</span>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleTestVoice(char)}
                                                disabled={previewingChar !== null}
                                                className="p-2 bg-zinc-800 hover:bg-indigo-600 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 text-xs"
                                                title="Préécouter la voix"
                                            >
                                                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Volume2 className="w-3.5 h-3.5" />}
                                                <span>Tester</span>
                                            </button>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2.5">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-medium text-zinc-500">Voix Gemini</label>
                                                <select 
                                                    value={config.voice}
                                                    onChange={(e) => setVoiceConfigs(p => ({...p, [char]: {...p[char], voice: e.target.value}}))}
                                                    className="w-full bg-[#111113] border border-zinc-800 text-xs rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                                                >
                                                    {GEMINI_VOICES.map(v => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-medium text-zinc-500">Instructions de style / Ton</label>
                                                <input 
                                                    type="text" 
                                                    value={config.prompt}
                                                    onChange={(e) => setVoiceConfigs(p => ({...p, [char]: {...p[char], prompt: e.target.value}}))}
                                                    placeholder="Ex: Enthousiaste, chuchote, ton solennel..." 
                                                    className="w-full bg-[#111113] border border-zinc-800 text-xs rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ERROR DISPLAY */}
                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start justify-between gap-3 animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-red-400">Erreur / Message d'information API</span>
                                <p className="text-xs text-red-300 leading-relaxed font-mono bg-red-950/40 p-2 rounded border border-red-500/20">{errorMsg}</p>

                                {/* Contextual Help & Actions */}
                                {errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") ? (
                                    <div className="mt-1 text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 flex flex-col gap-1">
                                        <span className="font-semibold text-amber-400">🟡 Quota API Gemini Atteint (429)</span>
                                        <span>• Vous avez dépassé la limite de requêtes gratuites (10 requêtes / minute par modèle).</span>
                                        <span>• <strong>Solution :</strong> Patientez 1 à 2 minutes ou changez le modèle TTS en haut à droite.</span>
                                    </div>
                                ) : (errorMsg.includes("400") || errorMsg.includes("403") || errorMsg.toLowerCase().includes("key")) ? (
                                    <div className="mt-1 flex flex-col gap-2">
                                        <div className="text-[11px] text-red-300/90 bg-red-950/30 p-2.5 rounded-lg border border-red-500/20 flex flex-col gap-1">
                                            <span className="font-semibold text-red-300">🔴 Clé API Invalide ou Manquante</span>
                                            <span>• Si vous êtes sur Vercel : avez-vous <strong>Redéployé (Redeploy)</strong> après avoir ajouté <code>VITE_GEMINI_API_KEY</code> ?</span>
                                            <span>• Assurez-vous d'avoir copié votre clé depuis <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline text-indigo-300">Google AI Studio</a>.</span>
                                        </div>
                                        <button 
                                            onClick={() => { setShowKeySettings(true); setErrorMsg(null); }}
                                            className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 rounded-lg text-xs font-medium border border-indigo-500/30 transition-colors"
                                        >
                                            <Key className="w-3.5 h-3.5" />
                                            Modifier ma clé API Gemini dans l'application
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <button 
                            onClick={() => setErrorMsg(null)}
                            className="p-1.5 text-red-400 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-colors flex-shrink-0"
                            title="Fermer ce message"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* ANTI-QUOTA GUARDRAIL CONFIG PANEL */}
                <div className="bg-[#1a1a1c] border border-indigo-500/20 p-4 rounded-xl flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-semibold text-white">Garde-fous Anti-Quota (Podcasts Longs 30+ min)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={antiQuotaMode}
                                onChange={(e) => setAntiQuotaMode(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {antiQuotaMode && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60 text-xs">
                            <div className="flex items-center justify-between bg-[#111113] p-2.5 rounded-lg border border-zinc-800">
                                <span className="text-zinc-400">Délai Anti-Quota :</span>
                                <select 
                                    value={safetyDelayMs}
                                    onChange={(e) => setSafetyDelayMs(Number(e.target.value))}
                                    className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 focus:outline-none border border-zinc-700 font-mono"
                                >
                                    <option value={2000}>2.0s (Modéré)</option>
                                    <option value={3000}>3.0s (Recommandé)</option>
                                    <option value={4500}>4.5s (Ultra-Sûr)</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-between bg-[#111113] p-2.5 rounded-lg border border-zinc-800">
                                <span className="text-zinc-400">Taille tronçon max :</span>
                                <select 
                                    value={chunkSizeLimit}
                                    onChange={(e) => setChunkSizeLimit(Number(e.target.value))}
                                    className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 focus:outline-none border border-zinc-700 font-mono"
                                >
                                    <option value={1200}>1200 char (~1.5 min)</option>
                                    <option value={1800}>1800 char (~2.5 min)</option>
                                    <option value={2500}>2500 char (~3.5 min)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* GENERATION & OUTPUT SECTION */}
                <div className="pt-2 border-t border-zinc-800/80">
                    {isGenerating ? (
                        <div className="bg-[#1a1a1c] border border-indigo-500/30 p-6 rounded-xl flex flex-col gap-4 shadow-lg animate-in fade-in zoom-in-95">
                            <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2.5">
                                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
                                    <span className="font-medium text-zinc-200 text-xs truncate max-w-[360px]">{progressStats.status}</span>
                                </div>
                                <span className="text-indigo-400 font-mono text-xs font-semibold flex-shrink-0">{progressStats.percent}%</span>
                            </div>
                            
                            <div className="w-full bg-[#111113] rounded-full h-2.5 overflow-hidden border border-zinc-800/50">
                                <div 
                                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                                    style={{ width: `${progressStats.percent}%` }}
                                />
                            </div>
                            
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-zinc-400">
                                <span className="uppercase tracking-wider font-medium flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    Protection anti-quota active
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                                        Segment {progressStats.currentChunk} / {progressStats.totalChunks}
                                    </span>
                                    <button 
                                        onClick={togglePauseGeneration}
                                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
                                    >
                                        {isPaused ? <Play className="w-3 h-3 fill-amber-300" /> : <Pause className="w-3 h-3" />}
                                        {isPaused ? "Reprendre" : "Pause"}
                                    </button>
                                    <button 
                                        onClick={cancelGeneration}
                                        className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3" />
                                        Stop
                                    </button>
                                </div>
                            </div>

                            {partialAudioUrl && (
                                <div className="mt-2 pt-3 border-t border-zinc-800 flex items-center justify-between bg-[#111113] p-3 rounded-lg">
                                    <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                                        Audio partiel disponible
                                    </span>
                                    <a 
                                        href={partialAudioUrl}
                                        download={`Flow_Podcast_Partiel.wav`}
                                        className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-medium rounded transition-colors"
                                    >
                                        Télécharger .wav partiel
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button 
                            onClick={handleGenerate}
                            disabled={script.trim().length === 0}
                            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
                        >
                            <Wand2 className="w-4 h-4" />
                            Générer le Podcast Studio (Mode Long 30+ min Sécurisé)
                        </button>
                    )}
                    
                    {/* CUSTOM AUDIO PLAYER RESULT */}
                    {audioUrl && !isGenerating && (
                        <div className="mt-5">
                            <AudioPlayer src={audioUrl} onDownload={handleDownloadWav} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}