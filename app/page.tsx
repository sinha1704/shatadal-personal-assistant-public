'use client';

import { useState, useRef, useEffect } from 'react';
import { fetchAIResponse } from './utils/api';

type Message = { 
  role: 'user' | 'ai'; 
  content: string; 
  timestamp: string;
};

const SUGGESTIONS = [
  { text: "Who is Shatadal Sundar Sinha?", icon: "👤" },
  { text: "Summarize my professional expertise and skills.", icon: "💼" },
  { text: "What is the secret behind antigravity?", icon: "🚀" },
  { text: "Explain Next.js App Router in simple terms.", icon: "💻" }
];

// Always called client-side only — avoids SSR/client timestamp mismatch
const getTimestamp = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ChatPage() {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Online');
  const [statusColor, setStatusColor] = useState<string>('bg-emerald-500');
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [showKB, setShowKB] = useState<boolean>(false);
  const [kbEntries, setKbEntries] = useState<any[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aetheris_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved chat history:", e);
        setMessages([
          {
            role: 'ai',
            content: "Hello! I am Shatadal Personal Assistant. How can I assist you today?",
            timestamp: getTimestamp()
          }
        ]);
      }
    } else {
      setMessages([
        {
          role: 'ai',
          content: "Hello! I am Shatadal Personal Assistant. How can I assist you today?",
          timestamp: getTimestamp()
        }
      ]);
    }
    setHasLoadedHistory(true);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (hasLoadedHistory) {
      localStorage.setItem('aetheris_chat_history', JSON.stringify(messages));
    }
  }, [messages, hasLoadedHistory]);

  // Load knowledge base entries on mount
  useEffect(() => {
    fetch('/api/upload')
      .then(r => r.json())
      .then(d => setKbEntries(d.entries || []))
      .catch(() => {});
  }, []);

  // Auto-scroll to the bottom of the chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const timestamp = getTimestamp();
    const userMsg: Message = { role: 'user', content: trimmed, timestamp };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStatusText('Thinking...');
    setStatusColor('bg-amber-500');

    try {
      // Build history from current messages before adding the new user message
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await fetchAIResponse(trimmed, history);
      const aiTimestamp = getTimestamp();
      
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        content: data.reply, 
        timestamp: aiTimestamp 
      }]);
      
      if (data.isFallback) {
        setApiWarning(data.errorDetails || "API connection warning");
        setStatusText('Fallback');
        setStatusColor('bg-amber-500');
      } else {
        setApiWarning(null);
        setStatusText('Online');
        setStatusColor('bg-emerald-500');
      }
    } catch (error) {
      console.error("Error fetching response:", error);
      const aiTimestamp = getTimestamp();
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        content: "Sorry, I couldn't reach the backend API. Please make sure the server is running.", 
        timestamp: aiTimestamp 
      }]);
      setStatusText('Error');
      setStatusColor('bg-rose-500');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const clearChat = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    const timestamp = getTimestamp();
    const welcomeMsg: Message = {
      role: 'ai',
      content: "Chat history cleared. How can I assist you now?",
      timestamp
    };
    setMessages([welcomeMsg]);
    setShowClearConfirm(false);
    // Smooth scroll the entire page to the top when cleared
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const uploadFile = async (file: File) => {
    const allowed = ['.txt', '.md', '.json', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadStatus(`❌ Unsupported type. Allowed: ${allowed.join(', ')}`);
      return;
    }
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    const isPDF = ext === '.pdf';
    setUploading(true);
    setUploadStatus(
      isImage ? '🔍 Analyzing image with AI vision...' : isPDF ? '📄 Extracting PDF text...' : 'Uploading...'
    );
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setKbEntries(prev => [
          ...prev.filter(e => e.filename !== file.name),
          data.entry
        ]);
        setUploadStatus(`✅ "${file.name}" trained successfully!`);
      } else {
        setUploadStatus(`❌ ${data.error}`);
      }
    } catch {
      setUploadStatus('❌ Upload failed. Try again.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  const deleteKBEntry = async (id: string, filename: string) => {
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setKbEntries(prev => prev.filter(e => e.id !== id));
    setUploadStatus(`🗑️ "${filename}" removed.`);
    setTimeout(() => setUploadStatus(null), 3000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <main className="h-screen max-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 font-sans relative selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Decorative gradient glowing bubbles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-float-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none animate-float-delayed" />
      
      {/* Premium Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/70 border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 id="main-title" className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Shatadal Personal Assistant
            </h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
              <span className="text-xs text-slate-400 font-medium">{statusText}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Train AI Button */}
          <button
            onClick={() => setShowKB(prev => !prev)}
            id="btn-train-ai"
            className={`px-3.5 py-1.5 rounded-lg text-xs border transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer ${
              showKB
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Train AI with your files"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Train AI</span>
            {kbEntries.length > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {kbEntries.length}
              </span>
            )}
          </button>

          {/* Clear Chat Button */}
          <button 
            onClick={clearChat}
            id="btn-clear-chat"
            className="px-3.5 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
            title="Clear Conversation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear Chat</span>
          </button>
        </div>
      </header>

      {/* Backdrop blur overlay for Drawer */}
      {showKB && (
        <div 
          onClick={() => setShowKB(false)} 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn" 
        />
      )}

      {/* Sliding Right-Sidebar Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-slate-900/95 backdrop-blur-md border-l border-slate-800 z-50 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
          showKB ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🧠</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Train AI Model</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Upload files to teach your agent</p>
            </div>
          </div>
          <button 
            onClick={() => setShowKB(false)}
            className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:text-white text-slate-400 transition-all cursor-pointer"
            title="Close drawer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-4 text-xs text-indigo-300 leading-relaxed">
            <p className="font-semibold text-indigo-300 mb-1">Knowledge File Support</p>
            <p className="text-slate-400">
              You can upload documents (TXT, MD, JSON, CSV, PDF) or images (PNG, JPG, WEBP).
              Images are automatically analyzed via AI vision. PDFs are parsed using text extraction.
            </p>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value=''; }}
            />
            {uploading ? (
              <div className="flex flex-col items-center space-y-2.5">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-indigo-450 font-medium">{uploadStatus || 'Processing file...'}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 text-slate-400">
                <svg className="w-8 h-8 text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs"><span className="text-indigo-400 font-semibold">Click to upload</span> or drag & drop</p>
                <p className="text-[10px] text-slate-500">Max size: 5MB per file</p>
              </div>
            )}
          </div>

          {/* Inline Upload Status if drawer is open */}
          {uploadStatus && !uploading && (
            <div className="bg-slate-800/90 border border-slate-700/60 rounded-xl p-3 text-xs text-center text-slate-200 animate-fadeIn">
              {uploadStatus}
            </div>
          )}

          {/* Knowledge Entries List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Trained Files ({kbEntries.length})
              </span>
              {kbEntries.length > 0 && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                  Active
                </span>
              )}
            </div>

            {kbEntries.length > 0 ? (
              <div className="space-y-2.5">
                {kbEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between bg-slate-800/40 border border-slate-800 hover:border-slate-700/60 rounded-xl p-3 group transition-all">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      {entry.type === 'image' && entry.imageUrl ? (
                        <img src={entry.imageUrl} alt={entry.filename} className="w-10 h-10 rounded-lg object-cover border border-slate-700 flex-shrink-0" />
                      ) : (
                        <span className="text-2xl flex-shrink-0 select-none">
                          {entry.type === 'pdf' ? '📕' : entry.filename.endsWith('.txt') ? '📄' : entry.filename.endsWith('.md') ? '📝' : entry.filename.endsWith('.json') ? '🔧' : '📊'}
                        </span>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs text-white font-medium truncate flex items-center gap-1.5">
                          {entry.filename}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {(entry.charCount || 0).toLocaleString()} chars&nbsp;·&nbsp;
                          <span className="uppercase font-semibold text-[8px] px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 ml-1">
                            {entry.type}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteKBEntry(entry.id, entry.filename)}
                      className="text-slate-505 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                      title="Remove from knowledge base"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500">No custom knowledge loaded.</p>
                <p className="text-[10px] text-slate-600 mt-1">Upload resumes or documents above.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {apiWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-400 backdrop-blur-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚠️</span>
            <span><strong>Connection Warning:</strong> {apiWarning} (Running in offline fallback)</span>
          </div>
          <button 
            onClick={() => setApiWarning(null)} 
            className="text-amber-400 hover:text-white transition-colors cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <section className="flex-1 overflow-y-auto w-full">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 w-full min-h-full flex flex-col justify-between">
          {messages.length <= 1 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 max-w-2xl mx-auto animate-fadeIn select-none">
              {/* Glowing AI Avatar Icon with Rotating Gradient Border */}
              <div className="relative mb-8 group select-none">
                {/* Soft background glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-blue-600 blur-2xl opacity-50 animate-pulse" />
                
                {/* Spinning border ring */}
                <div className="relative w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800/80 flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:border-indigo-500/50">
                  <div className="absolute inset-0.5 rounded-[22px] bg-gradient-to-tr from-indigo-500 via-purple-600 to-blue-600 opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                  {/* SVG Icon with float animation */}
                  <svg className="w-11 h-11 text-indigo-400 animate-float-icon mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent mb-3">
                Shatadal Personal Assistant
              </h2>
              
              <p className="text-sm md:text-base text-slate-400 max-w-md mb-8 leading-relaxed">
                {messages.length === 1 ? messages[0].content : "Hello! I am Shatadal Personal Assistant. How can I assist you today?"}
              </p>

              {/* Integrated Suggestion Chips */}
              <div className="w-full max-w-lg space-y-2.5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Get Started</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(sug.text)}
                      className="p-4 text-left rounded-xl bg-slate-900/30 hover:bg-slate-900/90 border border-slate-900 hover:border-indigo-500/30 text-slate-300 hover:text-white transition-all duration-300 text-xs flex items-center space-x-3 group cursor-pointer hover:shadow-[0_8px_30px_-5px_rgba(99,102,241,0.15)] active:scale-[0.98] hover:-translate-y-0.5"
                    >
                      <span className="text-base bg-slate-800/80 p-2 rounded-lg group-hover:scale-110 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-all duration-300">
                        {sug.icon}
                      </span>
                      <span className="font-medium tracking-wide line-clamp-1">{sug.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages list */
            <div className="space-y-6 flex-1">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex items-start gap-3.5 animate-fadeIn ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* AI Avatar */}
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 text-indigo-400 mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className="flex flex-col max-w-[80%]">
                    <div className={`p-4 rounded-2xl shadow-lg border text-sm md:text-base leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-indigo-500/30 text-white rounded-tr-none' 
                        : 'bg-slate-900/60 backdrop-blur-md border-slate-800/80 text-slate-150 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-line">{msg.content}</p>
                    </div>
                    <span className={`text-[10px] text-slate-500 mt-1 px-1.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* User Avatar */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-650 flex items-center justify-center flex-shrink-0 text-white mt-1 font-semibold text-xs uppercase shadow-md shadow-indigo-900/20">
                      U
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3.5 justify-start animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 text-indigo-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.21" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="px-4 py-3 bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-2xl rounded-tl-none flex items-center space-x-1.5">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </section>

      {/* Footer & Chat Input Form */}
      <footer className="w-full max-w-4xl mx-auto px-4 md:px-8 pb-6 pt-2">
        {/* Chat Upload Status Banner (shows when KB panel is closed) */}
        {uploading && !showKB && (
          <div className="mb-2.5 px-4 py-2 bg-slate-900/80 border border-indigo-500/20 backdrop-blur-md rounded-xl text-xs flex items-center space-x-2 animate-pulse max-w-max">
            <div className="w-3.5 h-3.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-indigo-300 font-medium">{uploadStatus || 'Training AI on file...'}</span>
          </div>
        )}
        
        {uploadStatus && !uploading && !showKB && (
          <div className="mb-2.5 px-4 py-2 bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-xl text-xs flex items-center justify-between animate-fadeIn max-w-max">
            <span className="text-slate-300 font-medium">{uploadStatus}</span>
            <button 
              onClick={() => setUploadStatus(null)} 
              className="text-slate-500 hover:text-slate-300 ml-2 text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input box */}
        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl p-2 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all flex items-end">
          {/* Direct File Upload Button */}
          <button
            type="button"
            onClick={() => chatFileInputRef.current?.click()}
            disabled={isLoading || uploading}
            className="p-3 text-slate-400 hover:text-slate-200 transition-all cursor-pointer rounded-xl hover:bg-slate-800/40 flex-shrink-0 hover:scale-[1.05] active:scale-[0.95]"
            title="Attach file to train AI"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={chatFileInputRef}
            type="file"
            accept=".txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = '';
            }}
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            id="chat-input"
            className="flex-1 max-h-36 min-h-[44px] bg-transparent resize-none border-0 focus:ring-0 outline-none placeholder:text-slate-500 text-slate-100 text-sm md:text-base px-3 py-2.5 font-sans"
            placeholder="Ask Shatadal Personal Assistant..."
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend(input)}
            id="btn-send-message"
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-[1.03] active:scale-[0.97] ${
              input.trim() && !isLoading 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                : 'bg-slate-900 border border-slate-805 text-slate-600'
            }`}
          >
            <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </div>
        
        <p className="text-[10px] text-center text-slate-600 mt-3">
          Powered by Hugging Face Inference API and BlenderBot-400M
        </p>
      </footer>

      {/* Custom Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-semibold text-white">Clear Chat History</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to clear your chat history? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleCancelClear}
                className="px-4 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer font-medium"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}