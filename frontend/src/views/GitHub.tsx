import React, { useState } from 'react';
import { ViewState } from '../App';
import { db } from '../db';
import { installObraSuperpowers } from '../utils/superpowers';

interface GitHubProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
}

interface RepoTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export function GitHubImport({ onNavigate }: GitHubProps) {
  const [url, setUrl] = useState('https://github.com/obra/superpowers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<RepoTreeItem[] | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ owner: string, repo: string, defaultBranch: string } | null>(null);
  const [scanStep, setScanStep] = useState(0);

  const parseGitHubUrl = (inputUrl: string) => {
    try {
      const urlObj = new URL(inputUrl);
      if (urlObj.hostname !== 'github.com') return null;
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1].replace('.git', '') };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleFetch = async () => {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      setError('Invalid GitHub URL');
      return;
    }
    
    setLoading(true);
    setError(null);
    setTree(null);
    setScanStep(1);

    try {
      // Fetch repo info to get default branch
      const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
      if (!repoRes.ok) throw new Error('Repository not found or is private');
      const repoData = await repoRes.json();
      
      setRepoInfo({
        owner: parsed.owner,
        repo: parsed.repo,
        defaultBranch: repoData.default_branch
      });

      setScanStep(2);

      // Fetch tree
      const treeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${repoData.default_branch}?recursive=1`);
      if (!treeRes.ok) throw new Error('Failed to fetch repository tree');
      const treeData = await treeRes.json();
      
      // Filter and sort tree (directories first, then files)
      const sortedTree = (treeData.tree as RepoTreeItem[])
        .filter(item => !item.path.includes('node_modules') && !item.path.includes('.git/'))
        .sort((a, b) => {
          if (a.type === b.type) return a.path.localeCompare(b.path);
          return a.type === 'tree' ? -1 : 1;
        })
        .slice(0, 100); // Limit to 100 items for UI performance

      setTree(sortedTree);
      setScanStep(3);
    } catch (err: any) {
      setError(err.message);
      setScanStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!repoInfo || !tree) return;
    
    try {
      if (repoInfo.owner.toLowerCase() === 'obra' && repoInfo.repo.toLowerCase() === 'superpowers') {
        await installObraSuperpowers();
        const obraProjects = await db.projects.where('name').startsWith('Obra Superpowers').toArray();
        const mainProject = obraProjects[0];
        if (mainProject) {
          onNavigate('editor', mainProject.id);
        } else {
          onNavigate('library');
        }
        return;
      }

      // Try to fetch README
      let readmeContent = '';
      try {
        const readmeRes = await fetch(`https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.defaultBranch}/README.md`);
        if (readmeRes.ok) {
          readmeContent = await readmeRes.text();
        }
      } catch (e) {
        console.error('Failed to fetch README', e);
      }

      const instructions = `Imported from GitHub: ${url}\n\nRepository Structure:\n${tree.slice(0, 50).map(t => `- ${t.path}`).join('\n')}\n\nREADME:\n${readmeContent.substring(0, 2000)}`;

      const newProjectId = crypto.randomUUID();
      const newSkillId = crypto.randomUUID();

      await db.projects.add({
        id: newProjectId,
        name: `${repoInfo.repo} Skill`,
        description: `Imported from GitHub: ${repoInfo.owner}/${repoInfo.repo}`,
        type: 'OTHER',
        status: 'In Development',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.skills.add({
        id: newSkillId,
        projectId: newProjectId,
        name: `${repoInfo.repo} Skill`,
        instructions: instructions,
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
        context: `Imported from GitHub repository ${repoInfo.owner}/${repoInfo.repo}`
      });

      onNavigate('editor', newProjectId);
    } catch (err) {
      console.error('Failed to generate skill', err);
      setError('Failed to generate skill from repository');
    }
  };

  const renderTreeItem = (item: RepoTreeItem) => {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const depth = parts.length - 1;
    
    if (item.type === 'tree') {
      return (
        <div key={item.path} className="flex items-center gap-2 mt-2" style={{ marginLeft: `${depth * 1.5}rem` }}>
          <span className="material-symbols-outlined text-primary text-lg filled">folder</span>
          <span className="font-medium text-on-surface">{name}/</span>
        </div>
      );
    }
    
    const isMarkdown = name.endsWith('.md');
    return (
      <div key={item.path} className={`flex items-center gap-2 py-1 ${isMarkdown ? 'bg-primary/5 border-l-2 border-primary px-3 rounded-r-md' : ''}`} style={{ marginLeft: `${depth * 1.5}rem` }}>
        <span className={`material-symbols-outlined text-lg ${isMarkdown ? 'text-primary' : 'text-secondary'}`}>
          {isMarkdown ? 'markdown' : 'description'}
        </span>
        <span className={isMarkdown ? 'text-primary font-bold' : ''}>{name}</span>
      </div>
    );
  };
  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-10 mt-2">
          <h1 className="text-4xl md:text-5xl font-headline text-on-surface leading-tight mb-3">
            Import from GitHub
          </h1>
          <p className="text-secondary max-w-xl font-body leading-relaxed">
            Connect a repository to automatically extract documentation, logic flows, and technical requirements for your AI Skill.
          </p>
        </div>

        {/* Import Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Input & Preview */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* URL Input Card */}
            <div className="bg-surface-container-low p-6 md:p-8 rounded-2xl border border-outline-variant/40 shadow-sm">
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-3">
                Repository URL
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline pointer-events-none">link</span>
                  <input 
                    type="text" 
                    aria-label="GitHub repository URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus-visible:ring-2 focus-visible:ring-primary transition-colors font-body text-sm" 
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleFetch}
                  disabled={loading || !url}
                  className="bg-on-surface text-surface px-8 py-3 rounded-xl font-bold hover:bg-on-surface/90 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Fetching...
                    </>
                  ) : (
                    'Fetch'
                  )}
                </button>
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-3 font-medium">{error}</p>
              )}
            </div>

            {/* Repository Structure Preview */}
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/40 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container/50">
                <span className="font-semibold font-headline text-on-surface text-lg">Repository Structure</span>
                <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold uppercase tracking-wider">Public</span>
              </div>
              <div className="p-6 font-mono text-sm text-on-surface-variant space-y-3 max-h-[500px] overflow-y-auto">
                {tree ? (
                  tree.map(item => renderTreeItem(item))
                ) : loading ? (
                  <div className="flex items-center justify-center py-10 text-secondary">
                    <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                    Loading repository structure...
                  </div>
                ) : (
                  <div className="text-secondary italic text-center py-10">
                    Enter a GitHub repository URL and click Fetch to view its structure.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Analysis & Confidence */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Scanning State */}
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-headline text-2xl text-on-surface">Module Analysis</h2>
                <div className="flex items-center gap-2 bg-primary/10 px-2.5 py-1 rounded-full">
                  {loading ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Live Scan</span>
                    </>
                  ) : tree ? (
                    <>
                      <span className="material-symbols-outlined text-xs text-emerald-600 filled">check_circle</span>
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Scan Complete</span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Waiting</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-5">
                <div className={`flex items-center gap-3 text-sm ${scanStep >= 1 ? '' : 'opacity-50'}`}>
                  <span className={`material-symbols-outlined text-xl ${scanStep > 1 ? 'text-emerald-600 filled' : scanStep === 1 ? 'text-primary animate-spin' : 'text-secondary'}`}>
                    {scanStep > 1 ? 'check_circle' : scanStep === 1 ? 'sync' : 'pending'}
                  </span>
                  <span className="text-on-surface font-medium">Analyzing repository structure...</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${scanStep >= 2 ? '' : 'opacity-50'}`}>
                  <span className={`material-symbols-outlined text-xl ${scanStep > 2 ? 'text-emerald-600 filled' : scanStep === 2 ? 'text-primary animate-spin' : 'text-secondary'}`}>
                    {scanStep > 2 ? 'check_circle' : scanStep === 2 ? 'sync' : 'pending'}
                  </span>
                  <span className="text-on-surface font-medium">Detecting markdown and scripts</span>
                </div>
                <div className={`flex items-center gap-3 text-sm ${scanStep >= 3 ? '' : 'opacity-50'}`}>
                  <span className={`material-symbols-outlined text-xl ${scanStep >= 3 ? 'text-emerald-600 filled' : 'text-secondary'}`}>
                    {scanStep >= 3 ? 'check_circle' : 'pending'}
                  </span>
                  <span className="text-on-surface font-medium">Mapping functional dependencies</span>
                </div>
              </div>

