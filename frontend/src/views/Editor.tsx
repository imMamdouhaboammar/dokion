import React, { useEffect, useState } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Skill, Project } from '../db';

interface EditorProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
  projectId?: string | null;
}

export function Editor({ onNavigate, projectId }: EditorProps) {
  const project = useLiveQuery(() => projectId ? db.projects.get(projectId) : undefined, [projectId]);
  const skills = useLiveQuery(() => projectId ? db.skills.where('projectId').equals(projectId).toArray() : [], [projectId]);
  const skill = skills?.[0];

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showAddExample, setShowAddExample] = useState(false);
  const [newExampleInput, setNewExampleInput] = useState('');
  const [newExampleOutput, setNewExampleOutput] = useState('');

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setInstructions(skill.instructions);
    }
  }, [skill]);

  const handleAddExample = async () => {
    if (!skill || !newExampleInput.trim() || !newExampleOutput.trim()) return;
    
    const updatedExamples = [...skill.examples, { input: newExampleInput, output: newExampleOutput }];
    await db.skills.update(skill.id, {
      examples: updatedExamples,
      updatedAt: Date.now()
    });
    
    setNewExampleInput('');
    setNewExampleOutput('');
    setShowAddExample(false);
  };

  const handleRemoveExample = async (index: number) => {
    if (!skill) return;
    const updatedExamples = skill.examples.filter((_, i) => i !== index);
    await db.skills.update(skill.id, {
      examples: updatedExamples,
      updatedAt: Date.now()
    });
  };

  const toggleTool = async (toolName: 'webSearch' | 'codeInterpreter') => {
    if (!skill) return;
    const currentTools = skill.tools || { webSearch: false, codeInterpreter: false };
    await db.skills.update(skill.id, {
      tools: {
        ...currentTools,
        [toolName]: !currentTools[toolName]
      },
      updatedAt: Date.now()
    });
  };

  const [isHealthBarOpen, setIsHealthBarOpen] = useState(true);

  // Auto-save effect
  useEffect(() => {
    if (!skill || !projectId) return;
    
    const isAutoSaveEnabled = localStorage.getItem('autoSave') !== 'false';
    if (!isAutoSaveEnabled) return;

    const timeout = setTimeout(async () => {
      if (name !== skill.name || instructions !== skill.instructions) {
        const updates = [
          db.skills.update(skill.id, {
            name,
            instructions,
            updatedAt: Date.now()
          }),
          db.projects.update(projectId, {
            name, // Keep project name in sync with main skill name
            updatedAt: Date.now()
          })
        ];
        
        // Update session
        const session = await db.sessions.where('projectId').equals(projectId).first();
        if (session) {
          updates.push(db.sessions.update(session.id, { lastActive: Date.now() }));
        }
        
        await Promise.all(updates);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [name, instructions, skill, projectId]);

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-headline mb-4">No Project Selected</h2>
          <button onClick={() => onNavigate('home')} className="bg-primary text-on-primary px-6 py-2 rounded-xl">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!project || !skill) {
    return <div className="flex h-full w-full items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="flex-1 min-h-0 flex w-full bg-background relative">
      
      {/* Left: Version History (Sidebar) */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-outline-variant bg-surface-container-low">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">History</span>
          <span className="material-symbols-outlined text-sm text-secondary">history</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar">
          <div className="p-3 bg-surface-container-highest rounded-xl border-l-4 border-primary shadow-sm">
            <div className="text-xs text-primary font-bold mb-1">Current Version</div>
            <div className="text-sm font-semibold text-on-surface">Working Draft</div>
            <div className="text-[10px] text-secondary mt-1">Autosaved</div>
          </div>
        </div>
      </aside>

      {/* Middle: Rich Form Editor */}
      <section className="flex-1 min-h-0 overflow-y-auto bg-surface-bright p-6 md:p-10 hide-scrollbar pb-40 md:pb-24">
        <div className="max-w-3xl mx-auto space-y-12">
          
          {/* Skill Header */}
          <header className="space-y-2 flex justify-between items-start">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase tracking-wider text-primary">Skill Identity</label>
              <input 
                type="text" 
                aria-label="Skill name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-4xl md:text-5xl font-headline italic bg-transparent border-none focus-visible:ring-2 focus-visible:ring-primary p-0 text-on-surface placeholder-outline rounded"
                placeholder="Enter Skill Name..."
              />
            </div>
            {localStorage.getItem('autoSave') === 'false' && (
              <button 
                type="button"
                onClick={async () => {
                  if (!skill || !projectId) return;
                  await db.skills.update(skill.id, { name, instructions, updatedAt: Date.now() });
                  await db.projects.update(projectId, { name, updatedAt: Date.now() });
                }}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary"
              >
                Save Changes
              </button>
            )}
          </header>

          {/* Instructions Panel */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-headline text-2xl text-on-surface">Instructions</h2>
              <button type="button" aria-label="Collapse instructions" className="text-secondary hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded p-1">
                <span className="material-symbols-outlined">unfold_less</span>
              </button>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-colors">
              <textarea 
                aria-label="System instructions"
                className="w-full bg-transparent border-none focus-visible:ring-2 focus-visible:ring-primary text-on-surface leading-relaxed resize-none font-body rounded" 
                rows={6}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Define how the AI should behave..."
              />
            </div>
          </div>

          {/* Tools & Capabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-headline text-2xl text-on-surface">Tools</h3>
              <div className="space-y-3">
                <button 
                  type="button"
                  role="switch"
                  aria-checked={Boolean(skill.tools?.webSearch)}
                  aria-label="Web Search tool"
                  onClick={() => toggleTool('webSearch')}
                  className={`w-full flex items-center justify-between p-4 bg-surface-container-lowest border rounded-xl shadow-sm cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${skill.tools?.webSearch ? 'border-primary' : 'border-outline-variant'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${skill.tools?.webSearch ? 'text-primary' : 'text-secondary'}`}>search</span>
                    <span className="text-sm font-medium text-on-surface">Web Search</span>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${skill.tools?.webSearch ? 'bg-primary' : 'bg-surface-dim border border-outline-variant'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.tools?.webSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
                <button 
                  type="button"
                  role="switch"
                  aria-checked={Boolean(skill.tools?.codeInterpreter)}
                  aria-label="Code Interpreter tool"
                  onClick={() => toggleTool('codeInterpreter')}
                  className={`w-full flex items-center justify-between p-4 bg-surface-container-lowest border rounded-xl shadow-sm cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${skill.tools?.codeInterpreter ? 'border-primary' : 'border-outline-variant'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${skill.tools?.codeInterpreter ? 'text-primary' : 'text-secondary'}`}>code</span>
                    <span className="text-sm font-medium text-on-surface">Code Interpreter</span>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${skill.tools?.codeInterpreter ? 'bg-primary' : 'bg-surface-dim border border-outline-variant'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${skill.tools?.codeInterpreter ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-headline text-2xl text-on-surface">References</h3>
              <div className="p-6 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container hover:border-primary/40 transition-colors h-[132px]">
                <span className="material-symbols-outlined text-secondary mb-2 text-3xl">upload_file</span>
                <span className="text-sm font-medium text-secondary">Upload PDFs or Docs</span>
              </div>
            </div>
          </div>

          {/* Examples Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-2xl text-on-surface">Examples</h3>
              <button 
                type="button"
                onClick={() => setShowAddExample(!showAddExample)}
                className="text-sm font-bold text-primary flex items-center gap-1 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="material-symbols-outlined text-sm">{showAddExample ? 'close' : 'add'}</span> 
                {showAddExample ? 'Cancel' : 'Add Example'}
              </button>
            </div>
            
            {showAddExample && (
              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-primary/30 shadow-sm space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary mb-1 block">User Query</label>
                  <textarea 
                    aria-label="User query example"
                    value={newExampleInput}
                    onChange={(e) => setNewExampleInput(e.target.value)}
                    placeholder="e.g. Summarize this article..."
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm focus-visible:ring-2 focus-visible:ring-primary resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-primary mb-1 block">Expected AI Output</label>
                  <textarea 
                    aria-label="Expected AI output example"
                    value={newExampleOutput}
                    onChange={(e) => setNewExampleOutput(e.target.value)}
                    placeholder="e.g. Here is a summary of the article..."
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm focus-visible:ring-2 focus-visible:ring-primary resize-none"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={handleAddExample}
                    disabled={!newExampleInput.trim() || !newExampleOutput.trim()}
                    className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Save Example
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {skill.examples.length === 0 ? (
                <div className="p-5 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant text-center text-secondary text-sm">
                  No examples added yet.
                </div>
              ) : (
                skill.examples.map((ex, i) => (
                  <div key={i} className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant relative group">
                    <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-2">User Query</div>
                    <div className="text-sm italic mb-4 text-on-surface">"{ex.input}"</div>
                    
                    <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">AI Output</div>
                    <div className="text-sm text-on-surface leading-relaxed">{ex.output}</div>
                    
                    <button 
                      type="button"
                      aria-label="Remove example"
                      onClick={() => handleRemoveExample(i)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-outline hover:text-error focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Right: Live Preview Window */}
      <aside className="hidden xl:flex flex-col w-[400px] border-l border-outline-variant bg-surface">
        <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Live Interpretation</span>
          </div>
          <button 
            type="button"
            aria-label="Refresh preview"
            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors text-secondary focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-6 hide-scrollbar">
          {/* Preview Card */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant">
            <div className="h-32 relative bg-surface-container-high rounded-t-2xl p-5 flex flex-col justify-end">
              <h3 className="font-headline text-2xl text-on-surface font-bold">{name || 'Untitled Skill'}</h3>
              <p className="text-xs text-secondary uppercase tracking-widest font-bold mt-1">Draft Version</p>
            </div>
            
            <div className="p-5 space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-bold text-secondary uppercase tracking-widest">Tone Analysis</div>
                <div className="flex gap-1.5">
                  <div className="h-1.5 flex-1 bg-primary rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-primary rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-surface-container-high rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-surface-container-high rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-surface-container-high rounded-full"></div>
                </div>
                <div className="text-xs text-secondary italic mt-1">Neutral</div>
              </div>
              
              <div className="space-y-2">
                <div className="text-xs font-bold text-secondary uppercase tracking-widest">Projected Output</div>
                <div className="bg-surface-container-low p-4 rounded-xl text-xs leading-relaxed text-on-surface/80 font-mono border border-outline-variant/50">
                  <span className="text-primary">[System Ready]</span><br/>
                  Awaiting instructions...
                </div>
              </div>
            </div>
          </div>
          
          {/* Insight Tip */}
          <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5 filled">lightbulb</span>
              <div>
                <p className="font-bold text-sm text-on-surface mb-1">Creator Tip</p>
                <p className="text-xs text-secondary leading-relaxed">
                  {instructions.length < 50 
                    ? "Add more detailed instructions to define the AI's behavior clearly." 
                    : "Your instructions are looking good! Consider adding examples to improve accuracy."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Validation Status Bar (Fixed at bottom) */}
      <footer 
        className={`absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-surface-container-lowest flex items-center px-6 justify-between z-20 transition-transform duration-300 ${
          isHealthBarOpen ? 'h-14 translate-y-0' : 'h-14 translate-y-[calc(100%-4px)]'
        }`}
      >
        <button 
          type="button"
          aria-label="Toggle Skill Health Bar"
          onClick={() => setIsHealthBarOpen(!isHealthBarOpen)}
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-3 bg-surface-container-lowest border border-outline-variant border-b-0 rounded-t-full flex items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="w-4 h-0.5 bg-outline rounded-full"></div>
        </button>
        
        <div className={`flex items-center gap-6 transition-opacity duration-300 ${isHealthBarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-secondary uppercase tracking-widest">Skill Health</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-4 bg-primary rounded-full"></div>
              <div className="w-1.5 h-4 bg-primary rounded-full"></div>
              <div className="w-1.5 h-4 bg-surface-dim rounded-full"></div>
              <div className="w-1.5 h-4 bg-surface-dim rounded-full"></div>
              <div className="w-1.5 h-4 bg-surface-dim rounded-full"></div>
            </div>
            <span className="text-sm font-bold text-primary ml-1">40%</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-outline-variant"></div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-secondary font-medium">
            <span className="material-symbols-outlined text-sm text-amber-600 filled">warning</span>
            <span className="text-amber-700">Add examples to improve health</span>
          </div>
        </div>
        <div className={`hidden md:flex items-center gap-4 text-xs text-secondary font-medium tracking-wide transition-opacity duration-300 ${isHealthBarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Local storage active
          </span>
          <span className="text-outline-variant">|</span>
          <span>Autosaved</span>
        </div>
      </footer>
    </div>
  );
}
