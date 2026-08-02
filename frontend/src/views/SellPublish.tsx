import React, { useState } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { DokionMascot } from '../components/DokionMascot';

interface SellPublishProps {
  onNavigate: (view: ViewState, extraId?: string) => void;
}

export function SellPublish({ onNavigate }: SellPublishProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'DevOps' | 'Agentic Workflows' | 'Security Shield' | 'Code Quality' | 'Data Pipelines' | 'AI Testing' | 'Custom Tools'>('DevOps');
  const [priceUsd, setPriceUsd] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [capabilities, setCapabilities] = useState<string>('FILE_ACCESS, TERMINAL_EXEC');
  const [yamlContent, setYamlContent] = useState<string>(`name: my-custom-playbook
version: 1.0.0
author: "@me"
description: "My custom Dokion playbook engine"
engine: ">=1.0.0"
steps:
  - name: Audit Environment
    run: echo "Auditing workspace..."
`);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);

  const listings = useLiveQuery(() => db.publisherListings.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());

  const totalRevenue = (transactions || []).reduce((acc, t) => acc + t.amount, 0);

  const handlePublishPlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsPublishing(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newId = `pb-pub-${crypto.randomUUID().slice(0, 8)}`;
      const sha256Hex = `sha256:${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      const sigHex = `ed25519:sig_publisher_${crypto.randomUUID().slice(0, 10)}`;

      const capArray = capabilities.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

      // Save to playbooks store
      await db.playbooks.add({
        id: newId,
        title,
        slug,
        version: '1.0.0',
        author: '@my-store-author',
        authorVerified: true,
        priceUsd: Number(priceUsd),
        priceTokens: Number(priceUsd) * 10,
        registrySource: 'https://registry.dokion.io',
        registryName: 'Dokion Official Registry',
        description,
        category,
        capabilities: capArray.length ? capArray : ['FILE_ACCESS'],
        permissions: [
          { scope: 'read:workspace', level: 'read', description: 'Read local project workspace files' }
        ],
        files: [
          {
            path: 'playbook.yaml',
            type: 'yaml',
            size: yamlContent.length,
            content: yamlContent
          }
        ],
        sha256: sha256Hex,
        signature: sigHex,
        compatibility: {
          minEngineVersion: 'v1.0.0',
          nodeVersion: '>=18.0.0',
          os: ['linux', 'darwin', 'win32']
        },
        rating: 5.0,
        downloads: 1,
        isInstalled: true,
        isInert: false,
        isActivated: true,
        isPaid: Number(priceUsd) > 0,
        isOwned: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Add to publisher listings
      await db.publisherListings.add({
        id: newId,
        playbookName: title,
        version: '1.0.0',
        priceUsd: Number(priceUsd),
        category,
        status: 'Published',
        downloads: 1,
        revenue: 0,
        createdAt: Date.now()
      });

      setPublishSuccessMsg(`Published "${title}" to Dokion Registry! Package hash: ${sha256Hex.slice(0, 18)}...`);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      console.error('Failed to publish playbook:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <DokionMascot role="debugger" size={64} className="shrink-0" />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D97958]/15 text-[#D97958] rounded-full text-xs font-mono font-bold mb-2 border border-[#D97958]/30">
                <span className="material-symbols-outlined text-sm">monetization_on</span>
                DOKION PUBLISHER & SELLER PORTAL
              </div>
              <h1 className="text-3xl font-headline font-bold text-on-surface">Publish & Sell Dokion Playbooks</h1>
              <p className="text-secondary text-sm mt-1">
                Author, price, package, and list cryptographically signed playbooks audited by Dokion Debugger.
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

        {/* Publisher Earnings Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface p-6 rounded-3xl border border-outline-variant/60 shadow-sm space-y-2">
            <span className="text-xs font-bold text-secondary uppercase">Total Revenue</span>
            <div className="text-3xl font-headline font-bold text-emerald-600">${totalRevenue} USD</div>
            <p className="text-[11px] text-secondary">From verified playbook purchases</p>
          </div>

          <div className="bg-surface p-6 rounded-3xl border border-outline-variant/60 shadow-sm space-y-2">
            <span className="text-xs font-bold text-secondary uppercase">Active Published Packages</span>
            <div className="text-3xl font-headline font-bold text-indigo-600">{listings?.length || 0}</div>
            <p className="text-[11px] text-secondary">Listed on Dokion Official & GitHub Registries</p>
          </div>

          <div className="bg-surface p-6 rounded-3xl border border-outline-variant/60 shadow-sm space-y-2">
            <span className="text-xs font-bold text-secondary uppercase">Publisher Verification Status</span>
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg">
              <span className="material-symbols-outlined filled">verified</span>
              Verified Creator (@my-store-author)
            </div>
            <p className="text-[11px] text-secondary">GPG & Ed25519 signing keys active</p>
          </div>
        </div>

        {/* Publish Form & Listings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form */}
          <div className="lg:col-span-7 bg-surface p-6 lg:p-8 rounded-3xl border border-outline-variant/60 shadow-sm space-y-6">
            <h2 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">publish</span>
              Package New Playbook
            </h2>

            {publishSuccessMsg && (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 filled">check_circle</span>
                {publishSuccessMsg}
              </div>
            )}

            <form onSubmit={handlePublishPlaybook} className="space-y-5 text-xs">
              <div>
                <label className="text-on-surface font-bold block mb-1">Playbook Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Dokion Kubernetes Cluster Deployer"
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-on-surface font-bold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="DevOps">DevOps</option>
                    <option value="Agentic Workflows">Agentic Workflows</option>
                    <option value="Security Shield">Security Shield</option>
                    <option value="Code Quality">Code Quality</option>
                    <option value="Data Pipelines">Data Pipelines</option>
                    <option value="AI Testing">AI Testing</option>
                  </select>
                </div>

                <div>
                  <label className="text-on-surface font-bold block mb-1">Price (USD) - Set 0 for Free</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={priceUsd}
                    onChange={e => setPriceUsd(Number(e.target.value))}
                    className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-on-surface font-bold block mb-1">Required Engine Capabilities (Comma Separated)</label>
                <input
                  type="text"
                  value={capabilities}
                  onChange={e => setCapabilities(e.target.value)}
                  placeholder="FILE_ACCESS, TERMINAL_EXEC, NET_PROXY"
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-mono text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="text-on-surface font-bold block mb-1">Package Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed explanation of what this playbook automates..."
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="text-on-surface font-bold block mb-1">playbook.yaml Spec Definition</label>
                <textarea
                  rows={6}
                  value={yamlContent}
                  onChange={e => setYamlContent(e.target.value)}
                  className="w-full p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isPublishing}
                className="w-full py-3.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-md focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    Signing & Publishing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    Sign & Publish to Dokion Store
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Active Publisher Listings */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-xl font-headline font-bold text-on-surface">Your Published Packages</h2>
            
            {!listings || listings.length === 0 ? (
              <div className="p-8 bg-surface rounded-3xl border border-dashed border-outline-variant text-center text-secondary text-xs">
                No active listings yet. Use the form to publish your first Dokion playbook!
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map(item => (
                  <div key={item.id} className="p-4 bg-surface rounded-2xl border border-outline-variant/60 shadow-sm flex items-center justify-between text-xs">
                    <div>
                      <div className="font-headline font-bold text-on-surface">{item.playbookName}</div>
                      <div className="text-secondary font-mono text-[11px] mt-0.5">
                        v{item.version} • {item.category} • {item.priceUsd > 0 ? `$${item.priceUsd}` : 'Free'}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 font-bold rounded-full text-[10px] uppercase">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