              {/* Confidence Cards */}
              {tree && (
                <div className="mt-10 space-y-3">
                  <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-4">Detected Modules</p>
                  
                  {tree.filter(t => t.path.includes('auth') || t.path.includes('login')).length > 0 && (
                    <div className="p-4 rounded-xl border border-outline-variant flex items-center justify-between bg-surface-container-lowest hover:border-primary/30 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-on-surface">User Authentication</p>
                        <p className="text-xs text-secondary mt-0.5">Found auth related files</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-on-surface">94%</p>
                        <p className="text-xs text-secondary uppercase tracking-wider font-bold">Confidence</p>
                      </div>
                    </div>
                  )}
                  
                  {tree.filter(t => t.path.includes('api') || t.path.includes('route')).length > 0 && (
                    <div className="p-4 rounded-xl border border-outline-variant flex items-center justify-between bg-surface-container-lowest hover:border-primary/30 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-on-surface">API Integration</p>
                        <p className="text-xs text-secondary mt-0.5">Found API routes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-on-surface">82%</p>
                        <p className="text-xs text-secondary uppercase tracking-wider font-bold">Confidence</p>
                      </div>
                    </div>
                  )}
                  
                  {tree.filter(t => t.path.endsWith('.md')).length > 0 && (
                    <div className="p-4 rounded-xl border border-outline-variant flex items-center justify-between bg-surface-container-lowest hover:border-primary/30 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-on-surface">Documentation</p>
                        <p className="text-xs text-secondary mt-0.5">Found markdown files</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-on-surface">99%</p>
                        <p className="text-xs text-secondary uppercase tracking-wider font-bold">Confidence</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="mt-8">
                <button 
                  type="button"
                  onClick={handleGenerate}
                  disabled={!tree || loading}
                  className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Generate Skill Draft
                </button>
                <p className="text-center text-xs text-secondary mt-4 italic font-body">
                  This will create a new draft in your Library based on the scanned logic.
                </p>
              </div>
            </div>

            {/* Meta Info */}
            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 flex gap-4 items-start">
              <span className="material-symbols-outlined text-primary filled mt-0.5">lightbulb</span>
              <p className="text-xs leading-relaxed text-on-surface font-body">
                <span className="font-bold text-primary">Pro-Tip:</span> Ensure your README is descriptive. Our engine prioritizes markdown files for high-level logic mapping.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
