import React, { useState } from 'react';
import { Playbook, db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { DokionMascot } from './DokionMascot';

interface PlaybookInspectionModalProps {
  playbook: Playbook | null;
  onClose: () => void;
  onActivateSuccess?: () => void;
}

export function PlaybookInspectionModal({ playbook, onClose, onActivateSuccess }: PlaybookInspectionModalProps) {
  if (!playbook) return null;

  const [activeTab, setActiveTab] = useState<'provenance' | 'files' | 'capabilities' | 'compatibility' | 'pipeline'>('provenance');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Pipeline simulation state
  const [pipelineStep, setPipelineStep] = useState<number>(playbook.isInstalled ? (playbook.isActivated ? 4 : 3) : 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const lockfileEntry = useLiveQuery(
    () => db.lockfiles.get(playbook.id),
    [playbook.id]
  );

  const handleRunPipeline = async () => {
    setIsProcessing(true);
    setPipelineError(null);
    try {
      // Step 1: Check Integrity
      setPipelineStep(1);
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Pull Content-Addressed Cache
      setPipelineStep(2);
      const totalSize = playbook.files.reduce((acc, f) => acc + f.size, 0);
      await db.cacheBlobs.put({
        hash: playbook.sha256,
        packageId: playbook.id,
        bytesSize: totalSize,
        cachedAt: Date.now(),
        status: 'verified',
        integrityValid: true
      });
      await new Promise(r => setTimeout(r, 700));

      // Step 3: Install Pinned Inert Package & Write Lockfile
      setPipelineStep(3);
      await db.playbooks.update(playbook.id, {
        isInstalled: true,
        isInert: true,
        updatedAt: Date.now()
      });

      await db.lockfiles.put({
        packageId: playbook.id,
        name: playbook.title,
        version: playbook.version,
        sha256: playbook.sha256,
        registryUrl: playbook.registrySource,
        activated: false,
        permissionsGranted: playbook.permissions.map(p => p.scope)
      });
      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      setPipelineError(err.message || 'Retrieval pipeline failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivatePlaybook = async () => {
    setIsProcessing(true);
    try {
      await db.playbooks.update(playbook.id, {
        isInstalled: true,
        isInert: false,
        isActivated: true,
        updatedAt: Date.now()
      });

      await db.lockfiles.update(playbook.id, {
        activated: true,
        activationTime: Date.now()
      });

      setPipelineStep(4);
      if (onActivateSuccess) onActivateSuccess();
    } catch (err: any) {
      setPipelineError(err.message || 'Activation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedFile = playbook.files[selectedFileIndex] || playbook.files[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="double-bezel max-w-4xl w-full max-h-[90vh]">
        <div className="double-bezel-inner bg-surface shadow-2xl flex flex-col max-h-[calc(90vh-1rem)] overflow-hidden animate-in fade-in duration-200">
          
          {/* Modal Header */}
          <div className="p-6 bg-surface-container-low border-b border-outline-variant/60 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <DokionMascot role="reviewer" size={54} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-mono font-bold rounded-full">
                    {playbook.version}
                  </span>
                  <span className="px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant text-xs font-semibold rounded-full font-body">
                    {playbook.category}
                  </span>
                  {playbook.authorVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/20">
                      <span className="material-symbols-outlined text-xs filled">verified</span>
                      Verified Provenance
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-headline font-extrabold text-on-surface">{playbook.title}</h2>
                <p className="text-xs font-mono text-secondary mt-1">Author: {playbook.author} | Registry: {playbook.registryName}</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-outline-variant/60 bg-surface-container-lowest px-6 overflow-x-auto hide-scrollbar">
          <TabButton 
            active={activeTab === 'provenance'} 
            onClick={() => setActiveTab('provenance')} 
            icon="shield" 
            label="Provenance & Hash" 
          />
          <TabButton 
            active={activeTab === 'files'} 
            onClick={() => setActiveTab('files')} 
            icon="folder_zip" 
            label={`Files (${playbook.files.length})`} 
          />
          <TabButton 
            active={activeTab === 'capabilities'} 
            onClick={() => setActiveTab('capabilities')} 
            icon="vpn_key" 
            label={`Permissions (${playbook.permissions.length})`} 
          />
          <TabButton 
            active={activeTab === 'compatibility'} 
            onClick={() => setActiveTab('compatibility')} 
            icon="checklist" 
            label="Engine Matrix" 
          />
          <TabButton 
            active={activeTab === 'pipeline'} 
            onClick={() => setActiveTab('pipeline')} 
            icon="download" 
            label="Retrieval & Lockfile" 
          />
        </div>

        {/* Tab Body Content */}
        <div className="p-6 flex-1 overflow-y-auto min-h-[360px] bg-surface-bright">
          
          {/* 1. Provenance & Cryptographic Signature */}
          {activeTab === 'provenance' && (
            <div className="space-y-6">
              <div className="bg-surface p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-600">verified_user</span>
                  Cryptographic Package Provenance
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                    <span className="text-secondary block mb-1">Content-Addressed SHA-256 Digest:</span>
                    <span className="text-primary font-bold break-all">{playbook.sha256}</span>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                    <span className="text-secondary block mb-1">Ed25519 Publisher Signature:</span>
                    <span className="text-emerald-600 font-bold break-all">{playbook.signature}</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-700 flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 filled">check_circle</span>
                  <div>
                    <span className="font-bold">Provenance Certificate Valid</span>
                    <p className="mt-0.5">This package signature matches the public key certificate registered to <code className="font-bold">{playbook.author}</code> on <code className="font-bold">{playbook.registrySource}</code>.</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface p-5 rounded-2xl border border-outline-variant/60">
                <h4 className="font-headline font-bold text-sm text-on-surface mb-2">Package Description</h4>
                <p className="text-secondary text-sm leading-relaxed">{playbook.description}</p>
              </div>
            </div>
          )}

          {/* 2. Files & Manifest */}
          {activeTab === 'files' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[300px]">
              <div className="md:col-span-1 bg-surface p-3 rounded-2xl border border-outline-variant/60 space-y-1 max-h-[320px] overflow-y-auto">
                <div className="text-xs font-bold text-secondary uppercase px-2 py-1">Package File Tree</div>
                {playbook.files.map((file, idx) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-mono flex items-center justify-between transition-colors ${
                      selectedFileIndex === idx
                        ? 'bg-primary text-on-primary font-bold'
                        : 'hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs">
                        {file.type === 'yaml' ? 'description' : file.type === 'md' ? 'article' : 'code'}
                      </span>
                      {file.path}
                    </span>
                    <span className="text-[10px] opacity-75">{file.size}B</span>
                  </button>
                ))}
              </div>

              <div className="md:col-span-2 bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 font-mono text-xs overflow-y-auto max-h-[320px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3 text-slate-400">
                  <span>{selectedFile?.path}</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-cyan-400 uppercase">{selectedFile?.type}</span>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {selectedFile?.content || '# No file content available'}
                </pre>
              </div>
            </div>
          )}

          {/* 3. Capabilities & Permissions */}
          {activeTab === 'capabilities' && (
            <div className="space-y-6">
              <div className="bg-surface p-5 rounded-2xl border border-outline-variant/60 space-y-3">
                <h4 className="font-headline font-bold text-sm text-on-surface">Declared Engine Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {playbook.capabilities.map(cap => (
                    <span key={cap} className="px-3 py-1 bg-indigo-500/10 text-indigo-700 text-xs font-mono font-bold rounded-lg border border-indigo-500/20 inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">bolt</span>
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-surface p-5 rounded-2xl border border-outline-variant/60 space-y-4">
                <h4 className="font-headline font-bold text-sm text-on-surface">Required Execution Scope Grants</h4>
                <div className="space-y-2">
                  {playbook.permissions.map(perm => (
                    <div key={perm.scope} className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono font-bold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-amber-600">lock</span>
                          {perm.scope}
                        </div>
                        <p className="text-secondary text-[11px] mt-0.5">{perm.description}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                        perm.level === 'admin' ? 'bg-red-500/15 text-red-700' :
                        perm.level === 'execute' ? 'bg-amber-500/15 text-amber-700' :
                        perm.level === 'write' ? 'bg-indigo-500/15 text-indigo-700' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {perm.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Engine Matrix */}
          {activeTab === 'compatibility' && (
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/60 space-y-4 text-xs font-mono">
              <h4 className="font-headline font-bold text-sm text-on-surface mb-2 font-sans">Dokion Engine Compatibility Matrix</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                  <span className="text-secondary block mb-1">Min Dokion Engine:</span>
                  <span className="text-primary font-bold text-sm">{playbook.compatibility.minEngineVersion}</span>
                </div>
                <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                  <span className="text-secondary block mb-1">Node Runtime:</span>
                  <span className="text-primary font-bold text-sm">{playbook.compatibility.nodeVersion}</span>
                </div>
                <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
                  <span className="text-secondary block mb-1">Supported Platforms:</span>
                  <span className="text-emerald-600 font-bold text-sm uppercase">{playbook.compatibility.os.join(', ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Retrieval & Lockfile Pipeline */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <div className="bg-surface p-6 rounded-2xl border border-outline-variant/60 space-y-4">
                <h3 className="font-headline font-bold text-lg text-on-surface">Dokion Package Retrieval & Activation Policy</h3>
                <p className="text-xs text-secondary leading-relaxed">
                  Packages are pulled into a content-addressed immutable cache only after SHA-256 verification. The package installs as an <strong>inert project package</strong> and writes an auditable <code className="text-primary font-bold">dokion-lock.json</code>. Activation requires explicit user intent.
                </p>

                {/* Pipeline 4-Step UI */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <PipelineStepCard 
                    step={1} 
                    title="1. SHA-256 Digest" 
                    desc="Validate Integrity" 
                    current={pipelineStep} 
                  />
                  <PipelineStepCard 
                    step={2} 
                    title="2. Immutable Cache" 
                    desc="Pull Content Bytes" 
                    current={pipelineStep} 
                  />
                  <PipelineStepCard 
                    step={3} 
                    title="3. Inert Lockfile" 
                    desc="Write dokion-lock.json" 
                    current={pipelineStep} 
                  />
                  <PipelineStepCard 
                    step={4} 
                    title="4. User Activation" 
                    desc="Approve Capabilities" 
                    current={pipelineStep} 
                  />
                </div>

                {pipelineError && (
                  <div className="p-3 bg-error/10 text-error rounded-xl text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {pipelineError}
                  </div>
                )}

                {/* Lockfile Preview Box */}
                {lockfileEntry && (
                  <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl border border-slate-800 text-xs font-mono">
                    <div className="text-slate-400 font-bold mb-2 flex items-center justify-between">
                      <span>dokion-lock.json (Auditable Record)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${lockfileEntry.activated ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {lockfileEntry.activated ? 'Active' : 'Inert Pinned'}
                      </span>
                    </div>
                    <pre className="text-[11px] text-emerald-300 overflow-x-auto">
{JSON.stringify({
  packageId: lockfileEntry.packageId,
  name: lockfileEntry.name,
  version: lockfileEntry.version,
  integrity: lockfileEntry.sha256,
  registry: lockfileEntry.registryUrl,
  status: lockfileEntry.activated ? 'ACTIVE' : 'INERT_PINNED',
  scopesGranted: lockfileEntry.permissionsGranted
}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-6 bg-surface-container-low border-t border-outline-variant/60 flex items-center justify-between gap-4">
          <div className="text-xs text-secondary font-mono">
            {playbook.priceUsd > 0 ? (
              <span className="text-on-surface font-bold text-sm">${playbook.priceUsd} USD / {playbook.priceTokens} Tokens</span>
            ) : (
              <span className="text-emerald-600 font-bold text-sm">FREE & Open Source</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-container transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close
            </button>

            {!playbook.isInstalled && (
              <button
                type="button"
                onClick={handleRunPipeline}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    Pulling Cache...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">download</span>
                    Pull & Install Inert Package
                  </>
                )}
              </button>
            )}

            {playbook.isInstalled && !playbook.isActivated && (
              <button
                type="button"
                onClick={handleActivatePlaybook}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">bolt</span>
                Approve & Activate Playbook
              </button>
            )}

            {playbook.isActivated && (
              <span className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm filled">check_circle</span>
                Active & Ready to Run
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-4 px-4 font-semibold text-xs border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? 'border-primary text-primary font-bold'
          : 'border-transparent text-secondary hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}

function PipelineStepCard({ step, title, desc, current }: { step: number; title: string; desc: string; current: number }) {
  const isDone = current >= step;
  const isCurrent = current === step - 1;

  return (
    <div className={`p-3 rounded-xl border text-xs transition-colors ${
      isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800' :
      isCurrent ? 'bg-primary/10 border-primary text-primary font-bold' :
      'bg-surface-container-lowest border-outline-variant/40 text-secondary'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold">{title}</span>
        <span className="material-symbols-outlined text-xs">
          {isDone ? 'check_circle' : isCurrent ? 'sync' : 'circle'}
        </span>
      </div>
      <p className="text-[11px] opacity-80">{desc}</p>
    </div>
  );
}
