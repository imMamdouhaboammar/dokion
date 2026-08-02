import React, { useState } from 'react';
import { ViewState } from '../App';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Playbook } from '../db';
import { PlaybookInspectionModal } from '../components/PlaybookInspectionModal';
import { DokionMascot, DokionRole } from '../components/DokionMascot';

interface StoreProps {
  onNavigate: (view: ViewState, extraId?: string) => void;
}

export function Store({ onNavigate }: StoreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRegistry, setSelectedRegistry] = useState<string>('All');
  const [priceFilter, setPriceFilter] = useState<'All' | 'Free' | 'Paid'>('All');

  const [inspectingPlaybook, setInspectingPlaybook] = useState<Playbook | null>(null);
  const [buyingPlaybook, setBuyingPlaybook] = useState<Playbook | null>(null);
  const [sharingPlaybook, setSharingPlaybook] = useState<Playbook | null>(null);
  
  const [walletBalance, setWalletBalance] = useState<number>(150);
  const [tokenBalance, setTokenBalance] = useState<number>(500);

  const [buySuccessMsg, setBuySuccessMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const registries = useLiveQuery(() => db.registries.toArray());
  const playbooks = useLiveQuery(() => db.playbooks.toArray());

  const categories = ['All', 'DevOps', 'Agentic Workflows', 'Security Shield', 'Code Quality', 'Data Pipelines', 'AI Testing'];

  // Filter playbooks
  const filteredPlaybooks = (playbooks || []).filter(pb => {
    const matchesSearch = pb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pb.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pb.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pb.capabilities.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || pb.category === selectedCategory;
    const matchesRegistry = selectedRegistry === 'All' || pb.registrySource === selectedRegistry || pb.registryName === selectedRegistry;
    const matchesPrice = priceFilter === 'All' ? true : (priceFilter === 'Free' ? pb.priceUsd === 0 : pb.priceUsd > 0);

    return matchesSearch && matchesCategory && matchesRegistry && matchesPrice;
  });

  const handleBuyConfirm = async () => {
    if (!buyingPlaybook) return;
    if (walletBalance < buyingPlaybook.priceUsd) {
      alert('Insufficient wallet balance! Please add credits in Settings.');
      return;
    }

    try {
      const newLicenseKey = `DOKION-LIC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      // Update playbook owned state
      await db.playbooks.update(buyingPlaybook.id, {
        isOwned: true,
        licenseKey: newLicenseKey,
        updatedAt: Date.now()
      });

      // Record transaction
      await db.transactions.add({
        id: crypto.randomUUID(),
        playbookId: buyingPlaybook.id,
        playbookTitle: buyingPlaybook.title,
        amount: buyingPlaybook.priceUsd,
        currency: 'USD',
        timestamp: Date.now(),
        status: 'Completed',
        licenseKey: newLicenseKey
      });

      setWalletBalance(prev => prev - buyingPlaybook.priceUsd);
      setTokenBalance(prev => prev - (buyingPlaybook.priceTokens || 0));
      setBuySuccessMsg(`Successfully purchased ${buyingPlaybook.title}! License key: ${newLicenseKey}`);

      setTimeout(() => {
        setBuySuccessMsg(null);
        setBuyingPlaybook(null);
      }, 2500);
    } catch (err) {
      console.error('Purchase failed:', err);
    }
  };

  const handleCopyShareLink = (pb: Playbook) => {
    const shareUrl = `https://dokion.io/store/playbook/${pb.slug || pb.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Hero Section */}
        <section className="double-bezel mesh-glow">
          <div className="double-bezel-inner bg-gradient-to-br from-[#30323D] via-[#262831] to-[#1E2028] text-white p-8 md:p-12 overflow-hidden shadow-xl border border-[#D97958]/30 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#D97958]/15 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-2xl">
                <div className="eyebrow-badge bg-[#D97958]/20 text-[#D97958] border-[#D97958]/40 mb-4">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  OFFICIAL DOKION IDENTITY & PLAYBOOKS STORE
                </div>
                <h1 className="text-4xl md:text-5xl font-headline font-extrabold leading-tight mb-4 tracking-tight">
                  Verified Playbooks & Agent Engines for Dokion
                </h1>
                <p className="text-slate-300 font-body text-base md:text-lg leading-relaxed mb-8">
                  Discover, install, buy, sell, and share cryptographically signed Dokion Playbooks powered by the Dokion Mascot identity. Inspect version history, content-addressed SHA-256 cache blobs, and auditable lockfiles.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate('installed')}
                    className="btn-pill-nested bg-[#D97958] text-white hover:bg-[#c66848] shadow-lg"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">inventory_2</span>
                      <span>Inspect Cache & Lockfile</span>
                    </span>
                    <span className="btn-icon-wrapper bg-white/20 text-white">
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('sell')}
                    className="btn-pill-nested bg-slate-800/90 text-white border border-slate-600 hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">sell</span>
                      <span>Publish & Sell Playbook</span>
                    </span>
                    <span className="btn-icon-wrapper bg-white/10 text-white">
                      <span className="material-symbols-outlined text-xs">add</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Dokion Core Mascot Hero Art */}
              <div className="shrink-0 flex flex-col items-center bg-[#FFFDF8]/10 p-6 rounded-3xl border border-white/15 backdrop-blur-md text-center shadow-lg">
                <DokionMascot role="core" size={160} />
                <div className="mt-3 font-headline font-extrabold text-sm text-[#FFFDF8]">Dokion Core Mascot</div>
                <div className="text-[11px] font-mono text-[#D97958] font-bold mt-0.5">dokion-01-core.svg</div>
              </div>
            </div>
          </div>
        </section>

        {/* Dokion 6 Character Roles Interactive Set */}
        <section className="double-bezel">
          <div className="double-bezel-inner p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-headline font-extrabold text-[#30323D] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D97958]">face</span>
                  Dokion Mascot Character Roles (Full 6 Set)
                </h2>
                <p className="text-xs text-secondary mt-0.5 font-body">
                  Official character set from <code className="font-mono font-bold text-[#D97958]">dokion-mascot-full-set/README.md</code> mapping to distinct workflow contexts.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { role: 'core' as DokionRole, title: '01 Core', context: 'Logo & Brand Mark', view: 'store' },
                { role: 'reviewer' as DokionRole, title: '02 Reviewer', context: 'Inspection & Code Review', view: 'installed' },
                { role: 'terminal' as DokionRole, title: '03 Terminal', context: 'CLI & Installed Cache', view: 'installed' },
                { role: 'guardian' as DokionRole, title: '04 Guardian', context: 'Lockfiles & Policy Hardening', view: 'installed' },
                { role: 'debugger' as DokionRole, title: '05 Debugger', context: 'Issue Scanner & Audits', view: 'sell' },
                { role: 'focus' as DokionRole, title: '06 Focus', context: 'Scope & Target Validation', view: 'registries' },
              ].map(item => (
                <div 
                  key={item.role}
                  onClick={() => onNavigate(item.view as ViewState)}
                  className="p-3.5 bg-surface-container rounded-2xl border border-outline-variant/50 hover:border-[#D97958] hover:bg-surface-container-high transition-all flex flex-col items-center text-center group cursor-pointer"
                >
                  <DokionMascot role={item.role} size={56} />
                  <span className="font-headline font-bold text-xs text-[#30323D] mt-2 group-hover:text-[#D97958] transition-colors">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-secondary mt-0.5 line-clamp-1 font-body">
                    {item.context}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <section className="double-bezel">
          <div className="double-bezel-inner p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Search Input */}
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-4 top-3.5 text-secondary">search</span>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search playbooks by title, author, capabilities, or SHA-256..."
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl text-sm font-body text-on-surface focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  aria-label="Search Dokion Playbooks"
                />
              </div>

              {/* Registry Dropdown */}
              <div className="w-full md:w-64 shrink-0">
                <select
                  value={selectedRegistry}
                  onChange={e => setSelectedRegistry(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl text-sm font-semibold text-on-surface focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
                  aria-label="Filter Registry Source"
                >
                  <option value="All">All Registries</option>
                  {registries?.map(reg => (
                    <option key={reg.id} value={reg.url}>{reg.name}</option>
                  ))}
                </select>
              </div>

              {/* Price Filter */}
              <div className="flex bg-surface-container rounded-xl p-1 text-xs font-bold border border-outline-variant/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setPriceFilter('All')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${priceFilter === 'All' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setPriceFilter('Free')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${priceFilter === 'Free' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'}`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setPriceFilter('Paid')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${priceFilter === 'Paid' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'}`}
                >
                  Paid
                </button>
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <span className="text-xs font-bold font-mono text-secondary uppercase tracking-wider mr-2 shrink-0">Category:</span>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                    selectedCategory === cat
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Playbooks Marketplace Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-headline font-extrabold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">storefront</span>
              Available Dokion Playbooks ({filteredPlaybooks.length})
            </h2>
            <div className="text-xs font-mono text-secondary">
              Wallet Balance: <span className="font-bold text-emerald-600">${walletBalance} USD</span> / <span className="font-bold text-indigo-600">{tokenBalance} Tokens</span>
            </div>
          </div>

          {filteredPlaybooks.length === 0 ? (
            <div className="double-bezel">
              <div className="double-bezel-inner text-center py-16 p-8 border-dashed border-outline-variant text-secondary space-y-2">
                <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
                <p className="font-bold text-on-surface">No playbooks found matching criteria</p>
                <p className="text-xs font-body">Try broadening your search or switching registry sources.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlaybooks.map(pb => (
                <div 
                  key={pb.id}
                  className="double-bezel cursor-pointer group"
                >
                  <div className="double-bezel-inner p-6 flex flex-col justify-between h-full space-y-4">
                    <div>
                      {/* Top Row Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant text-[11px] font-mono font-bold rounded-lg border border-outline-variant/30">
                          {pb.version}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {pb.priceUsd > 0 ? (
                            <span className="px-3 py-1 bg-amber-500/15 text-amber-700 font-bold text-xs rounded-full border border-amber-500/30 font-mono">
                              ${pb.priceUsd} USD
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-emerald-500/15 text-emerald-700 font-bold text-xs rounded-full border border-emerald-500/30 font-mono">
                              FREE
                            </span>
                          )}
                          {pb.isActivated && (
                            <span className="px-2 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded-full uppercase tracking-wider font-mono">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-headline font-extrabold text-on-surface leading-snug mb-1 group-hover:text-primary transition-colors">
                        {pb.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-xs text-secondary font-mono mb-3">
                        <span>{pb.author}</span>
                        {pb.authorVerified && (
                          <span className="material-symbols-outlined text-emerald-600 text-xs filled" title="Verified Author">verified</span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                          <span className="material-symbols-outlined text-xs filled text-amber-500">star</span>
                          {pb.rating}
                        </span>
                        <span>({pb.downloads} DLs)</span>
                      </div>

                      <p className="text-secondary text-xs line-clamp-2 leading-relaxed mb-4 font-body">
                        {pb.description}
                      </p>

                      {/* Capabilities Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {pb.capabilities.slice(0, 3).map(cap => (
                          <span key={cap} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-mono font-bold rounded">
                            {cap}
                          </span>
                        ))}
                        {pb.capabilities.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-surface-container text-secondary text-[10px] font-mono rounded">
                            +{pb.capabilities.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-4 border-t border-outline-variant/40 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingPlaybook(pb)}
                        className="px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-sm">info</span>
                        Inspect
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSharingPlaybook(pb)}
                          className="p-2 text-secondary hover:text-primary bg-surface-container rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                          title="Share Playbook"
                          aria-label="Share Playbook"
                        >
                          <span className="material-symbols-outlined text-sm">share</span>
                        </button>

                        {pb.priceUsd > 0 && !pb.isOwned ? (
                          <button
                            type="button"
                            onClick={() => setBuyingPlaybook(pb)}
                            className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors flex items-center gap-1 shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="material-symbols-outlined text-sm">shopping_cart</span>
                            Buy
                          </button>
                        ) : pb.isActivated ? (
                          <button
                            type="button"
                            onClick={() => onNavigate('playbook-detail', pb.id)}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            View Details
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setInspectingPlaybook(pb)}
                            className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Install Inert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Playbook Inspection Modal */}
      {inspectingPlaybook && (
        <PlaybookInspectionModal 
          playbook={inspectingPlaybook} 
          onClose={() => setInspectingPlaybook(null)} 
        />
      )}

      {/* Buy Modal */}
      {buyingPlaybook && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
              <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">shopping_bag</span>
                Purchase Dokion Playbook
              </h3>
              <button 
                type="button"
                onClick={() => setBuyingPlaybook(null)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 space-y-1">
                <div className="font-bold text-sm text-on-surface">{buyingPlaybook.title}</div>
                <div className="text-secondary font-mono">Publisher: {buyingPlaybook.author} | Version: {buyingPlaybook.version}</div>
              </div>

              <div className="flex justify-between items-center p-3 bg-surface-container rounded-xl">
                <span className="font-semibold text-secondary">Price:</span>
                <span className="font-bold text-amber-600 text-sm">${buyingPlaybook.priceUsd} USD / {buyingPlaybook.priceTokens} Dokion Tokens</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-surface-container rounded-xl">
                <span className="font-semibold text-secondary">Your Available Wallet:</span>
                <span className="font-bold text-emerald-600 text-sm">${walletBalance} USD</span>
              </div>
            </div>

            {buySuccessMsg ? (
              <div className="p-3 bg-emerald-500/15 text-emerald-700 rounded-xl text-xs font-bold text-center">
                {buySuccessMsg}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBuyingPlaybook(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-secondary hover:bg-surface-container rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBuyConfirm}
                  className="px-6 py-2.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  Confirm & Issue License
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {sharingPlaybook && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
              <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">share</span>
                Share Dokion Playbook
              </h3>
              <button 
                type="button"
                onClick={() => setSharingPlaybook(null)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-secondary font-bold mb-1 block">Shareable Registry URL:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://dokion.io/store/playbook/${sharingPlaybook.slug || sharingPlaybook.id}`}
                    className="flex-1 bg-surface-container p-3 rounded-xl border border-outline-variant font-mono text-xs text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(sharingPlaybook)}
                    className="px-4 py-3 bg-primary text-on-primary font-bold rounded-xl text-xs hover:bg-primary/90 transition-colors"
                  >
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-secondary font-bold mb-1 block">Auditable Lockfile Snippet (dokion-lock.json):</label>
                <div className="bg-slate-950 text-emerald-400 p-3 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto">
{JSON.stringify({
  package: sharingPlaybook.title,
  version: sharingPlaybook.version,
  sha256: sharingPlaybook.sha256,
  registry: sharingPlaybook.registrySource
}, null, 2)}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSharingPlaybook(null)}
                className="px-5 py-2.5 bg-surface-container font-semibold rounded-xl text-xs hover:bg-surface-container-high"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
