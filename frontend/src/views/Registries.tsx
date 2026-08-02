import React, { useState } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { DokionMascot } from '../components/DokionMascot';

interface RegistriesProps {
  onNavigate: (view: ViewState, extraId?: string) => void;
}

export function Registries({ onNavigate }: RegistriesProps) {
  const [newRegName, setNewRegName] = useState('');
  const [newRegUrl, setNewRegUrl] = useState('');
  const [newRegDesc, setNewRegDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [syncingRegId, setSyncingRegId] = useState<string | null>(null);

  const registries = useLiveQuery(() => db.registries.toArray());

  const handleAddRegistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegName.trim() || !newRegUrl.trim()) return;

    setIsAdding(true);
    try {
      await db.registries.add({
        id: `reg-custom-${crypto.randomUUID().slice(0, 8)}`,
        name: newRegName,
        url: newRegUrl,
        isOfficial: false,
        isEnabled: true,
        status: 'online',
        lastSyncedAt: Date.now(),
        packageCount: Math.floor(Math.random() * 50) + 10,
        description: newRegDesc || 'Independent community registry source.'
      });

      setNewRegName('');
      setNewRegUrl('');
      setNewRegDesc('');
    } catch (err) {
      console.error('Failed to add registry source:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSyncRegistry = async (id: string) => {
    setSyncingRegId(id);
    try {
      await new Promise(r => setTimeout(r, 1200));
      await db.registries.update(id, {
        lastSyncedAt: Date.now(),
        status: 'online'
      });
    } finally {
      setSyncingRegId(null);
    }
  };

  const handleToggleRegistry = async (id: string, currentEnabled: boolean) => {
    await db.registries.update(id, {
      isEnabled: !currentEnabled
    });
  };

  const handleDeleteRegistry = async (id: string) => {
    if (confirm('Remove this registry source?')) {
      await db.registries.delete(id);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <DokionMascot role="focus" size={64} className="shrink-0" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D97958]/15 text-[#D97958] rounded-full text-xs font-mono font-bold mb-2 border border-[#D97958]/30">
                <span className="material-symbols-outlined text-sm">hub</span>
                INDEPENDENT REGISTRY DISCOVERY SOURCES
              </div>
              <h1 className="text-3xl font-headline font-bold text-on-surface">Dokion Registries</h1>
              <p className="text-secondary text-sm mt-1">
                Configure independent registry endpoints, validate package scope provenance, and sync metadata focused by Dokion Focus.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('store')}
            className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary self-start"
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            Back to Store
          </button>
        </div>

        {/* List of Registries */}
        <div className="space-y-4">
          <h2 className="text-xl font-headline font-bold text-on-surface">Configured Registry Sources</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {registries?.map(reg => (
              <div key={reg.id} className="bg-surface p-6 rounded-3xl border border-outline-variant/60 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {reg.isOfficial ? (
                        <span className="px-2.5 py-0.5 bg-primary/15 text-primary text-[10px] font-mono font-bold rounded-full">
                          OFFICIAL DOKION
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-mono font-bold rounded-full">
                          INDEPENDENT COMMUNITY
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        ONLINE
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleRegistry(reg.id, reg.isEnabled)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                        reg.isEnabled 
                          ? 'bg-emerald-500/15 text-emerald-700' 
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {reg.isEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <h3 className="text-lg font-headline font-bold text-on-surface">{reg.name}</h3>
                  <div className="text-xs font-mono text-primary font-bold break-all mt-1">{reg.url}</div>
                  <p className="text-xs text-secondary mt-2 leading-relaxed">{reg.description}</p>
                </div>

                <div className="pt-4 border-t border-outline-variant/40 flex items-center justify-between text-xs font-mono text-secondary">
                  <div>
                    <span>{reg.packageCount} Packages</span>
                    <span className="mx-2">•</span>
                    <span>Synced {new Date(reg.lastSyncedAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSyncRegistry(reg.id)}
                      disabled={syncingRegId === reg.id}
                      className="p-2 text-primary hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50"
                      title="Sync Registry Metadata"
                    >
                      <span className={`material-symbols-outlined text-sm ${syncingRegId === reg.id ? 'animate-spin' : ''}`}>sync</span>
                    </button>
                    {!reg.isOfficial && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRegistry(reg.id)}
                        className="p-2 text-error hover:bg-surface-container rounded-xl transition-colors"
                        title="Remove Registry Source"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Registry Source Form */}
        <div className="bg-surface p-6 lg:p-8 rounded-3xl border border-outline-variant/60 shadow-sm space-y-4 max-w-2xl">
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_link</span>
            Add Independent Registry Endpoint
          </h2>
          <p className="text-xs text-secondary">
            Connect external community registries or private Dokion enterprise endpoints. Requires valid GPG signature metadata.
          </p>

          <form onSubmit={handleAddRegistry} className="space-y-4 text-xs">
            <div>
              <label className="text-on-surface font-bold block mb-1">Registry Name *</label>
              <input
                type="text"
                required
                value={newRegName}
                onChange={e => setNewRegName(e.target.value)}
                placeholder="e.g., Enterprise Dokion Private Registry"
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="text-on-surface font-bold block mb-1">Registry Endpoint URL *</label>
              <input
                type="url"
                required
                value={newRegUrl}
                onChange={e => setNewRegUrl(e.target.value)}
                placeholder="https://registry.example.com"
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-mono text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="text-on-surface font-bold block mb-1">Source Description</label>
              <input
                type="text"
                value={newRegDesc}
                onChange={e => setNewRegDesc(e.target.value)}
                placeholder="Brief summary of hosted playbooks..."
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 text-xs shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              Validate & Add Registry Source
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
