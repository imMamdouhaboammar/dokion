import React, { useState } from 'react';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

interface SkillsShProps {
  onNavigate: (view: any, projectId?: string) => void;
}

export function SkillsSh({ onNavigate }: SkillsShProps) {
  const [command, setCommand] = useState('npx skills add https://github.com/microsoft/github-copilot-for-azure --skill azure-observability');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState<number>(0);
  const [tree, setTree] = useState<any[] | null>(null);

  const handleFetch = async () => {
    if (!command.trim()) return;
    
    setLoading(true);
    setError(null);
    setScanStep(1);
    setTree(null);

    try {
      // Extract github URL from command
      const urlMatch = command.match(/https:\/\/github\.com\/[^\s]+/);
      if (!urlMatch) {
        throw new Error('Could not find a valid GitHub URL in the command.');
      }
      const url = urlMatch[0];

      // Parse GitHub URL
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        throw new Error('Invalid GitHub repository URL');
      }
      const owner = parts[0];
      const repo = parts[1];

      // 1. Fetch repo info (to get default branch)
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoRes.ok) throw new Error('Failed to fetch repository information');
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch;

      setScanStep(2);

      // 2. Fetch tree
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
      if (!treeRes.ok) throw new Error('Failed to fetch repository tree');
      const treeData = await treeRes.json();

      // Filter and sort tree
      const filteredTree = treeData.tree
        .filter((item: any) => !item.path.startsWith('.') && !item.path.includes('node_modules'))
        .sort((a: any, b: any) => {
          if (a.type === 'tree' && b.type !== 'tree') return -1;
          if (a.type !== 'tree' && b.type === 'tree') return 1;
          return a.path.localeCompare(b.path);
        });

      setTree(filteredTree);
      setScanStep(3);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the repository');
      setScanStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!tree) return;
    setLoading(true);
    try {
      // Extract github URL from command
      const urlMatch = command.match(/https:\/\/github\.com\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : '';
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      const owner = parts[0];
      const repo = parts[1];

      // Try to fetch README
      let readmeContent = '';
      try {
        const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);
        if (readmeRes.ok) {
          readmeContent = await readmeRes.text();
        } else {
           const readmeResMaster = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`);
           if (readmeResMaster.ok) {
             readmeContent = await readmeResMaster.text();
           }
        }
      } catch (e) {
        console.warn("Could not fetch README");
      }

      // Extract skill name from command if present
      const skillMatch = command.match(/--skill\s+([^\s]+)/);
      const skillName = skillMatch ? skillMatch[1] : repo;

      const projectId = uuidv4();
      const skillId = uuidv4();
      const sessionId = uuidv4();

      const instructions = `
# Imported from skills.sh
Source: ${url}

## Repository Structure
${tree.slice(0, 50).map(item => `- ${item.path}`).join('\n')}
${tree.length > 50 ? `\n... and ${tree.length - 50} more files` : ''}

## README
${readmeContent.substring(0, 2000)}...
      `;

      const now = Date.now();

      await db.projects.add({
        id: projectId,
        name: skillName,
        type: 'WEB APP',
        status: 'In Development',
        description: `Imported from ${url}`,
        createdAt: now,
        updatedAt: now
      });

      await db.skills.add({
        id: skillId,
        projectId,
        name: skillName,
        instructions,
        tools: { webSearch: false, codeInterpreter: false },
        examples: [],
        triggers: [],
        createdAt: now,
        updatedAt: now
      });

      await db.sessions.add({
        id: sessionId,
        projectId,
        lastActive: now,
        progress: 0,
        context: ''
      });

      onNavigate('editor', projectId);
    } catch (err: any) {
       setError(err.message || 'Failed to generate skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface pb-32 md:pb-16">
      <div className="max-w-5xl mx-auto p-8 pt-12">
        <div className="flex items-center gap-4 mb-8">
          <button 
            type="button"
            aria-label="Go back to skill creation"
            onClick={() => onNavigate('create')}
            className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-4xl font-headline font-bold text-on-surface">Import from skills.sh</h1>
            <p className="text-on-surface-variant mt-2 font-body text-lg">Run the npx skills add command to import a community skill.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Input and Structure */}
          <div className="lg:col-span-2 space-y-8">
            {/* Input Section */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant shadow-sm">
              <h2 className="text-xl font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">terminal</span>
                Command
              </h2>
              
              <div className="flex flex-col gap-4">
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-on-surface-variant font-mono pointer-events-none">$</span>
                  <input 
                    type="text" 
                    aria-label="skills.sh command"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="npx skills add https://github.com/... --skill name"
                    className="w-full bg-surface-container pl-10 pr-4 py-4 rounded-xl border border-outline focus-visible:ring-2 focus-visible:ring-primary transition-colors font-mono text-sm text-on-surface"
                  />
                </div>
                {error && (
                  <div className="text-error text-sm flex items-center gap-2 bg-error-container/20 p-3 rounded-lg">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {error}
                  </div>
                )}
                <button 
                  type="button"
                  onClick={handleFetch}
                  disabled={loading || !command.trim()}
                  className="bg-primary text-on-primary px-6 py-4 rounded-xl font-bold tracking-tight hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {loading && scanStep < 3 ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">sync</span>
                      Executing Command...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">play_arrow</span>
                      Execute
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Repository Structure Preview */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant shadow-sm min-h-[400px]">
              <h2 className="text-xl font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">folder_open</span>
                Skill Structure
              </h2>
              
              <div className="bg-surface-container rounded-xl p-4 h-[300px] overflow-y-auto font-mono text-sm">
                {tree ? (
                  <div className="space-y-1">
                    {tree.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high p-1 rounded cursor-default">
                        <span className="material-symbols-outlined text-[16px] opacity-70">
                          {item.type === 'tree' ? 'folder' : 'draft'}
                        </span>
                        <span className={item.type === 'tree' ? 'font-bold text-primary' : ''}>
                          {item.path}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : loading ? (
                   <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-4 animate-spin">sync</span>
                    <p>Fetching repository data...</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-4">account_tree</span>
                    <p>Execute the command to preview the skill structure</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Analysis and Actions */}
          <div className="space-y-8">
            {/* Analysis Section */}
            <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant shadow-sm">
              <h2 className="text-xl font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                Extraction Analysis
              </h2>
              
              <div className="space-y-6">
                {/* Scan Status */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${scanStep > 0 ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                    <span className={`material-symbols-outlined ${scanStep > 0 && scanStep < 3 ? 'animate-spin' : ''}`}>
                      {scanStep === 3 ? 'check_circle' : 'radar'}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-on-surface">
                      {scanStep === 0 && "Waiting to execute"}
                      {scanStep === 1 && "Connecting to skills.sh..."}
                      {scanStep === 2 && "Extracting skill data..."}
                      {scanStep === 3 && "Extraction Complete"}
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {scanStep === 3 ? "Ready to generate draft" : "Run command to start"}
                    </div>
                  </div>
                </div>

                {/* Detected Modules (Mocked for now based on tree) */}
                {tree && (
                  <div className="space-y-3 pt-4 border-t border-outline-variant">
                    <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Detected Components</h3>
                    
                    {tree.some(i => i.path.toLowerCase().includes('auth') || i.path.toLowerCase().includes('login')) && (
                      <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">lock</span>
                          <span className="text-sm font-medium">Authentication</span>
                        </div>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">High</span>
                      </div>
                    )}

                    {tree.some(i => i.path.toLowerCase().includes('api') || i.path.toLowerCase().includes('routes')) && (
                      <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">api</span>
                          <span className="text-sm font-medium">API Integration</span>
                        </div>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">High</span>
                      </div>
                    )}
                    
                    {tree.some(i => i.path.toLowerCase().includes('readme') || i.path.toLowerCase().includes('docs')) && (
                      <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">description</span>
                          <span className="text-sm font-medium">Documentation</span>
                        </div>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-bold">High</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Section */}
            <div className="bg-primary-container rounded-2xl p-8 border border-primary/20 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
              
              <h2 className="text-xl font-headline font-bold text-on-primary-container mb-2 relative z-10">
                Ready to Build?
              </h2>
              <p className="text-on-primary-container/80 text-sm mb-6 relative z-10">
                Generate a new skill draft based on the extracted components and documentation.
              </p>
              
              <button 
                type="button"
                onClick={handleGenerate}
                disabled={!tree || loading}
                className="w-full bg-primary text-on-primary px-6 py-4 rounded-xl font-bold tracking-tight hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
                Generate Skill Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
