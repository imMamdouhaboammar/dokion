import React, { useState, useRef, useEffect } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ChatEntry as DbChatEntry } from '../db';
import { GoogleGenAI } from '@google/genai';

interface ChatProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
  projectId?: string | null;
}

interface ChatEntry extends DbChatEntry {
  isGenerating?: boolean;
}

export function Chat({ onNavigate, projectId }: ChatProps) {
  const skill = useLiveQuery(() => projectId ? db.skills.where('projectId').equals(projectId).first() : undefined, [projectId]);
  const savedChats = useLiveQuery(() => projectId ? db.chats.where('projectId').equals(projectId).sortBy('timestamp') : [], [projectId]);

  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState<ChatEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savedChats) {
      setConversation(savedChats.map(c => ({ ...c, isGenerating: false })));
    }
  }, [savedChats]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !projectId) return;

    const prompt = input.trim();
    setInput('');
    setIsGenerating(true);

    const newEntry: ChatEntry = {
      id: Date.now().toString(),
      projectId,
      userPrompt: prompt,
      baseResponse: '',
      skillResponse: '',
      timestamp: Date.now(),
      isGenerating: true
    };

    setConversation(prev => [...prev, newEntry]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let baseResText = '';
      let skillResText = '';
      
      const tools = [];
      if (skill?.tools?.webSearch) {
        tools.push({ googleSearch: {} });
      }
      if (skill?.tools?.codeInterpreter) {
        tools.push({ codeExecution: {} });
      }
      
      // Call Skill Model
      const skillStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: skill?.instructions || 'You are a helpful assistant.',
          ...(tools.length > 0 ? { tools } : {})
        }
      });

      if (compareMode) {
        // Call Base Model
        const baseStream = await ai.models.generateContentStream({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });
        
        const processStream = async (stream: any, isBase: boolean) => {
          for await (const chunk of stream) {
            const text = chunk.text || '';
            if (isBase) {
              baseResText += text;
            } else {
              skillResText += text;
            }
            setConversation(prev => prev.map(e => 
              e.id === newEntry.id 
                ? { ...e, baseResponse: baseResText, skillResponse: skillResText } 
                : e
            ));
          }
        };

        await Promise.all([
          processStream(baseStream, true),
          processStream(skillStream, false)
        ]);
      } else {
        for await (const chunk of skillStream) {
          skillResText += chunk.text || '';
          setConversation(prev => prev.map(e => 
            e.id === newEntry.id 
              ? { ...e, skillResponse: skillResText } 
              : e
          ));
        }
      }

      const finalEntry = {
        ...newEntry,
        baseResponse: baseResText,
        skillResponse: skillResText,
        isGenerating: false
      };

      await db.chats.add({
        id: finalEntry.id,
        projectId: finalEntry.projectId,
        userPrompt: finalEntry.userPrompt,
        baseResponse: finalEntry.baseResponse,
        skillResponse: finalEntry.skillResponse,
        timestamp: finalEntry.timestamp
      });

    } catch (error) {
      console.error('Error generating response:', error);
      setConversation(prev => prev.map(entry =>
        entry.id === newEntry.id
          ? {
              ...entry,
              baseResponse: 'Error connecting to AI.',
              skillResponse: 'Error connecting to AI.',
              isGenerating: false
            }
          : entry
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex w-full bg-background">
      {/* Left: Chat Workspace */}
      <section className="flex-1 min-h-0 flex flex-col relative bg-surface-container-lowest">
        {/* Active Skills Header Bar */}
        <div className="px-6 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between z-10">
          <div className="flex items-center gap-4 overflow-x-auto hide-scrollbar">
            <span className="text-xs font-bold tracking-widest uppercase text-secondary whitespace-nowrap">Active Skill</span>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-white border border-outline-variant px-3 py-1.5 rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span className="text-xs font-medium text-on-surface whitespace-nowrap">{skill?.name || 'No Skill Selected'}</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 border-l border-outline-variant pl-4 ml-4">
            <span className="text-xs font-label text-secondary whitespace-nowrap">Compare Mode</span>
            <button 
              type="button"
              role="switch"
              aria-checked={compareMode}
              aria-label="Toggle Compare Mode"
              onClick={() => setCompareMode(!compareMode)}
              className={`w-9 h-5 rounded-full relative flex items-center px-0.5 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${compareMode ? 'bg-primary/20' : 'bg-surface-dim border border-outline-variant'}`}
            >
              <span className={`w-4 h-4 bg-primary rounded-full transition-transform shadow-sm ${compareMode ? 'translate-x-4' : 'translate-x-0'}`}></span>
            </button>
          </div>
        </div>

        {/* Chat Content (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-8 space-y-10 max-w-4xl mx-auto w-full hide-scrollbar pb-48 md:pb-32">
          
          {conversation.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <span className="material-symbols-outlined text-4xl mb-4">forum</span>
              <p className="text-sm font-medium">Send a message to test your skill.</p>
              <p className="text-xs mt-2">Compare the base model with your custom instructions.</p>
            </div>
          )}

          {conversation.map((entry) => (
            <div key={entry.id} className="space-y-10">
              {/* User Message */}
              <div className="flex gap-4 sm:gap-6 max-w-3xl">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex-shrink-0 flex items-center justify-center border border-outline-variant/50">
                  <span className="material-symbols-outlined text-secondary text-sm">person</span>
                </div>
                <div className="space-y-2 pt-1">
                  <p className="text-on-surface leading-relaxed text-[15px] whitespace-pre-wrap">
                    {entry.userPrompt}
                  </p>
                </div>
              </div>

              {/* Compare Response Layout */}
              <div className={`grid grid-cols-1 ${compareMode ? 'md:grid-cols-2' : ''} gap-6 w-full border-t border-outline-variant/40 pt-8`}>
                {/* Without Skill */}
                {compareMode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Base Model</span>
                    </div>
                    <div className="bg-surface-container-low/50 p-5 sm:p-6 rounded-2xl border border-outline-variant/40">
                      {entry.isGenerating ? (
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1 space-y-3 py-1">
                            <div className="h-2 bg-surface-container-highest rounded w-3/4"></div>
                            <div className="h-2 bg-surface-container-highest rounded"></div>
                            <div className="h-2 bg-surface-container-highest rounded w-5/6"></div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-secondary leading-relaxed italic text-[14px] whitespace-pre-wrap">
                          {entry.baseResponse}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* With Skill */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">With {skill?.name || 'Skill'}</span>
                  </div>
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border-l-4 border-primary shadow-sm">
                    {entry.isGenerating ? (
                      <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-3 py-1">
                          <div className="h-2 bg-surface-container-highest rounded w-3/4"></div>
                          <div className="h-2 bg-surface-container-highest rounded"></div>
                          <div className="h-2 bg-surface-container-highest rounded w-5/6"></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-on-surface leading-relaxed text-[14px] whitespace-pre-wrap">
                        {entry.skillResponse}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Composer Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-surface-container-lowest border-t border-outline-variant/40">
          <div className="max-w-4xl mx-auto bg-surface-container-low border border-outline-variant rounded-2xl p-3 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <textarea 
              aria-label="Skill prompt input"
              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-outline font-body resize-none h-16 sm:h-20 p-2" 
              placeholder="How should the AI use your skill now?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            ></textarea>
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-outline-variant/40">
              <div className="flex items-center gap-2 sm:gap-4 text-secondary px-2">
                <button type="button" aria-label="Attach file" className="hover:text-primary transition-colors flex items-center gap-1.5 p-1 focus-visible:ring-2 focus-visible:ring-primary rounded">
                  <span className="material-symbols-outlined text-lg">attach_file</span>
                  <span className="text-xs font-medium hidden sm:inline">Attach</span>
                </button>
                <button type="button" aria-label="Context settings" className="hover:text-primary transition-colors flex items-center gap-1.5 p-1 focus-visible:ring-2 focus-visible:ring-primary rounded">
                  <span className="material-symbols-outlined text-lg">history</span>
                  <span className="text-xs font-medium hidden sm:inline">Context</span>
                </button>
              </div>
              <button 
                type="button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={isGenerating || !input.trim()}
                className="bg-primary text-on-primary w-10 h-10 rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined filled">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-center text-secondary mt-3 hidden sm:block">
            Testing workspace. Changes to skills must be saved in the Library.
          </p>
        </div>
      </section>

      {/* Right: Skill Inspector Panel */}
      {isInspectorOpen ? (
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 bg-surface-container-low border-l border-outline-variant z-20 transition-all duration-300">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface">
            <h2 className="font-headline text-xl text-on-surface">Output Inspector</h2>
            <button 
              type="button"
              aria-label="Close Inspector"
              onClick={() => setIsInspectorOpen(false)}
              className="p-1 hover:bg-surface-container rounded-lg transition-colors text-secondary focus-visible:ring-2 focus-visible:ring-primary"
              title="Close Inspector"
            >
              <span className="material-symbols-outlined">dock_to_right</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar pb-24">
            
            {/* Skill Trigger Event */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">Internal Triggers</span>
                <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold tracking-wide">SUCCESS</span>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl font-mono text-xs leading-relaxed shadow-sm">
                <div className="text-primary"><span className="text-outline">// Active Skill:</span> {skill?.name || 'None'}</div>
                <div className="mt-2 text-on-surface">
                  {'{'}<br/>
                  &nbsp;&nbsp;"status": "applied",<br/>
                  &nbsp;&nbsp;"instructions_length": {skill?.instructions?.length || 0}<br/>
                  {'}'}
                </div>
              </div>
            </div>

            {/* Prompt Injection Logs */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-secondary uppercase tracking-wider">System Instruction</span>
              <div className="text-sm text-on-surface leading-relaxed italic bg-surface-bright border-l-2 border-primary/40 p-4 rounded-r-xl shadow-sm">
                {skill?.instructions ? `"${skill.instructions}"` : "No instructions defined. The model will use its default behavior."}
              </div>
            </div>

          </div>
        </aside>
      ) : (
        <div className="hidden lg:flex flex-col border-l border-outline-variant bg-surface-container-low z-20">
          <button 
            type="button"
            aria-label="Open Inspector"
            onClick={() => setIsInspectorOpen(true)}
            className="p-4 hover:bg-surface-container transition-colors text-secondary h-full flex items-start focus-visible:ring-2 focus-visible:ring-primary"
            title="Open Inspector"
          >
            <span className="material-symbols-outlined">dock_to_left</span>
          </button>
        </div>
      )}
    </div>
  );
}
