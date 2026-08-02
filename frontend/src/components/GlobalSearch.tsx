import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Playbook } from '../db';
import { ViewState } from '../App';

interface GlobalSearchProps {
  onNavigate: (view: ViewState, extraId?: string) => void;
}

const FEATURED_TAGS = [
  'DevOps',
  'Agentic Workflows',
  'Security Shield',
  'Code Quality',
  'Data Pipelines',
  'AI Testing',
  'TERMINAL_EXEC',
  'SUBAGENT_DISPATCH',
  'SECRETS_ACCESS'
];

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch playbooks live from Dexie DB
  const allPlaybooks = useLiveQuery(() => db.playbooks.toArray()) || [];

  // Filter playbooks by name, capabilities/tags, category, description, author
  const trimmedQuery = query.trim().toLowerCase();
  
  const filteredPlaybooks = trimmedQuery
    ? allPlaybooks.filter(pb => {
        const matchesName = pb.title.toLowerCase().includes(trimmedQuery);
        const matchesCategory = pb.category.toLowerCase().includes(trimmedQuery);
        const matchesDescription = pb.description.toLowerCase().includes(trimmedQuery);
        const matchesAuthor = pb.author.toLowerCase().includes(trimmedQuery);
        const matchesTags = pb.capabilities.some(cap => cap.toLowerCase().includes(trimmedQuery));
        const matchesSlug = (pb.slug || '').toLowerCase().includes(trimmedQuery);
        
        return matchesName || matchesCategory || matchesDescription || matchesAuthor || matchesTags || matchesSlug;
      })
    : [];

  const installedResults = filteredPlaybooks.filter(pb => pb.isInstalled);
  const storeResults = filteredPlaybooks.filter(pb => !pb.isInstalled);

  // Flat list for keyboard navigation
  const flatResults = [...installedResults, ...storeResults];

  // Shortcut key handling (Cmd+K / Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation through results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        handleSelectResult(flatResults[selectedIndex]);
      } else if (flatResults.length > 0) {
        handleSelectResult(flatResults[0]);
      }
    }
  };

  const handleSelectResult = (pb: Playbook) => {
    setIsOpen(false);
    if (pb.isInstalled) {
      if (pb.isActivated) {
        onNavigate('playbook-detail', pb.id);
      } else {
        onNavigate('installed');
      }
    } else {
      onNavigate('store');
    }
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-2 sm:mx-4">
      {/* Search Input Container */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3 text-secondary text-lg pointer-events-none">
          search
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Global search playbooks & tags (Cmd+K)..."
          aria-label="Global search playbooks and store items by name or tags"
          aria-expanded={isOpen}
          role="combobox"
          className="w-full pl-9 pr-16 py-1.5 bg-surface-container-lowest border border-outline-variant/80 rounded-xl text-xs font-body text-on-surface placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-xs"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-0.5 text-secondary hover:text-on-surface rounded-full transition-colors"
            title="Clear search"
            aria-label="Clear search query"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 px-1.5 py-0.5 bg-surface-container text-secondary text-[10px] font-mono font-bold rounded border border-outline-variant/40 pointer-events-none">
            <span className="text-[9px]">⌘</span>K
          </kbd>
        )}
      </div>

      {/* Global Search Dropdown Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant/80 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
          {/* Quick Filter Tag Chips */}
          <div className="p-3 bg-surface-container-lowest border-b border-outline-variant/40">
            <div className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Filter by Name or Tags</span>
              <span className="text-primary font-mono lowercase">{allPlaybooks.length} items available</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {FEATURED_TAGS.map(tag => {
                const isSelected = query.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm scale-95'
                        : 'bg-surface-container text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 space-y-3 flex-1">
            {!query ? (
              <div className="p-4 text-center text-xs text-secondary space-y-1">
                <span className="material-symbols-outlined text-2xl text-outline mb-1 block">travel_explore</span>
                <p className="font-semibold text-on-surface">Search Playbooks & Store Items</p>
                <p className="text-[11px]">Type a name, author, capability tag, or click a tag chip above.</p>
              </div>
            ) : flatResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-secondary space-y-2">
                <span className="material-symbols-outlined text-3xl text-outline block">search_off</span>
                <p className="font-bold text-on-surface">No playbooks or tags found for "{query}"</p>
                <p className="text-[11px]">Try searching for terms like "DevOps", "Security", "TERMINAL_EXEC", or "Auditor".</p>
              </div>
            ) : (
              <>
                {/* Installed Playbooks Section */}
                {installedResults.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-[10px] font-bold font-mono text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 bg-emerald-500/10 rounded-lg mb-1.5">
                      <span className="material-symbols-outlined text-xs">inventory_2</span>
                      Installed Playbooks ({installedResults.length})
                    </div>
                    <div className="space-y-1">
                      {installedResults.map(pb => {
                        const globalIdx = flatResults.findIndex(item => item.id === pb.id);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <div
                            key={pb.id}
                            onClick={() => handleSelectResult(pb)}
                            className={`p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/40 shadow-sm'
                                : 'hover:bg-surface-container border border-transparent'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-headline font-bold text-xs text-on-surface truncate">
                                  {pb.title}
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 text-[10px] font-bold rounded-full font-mono shrink-0">
                                  {pb.isActivated ? 'ACTIVE' : 'INERT'}
                                </span>
                              </div>
                              <p className="text-[11px] text-secondary line-clamp-1 leading-normal">
                                {pb.description}
                              </p>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                <span className="text-[10px] font-mono text-secondary mr-1">
                                  by {pb.author}
                                </span>
                                {pb.capabilities.map(cap => (
                                  <span
                                    key={cap}
                                    className={`px-1.5 py-0.2 text-[9px] font-mono rounded ${
                                      cap.toLowerCase().includes(trimmedQuery) 
                                        ? 'bg-indigo-500/20 text-indigo-700 font-bold' 
                                        : 'bg-surface-container-high text-secondary'
                                    }`}
                                  >
                                    #{cap}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectResult(pb);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shrink-0 flex items-center gap-1 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {pb.isActivated ? 'play_arrow' : 'settings'}
                              </span>
                              {pb.isActivated ? 'Run' : 'Manage'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Store Marketplace Section */}
                {storeResults.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-[10px] font-bold font-mono text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 bg-indigo-500/10 rounded-lg mb-1.5 mt-2">
                      <span className="material-symbols-outlined text-xs">storefront</span>
                      Store Marketplace ({storeResults.length})
                    </div>
                    <div className="space-y-1">
                      {storeResults.map(pb => {
                        const globalIdx = flatResults.findIndex(item => item.id === pb.id);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <div
                            key={pb.id}
                            onClick={() => handleSelectResult(pb)}
                            className={`p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/40 shadow-sm'
                                : 'hover:bg-surface-container border border-transparent'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-headline font-bold text-xs text-on-surface truncate">
                                  {pb.title}
                                </span>
                                {pb.priceUsd > 0 ? (
                                  <span className="px-2 py-0.5 bg-amber-500/15 text-amber-700 text-[10px] font-bold rounded-full font-mono shrink-0">
                                    ${pb.priceUsd}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 text-[10px] font-bold rounded-full font-mono shrink-0">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-secondary line-clamp-1 leading-normal">
                                {pb.description}
                              </p>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                <span className="text-[10px] font-mono text-secondary mr-1">
                                  by {pb.author}
                                </span>
                                {pb.capabilities.map(cap => (
                                  <span
                                    key={cap}
                                    className={`px-1.5 py-0.2 text-[9px] font-mono rounded ${
                                      cap.toLowerCase().includes(trimmedQuery) 
                                        ? 'bg-indigo-500/20 text-indigo-700 font-bold' 
                                        : 'bg-surface-container-high text-secondary'
                                    }`}
                                  >
                                    #{cap}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectResult(pb);
                              }}
                              className="px-2.5 py-1 bg-primary text-on-primary rounded-lg text-[10px] font-bold hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-xs">storefront</span>
                              View
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
