import React from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDistanceToNow } from '../utils/date';

interface LibraryProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
}

export function Library({ onNavigate }: LibraryProps) {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray());

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-5xl mx-auto">
        {/* Header & Search */}
        <section className="mb-8">
          <h1 className="text-4xl md:text-5xl font-headline text-on-surface leading-tight mb-6">Library</h1>
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input 
              type="text"
              aria-label="Search skills"
              className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus-visible:ring-2 focus-visible:ring-primary text-sm transition-colors" 
              placeholder="Search your skills..." 
            />
          </div>
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button type="button" className="px-4 py-1.5 bg-primary text-on-primary rounded-full text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary">All Skills</button>
            <button type="button" className="px-4 py-1.5 bg-surface-container text-on-surface-variant rounded-full text-sm font-medium whitespace-nowrap hover:bg-surface-container-high transition-colors focus-visible:ring-2 focus-visible:ring-primary">Ready</button>
            <button type="button" className="px-4 py-1.5 bg-surface-container text-on-surface-variant rounded-full text-sm font-medium whitespace-nowrap hover:bg-surface-container-high transition-colors focus-visible:ring-2 focus-visible:ring-primary">Drafts</button>
            <button type="button" className="px-4 py-1.5 bg-surface-container text-on-surface-variant rounded-full text-sm font-medium whitespace-nowrap hover:bg-surface-container-high transition-colors focus-visible:ring-2 focus-visible:ring-primary">Archived</button>
          </div>
        </section>

        {/* Skills List */}
        <section className="space-y-4">
          {projects === undefined ? (
            <div className="text-secondary text-sm">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-secondary text-sm py-8 text-center border border-dashed border-outline-variant rounded-2xl">
              No projects yet. Start by creating one!
            </div>
          ) : (
            projects.map(project => (
              <button 
                key={project.id}
                type="button"
                onClick={() => onNavigate('editor', project.id)}
                className="w-full text-left bg-surface-container-low p-5 rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-md hover:border-primary/30 cursor-pointer transition-shadow focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 rounded-lg ${project.status === 'Deployed' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                    <span className="material-symbols-outlined">
                      {project.status === 'Deployed' ? 'auto_fix_high' : 'code'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider ${
                    project.status === 'Deployed' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container-highest text-secondary'
                  }`}>
                    {project.status === 'Deployed' ? 'Ready' : 'Draft'}
                  </span>
                </div>
                <h2 className="text-xl font-headline mb-1 text-on-surface">{project.name}</h2>
                <p className="text-secondary text-xs font-medium">Last edited {formatDistanceToNow(project.updatedAt)}</p>
              </button>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
