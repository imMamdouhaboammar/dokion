import React, { useState, useEffect } from 'react';
import type { PlaybookListing } from '../types/marketplace';
import { MarketplaceService, SearchFilters } from '../services/marketplaceService';
import { useAuth } from '../context/AuthContext';

interface MarketplaceStorefrontProps {
  onNavigate: (view: string, extraId?: string) => void;
}

const CATEGORIES = [
  'All',
  'Security Scanning',
  'Code Review',
  'Dependency Analysis',
  'Infrastructure',
  'CI and CD',
  'Web Applications',
  'APIs',
  'Databases',
  'Cloud Security',
  'Secrets Detection',
  'Compliance',
  'Testing',
  'Developer Experience',
  'Reporting',
  'Output Adapters',
  'Custom Policies'
];

export function MarketplaceStorefront({ onNavigate }: MarketplaceStorefrontProps) {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<PlaybookListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isPaid, setIsPaid] = useState<boolean | undefined>(undefined);
  const [officialOnly, setIsOfficialOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SearchFilters['sortBy']>('relevance');

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      const results = await MarketplaceService.searchPlaybooks({
        query,
        category: selectedCategory,
        isPaid,
        isOfficial: officialOnly,
        sortBy
      });
      setPlaybooks(results);
      setLoading(false);
    }
    fetchListings();
  }, [query, selectedCategory, isPaid, officialOnly, sortBy]);

  const verifiedPlaybooks = playbooks.filter(p => p.lastVerifiedAt);

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#30323D]">
      {/* Hero Section */}
      <section className="px-4 sm:px-6 pt-8 pb-6 max-w-6xl mx-auto">
        <div className="double-bezel mesh-glow">
          <div className="double-bezel-inner p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="space-y-4 max-w-xl text-center md:text-left z-10">
              <div className="eyebrow-badge">
                <span className="material-symbols-outlined text-xs">verified_user</span>
                Official Dokion Distribution & Execution Layer
              </div>
              
              <h1 className="text-3xl sm:text-5xl font-extrabold font-headline leading-tight tracking-tight text-[#30323D]">
                Verified Dokion Playbooks & Security Scanners
              </h1>
              
              <p className="text-xs sm:text-sm text-[#30323D]/85 leading-relaxed font-body">
                Executable rulesets, analysis workflows, and output adapters for Dokion AI Engine. Every package is cryptographically verified with real sandbox test pass records.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('creator-publishing')}
                  className="btn-pill-nested bg-[#D97958] hover:bg-[#c26543] text-white shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">publish</span>
                    <span>Publish a Playbook</span>
                  </span>
                  <span className="btn-icon-wrapper bg-white/20 text-white">
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('user-library')}
                  className="btn-pill-nested bg-[#30323D]/5 hover:bg-[#30323D]/10 text-[#30323D] border border-[#30323D]/15"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">local_library</span>
                    <span>My Library & Licenses</span>
                  </span>
                  <span className="btn-icon-wrapper bg-[#30323D]/10 text-[#30323D]">
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="relative shrink-0 z-10">
              <div className="w-48 h-48 sm:w-56 sm:h-56 bg-white/90 rounded-2xl p-4 border border-[#30323D]/12 flex items-center justify-center shadow-sm backdrop-blur-xs">
                <img
                  src="/dokion-mascot-full-set/mascot/color/dokion-01-core.svg"
                  alt="Dokion Core Mascot"
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted & Verified Showcase Section */}
      <section className="px-4 sm:px-6 py-4 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-base font-extrabold font-headline text-[#30323D] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
              Recently Verified Execution Proofs
            </h2>
            <p className="text-xs text-[#30323D]/60 font-body">Playbooks that passed full isolated sandbox test runs against Dokion Findings Protocol v1.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {verifiedPlaybooks.slice(0, 3).map(pb => (
            <div
              key={pb.id}
              onClick={() => onNavigate('playbook-detail', pb.slug)}
              className="double-bezel cursor-pointer group"
            >
              <div className="double-bezel-inner p-4 border-emerald-500/20 hover:border-emerald-500/50 transition-colors flex flex-col justify-between h-full">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-800 text-[10px] font-bold rounded-md font-mono flex items-center gap-1 border border-emerald-500/20">
                      <span className="material-symbols-outlined text-xs">check_circle</span> Verified Test Pass
                    </span>
                    <span className="text-[10px] font-mono text-[#30323D]/60">Dokion &ge;1.8.0</span>
                  </div>
                  <h3 className="font-bold text-xs text-[#30323D] group-hover:text-[#D97958] transition-colors line-clamp-1">{pb.title}</h3>
                  <p className="text-[11px] text-[#30323D]/75 line-clamp-2 leading-relaxed">{pb.summary}</p>
                </div>

                <div className="pt-3 mt-3 border-t border-[#30323D]/10 flex justify-between items-center text-[10px] text-[#30323D]/60 font-mono">
                  <span>SHA-256 Verified</span>
                  <span>{pb.lastVerifiedAt ? new Date(pb.lastVerifiedAt).toLocaleDateString() : 'Active'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog Search & Filtering */}
      <section className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-6">
        <div className="double-bezel">
          <div className="double-bezel-inner p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#30323D]/50 text-lg">search</span>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search playbooks by title, capability, category, or publisher..."
                  className="w-full pl-9 pr-4 py-2.5 border border-[#30323D]/15 rounded-xl text-xs bg-[#FFFDF8] focus:outline-none focus:ring-2 focus:ring-[#D97958] font-body"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SearchFilters['sortBy'])}
                  className="px-3 py-2.5 border border-[#30323D]/15 rounded-xl text-xs bg-white font-semibold text-[#30323D]"
                >
                  <option value="relevance">Sort: Relevance</option>
                  <option value="recently_updated">Sort: Recently Updated</option>
                  <option value="highest_rated">Sort: Highest Rated</option>
                  <option value="most_installed">Sort: Most Installed</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Categories Pill Bar */}
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar border-t border-[#30323D]/10 pt-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border ${
                    selectedCategory === cat
                      ? 'bg-[#30323D] text-white border-[#30323D] shadow-xs'
                      : 'bg-[#FFFDF8] text-[#30323D]/80 border-[#30323D]/15 hover:border-[#30323D]/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Additional Filter Checkboxes */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#30323D]/80 pt-2 border-t border-[#30323D]/10">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#30323D]">
                <input
                  type="checkbox"
                  checked={isPaid === false}
                  onChange={e => setIsPaid(e.target.checked ? false : undefined)}
                  className="rounded text-[#D97958] focus:ring-[#D97958]"
                />
                <span>Free Playbooks Only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#30323D]">
                <input
                  type="checkbox"
                  checked={isPaid === true}
                  onChange={e => setIsPaid(e.target.checked ? true : undefined)}
                  className="rounded text-[#D97958] focus:ring-[#D97958]"
                />
                <span>Commercial License Only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#30323D]">
                <input
                  type="checkbox"
                  checked={officialOnly}
                  onChange={e => setIsOfficialOnly(e.target.checked)}
                  className="rounded text-[#D97958] focus:ring-[#D97958]"
                />
                <span>Official Dokion Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Playbook Cards Grid */}
        {loading ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-3xl animate-spin text-[#D97958]">progress_activity</span>
          </div>
        ) : playbooks.length === 0 ? (
          <div className="double-bezel max-w-md mx-auto">
            <div className="double-bezel-inner text-center py-12 p-8 space-y-3">
              <img src="/dokion-mascot-full-set/mascot/color/dokion-06-focus.svg" alt="" className="w-20 h-20 mx-auto" />
              <h3 className="text-base font-bold font-headline">No Matching Playbooks</h3>
              <p className="text-xs text-[#30323D]/70 font-body">No playbooks found matching your search filters.</p>
              <button
                type="button"
                onClick={() => { setQuery(''); setSelectedCategory('All'); setIsPaid(undefined); setIsOfficialOnly(false); }}
                className="btn-pill-nested bg-[#30323D] text-white"
              >
                <span>Reset Filters</span>
                <span className="btn-icon-wrapper bg-white/20">
                  <span className="material-symbols-outlined text-xs">restart_alt</span>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playbooks.map(pb => (
              <div
                key={pb.id}
                onClick={() => onNavigate('playbook-detail', pb.slug)}
                className="double-bezel cursor-pointer group"
              >
                <div className="double-bezel-inner p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <img src={pb.iconUrl} alt="" className="w-12 h-12 rounded-xl object-contain bg-[#30323D]/5 p-2 border border-[#30323D]/10" />
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-headline ${
                        pb.isPaid ? 'bg-[#D97958]/10 text-[#D97958] border border-[#D97958]/20' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {pb.isPaid ? `$${(pb.priceUsdCents / 100).toFixed(2)} USD` : 'FREE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-[#30323D]/60 font-semibold font-body">
                      <span>{pb.publisherName}</span>
                      {pb.publisherVerified && (
                        <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-base font-headline text-[#30323D] group-hover:text-[#D97958] transition-colors mb-1.5 line-clamp-1">
                      {pb.title}
                    </h3>

                    <p className="text-xs text-[#30323D]/75 line-clamp-2 mb-4 leading-relaxed font-body">
                      {pb.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#30323D]/10 flex justify-between items-center text-xs text-[#30323D]/70 font-medium">
                    <div className="flex items-center gap-1 font-bold text-[#30323D]">
                      <span className="material-symbols-outlined text-sm text-amber-500 fill">star</span>
                      <span>{pb.ratingAverage}</span>
                      <span className="text-[#30323D]/50 font-normal">({pb.ratingCount})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-[#30323D]/5 px-2 py-0.5 rounded border border-[#30323D]/10">v{pb.currentVersion}</span>
                      <span className="text-[#30323D]/50">&bull;</span>
                      <span className="font-mono text-[11px]">{pb.downloadCount.toLocaleString()} installs</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
