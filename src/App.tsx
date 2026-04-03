import React, { useState, useEffect, useRef } from 'react';
import { 
  Send,
  Bot,
  User,
  Calendar as CalendarIcon,
  MessageSquare,
  Clock,
  Sparkles,
  LayoutGrid,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const GOOGLE_CALENDAR_API_KEY = "AIzaSyALDbepduzEREOHW3PZI--8-gElaDeWfRE";
const CALENDAR_ID = "1b31d9021a571a9cf14fcf307f7cb12c286276c290fca73b9847ec14dd9a3406@group.calendar.google.com";
const LOGO_URL = "https://i.imgur.com/JYSeHia.png"; 

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}

interface CalendarEvent {
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'calendar' | 'grid'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: '¡Hola! Bienvenido al asistente de INSELPA. ¿Qué deseas consultar hoy?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // State for weekly upcoming events
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // State for grid month view
  const [currentGridDate, setCurrentGridDate] = useState(new Date());
  const [gridEvents, setGridEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingGrid, setIsLoadingGrid] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Fetch upcoming events for chat context and weekly view
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const now = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${GOOGLE_CALENDAR_API_KEY}&timeMin=${now}&maxResults=50&orderBy=startTime&singleEvents=true`;
        const res = await fetch(url);
        const data = await res.json();
        setEvents(data.items || []);
      } catch (err) {
        console.error("Error cargando calendario", err);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEvents();
  }, []);

  // Fetch events for the selected month in the grid view
  useEffect(() => {
    const fetchGridEvents = async () => {
      setIsLoadingGrid(true);
      try {
        const year = currentGridDate.getFullYear();
        const month = currentGridDate.getMonth();
        const timeMin = new Date(year, month, 1).toISOString();
        const timeMax = new Date(year, month + 1, 1).toISOString();
        
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${GOOGLE_CALENDAR_API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=100&orderBy=startTime&singleEvents=true`;
        const res = await fetch(url);
        const data = await res.json();
        setGridEvents(data.items || []);
      } catch (err) {
        console.error("Error cargando eventos del mes", err);
      } finally {
        setIsLoadingGrid(false);
      }
    };
    fetchGridEvents();
  }, [currentGridDate.getFullYear(), currentGridDate.getMonth()]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      // @ts-ignore - Vite env variables
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === '') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          text: "⚠️ Falta la clave de API de Gemini. En Vercel, debes nombrar la variable de entorno exactamente como VITE_GEMINI_API_KEY (con VITE_ al principio). ¡Recuerda hacer un Redeploy después de agregarla!", 
          isError: true 
        }]);
        setIsTyping(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      const context = events.map(e => `- ${e.summary}: ${new Date(e.start.dateTime || e.start.date || '').toLocaleString('es-CO')}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: `Eres el asistente de INSELPA. Responde en español sobre estos eventos:\n${context}`
        }
      });

      const text = response.text || "No obtuve respuesta.";
      setMessages(prev => [...prev, { role: 'assistant', text }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: "Error de conexión.", isError: true }]);
    } finally {
      setIsTyping(false);
    }
  };

  const weeklyEvents = events.filter(e => {
    const d = new Date(e.start.dateTime || e.start.date || '');
    const now = new Date();
    const week = new Date();
    week.setDate(now.getDate() + 7);
    return d >= now && d <= week;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50/50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
              <img src={LOGO_URL} alt="Logo INSELPA" className="h-8 w-8 object-contain" referrerPolicy="no-referrer" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">INSELPA</h1>
          </div>
          
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('chat')} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'chat' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Asistente</span>
            </button>
            <button 
              onClick={() => setActiveTab('calendar')} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <CalendarIcon size={16} />
              <span className="hidden sm:inline">Eventos</span>
            </button>
            <button 
              onClick={() => setActiveTab('grid')} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Mes</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-5xl mx-auto w-full relative">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full w-full max-w-3xl mx-auto">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-indigo-600'}`}>
                    {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                        : m.isError 
                          ? 'bg-red-50 border border-red-100 text-red-800 rounded-2xl rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-4 flex-row">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-sm">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 sm:p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
              <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                <input 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  className="flex-1 bg-transparent px-4 py-3 text-[15px] focus:outline-none placeholder:text-slate-400 min-h-[44px]" 
                  placeholder="Escribe tu consulta aquí..." 
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim() || isTyping}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white p-3 rounded-xl shadow-sm transition-colors flex-shrink-0 h-[44px] w-[44px] flex items-center justify-center"
                >
                  <Send size={18} className={inputText.trim() && !isTyping ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
                </button>
              </form>
              <div className="text-center mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Sparkles size={12} />
                <span>Asistente impulsado por IA. Puede cometer errores.</span>
              </div>
            </div>
          </div>
        ) : activeTab === 'grid' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 w-full">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight capitalize">
                  {currentGridDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1 sm:gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                  <button onClick={() => setCurrentGridDate(new Date(currentGridDate.getFullYear(), currentGridDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setCurrentGridDate(new Date())} className="px-3 py-1.5 text-sm font-medium hover:bg-slate-100 rounded-md text-slate-700 transition-colors">
                    Hoy
                  </button>
                  <button onClick={() => setCurrentGridDate(new Date(currentGridDate.getFullYear(), currentGridDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-200 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 gap-px bg-slate-200 border-b border-slate-200">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                    <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-slate-200 auto-rows-fr">
                  {/* Empty cells for days before the 1st of the month */}
                  {Array.from({ length: (new Date(currentGridDate.getFullYear(), currentGridDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[120px] bg-slate-50/50 p-2"></div>
                  ))}
                  
                  {/* Actual days of the month */}
                  {Array.from({ length: new Date(currentGridDate.getFullYear(), currentGridDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                    const day = i + 1;
                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentGridDate.getMonth() && new Date().getFullYear() === currentGridDate.getFullYear();
                    const dayEvents = gridEvents.filter(e => {
                      const eDate = new Date(e.start.dateTime || e.start.date || '');
                      return eDate.getDate() === day && eDate.getMonth() === currentGridDate.getMonth() && eDate.getFullYear() === currentGridDate.getFullYear();
                    });

                    return (
                      <div key={day} className="min-h-[80px] sm:min-h-[120px] bg-white p-1 sm:p-2 hover:bg-slate-50 transition-colors relative group flex flex-col">
                        <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 flex-shrink-0 ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700'}`}>
                          {day}
                        </div>
                        <div className="space-y-1 overflow-y-auto flex-1 no-scrollbar">
                          {isLoadingGrid ? null : dayEvents.map((e, idx) => {
                            const hasTime = !!e.start.dateTime;
                            return (
                              <div key={idx} className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 truncate" title={e.summary}>
                                {hasTime && <span className="font-semibold mr-1">{new Date(e.start.dateTime!).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</span>}
                                {e.summary}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 w-full">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Próximos Eventos</h2>
                  <p className="text-slate-500 mt-1">Actividades programadas para los próximos 7 días</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                  <CalendarIcon size={20} />
                </div>
              </div>

              {isLoadingEvents ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p>Sincronizando calendario...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weeklyEvents.length > 0 ? weeklyEvents.map((e, i) => {
                    const eventDate = new Date(e.start.dateTime || e.start.date || '');
                    return (
                      <div key={i} className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row gap-5 sm:items-center">
                        <div className="flex-shrink-0 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 text-indigo-700 rounded-xl p-3 text-center min-w-[72px] shadow-sm group-hover:scale-105 transition-transform">
                          <div className="text-2xl font-black leading-none">{eventDate.getDate()}</div>
                          <div className="text-[11px] font-bold uppercase tracking-wider mt-1 opacity-80">
                            {eventDate.toLocaleDateString('es-CO', {month: 'short'})}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-slate-800 group-hover:text-indigo-700 transition-colors">{e.summary}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Clock size={14} className="text-slate-400" />
                              <span>{eventDate.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center bg-white border border-slate-200 border-dashed rounded-2xl py-16 px-4">
                      <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <CalendarIcon size={24} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-1">Semana libre</h3>
                      <p className="text-slate-500">No hay eventos programados para los próximos 7 días.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
