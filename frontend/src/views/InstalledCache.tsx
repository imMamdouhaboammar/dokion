import React, { useState } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Playbook } from '../db';
import { PlaybookInspectionModal } from '../components/PlaybookInspectionModal';
import { DokionMascot } from '../components/DokionMascot';

interface InstalledCacheProps {
  onNavigate: (view: ViewState, extraId?: string) => void;
}

export function InstalledCache({ onNavigate }: InstalledCacheProps) {
  const [selectedTab, setSelectedTab] = useState<'packages' | 'cache' | 'lockfile'>('packages');
  const [inspectingPlaybook, setInspectingPlaybook] = useState<Playbook | null>(null);
  const [copiedLockfile, setCopiedLockfile] = useState(false);

  const installedPlaybooks = useLiveQuery(
    () => db.playbooks.filter(p => p.isInstalled).toArray()
  );

  const cacheBlobs = useLiveQuery(
    () => db.cacheBlobs.toArray()
  );

  const lockfiles = useLiveQuery(
    () => db.lockfiles.toArray()
  );

  const handleToggleActivate = async (pb: Playbook) => {
    const nextActivated = !pb.isActivated;
    await db.playbooks.update(pb.id, {
      isActivated: nextActivated,
      isInert: !nextActivated,
      updatedAt: Date.now()
    });

    await db.lockfiles.update(pb.id, {
      activated: nextActivated,
      activationTime: nextActivated ? Date.now() : undefined
    });
  };

  const handlePurgeCache = async (hash: string) => {
    if (confirm(`Purge immutable cache blob ${hash.slice(0, 16)}...?`)) {
      await db.cacheBlobs.delete(hash);
    }
  };

  const formattedLockfileJson = JSON.stringify({
    lockfileVersion: "dokion-lock-v1",
    generatedAt: new Date().toISOString(),
    packages: (lockfiles || []).reduce((acc: any, item) => {
      acc[item.packageId] = {
        name: item.name,
        version: item.version,
        sha256: item.sha256,
        registry: item.registryUrl,
        activated: item.activated,
        permissions: item.permissionsGranted
      };
      return acc;
    }, {})
  }, null, 2);

  const handleCopyLockfile = () => {
    navigator.clipboard.writeText(formattedLockfileJson);
    setCopiedLockfile(true);
    setTimeout(() => setCopiedLockfile(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <DokionMascot role="guardian" size={64} className="shrink-0" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D97958]/15 text-[#D97958] rounded-full text-xs font-mono font-bold mb-2 border border-[#D97958]/30">
                <span className="material-symbols-outlined text-sm">enhanced_encryption</span>
                CONTENT-ADDRESSED CACHE & LOCKFILE ENGINE
              </div>
              <h1 className="text-3xl font-headline font-bold text-on-surface">Installed Dokion Packages</h1>
              <p className="text-secondary text-sm mt-1">
                Pinned inert packages, SHA-256 integrity cache blobs, and auditable <code className="text-primary font-bold">dokion-lock.json</code> state protected by Dokion Guardian.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('store')}
              className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              Browse Store
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b border-outline-variant/60 bg-surface rounded-2xl p-1.5 gap-2">
          <button
            type="button"
            onClick={() => setSelectedTab('packages')}
            className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
              selectedTab === 'packages'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">layers</span>
            Installed Packages ({installedPlaybooks?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('cache')}
            className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
              selectedTab === 'cache'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">folder_zip</span>
            Content-Addressed Cache ({cacheBlobs?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('lockfile')}
            className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
              selectedTab === 'lockfile'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            Auditable Lockfile (dokion-lock.json)
          </button>
        </div>

        {/* TAB 1: INSTALLED PACKAGES */}
        {selectedTab === 'packages' && (
          <div className="space-y-4">
            {!installedPlaybooks || installedPlaybooks.length === 0 ? (
              <div className="text-center py-16 bg-surface p-8 rounded-3xl border border-dashed border-outline-variant text-secondary">
                <span className="material-symbols-outlined text-4xl mb-2 text-outline">inbox</span>
                <p className="font-bold text-on-surface">No Dokion Playbooks installed yet</p>
                <p className="text-xs mt-1">Browse the store to pull immutable package bytes and install inert playbooks.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('store')}
                  className="mt-4 px-6 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl"
                >
                  Go to Store
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {installedPlaybooks.map(pb => (
                  <div key={pb.id} className="bg-surface p-6 rounded-3xl border border-outline-variant/60 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-mono font-bold rounded-full mr-2">
                          v{pb.version}
                        </span>
                        <h3 className="text-lg font-headline font-bold text-on-surface inline">{pb.title}</h3>
                        <p className="text-xs font-mono text-secondary mt-1">{pb.author} • {pb.category}</p>
                      </div>

                      <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                        pb.isActivated 
                          ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                      }`}>
                        {pb.isActivated ? 'ACTIVE' : 'INERT PINNED'}
                      </span>
                    </div>

                    <div className="p-3 bg-surface-container-lowest rounded-xl text-xs font-mono border border-outline-variant/40 space-y-1">
                      <div className="text-secondary flex justify-between">
                        <span>SHA-256 Digest:</span>
                        <span className="text-primary font-bold truncate max-w-[200px]">{pb.sha256}</span>
                      </div>
                      <div className="text-secondary flex justify-between">
                        <span>Registry Source:</span>
                        <span className="truncate max-w-[200px]">{pb.registryName}</span>
                      </div>
                    </div>

                    {/* Activation Gate Toggle */}
                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-outline-variant/40">
                      <button
                        type="button"
                        onClick={() => setInspectingPlaybook(pb)}
                        className="px-3 py-2 text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                      >
                        Inspect Files
                      </button>

                      <div className="flex items-center gap-2">
                        {pb.isActivated ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onNavigate('playbook-detail', pb.id)}
                              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActivate(pb)}
                              className="px-3 py-2 bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-300 transition-colors"
                              title="Deactivate package to Inert state"
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleActivate(pb)}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-sm">bolt</span>
                            Approve & Activate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONTENT-ADDRESSED CACHE */}
        {selectedTab === 'cache' && (
          <div className="bg-surface p-6 rounded-3xl border border-outline-variant/60 space-y-4">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">inventory_2</span>
              Content-Addressed Cache (`cache/sha256:...`)
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Immutable package bytes pulled into content-addressed cache only after SHA-256 integrity verification passes.
            </p>

            <div className="space-y-3">
              {cacheBlobs?.map(blob => (
                <div key={blob.hash} className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-1">
                    <div className="text-primary font-bold break-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                      {blob.hash}
                    </div>
                    <div className="text-secondary text-[11px]">
                      Package ID: {blob.packageId} • Size: {(blob.bytesSize / 1024).toFixed(2)} KB • Cached: {new Date(blob.cachedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 font-bold rounded-lg text-[10px] uppercase">
                      INTEGRITY PASSED
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePurgeCache(blob.hash)}
                      className="p-2 text-secondary hover:text-error hover:bg-surface-container rounded-lg transition-colors"
                      title="Purge cache blob"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AUDITABLE LOCKFILE VIEWER */}
        {selectedTab === 'lockfile' && (
          <div className="bg-slate-950 text-slate-100 p-6 rounded-3xl border border-slate-800 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">description</span>
                <span className="text-sm font-bold text-slate-200">dokion-lock.json (Pinned Lockfile Record)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLockfile}
                className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-cyan-400 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                {copiedLockfile ? 'Copied Lockfile!' : 'Copy dokion-lock.json'}
              </button>
            </div>

            <pre className="text-emerald-400 text-[11px] leading-relaxed overflow-x-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800">
              {formattedLockfileJson}
            </pre>
          </div>
        )}

      </div>

      {inspectingPlaybook && (
        <PlaybookInspectionModal 
          playbook={inspectingPlaybook} 
          onClose={() => setInspectingPlaybook(null)} 
        />
      )}
    </div>
  );
}
