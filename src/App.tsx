import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  UploadCloud, CheckCircle2, Loader2, AlertCircle, 
  Send, Bot, BookOpen, X, Sparkles, Database, BrainCircuit,
  Info, FileText, ChevronRight, ArrowUp, Menu, MoreVertical,
  MessageSquare, Zap, Clock, HardDrive, Activity, ChevronLeft, Lock, Terminal,
  Settings, User, Palette
} from 'lucide-react';
import { db } from './db';
import { generateQuestions, searchMode, answerMode } from './gemini';
import { splitIntoChunks, isFileEmpty } from './chunking';
import { vectorStore } from './vectorStore';

type FileStatus = 'uploading' | 'processing' | 'ready' | 'error';
type ThemeColor = 'indigo' | 'emerald' | 'rose' | 'cyan';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: FileStatus;
  progress?: number;
  message?: string;
  uploadTime?: string;
  content?: string;
}

interface Source {
  book: string;
  text: string;
  page: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  text: string;
  sources?: Source[];
  isHonest?: boolean;
  confidence?: number;
  isStreaming?: boolean;
}

const getTheme = (color: ThemeColor, isOverclocked: boolean) => {
  if (isOverclocked) {
    return {
      gradient: 'from-red-500 to-orange-500',
      gradientHover: 'from-red-500/5 to-orange-500/5',
      gradientSoft: 'from-red-500/30 via-orange-500/30 to-red-500/30',
      gradientLine: 'from-red-500/50',
      text: 'text-red-400',
      textGradient: 'from-red-300 to-orange-300',
      border: 'border-red-500/30',
      borderSoft: 'border-red-500/20',
      bg: 'bg-red-500/20',
      bgSoft: 'bg-red-500/10',
      glow: 'shadow-[0_0_40px_rgba(239,68,68,0.2)]',
      ping: 'bg-red-400',
      mesh: 'overclocked',
      cursor: 'bg-red-500'
    };
  }
  switch (color) {
    case 'emerald': return { 
      gradient: 'from-emerald-500 to-teal-500', 
      gradientHover: 'from-emerald-500/5 to-teal-500/5', 
      gradientSoft: 'from-emerald-500/30 via-teal-500/30 to-emerald-500/30',
      gradientLine: 'from-emerald-500/50',
      text: 'text-emerald-400', 
      textGradient: 'from-emerald-300 to-teal-300', 
      border: 'border-emerald-500/30', 
      borderSoft: 'border-emerald-500/20', 
      bg: 'bg-emerald-500/20', 
      bgSoft: 'bg-emerald-500/10', 
      glow: 'shadow-[0_0_40px_rgba(16,185,129,0.2)]', 
      ping: 'bg-emerald-400', 
      mesh: 'theme-emerald',
      cursor: 'bg-emerald-400'
    };
    case 'rose': return { 
      gradient: 'from-rose-500 to-pink-500', 
      gradientHover: 'from-rose-500/5 to-pink-500/5', 
      gradientSoft: 'from-rose-500/30 via-pink-500/30 to-rose-500/30',
      gradientLine: 'from-rose-500/50',
      text: 'text-rose-400', 
      textGradient: 'from-rose-300 to-pink-300', 
      border: 'border-rose-500/30', 
      borderSoft: 'border-rose-500/20', 
      bg: 'bg-rose-500/20', 
      bgSoft: 'bg-rose-500/10', 
      glow: 'shadow-[0_0_40px_rgba(244,63,94,0.2)]', 
      ping: 'bg-rose-400', 
      mesh: 'theme-rose',
      cursor: 'bg-rose-400'
    };
    case 'cyan': return { 
      gradient: 'from-cyan-500 to-blue-500', 
      gradientHover: 'from-cyan-500/5 to-blue-500/5', 
      gradientSoft: 'from-cyan-500/30 via-blue-500/30 to-cyan-500/30',
      gradientLine: 'from-cyan-500/50',
      text: 'text-cyan-400', 
      textGradient: 'from-cyan-300 to-blue-300', 
      border: 'border-cyan-500/30', 
      borderSoft: 'border-cyan-500/20', 
      bg: 'bg-cyan-500/20', 
      bgSoft: 'bg-cyan-500/10', 
      glow: 'shadow-[0_0_40px_rgba(6,182,212,0.2)]', 
      ping: 'bg-cyan-400', 
      mesh: 'theme-cyan',
      cursor: 'bg-cyan-400'
    };
    default: return { 
      gradient: 'from-indigo-500 to-purple-500', 
      gradientHover: 'from-indigo-500/5 to-purple-500/5', 
      gradientSoft: 'from-indigo-500/30 via-purple-500/30 to-indigo-500/30',
      gradientLine: 'from-indigo-500/50',
      text: 'text-indigo-400', 
      textGradient: 'from-indigo-300 to-purple-300', 
      border: 'border-indigo-500/30', 
      borderSoft: 'border-indigo-500/20', 
      bg: 'bg-indigo-500/20', 
      bgSoft: 'bg-indigo-500/10', 
      glow: 'shadow-[0_0_40px_rgba(99,102,241,0.2)]', 
      ping: 'bg-indigo-400', 
      mesh: 'theme-indigo',
      cursor: 'bg-indigo-400'
    };
  }
};

