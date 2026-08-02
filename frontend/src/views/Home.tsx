import React from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDistanceToNow } from '../utils/date';

interface HomeProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const recentProjects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().limit(4).toArray());
  const lastSession = useLiveQuery(() => db.sessions.orderBy('lastActive').reverse().first());
  const lastProject = useLiveQuery(() => lastSession ? db.projects.get(lastSession.projectId) : undefined, [lastSession]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newProjectId = crypto.randomUUID();
      const newSkillId = crypto.randomUUID();

      const firstPath = files[0].webkitRelativePath;
      const folderName = firstPath ? firstPath.split('/')[0] : 'Uploaded Folder';

      await db.projects.add({
        id: newProjectId,
        name: folderName,
        description: `Imported from local folder: ${folderName}`,
        type: 'OTHER',
        status: 'In Development',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.skills.add({
        id: newSkillId,
        projectId: newProjectId,
        name: folderName,
        instructions: `Analyze the uploaded folder structure and contents for ${folderName}.`,
        triggers: [],
        examples: [],
        tools: { webSearch: false, codeInterpreter: true },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.sessions.add({
        id: crypto.randomUUID(),
        projectId: newProjectId,
        lastActive: Date.now(),
        progress: 0,
        context: `Imported folder ${folderName} with ${files.length} files.`
      });

      onNavigate('editor', newProjectId);
    } catch (error) {
      console.error('Failed to create project from folder:', error);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-5xl mx-auto">
        
        {/* Hero / Resume Session Banner */}
        {lastProject && (
          <div className="relative rounded-3xl bg-surface-container-high border border-outline-variant p-8 mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="relative z-10 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs font-semibold text-primary mb-4">
                <span className="material-symbols-outlined text-sm filled">bolt</span>
                CONTINUE EXPLORING
              </div>
              <h2 className="text-3xl md:text-4xl font-headline text-on-surface leading-tight mb-3">
                Resume Last Session
              </h2>
              <p className="text-secondary font-body leading-relaxed mb-6">
                You were working on <span className="text-on-surface font-semibold">{lastProject.name}</span>. Ready to finalize the deployment?
              </p>
              <button 
                type="button"
                onClick={() => onNavigate('editor', lastProject.id)}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Open Workspace
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            <div className="relative w-full md:w-64 h-48 bg-surface-container-highest rounded-2xl flex items-center justify-center border-2 border-dashed border-outline-variant">
              <div className="absolute inset-0 bg-primary/5 rounded-2xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-surface p-4 rounded-xl shadow-sm border border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-4xl">data_object</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bento Grid Section: Quick Actions & Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          
          {/* Quick Actions Card (1/3) */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <h2 className="text-2xl font-headline px-2 text-on-surface">Quick Actions</h2>
            <div className="flex flex-col gap-3">
              <QuickActionCard 
                icon="auto_fix_high" 
                title="SEO/AEO/GEO Engine" 
                desc="Generate & Audit AI Articles" 
                onClick={() => onNavigate('seo-engine')}
              />
              <QuickActionCard 
                icon="terminal" 
                title="Create from GitHub" 
                desc="Import repository structure" 
                onClick={() => onNavigate('github')}
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFolderUpload} 
                className="hidden" 
                {...{ webkitdirectory: "", directory: "" } as any}
              />
              <QuickActionCard 
                icon="upload_file" 
                title="Upload Folder" 
                desc="Local-first processing" 
                onClick={() => fileInputRef.current?.click()}
              />
              <QuickActionCard 
                icon="add" 
                title="New Skill" 
                desc="Choose starting point" 
                onClick={() => onNavigate('create')}
              />
            </div>
          </div>

          {/* Recent Projects (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-headline text-on-surface">Recent Projects</h2>
              <button 
                type="button"
                onClick={() => onNavigate('library')}
                className="text-sm text-primary font-semibold hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
              >
                View All
              </button>
            </div>
            
            {recentProjects === undefined ? (
               <div className="text-secondary text-sm px-2">Loading projects...</div>
            ) : recentProjects.length === 0 ? (
               <div className="text-secondary text-sm px-2 py-8 text-center border border-dashed border-outline-variant rounded-2xl">
                 No projects yet. Start by creating one!
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentProjects.map(project => (
                  <ProjectCard 
                    key={project.id}
                    type={project.type} 
                    title={project.name} 
                    desc={project.description}
                    status={project.status}
                    statusColor={project.status === 'Deployed' ? 'bg-emerald-600' : 'bg-primary'}
                    time={`Modified ${formatDistanceToNow(project.updatedAt)}`}
                    onClick={() => onNavigate('editor', project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Premium Empty State / Footer Focus */}
        <div className="mt-8 p-10 md:p-12 text-center bg-surface-container-low border border-outline-variant/40 rounded-3xl max-w-4xl mx-auto">
          <div className="mb-6 inline-block p-4 rounded-full bg-white shadow-sm border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-4xl filled">auto_awesome</span>
          </div>
          <h2 className="text-3xl font-headline mb-4 text-on-surface">Build Skills That Think With You</h2>
          <p className="text-secondary font-body max-w-lg mx-auto mb-8">
            Elevate your skills from simple chat prompts to structured, testable, and portable packages. Join the Skillaude workspace to build reliable AI capabilities.
          </p>
          <button 
            type="button"
            onClick={() => onNavigate('library')}
            className="bg-on-surface text-surface px-8 py-3.5 rounded-xl font-bold hover:bg-on-surface/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Explore Skillaude
          </button>
        </div>

      </div>
    </div>
  );
}

function QuickActionCard({ icon, title, desc, onClick }: { icon: string, title: string, desc: string, onClick?: () => void }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <span className="material-symbols-outlined text-secondary group-hover:text-primary">{icon}</span>
      </div>
      <div>
        <div className="font-bold text-on-surface text-sm">{title}</div>
        <div className="text-xs text-secondary mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

function ProjectCard({ type, title, desc, status, statusColor, time, onClick }: any) {
  return (
    <button 
      type="button"
      onClick={onClick} 
      className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant hover:shadow-md transition-shadow flex flex-col h-full text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex justify-between items-start mb-4 w-full">
        <span className="px-3 py-1 bg-surface-container rounded-lg text-xs font-bold tracking-wider text-secondary uppercase">
          {type}
        </span>
        <button 
          type="button"
          aria-label="More options"
          className="text-outline hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1" 
          onClick={(e) => { e.stopPropagation(); }}
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      <h3 className="text-xl font-headline mb-2 text-on-surface">{title}</h3>
      <p className="text-sm text-secondary font-body mb-6 flex-1">{desc}</p>
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/40 w-full">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
          <span className="text-xs text-secondary font-medium">{status}</span>
        </div>
        <span className="text-xs text-outline">{time}</span>
      </div>
    </button>
  );
}
