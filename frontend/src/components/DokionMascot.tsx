import React from 'react';

export type DokionRole = 'core' | 'reviewer' | 'terminal' | 'guardian' | 'debugger' | 'focus';

export interface DokionMascotProps {
  role?: DokionRole;
  size?: number;
  className?: string;
  showBadge?: boolean;
  badgeLabel?: string;
  showCaption?: boolean;
  mono?: 'dark' | 'light' | false;
}

export function DokionMascot({
  role = 'core',
  size = 64,
  className = '',
  showBadge = false,
  badgeLabel,
  showCaption = false,
  mono = false
}: DokionMascotProps) {
  const charcoal = mono === 'light' ? '#FFFFFF' : '#30323D';
  const cream = mono === 'dark' ? '#1E2028' : '#FFFDF8';
  const terracotta = mono ? (mono === 'light' ? '#E68A6E' : '#D97958') : '#D97958';

  const roleMeta: Record<DokionRole, { title: string; desc: string }> = {
    core: { title: 'Core Dokion', desc: 'Primary mascot mark & brand identity' },
    reviewer: { title: 'Dokion Reviewer', desc: 'Code inspection & quality auditing' },
    terminal: { title: 'Dokion Terminal', desc: 'CLI execution & developer tools' },
    guardian: { title: 'Dokion Guardian', desc: 'Policy, safety & lockfile protection' },
    debugger: { title: 'Dokion Debugger', desc: 'Issue scanner & anomaly finder' },
    focus: { title: 'Dokion Focus', desc: 'Targeting, scope & validation' }
  };

  const currentMeta = roleMeta[role] || roleMeta.core;

  const renderMascotPaths = () => {
    switch (role) {
      case 'reviewer':
        return (
          <>
            <path d="M103 358C67 331 67 282 96 246C95 175 148 111 225 103C238 101 246 90 255 69C264 90 272 101 285 103C363 111 417 176 416 248C445 286 439 333 405 358C369 383 324 371 300 341C284 356 269 362 246 362C219 362 199 354 184 338C163 369 135 380 103 358Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="222" cy="210" r="49" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="344" cy="210" r="49" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M271 210H295" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="222" cy="210" r="11" fill={charcoal}/>
            <circle cx="344" cy="210" r="11" fill={charcoal}/>
            <path d="M273 279C280 286 290 286 297 279" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <circle cx="132" cy="244" r="54" fill={cream} stroke={charcoal} strokeWidth="16"/>
            <path d="M170 283L202 317" stroke={charcoal} strokeWidth="16" strokeLinecap="round"/>
            <path d="M111 231L91 246L111 261M146 231L166 246L146 261M132 222L122 270" stroke={terracotta} strokeWidth="11" strokeLinecap="round"/>
            <path d="M175 313C182 297 198 294 211 304C225 315 220 338 203 347" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <path d="M383 285C370 311 357 327 339 338" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
          </>
        );
      case 'terminal':
        return (
          <>
            <path d="M111 370V347H91V321H72V286H88V245H102V205H119V169H141V132H174V105H216V86H296V101H338V122H374V150H398V181H414V219H430V256H444V296H425V333H405V370H111Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="205" cy="207" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="327" cy="207" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M255 207H277" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="205" cy="207" r="12" fill={charcoal}/>
            <circle cx="327" cy="207" r="12" fill={charcoal}/>
            <path d="M254 278C261 284 271 284 278 278" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <path d="M121 303H190V370H121" stroke={charcoal} strokeWidth="16" strokeLinecap="round"/>
            <path d="M322 306L347 329L322 352M365 352H396" stroke={terracotta} strokeWidth="13" strokeLinecap="round"/>
            <path d="M401 76V53M418 82L434 65M384 82L368 65" stroke={terracotta} strokeWidth="11" strokeLinecap="round"/>
          </>
        );
      case 'guardian':
        return (
          <>
            <path d="M95 362C55 338 51 283 82 243C80 184 115 132 171 111C198 101 225 89 252 60C282 91 308 103 337 113C391 133 426 184 425 245C455 285 449 338 409 362C373 384 333 375 311 346C295 360 277 367 255 367C233 367 214 360 199 346C176 375 133 384 95 362Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="188" cy="208" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="320" cy="208" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M238 208H270" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="188" cy="208" r="11" fill={charcoal}/>
            <circle cx="320" cy="208" r="11" fill={charcoal}/>
            <path d="M246 278C252 284 260 284 266 278" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <path d="M130 284C149 311 171 319 195 309" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M382 284C363 311 341 319 317 309" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M256 294L306 313V352C293 379 277 394 256 407C235 394 219 379 206 352V313L256 294Z" fill={cream} stroke={charcoal} strokeWidth="15" strokeLinejoin="round"/>
            <path d="M232 349L248 365L282 330" stroke={terracotta} strokeWidth="14" strokeLinecap="round"/>
          </>
        );
      case 'debugger':
        return (
          <>
            <path d="M98 366C61 342 55 294 78 252C82 184 134 125 209 109C242 102 273 106 302 122C329 137 351 117 374 128C410 145 428 188 426 239C454 282 448 334 410 362C373 389 331 378 307 350C290 363 272 369 249 369C225 369 205 362 190 347C167 376 132 388 98 366Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="193" cy="210" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="315" cy="210" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M243 210H265" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="193" cy="210" r="11" fill={charcoal}/>
            <circle cx="315" cy="210" r="11" fill={charcoal}/>
            <path d="M245 279C252 285 261 285 268 279" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <path d="M128 292C147 315 166 327 187 336" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M384 292C365 315 346 327 325 336" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <ellipse cx="256" cy="343" rx="29" ry="37" fill="none" stroke={terracotta} strokeWidth="12"/>
            <path d="M256 306V380M226 326L209 316M286 326L303 316M226 345H206M286 345H306M228 363L211 375M284 363L301 375M240 306L232 294M272 306L280 294" stroke={terracotta} strokeWidth="10" strokeLinecap="round"/>
          </>
        );
      case 'focus':
        return (
          <>
            <path d="M102 362C64 338 56 287 82 246C82 175 136 116 213 103C252 96 293 103 326 120C356 136 381 110 408 132C430 151 435 184 426 218C456 263 455 318 421 352C386 386 341 377 315 346C300 360 279 368 255 368C231 368 210 360 195 346C171 376 136 383 102 362Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="194" cy="212" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="316" cy="212" r="50" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M244 212H266" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="194" cy="212" r="11" fill={charcoal}/>
            <circle cx="316" cy="212" r="11" fill={charcoal}/>
            <path d="M247 280C253 286 261 286 267 280" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <path d="M130 290C148 314 166 327 188 336" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M382 290C364 314 346 327 324 336" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M225 319V300H244M287 300H306V319M306 363V382H287M244 382H225V363" stroke={terracotta} strokeWidth="12" strokeLinecap="round"/>
          </>
        );
      case 'core':
      default:
        return (
          <>
            <path d="M94 354C52 334 45 278 80 238C78 158 148 88 256 88C364 88 434 158 432 238C467 278 460 334 418 354C380 372 338 364 315 334C300 351 280 360 256 360C232 360 212 351 197 334C174 364 132 372 94 354Z" fill={cream} stroke={charcoal} strokeWidth="18" strokeLinejoin="round"/>
            <circle cx="190" cy="205" r="51" fill="none" stroke={charcoal} strokeWidth="16"/>
            <circle cx="322" cy="205" r="51" fill="none" stroke={charcoal} strokeWidth="16"/>
            <path d="M241 205H271" stroke={charcoal} strokeWidth="14" strokeLinecap="round"/>
            <circle cx="190" cy="205" r="12" fill={charcoal}/>
            <circle cx="322" cy="205" r="12" fill={charcoal}/>
            <path d="M246 277C252 283 260 283 266 277" stroke={charcoal} strokeWidth="12" strokeLinecap="round"/>
            <path d="M132 278C149 304 172 317 197 302C186 322 192 342 213 350" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M380 278C363 304 340 317 315 302C326 322 320 342 299 350" stroke={charcoal} strokeWidth="15" strokeLinecap="round"/>
            <path d="M230 295H218V326H230" stroke={terracotta} strokeWidth="13" strokeLinecap="round"/>
            <path d="M282 295H294V326H282" stroke={terracotta} strokeWidth="13" strokeLinecap="round"/>
          </>
        );
    }
  };

  return (
    <div className={`inline-flex flex-col items-center shrink-0 ${className}`}>
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox="0 0 512 512"
          role="img"
          aria-label={`Dokion Mascot ${role}`}
          className="shrink-0 transition-transform duration-200 hover:scale-105"
        >
          {renderMascotPaths()}
        </svg>

        {showBadge && (
          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-[#D97958] text-white text-[9px] font-mono font-bold rounded-md shadow-sm uppercase tracking-wider">
            {badgeLabel || role}
          </span>
        )}
      </div>

      {showCaption && (
        <div className="text-center mt-1.5">
          <div className="font-headline font-bold text-xs text-[#30323D] tracking-tight">{currentMeta.title}</div>
          <div className="text-[10px] text-secondary">{currentMeta.desc}</div>
        </div>
      )}
    </div>
  );
}
