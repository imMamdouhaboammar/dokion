import React from 'react';
import { ViewState } from '../App';
import { db } from '../db';

interface CreationMethodPickerProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
}

export function CreationMethodPicker({ onNavigate }: CreationMethodPickerProps) {
  const handleStartBlank = async () => {
    try {
      const newProjectId = crypto.randomUUID();
      const newSkillId = crypto.randomUUID();

      await db.projects.add({
        id: newProjectId,
        name: 'Untitled Skill',
        description: 'A new blank project.',
        type: 'OTHER',
        status: 'In Development',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.skills.add({
        id: newSkillId,
        projectId: newProjectId,
        name: 'Untitled Skill',
        instructions: '',
        triggers: [],
        examples: [],
        tools: { webSearch: false, codeInterpreter: false },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.sessions.add({
        id: crypto.randomUUID(),
        projectId: newProjectId,
        lastActive: Date.now(),
        progress: 0,
        context: 'Started a blank project'
      });

      onNavigate('editor', newProjectId);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

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
    <div className="flex-1 min-h-0 flex w-full bg-background relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFolderUpload} 
        className="hidden" 
        {...{ webkitdirectory: "", directory: "" } as any}
      />
      {/* Main Content Cluster */}
      <main className="flex-1 flex min-h-0 overflow-y-auto">
        {/* Center Canvas */}
        <div className="flex-1 px-6 md:px-12 py-10 max-w-5xl mx-auto pb-40 md:pb-24">
          <section className="space-y-12">
            <header className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-headline font-semibold text-on-surface leading-tight tracking-tight">Choose your starting point</h2>
              <p className="mt-4 text-lg font-body text-on-surface-variant leading-relaxed">A skill is a structured package of instructions, scripts, and assets. Select a method to initialize your workspace.</p>
            </header>
            
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">How are you starting today?</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="px-4 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-semibold border border-primary/20 hover:bg-primary-container transition-colors focus-visible:ring-2 focus-visible:ring-primary">From a repo</button>
                  <button type="button" className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold border border-outline-variant hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary">From local files</button>
                  <button type="button" className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold border border-outline-variant hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary">From scratch</button>
                  <button type="button" className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold border border-outline-variant hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary">From a package</button>
                </div>
              </div>

              {/* 2x2 Method Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1 */}
                <button 
                  type="button"
                  onClick={() => onNavigate('github')}
                  className="group text-left bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm hover:border-primary hover:shadow-md transition-colors duration-300 cursor-pointer relative focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col h-full">
                    <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-primary text-2xl">code</span>
                    </div>
                    <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">Connect GitHub</h3>
                    <p className="text-on-surface-variant text-sm font-body leading-relaxed mb-8">Best if your skill already lives in a repo. We'll handle continuous validation and versioning.</p>
                    <div className="mt-auto flex items-center text-primary text-sm font-bold tracking-tight">
                      Start Integration
                      <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                    </div>
                  </div>
                </button>

                {/* Card 2 */}
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group text-left bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm hover:border-primary hover:shadow-md transition-colors duration-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col h-full">
                    <div className="w-12 h-12 rounded-lg bg-secondary-fixed flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-secondary text-2xl">folder</span>
                    </div>
                    <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">Upload Folder</h3>
                    <p className="text-on-surface-variant text-sm font-body leading-relaxed mb-8">Best for local markdown, scripts, and docs. Select your existing local workspace folder.</p>
                    <div className="mt-auto flex items-center text-primary text-sm font-bold tracking-tight">
                      Select Folder
                      <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                    </div>
                  </div>
                </button>

                {/* Card 3 */}
                <button 
                  type="button"
                  onClick={handleStartBlank}
                  className="group text-left bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm hover:border-primary hover:shadow-md transition-colors duration-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col h-full">
                    <div className="w-12 h-12 rounded-lg bg-tertiary-fixed flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-tertiary text-2xl">edit_note</span>
                    </div>
                    <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">Blank Canvas</h3>
                    <p className="text-on-surface-variant text-sm font-body leading-relaxed mb-8">Best for building a new skill from scratch. Use our interactive editor to define instructions and tools.</p>
                    <div className="mt-auto flex items-center text-primary text-sm font-bold tracking-tight">
                      Create New
                      <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                    </div>
                  </div>
                </button>

                {/* Card 4 */}
                <button 
                  type="button"
                  onClick={() => onNavigate('skills-sh')}
                  className="group text-left bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm hover:border-primary hover:shadow-md transition-colors duration-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col h-full">
                    <div className="w-12 h-12 rounded-lg bg-primary-fixed/50 flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
                    </div>
                    <h3 className="text-2xl font-headline font-bold text-on-surface mb-2">Import from skills.sh</h3>
                    <p className="text-on-surface-variant text-sm font-body leading-relaxed mb-8">Best for pulling community skills. Import skills to inspect and customize.</p>
                    <div className="mt-auto flex items-center text-primary text-sm font-bold tracking-tight">
                      Run Command
                      <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Side Panel */}
        <aside className="hidden xl:block w-80 bg-surface-container-low border-l border-outline-variant/60 p-8 space-y-8">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Context</h4>
            
            {/* Recommendation Card */}
            <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2">
                <span className="material-symbols-outlined text-primary text-xs filled">auto_awesome</span>
              </div>
              <p className="text-xs font-bold text-primary mb-2 uppercase tracking-tight">Smart Recommendation</p>
              <h5 className="font-headline font-bold text-lg mb-2">For Developers</h5>
              <p className="text-xs font-body text-on-surface-variant leading-relaxed">Based on your activity, we suggest <span className="font-bold">Connect GitHub</span> to leverage existing CI/CD pipelines.</p>
            </div>
            
            {/* Resume Card */}
            <button 
              type="button"
              onClick={() => onNavigate('home')}
              className="w-full text-left bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-sm hover:border-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-tight">Resume Previous</span>
                <span className="text-xs text-outline">12m ago</span>
              </div>
              <h5 className="font-headline font-bold text-lg mb-1">Untitled_Skill_02</h5>
              <div className="flex items-center space-x-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                <span className="text-xs font-bold text-on-surface-variant">Draft Phase</span>
              </div>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full border-2 border-surface bg-surface-container flex items-center justify-center text-xs font-bold">A</div>
                <div className="w-6 h-6 rounded-full border-2 border-surface bg-surface-container flex items-center justify-center text-xs font-bold">B</div>
              </div>
            </button>
          </div>
          
          <div className="pt-8 border-t border-outline-variant/40 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Learning Center</h4>
            <div className="space-y-4">
              <a className="flex items-center group" href="#">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center mr-3 group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">menu_book</span>
                </div>
                <span className="text-xs font-medium group-hover:text-primary transition-colors">Skill Architecture Guide</span>
              </a>
              <a className="flex items-center group" href="#">
                <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center mr-3 group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">videocam</span>
                </div>
                <span className="text-xs font-medium group-hover:text-primary transition-colors">Workspace Video Tour</span>
              </a>
            </div>
          </div>
          
          {/* Promotion / Tip */}
          <div className="mt-auto bg-primary rounded-xl p-6 text-on-primary">
            <span className="material-symbols-outlined text-on-primary/60 text-3xl mb-4">lightbulb</span>
            <p className="text-xs leading-relaxed font-medium">Pro Tip: Import a .zip package if you're migrating from a legacy system.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
