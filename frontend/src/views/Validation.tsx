import React from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

interface ValidationProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
  projectId?: string | null;
}

export function Validation({ onNavigate, projectId }: ValidationProps) {
  const project = useLiveQuery(() => projectId ? db.projects.get(projectId) : undefined, [projectId]);
  const skills = useLiveQuery(() => projectId ? db.skills.where('projectId').equals(projectId).toArray() : [], [projectId]);
  const skill = skills?.[0];

  const hasInstructions = skill && skill.instructions.length > 50;
  const hasExamples = skill && skill.examples.length > 0;
  const hasTools = skill && (skill.tools?.webSearch || skill.tools?.codeInterpreter);
  
  const structureScore = hasInstructions ? 98 : 40;
  const clarityScore = hasInstructions ? 85 : 30;
  const triggersScore = 62; // Placeholder
  const examplesScore = hasExamples ? 100 : 0;
  
  const readiness = Math.round((structureScore + clarityScore + triggersScore + examplesScore) / 4);

  if (!projectId || !project) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-headline mb-4">No Project Selected</h2>
          <button type="button" onClick={() => onNavigate('home')} className="bg-primary text-on-primary px-6 py-2 rounded-xl focus-visible:ring-2 focus-visible:ring-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex w-full bg-background relative">
      {/* SideNavBar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-outline-variant bg-surface-container-low">
        <div className="p-4 border-b border-outline-variant">
          <p className="font-headline text-primary text-lg leading-tight">Quality Dimensions</p>
          <p className="text-secondary text-xs font-medium tracking-wide uppercase mt-1">Validation Workspace</p>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto hide-scrollbar">
          <button type="button" className="bg-primary/10 text-primary font-bold rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left focus-visible:ring-2 focus-visible:ring-primary">
            <span className="material-symbols-outlined">account_tree</span>
            <span className="text-sm">Structure</span>
          </button>
          <button type="button" className="text-secondary px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors rounded-lg text-left focus-visible:ring-2 focus-visible:ring-primary">
            <span className="material-symbols-outlined">auto_awesome</span>
            <span className="text-sm">Clarity</span>
          </button>
          <button type="button" className="text-secondary px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors rounded-lg text-left focus-visible:ring-2 focus-visible:ring-primary">
            <span className="material-symbols-outlined">bolt</span>
            <span className="text-sm">Triggers</span>
          </button>
          <button type="button" className="text-secondary px-4 py-3 flex items-center gap-3 hover:bg-surface-container-high transition-colors rounded-lg text-left focus-visible:ring-2 focus-visible:ring-primary">
            <span className="material-symbols-outlined">library_books</span>
            <span className="text-sm">Examples</span>
          </button>
        </div>
        <div className="p-4 border-t border-outline-variant">
          <button type="button" className="w-full bg-primary text-on-primary py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary">
            <span className="material-symbols-outlined text-sm">add</span>
            New Check
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 overflow-y-auto bg-surface-bright p-6 md:p-10 hide-scrollbar pb-40 md:pb-24">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-headline tracking-tight text-on-surface">Validation: {project.name}</h1>
              <p className="text-secondary mt-2 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Last checked just now
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="px-6 py-2.5 rounded-lg border border-outline-variant text-on-surface font-semibold hover:bg-surface-container-low transition-colors focus-visible:ring-2 focus-visible:ring-primary">Re-run All Tests</button>
              <button type="button" className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-primary">View Final Report</button>
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Summary Block */}
            <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-8 sm:gap-12 shadow-sm">
              <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90">
                  <circle className="text-surface-container" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="8"></circle>
                  <circle className="text-primary" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset="52.8" strokeWidth="8"></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-headline font-bold text-on-surface">{readiness}%</span>
                  <span className="text-xs uppercase tracking-wider text-primary font-bold">Readiness</span>
                </div>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-3xl font-headline text-on-surface mb-2">Almost Ready</h2>
                <p className="text-secondary max-w-md mb-6 mx-auto sm:mx-0">Your skill logic is highly cohesive, but a few critical resource links are missing for full deployment.</p>
                <div className="flex justify-center sm:justify-start gap-8">
                  <div>
                    <span className="block text-2xl font-headline text-error font-bold">2</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Blockers</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-headline text-amber-600 font-bold">4</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Warnings</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-headline text-emerald-600 font-bold">12</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Passed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps Panel */}
            <div className="lg:col-span-4 bg-primary text-on-primary rounded-2xl p-8 flex flex-col justify-between shadow-md">
              <div>
                <h3 className="text-xl font-headline font-semibold mb-6">Readiness Preview</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-on-primary/10 p-4 rounded-xl">
                    <span className="material-symbols-outlined text-emerald-300">check_circle</span>
                    <div>
                      <p className="font-bold text-sm">Safe to Test</p>
                      <p className="text-white/70 text-xs">Sandbox environment ready</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-on-primary/10 p-4 rounded-xl border border-on-primary/20">
                    <span className="material-symbols-outlined text-amber-300">warning</span>
                    <div>
                      <p className="font-bold text-sm">Export Preview</p>
                      <p className="text-white/70 text-xs">Restricted until blockers fixed</p>
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" className="w-full bg-white text-primary font-bold py-3 rounded-xl mt-6 hover:bg-surface-container-lowest transition-colors focus-visible:ring-2 focus-visible:ring-primary">Start Final Verification</button>
            </div>

            {/* Dimensions Panel */}
            <div className="lg:col-span-12">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-headline text-on-surface">Dimensions Analysis</h2>
                <button type="button" className="text-primary font-bold text-sm flex items-center gap-1 hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded px-1">
                  Compare with historical data
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Dimension Card 1 */}
                <div className="bg-surface-container-low border border-outline-variant/40 p-6 rounded-2xl hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                      <span className="material-symbols-outlined">account_tree</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Passed</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold mb-1">Structure</h3>
                  <p className="text-xs text-secondary mb-6">Hierarchy and nodal integrity verified.</p>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-headline font-bold text-on-surface">{structureScore}%</span>
                    <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5">View Details</button>
                  </div>
                </div>

                {/* Dimension Card 2 */}
                <div className="bg-surface-container-low border border-outline-variant/40 p-6 rounded-2xl border-l-4 border-l-amber-500 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                      <span className="material-symbols-outlined">auto_awesome</span>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Attention</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold mb-1">Clarity</h3>
                  <p className="text-xs text-secondary mb-6">Some prompts contain ambiguous phrasing.</p>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-headline font-bold text-on-surface">{clarityScore}%</span>
                    <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5">View Details</button>
                  </div>
                </div>

                {/* Dimension Card 3 */}
                <div className="bg-surface-container-low border border-outline-variant/40 p-6 rounded-2xl border-l-4 border-l-amber-500 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                      <span className="material-symbols-outlined">bolt</span>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Attention</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold mb-1">Triggers</h3>
                  <p className="text-xs text-secondary mb-6">User intent matching needs refinement.</p>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-headline font-bold text-on-surface">{triggersScore}%</span>
                    <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5">View Details</button>
                  </div>
                </div>

                {/* Dimension Card 4 */}
                <div className="bg-surface-container-low border border-outline-variant/40 p-6 rounded-2xl hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                      <span className="material-symbols-outlined">library_books</span>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded uppercase tracking-wider">Passed</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold mb-1">Examples</h3>
                  <p className="text-xs text-secondary mb-6">Training set coverage is exhaustive.</p>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-headline font-bold text-on-surface">{examplesScore}%</span>
                    <button type="button" className="text-primary text-xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5">View Details</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Issues Panel */}
            <div className="lg:col-span-7">
              <h2 className="text-2xl font-headline text-on-surface mb-6">Issues & Critical Findings</h2>
              <div className="space-y-4">
                <div className="bg-white border border-outline-variant/60 rounded-2xl p-5 flex items-start gap-4 hover:border-error transition-all group shadow-sm">
                  <div className="mt-1 flex-shrink-0">
                    <span className="material-symbols-outlined text-error filled">error</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-on-surface">Missing Resource Link</h3>
                        <p className="text-sm text-secondary mt-1">Component 'DataCleaner' refers to an external documentation link that returns a 404 error.</p>
                      </div>
                      <button 
                        onClick={() => onNavigate('editor', projectId)}
                        className="px-4 py-1.5 bg-error/10 text-error font-bold text-xs rounded-lg hover:bg-error hover:text-white transition-all"
                      >
                        Fix
                      </button>
                    </div>
                    <div className="mt-4 flex gap-4">
                      <span className="text-[10px] font-bold bg-surface-container-highest text-secondary px-2 py-0.5 rounded uppercase">Blocker</span>
                      <span className="text-[10px] font-bold text-outline">ID: SK-1029</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant/60 rounded-2xl p-5 flex items-start gap-4 hover:border-amber-500 transition-all group shadow-sm">
                  <div className="mt-1 flex-shrink-0">
                    <span className="material-symbols-outlined text-amber-500 filled">warning</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-on-surface">Ambiguous Trigger</h3>
                        <p className="text-sm text-secondary mt-1">The phrase 'Analyze this' matches both Data Processing and Visual Report generation triggers.</p>
                      </div>
                      <button 
                        onClick={() => onNavigate('editor', projectId)}
                        className="px-4 py-1.5 bg-amber-500/10 text-amber-700 font-bold text-xs rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                      >
                        Fix
                      </button>
                    </div>
                    <div className="mt-4 flex gap-4">
                      <span className="text-[10px] font-bold bg-surface-container-highest text-secondary px-2 py-0.5 rounded uppercase">Warning</span>
                      <span className="text-[10px] font-bold text-outline">ID: SK-1044</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Panel */}
            <div className="lg:col-span-5">
              <h2 className="text-2xl font-headline text-on-surface mb-6">Latest Test Results</h2>
              <div className="bg-surface-container-low rounded-2xl p-8 h-full flex flex-col justify-between border border-outline-variant/40 shadow-sm">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex -space-x-3">
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center text-secondary text-xs font-bold">JD</div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-dim flex items-center justify-center text-secondary text-xs font-bold">AL</div>
                      <div className="w-10 h-10 rounded-full border-2 border-white bg-outline flex items-center justify-center text-white text-xs font-bold">+1</div>
                    </div>
                    <p className="text-xs text-secondary font-medium italic">Summary of the last 3 chat sessions</p>
                  </div>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-outline-variant/40 pb-4">
                      <span className="text-sm font-medium text-secondary">Logic Match Accuracy</span>
                      <span className="text-xl font-headline font-bold text-primary">94%</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-outline-variant/40 pb-4">
                      <span className="text-sm font-medium text-secondary">Response Latency</span>
                      <span className="text-xl font-headline font-bold text-on-surface">1.2s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-secondary">User Sentiment Score</span>
                      <span className="text-xl font-headline font-bold text-emerald-600">4.8<small className="text-xs text-outline">/5</small></span>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <button onClick={() => onNavigate('chat', projectId)} className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline">
                    Review Conversations
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
