import React from 'react';
import { DokionMascot, DokionRole } from './DokionMascot';

export interface LogoProps {
  className?: string;
  variant?: 'primary' | 'icon' | 'monochrome' | 'dark' | 'stacked' | 'badge' | 'lockup';
  role?: DokionRole;
  size?: number;
  animated?: boolean;
  theme?: 'dokion' | 'default' | 'ocean' | 'emerald' | 'cyber' | 'monochrome' | 'amber';
  tagline?: string;
  badgeText?: string;
  onClick?: () => void;
}

export function Logo({
  className = '',
  variant = 'primary',
  role = 'core',
  size = 36,
  animated = false,
  theme = 'dokion',
  tagline = 'Playbooks & Skills Engine',
  badgeText = 'Dokion',
  onClick
}: LogoProps) {
  const isMonochrome = variant === 'monochrome' || theme === 'monochrome';
  const isDark = variant === 'dark';

  const mascotIcon = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-300 ${
        animated ? 'hover:scale-105' : ''
      }`}
    >
      <DokionMascot
        role={role}
        size={size}
        mono={isMonochrome ? (isDark ? 'light' : 'dark') : false}
      />
    </div>
  );

  if (variant === 'icon') {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`inline-flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-primary rounded-xl ${className}`}
          aria-label="Dokion Mascot Logo Icon"
        >
          {mascotIcon}
        </button>
      );
    }
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {mascotIcon}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center text-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {mascotIcon}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span
              className={`font-headline font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-[#30323D]'}`}
              style={{ fontSize: Math.max(18, size * 0.55) }}
            >
              Dokion
            </span>
            {badgeText && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-[#D97958]/15 text-[#D97958] rounded-full font-bold tracking-wider border border-[#D97958]/30">
                {badgeText}
              </span>
            )}
          </div>
          {tagline && (
            <span className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-300' : 'text-secondary'}`}>
              {tagline}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-surface border border-outline-variant/60 shadow-sm ${onClick ? 'cursor-pointer hover:bg-surface-container-high' : ''} ${className}`}
      >
        {mascotIcon}
        <span className="font-headline font-bold text-sm text-[#30323D] tracking-tight">
          Dokion
        </span>
        {badgeText && (
          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-[#D97958]/15 text-[#D97958] rounded font-bold border border-[#D97958]/30">
            {badgeText}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'lockup') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-4 ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
      >
        {mascotIcon}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span 
              className="font-headline font-extrabold tracking-tight text-[#30323D] leading-none"
              style={{ fontSize: Math.max(20, size * 0.7) }}
            >
              Dokion
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-[#D97958] text-white rounded-md">
              Identity
            </span>
          </div>
          <span className="text-xs text-secondary font-medium tracking-wide mt-1">
            Build Skills & Playbooks That Think With You
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
    >
      {mascotIcon}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-headline font-bold tracking-tight leading-none flex items-center gap-1.5 ${
              isDark ? 'text-white' : 'text-[#30323D]'
            }`}
            style={{ fontSize: Math.max(16, size * 0.58) }}
          >
            Dokion
            {badgeText && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#D97958]/15 text-[#D97958] rounded font-bold tracking-wider border border-[#D97958]/30">
                {badgeText}
              </span>
            )}
          </span>
        </div>
        {tagline && (
          <span className={`text-[11px] font-medium tracking-normal mt-1 leading-none ${
            isDark ? 'text-slate-400' : 'text-secondary'
          }`}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