const DecryptText = ({ text, isStreaming, isOverclocked, cursorClass }: { text: string, isStreaming?: boolean, isOverclocked?: boolean, cursorClass: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
  
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      setIsDone(true);
      return;
    }

    let i = 0;
    setIsDone(false);
    const speed = isOverclocked ? 3 : 1;
    
    const interval = setInterval(() => {
      if (i >= text.length) {
        clearInterval(interval);
        setDisplayedText(text);
        setIsDone(true);
        return;
      }
      
      const actual = text.slice(0, i);
      const randomLength = Math.min(3, text.length - i);
      const random = Array(randomLength).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
      
      setDisplayedText(actual + random);
      i += speed;
    }, 15);
    
    return () => clearInterval(interval);
  }, [text, isStreaming, isOverclocked]);

  return (
    <span>
      {displayedText}
      {!isDone && <span className={`inline-block w-2 h-4 ml-1 ${cursorClass} cursor-blink align-middle shadow-[0_0_10px_currentColor]`} />}
    </span>
  );
};

const Telemetry = ({ isOverclocked }: { isOverclocked: boolean }) => {
  const [ping, setPing] = useState(12);
  
  useEffect(() => {
    const int = setInterval(() => {
      setPing(Math.floor(Math.random() * (isOverclocked ? 4 : 10)) + (isOverclocked ? 2 : 8));
    }, 2000);
    return () => clearInterval(int);
  }, [isOverclocked]);

  return (
    <div className="fixed bottom-4 right-6 text-[9px] font-mono text-zinc-600 tracking-widest pointer-events-none z-50 hidden md:flex gap-6 opacity-60">
      <span className="flex items-center gap-1.5">
        <Terminal className="w-3 h-3" />
        SYS.MEM: {isOverclocked ? '128.4TB' : '64.2TB'}
      </span>
      <span>Q-CORES: {isOverclocked ? 'MAX' : '128'} ACTIVE</span>
      <span>LATENCY: {ping}ms</span>
      <span className={isOverclocked ? 'text-red-500/80 animate-pulse' : 'text-indigo-500/50'}>
        {isOverclocked ? 'QUANTUM ENCRYPTION' : 'SECURE CONNECTION'}
      </span>
    </div>
  );
};

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  
  // New State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, file: UploadedFile} | null>(null);
  const [readerFile, setReaderFile] = useState<UploadedFile | null>(null);
  const [activeContext, setActiveContext] = useState<UploadedFile | null>(null);
  const [isOverclocked, setIsOverclocked] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [themeColor, setThemeColor] = useState<ThemeColor>('indigo');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const theme = getTheme(themeColor, isOverclocked);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Загрузка данных из БД при монтировании
  useEffect(() => {
    const loadData = async () => {
      await db.init();
      
      // Загружаем настройки первыми
      const savedSettings = await db.getSettings();
      if (savedSettings) {
        setUserName(savedSettings.userName || '');
        setThemeColor(savedSettings.themeColor || 'indigo');
        setIsOverclocked(savedSettings.isOverclocked || false);
      }
      
      // Загружаем файлы
      const savedFiles = await db.getFiles();
      if (savedFiles.length > 0) {
        setFiles(savedFiles);
      }
      
      // Загружаем сообщения
      const savedMessages = await db.getMessages();
      if (savedMessages.length > 0) {
        setMessages(savedMessages);
      } else {
        // Если нет сохраненных сообщений, показываем приветствие
        setMessages([{
          id: 'welcome',
          type: 'system',
          text: 'Добро пожаловать в Neural Library'
        }]);
      }
      
      // Отмечаем что данные загружены
      setIsDataLoaded(true);
    };
    
    loadData();
  }, []);

  // Сохранение файлов в БД
  useEffect(() => {
    if (files.length > 0) {
      files.forEach(file => db.saveFile(file));
    }
  }, [files]);

  // Сохранение сообщений в БД
  useEffect(() => {
    if (messages.length > 1) { // Пропускаем начальное приветствие
      messages.forEach(msg => {
        if (!msg.isStreaming) {
          db.saveMessage(msg);
        }
      });
    }
  }, [messages]);

  // Сохранение настроек в БД (только после загрузки данных)
  useEffect(() => {
    if (isDataLoaded) {
      db.saveSettings({
        userName,
        themeColor,
        isOverclocked
      });
    }
  }, [userName, themeColor, isOverclocked, isDataLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    
    const handleResize = () => {
      if (window.innerWidth > 768 && !isSidebarOpen) {
        // Don't auto-open if user explicitly closed it, just handle responsive layout
      }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSidebarOpen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files as FileList).filter((f: File) => f.name.endsWith('.txt'));
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files as FileList).filter((f: File) => f.name.endsWith('.txt'));
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (newFiles: File[]) => {
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        
        if (isFileEmpty(content)) {
          console.warn(`File ${file.name} is empty, skipping`);
          return;
        }
        
        const newUpload: UploadedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          status: 'uploading',
          progress: 0,
          message: 'Чтение файла...',
          uploadTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: content
        };
        setFiles(prev => [...prev, newUpload]);
        simulateFileProcessing(newUpload.id, content, file.name);
      };
      reader.readAsText(file);
    });
  };

  const simulateFileProcessing = (id: string, content: string, bookName: string) => {
    const speedMultiplier = isOverclocked ? 0.4 : 1;
    const steps = [
      { msg: 'Векторизация текста...', progress: 25, delay: 800 * speedMultiplier },
      { msg: 'Разбиение на чанки...', progress: 50, delay: 1800 * speedMultiplier },
      { msg: 'Индексация фрагментов...', progress: 80, delay: 3000 * speedMultiplier },
      { msg: 'В базе', progress: 100, delay: 4000 * speedMultiplier, status: 'ready' as FileStatus }
    ];

    steps.forEach(step => {
      setTimeout(() => {
        setFiles(prev => {
          const updatedFiles = prev.map(f => f.id === id ? { 
            ...f, 
            status: step.status || 'processing', 
            message: step.msg, 
            progress: step.progress 
          } : f);
          
          if (step.status === 'ready') {
            const chunks = splitIntoChunks(content, bookName);
            vectorStore.addChunks(chunks);
            
            const file = updatedFiles.find(f => f.id === id);
            if (file && file.content) {
              generateQuestions(file.content, file.name).then(questions => {
                setSuggestedQuestions(questions);
              });
            }
          }
          
          return updatedFiles;
        });
      }, step.delay);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const hasReadyFiles = files.some(f => f.status === 'ready');

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !hasReadyFiles) return;

    const userQuestion = inputValue.trim();
    const isSearchMode = userQuestion.toLowerCase().startsWith('найди') || 
                         userQuestion.toLowerCase().startsWith('поиск');
    
    const newUserMsg: Message = {
      id: Math.random().toString(36).substring(7),
      type: 'user',
      text: userQuestion
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');

    const aiMsgId = Math.random().toString(36).substring(7);
    setMessages(prev => [...prev, {
      id: aiMsgId,
      type: 'ai',
      text: isSearchMode ? 'Ищу релевантные фрагменты...' : 'Анализирую документы...',
      isStreaming: true
    }]);

    try {
      const searchResults = vectorStore.simpleSearch(userQuestion, 5);
      const contexts = searchResults.map(r => ({
        text: r.chunk.text,
        source: `${r.chunk.bookName}, фрагмент №${r.chunk.chunkIndex + 1}`
      }));

      let response: string;
      
      if (isSearchMode) {
        response = await searchMode(userQuestion, contexts);
      } else {
        const result = await answerMode(userQuestion, contexts, userName);
        response = result.answer;
      }

      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        text: response,
        isStreaming: false
      } : m));
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        text: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
        isStreaming: false
      } : m));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, file: UploadedFile) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 250);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, file });
  };

  const openReader = (file: UploadedFile) => {
    setReaderFile(file);
    setContextMenu(null);
  };

  const startBookChat = (file: UploadedFile) => {
    setActiveContext(file);
    setContextMenu(null);
    setMessages([{
      id: Math.random().toString(36).substring(7),
      type: 'system',
      text: `Чат по книге: ${file.name}`
    }]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const summarizeBook = (file: UploadedFile) => {
    setActiveContext(file);
    setContextMenu(null);
    setInputValue(`Сделай подробную выжимку книги "${file.name}"`);
    setTimeout(() => handleSendMessage(), 100);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-white/20 bg-noise">
      <div className={`mesh-bg ${theme.mesh}`} />
      {isOverclocked && <div className="scanlines" />}
      
      <Telemetry isOverclocked={isOverclocked} />

      {/* Fixed Hamburger Menu Button - Always visible when sidebar is closed */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.button 
            initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
            onClick={() => setIsSidebarOpen(true)} 
            className="fixed top-6 left-6 z-50 p-3.5 glass-premium rounded-full hover:bg-white/10 transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)] group"
          >
            <Menu className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-[85vw] max-w-[360px] md:w-[360px] glass-panel z-40 flex flex-col shadow-[20px_0_60px_rgba(0,0,0,0.5)]"
          >
            <div className="p-8 pt-8 flex flex-col h-full relative">
              
              {/* Close Sidebar Button */}
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors group"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-3 mb-10 mt-2"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${theme.bg} ${theme.border}`}>
                  <BrainCircuit className={`w-4 h-4 ${theme.text}`} />
                </div>
                <h1 className="font-semibold tracking-tight text-lg">Neural Library</h1>
              </motion.div>
              
              {/* Sleek Uploader */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className={`relative group rounded-3xl transition-all duration-500 p-6 text-center cursor-pointer overflow-hidden border spotlight-hover
                  ${isDragging ? `${theme.border} ${theme.bgSoft} scale-[1.02] ${theme.glow}` : 'border-white/[0.05] hover:border-white/[0.15] hover:bg-white/[0.03] bg-white/[0.01]'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileInput} 
                  multiple 
                  accept=".txt" 
                  className="hidden" 
                />
                <div className="relative z-10 flex items-center justify-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isDragging ? `${theme.bg} ${theme.text} scale-110` : 'bg-white/5 text-zinc-400 group-hover:text-zinc-200 group-hover:scale-105 group-hover:bg-white/10'}`}>
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[15px] font-medium text-zinc-200">Добавить документ</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-light">TXT файлы до 50MB</p>
                  </div>
                </div>
              </motion.div>

              {/* Archive / macOS Stack */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="mt-8 flex-1 flex flex-col min-h-0"
              >
                <div className="flex items-center justify-between mb-6 px-2">
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Архив документов</h3>
                  <span className="text-[10px] font-medium text-zinc-400 bg-white/[0.03] border border-white/[0.05] px-2.5 py-1 rounded-full">
                    {files.length}
                  </span>
                </div>
                
                <div 
                  className="flex-1 flex flex-col justify-end pb-8 relative cursor-pointer md:cursor-default"
                  onMouseEnter={() => setIsStackHovered(true)}
                  onMouseLeave={() => setIsStackHovered(false)}
                  onClick={() => window.innerWidth < 768 && setIsStackExpanded(!isStackExpanded)}
                >
                  {files.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 animate-pulse-glow">
                        <HardDrive className="w-6 h-6 text-zinc-500" />
                      </div>
                      <p className="text-sm text-zinc-400 font-light">Ожидаю данные для обучения...</p>
                    </div>
                  ) : (
                    files.map((file, i) => {
                      const reverseIndex = files.length - 1 - i;
                      const isExpanded = isStackHovered || isStackExpanded;
                      
                      return (
                        <div 
                          key={file.id}
                          onContextMenu={(e) => handleContextMenu(e, file)}
                          style={{
                            marginTop: isExpanded ? '12px' : (i === 0 ? '0' : '-64px'),
                            transform: isExpanded ? 'scale(1) translateY(0)' : `scale(${1 - reverseIndex * 0.04}) translateY(-${reverseIndex * 8}px)`,
                            zIndex: i
                          }}
                          className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] glass-premium p-4 rounded-[1.5rem] border border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.05] cursor-context-menu group/file relative spotlight-hover"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner bg-gradient-to-br ${theme.gradientSoft}`}>
                              {file.status === 'ready' ? (
                                <FileText className={`w-5 h-5 ${theme.text}`} />
                              ) : file.status === 'error' ? (
                                <AlertCircle className="w-5 h-5 text-red-400" />
                              ) : (
                                <Loader2 className={`w-5 h-5 animate-spin ${theme.text}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                              <p className="text-[15px] font-medium text-zinc-200 truncate group-hover/file:text-white transition-colors">{file.name}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-light">
                                  <Clock className="w-3 h-3" /> {file.uploadTime}
                                </span>
                                <span className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-light">
                                  <HardDrive className="w-3 h-3" /> {formatSize(file.size)}
                                </span>
                              </div>
                              {file.status !== 'ready' && file.status !== 'error' && (
                                <div className="w-full h-0.5 bg-white/[0.05] rounded-full mt-2.5 overflow-hidden">
                                  <motion.div 
                                    className={`h-full bg-gradient-to-r ${theme.gradient}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${file.progress}%` }}
                                    transition={{ duration: 0.5 }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Mobile Context Menu Button */}
                          <button 
                            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white transition-colors"
                            onClick={(e) => handleContextMenu(e, file)}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>

              {/* Bottom Sidebar Controls */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between"
              >
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                >
                  <Settings className="w-4 h-4" />
                  Настройки
                </button>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${theme.ping}`} />
                   <span className="text-[10px] uppercase tracking-widest text-zinc-500">Система активна</span>
                </div>
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative z-10 min-w-0 transition-all duration-500 ${isSidebarOpen ? 'md:ml-[360px]' : 'ml-0'}`}>
        
        {/* Top Right Controls (Overclock) */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
          <button 
            onClick={() => setIsOverclocked(!isOverclocked)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-bold tracking-widest transition-all duration-500 ${isOverclocked ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-black/40 backdrop-blur-md border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
          >
            <Zap className={`w-3.5 h-3.5 ${isOverclocked ? 'animate-pulse' : ''}`} />

          </button>
        </div>

        {/* Active Context Badge */}
        <AnimatePresence>
          {activeContext && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-20"
            >
              <div className={`glass-premium px-5 py-2.5 rounded-full flex items-center gap-3 border animate-pulse-glow ${theme.border} ${theme.glow}`}>
                <div className={`w-2 h-2 rounded-full animate-ping ${theme.ping}`} />
                <BookOpen className={`w-4 h-4 ${theme.text}`} />
                <span className="text-sm font-medium text-zinc-200">Связь установлена: <span className="text-white">{activeContext.name}</span></span>
                <button onClick={() => setActiveContext(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth hide-scrollbar scroll-fade">
          <div className="max-w-3xl mx-auto space-y-12 pb-40 pt-16">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  layout
                  key={msg.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.type === 'system' ? (
                    <div className="w-full flex flex-col items-center justify-center py-24">
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="relative w-28 h-28 mb-10"
                      >
                        <div className={`absolute inset-[-25%] border border-dashed rounded-full spin-slow ${theme.borderSoft}`} />
                        <div className={`absolute inset-[-12%] border border-dashed rounded-full spin-slow ${theme.borderSoft}`} style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
                        
                        <div className={`absolute inset-0 rounded-full blur-3xl animate-pulse ${theme.bg}`} />
                        <div className={`absolute inset-2 rounded-full blur-xl bg-gradient-to-tr ${theme.gradientSoft}`} />
                        <div className={`relative w-full h-full glass-premium rounded-full flex items-center justify-center border border-white/10 ${theme.glow}`}>
                          <BrainCircuit className="w-10 h-10 text-white" strokeWidth={1.5} />
                        </div>
                      </motion.div>
                      
                      <h2 className="text-4xl md:text-5xl font-light text-gradient mb-5 tracking-tight text-center">
                        {userName ? `С возвращением, ${userName}` : 'Neural Library'}
                      </h2>
                      <p className="text-zinc-400 max-w-md text-center text-[15px] leading-relaxed font-light">
                        {activeContext 
                          ? 'Задавайте вопросы по содержимому этой книги. ИИ проанализирует текст и даст точные ответы.'
                          : 'Загрузите документы для формирования базы знаний. ИИ проанализирует контекст и предоставит точные ответы со ссылками на источники.'}
                      </p>
                      
                      {hasReadyFiles && !activeContext && suggestedQuestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3, staggerChildren: 0.1 }}
                          className="mt-14 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          {suggestedQuestions.map((suggestion, i) => (
                            <motion.button 
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + (i * 0.1) }}
                              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.04)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => { setInputValue(suggestion); }}
                              className="group text-left p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:border-white/[0.08] transition-all flex items-center justify-between spotlight-hover"
                            >
                              <span className="text-sm text-zinc-300 group-hover:text-white transition-colors font-light">{suggestion}</span>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  ) : msg.type === 'user' ? (
                    <div className="max-w-[85%] md:max-w-[75%] bg-white text-black px-6 py-4 rounded-3xl rounded-tr-sm shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                      <p className="text-[15px] leading-relaxed font-medium">{msg.text}</p>
                    </div>
                  ) : (
                    <div className="max-w-[95%] md:max-w-[85%] w-full">
                      <div className="flex items-start gap-4 md:gap-6">
                        <div className="w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_20px_rgba(255,255,255,0.05)] relative">
                          <div className={`absolute inset-0 rounded-full blur-md ${theme.bg}`} />
                          {msg.isStreaming ? (
                            <Activity className={`w-4 h-4 relative z-10 animate-pulse ${theme.text}`} />
                          ) : (
                            <Sparkles className="w-4 h-4 text-zinc-200 relative z-10" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          {msg.isStreaming ? (
                            <div className="flex items-center gap-4 text-zinc-400">
                              <div className={`w-4 h-4 rounded-full border-2 ${theme.borderSoft} border-t-current ${theme.text} animate-spin`} />
                              <span className={`text-[15px] font-light thinking-dots text-transparent bg-clip-text bg-gradient-to-r ${theme.textGradient}`}>
                                {isOverclocked ? 'Квантовая дешифровка данных' : 'Анализ нейронных связей'}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              <div className="prose prose-invert max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-200 prose-strong:text-white prose-ul:text-zinc-200 prose-ol:text-zinc-200 prose-li:text-zinc-200 text-[16px] leading-[1.8] font-light tracking-wide">
                                <ReactMarkdown>
                                  {msg.text}
                                </ReactMarkdown>
                              </div>
                              
                              {msg.sources && msg.sources.length > 0 && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 1.2 }} 
                                  className="pt-4"
                                >
                                  <div className="flex items-center gap-3 mb-5">
                                    <div className={`h-px w-8 bg-gradient-to-r to-transparent ${theme.gradientLine}`} />
                                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${theme.text}`}>Источники</span>
                                    {msg.confidence && (
                                      <span className="ml-auto text-[10px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                        CONFIDENCE: {(msg.confidence * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {msg.sources.map((source, idx) => (
                                      <motion.div 
                                        key={idx}
                                        whileHover={{ y: -2, scale: 1.01 }}
                                        onClick={() => setSelectedSource(source)}
                                        className="group relative p-5 rounded-3xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] cursor-pointer transition-all flex flex-col h-full overflow-hidden shadow-lg spotlight-hover"
                                      >
                                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${theme.gradientHover}`} />
                                        <div className="relative z-10 flex flex-col h-full">
                                          <div className="flex items-center gap-2.5 mb-3">
                                            <FileText className={`w-4 h-4 ${theme.text}`} />
                                            <span className="text-xs font-medium text-zinc-300 truncate">{source.book}</span>
                                          </div>
                                          <p className="text-[13px] text-zinc-500 line-clamp-3 leading-relaxed flex-1 mb-4 font-light">"{source.text}"</p>
                                          <div className="mt-auto flex items-center justify-between">
                                            <span className="text-[10px] font-medium text-zinc-500 bg-black/50 px-2.5 py-1 rounded-md border border-white/[0.03]">{source.page}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                                          </div>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-10 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto relative pointer-events-auto">
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
              <div className="relative flex-1 group">
                {/* Dynamic Aura Glow based on input length */}
                <div 
                  className={`absolute -inset-1.5 rounded-[2.5rem] blur-xl transition-all duration-700 bg-gradient-to-r ${theme.gradientSoft}`}
                  style={{ opacity: inputValue.length > 0 ? Math.min(inputValue.length / 50, 1) : 0 }}
                />
                <div className="relative flex items-center glass-input rounded-[2.5rem] p-2 md:p-2.5">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={!hasReadyFiles}
                    placeholder={hasReadyFiles ? "Спросите что-нибудь..." : "Загрузите базу знаний для начала..."}
                    className="w-full bg-transparent pl-4 md:pl-6 pr-12 md:pr-14 py-3 md:py-3.5 text-[15px] md:text-[16px] text-white placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed outline-none font-light"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={!inputValue.trim() || !hasReadyFiles}
                    className="absolute right-2 md:right-3.5 p-3 md:p-3.5 rounded-full bg-white text-black disabled:bg-white/5 disabled:text-zinc-600 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:shadow-none"
                  >
                    <ArrowUp className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.5} />
                  </motion.button>
                </div>
              </div>
            </form>
            <div className="mt-3 md:mt-5 text-center">
              <p className="text-[10px] md:text-[11px] text-zinc-600 font-medium tracking-wide">
                ИИ может допускать ошибки. Проверяйте источники.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md glass-premium rounded-[2rem] overflow-hidden border border-white/10"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                 <h3 className="text-[15px] font-medium flex items-center gap-3 text-zinc-200">
                   <Settings className="w-4 h-4 text-zinc-400"/> Настройки системы
                 </h3>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                   <X className="w-4 h-4 text-zinc-500 hover:text-white"/>
                 </button>
              </div>
              <div className="p-6 md:p-8 space-y-8">
                 {/* Name Input */}
                 <div>
                   <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 block">Идентификатор пользователя</label>
                   <div className="relative">
                     <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                     <input 
                       type="text" 
                       value={userName} 
                       onChange={e => setUserName(e.target.value)}
                       placeholder="Введите ваше имя..."
                       className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:border-white/30 focus:bg-white/[0.05] transition-all outline-none"
                     />
                   </div>
                 </div>
                 
                 {/* Theme Selection */}
                 <div>
                   <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-4 block">Нейронный резонанс (Цвет)</label>
                   <div className="flex gap-4">
                     {(['indigo', 'emerald', 'rose', 'cyan'] as ThemeColor[]).map(c => (
                       <button 
                         key={c}
                         onClick={() => setThemeColor(c)}
                         className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${themeColor === c ? 'scale-110' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                       >
                         {themeColor === c && (
                           <motion.div 
                             layoutId="theme-ring"
                             className="absolute inset-0 rounded-full border-2 border-white/30"
                             transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                           />
                         )}
                         <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getTheme(c, false).gradient} shadow-lg`} />
                       </button>
                     ))}
                   </div>
                 </div>


              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            transition={{ duration: 0.2 }}
            className="fixed z-[100] glass-premium rounded-2xl p-2 min-w-[240px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-white/5 mb-2">
              <p className="text-xs font-medium text-zinc-400 truncate">{contextMenu.file.name}</p>
            </div>
            <button onClick={() => openReader(contextMenu.file)} className="w-full text-left px-3 py-2.5 text-[14px] text-zinc-200 hover:bg-white/10 hover:text-white rounded-xl flex items-center gap-3 transition-colors group">
              <BookOpen className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" /> Читать документ
            </button>
            <button onClick={() => startBookChat(contextMenu.file)} className="w-full text-left px-3 py-2.5 text-[14px] text-zinc-200 hover:bg-white/10 hover:text-white rounded-xl flex items-center gap-3 transition-colors group">
              <MessageSquare className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" /> Обсудить книгу
            </button>
            <button onClick={() => summarizeBook(contextMenu.file)} className="w-full text-left px-3 py-2.5 text-[14px] text-zinc-200 hover:bg-white/10 hover:text-white rounded-xl flex items-center gap-3 transition-colors group">
              <Zap className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-colors" /> Сделать выжимку
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reader Mode */}
      <AnimatePresence>
        {readerFile && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[200] bg-[#050505] overflow-y-auto selection:bg-indigo-500/30 hide-scrollbar"
          >
            <div className="sticky top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-center bg-gradient-to-b from-[#050505] via-[#050505]/90 to-transparent z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <BookOpen className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="text-zinc-400 font-sans text-xs md:text-sm tracking-wide truncate max-w-[200px] md:max-w-md">{readerFile.name}</div>
              </div>
              <button 
                onClick={() => setReaderFile(null)} 
                className="p-2.5 md:p-3 glass-premium rounded-full hover:bg-white/10 transition-colors group"
              >
                <X className="w-4 h-4 md:w-5 md:h-5 text-zinc-400 group-hover:text-white" />
              </button>
            </div>
            <div className="max-w-3xl mx-auto px-6 md:px-8 pb-32 pt-10">
              <h1 className="text-3xl md:text-5xl font-serif mb-10 md:mb-16 text-zinc-100 leading-tight tracking-tight">
                {readerFile.name.replace('.txt', '')}
              </h1>
              <div className="prose prose-invert prose-base md:prose-lg max-w-none font-serif text-zinc-300 leading-[2.2] tracking-wide whitespace-pre-wrap">
                {readerFile.content || "Текст документа недоступен. Пожалуйста, загрузите реальный .txt файл."}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source Modal */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setSelectedSource(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl glass-premium rounded-[2rem] overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 md:px-8 py-5 md:py-6 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${theme.bg} ${theme.border}`}>
                    <FileText className={`w-5 h-5 ${theme.text}`} />
                  </div>
                  <h3 className="text-[15px] font-medium text-zinc-200">Просмотр источника</h3>
                </div>
                <button 
                  onClick={() => setSelectedSource(null)}
                  className="p-2.5 rounded-full hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 md:p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <span className="text-lg md:text-xl font-medium text-white tracking-tight">{selectedSource.book}</span>
                  <span className="text-xs font-semibold text-zinc-400 bg-white/[0.03] px-4 py-2 rounded-full border border-white/[0.05] self-start md:self-auto">
                    {selectedSource.page}
                  </span>
                </div>
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full opacity-60 bg-gradient-to-b ${theme.gradient}`} />
                  <p className="text-[15px] md:text-[16px] text-zinc-300 leading-[1.8] pl-6 md:pl-8 font-light tracking-wide">
                    {selectedSource.text}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
