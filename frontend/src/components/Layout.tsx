import React from 'react';
import { ViewState } from '../App';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: string, extraId?: string) => void;
}

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { user, role } = useAuth();

  return (
    <div className="flex h-[100dvh] bg-[#FFFDF8] text-[#30323D]">
      {/* Left Rail Navigation */}
      <aside className="hidden md:flex flex-col items-center w-20 py-6 border-r border-[#30323D]/15 bg-white z-30">
        <button
          type="button"
          onClick={() => onNavigate('store')}
          title="Dokion Store Home"
          aria-label="Dokion Store Home"
          className="mb-8 hover:opacity-85 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#D97958] rounded-xl p-2 bg-[#30323D]"
        >
          <img
            src="/dokion-mascot-full-set/mascot/color/dokion-01-core.svg"
            alt="Dokion Logo"
            className="w-7 h-7 object-contain"
          />
        </button>

        <nav className="flex flex-col gap-4 flex-1 w-full px-2" aria-label="Main navigation">
          <NavItem
            icon="storefront"
            label="Explore"
            active={currentView === 'store' || currentView === 'explore'}
            onClick={() => onNavigate('store')}
          />
          <NavItem
            icon="local_library"
            label="Library"
            active={currentView === 'user-library'}
            onClick={() => onNavigate('user-library')}
          />
          <NavItem
            icon="publish"
            label="Publish"
            active={currentView === 'creator-publishing'}
            onClick={() => onNavigate('creator-publishing')}
          />
          {(role === 'MODERATOR' || role === 'ADMIN') && (
            <NavItem
              icon="gavel"
              label="Moderation"
              active={currentView === 'moderation-studio'}
              onClick={() => onNavigate('moderation-studio')}
            />
          )}
          <NavItem
            icon="hub"
            label="Registries"
            active={currentView === 'registries'}
            onClick={() => onNavigate('registries')}
          />
          <NavItem
            icon="settings"
            label="Settings"
            active={currentView === 'settings'}
            onClick={() => onNavigate('settings')}
          />
        </nav>

        <button
          type="button"
          onClick={() => onNavigate('user-library')}
          title={`User Profile: ${user?.name || 'Guest'}`}
          aria-label="User Profile"
          className="mt-auto hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-[#D97958] rounded-full p-1"
        >
          <img
            src={user?.avatarUrl || '/dokion-mascot-full-set/mascot/color/dokion-01-core.svg'}
            alt="User Avatar"
            className="w-9 h-9 rounded-full border border-[#30323D]/20 bg-[#FFFDF8] object-cover"
          />
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#30323D]/12 z-30 px-4 sm:px-8 py-3 shadow-2xs">
          <div className="flex justify-between items-center max-w-7xl mx-auto gap-4">
            {/* Brand Lockup */}
            <button
              type="button"
              onClick={() => onNavigate('store')}
              className="flex items-center gap-3 group text-left focus-visible:ring-2 focus-visible:ring-[#D97958] rounded-xl p-1 transition-all"
              title="Dokion Marketplace"
            >
              <div className="w-9 h-9 rounded-xl bg-[#30323D] flex items-center justify-center p-1.5 shadow-xs group-hover:scale-105 transition-transform">
                <img
                  src="/dokion-mascot-full-set/mascot/color/dokion-01-core.svg"
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-extrabold text-base tracking-tight text-[#30323D]">
                  Dokion
                </span>
                <span className="px-2 py-0.5 bg-[#D97958] text-white text-[10px] font-bold font-mono tracking-wider rounded-md uppercase shadow-2xs">
                  Marketplace
                </span>
              </div>
            </button>

            {/* Global Search Bar */}
            <GlobalSearch onNavigate={onNavigate} />

            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('user-library')}
                className="flex items-center gap-2.5 px-3 py-1.5 bg-white border border-[#30323D]/15 hover:border-[#30323D]/30 rounded-xl transition-all shadow-2xs hover:shadow-xs group"
              >
                <img
                  src={user?.avatarUrl || '/dokion-mascot-full-set/mascot/color/dokion-01-core.svg'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-[#30323D]/15"
                />
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-[#30323D] leading-tight">{user?.name || 'Guest'}</span>
                  <span className="text-[10px] font-mono text-[#D97958] font-bold tracking-wider leading-none uppercase">{role}</span>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic View Content */}
        <main className="flex-1 flex flex-col min-h-0 relative pb-[88px] md:pb-0 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-30 flex justify-around items-center px-2 pt-2 bg-white border-t border-[#30323D]/15 shadow-lg rounded-t-2xl pb-6" aria-label="Mobile Bottom Navigation">
        <MobileNavItem icon="storefront" label="Explore" active={currentView === 'store' || currentView === 'explore'} onClick={() => onNavigate('store')} />
        <MobileNavItem icon="local_library" label="Library" active={currentView === 'user-library'} onClick={() => onNavigate('user-library')} />
        <MobileNavItem icon="publish" label="Publish" active={currentView === 'creator-publishing'} onClick={() => onNavigate('creator-publishing')} />
        <MobileNavItem icon="settings" label="Settings" active={currentView === 'settings'} onClick={() => onNavigate('settings')} />
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors w-full focus-visible:ring-2 focus-visible:ring-[#D97958] ${
        active ? 'text-[#D97958] bg-[#D97958]/10 font-bold' : 'text-[#30323D]/70 hover:bg-[#30323D]/5 hover:text-[#30323D]'
      }`}
    >
      <span className={`material-symbols-outlined ${active ? 'filled' : ''}`}>{icon}</span>
      <span className="text-[10px] font-semibold tracking-tight mt-0.5">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-[#D97958] ${
        active ? 'text-[#D97958] bg-[#D97958]/10 font-bold' : 'text-[#30323D]/70'
      }`}
    >
      <span className={`material-symbols-outlined ${active ? 'filled' : ''}`}>{icon}</span>
      <span className="font-label text-[10px] font-medium tracking-wide mt-0.5">{label}</span>
    </button>
  );
}
