import React, { useEffect } from 'react';

interface SetupMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetupMCPModal({ isOpen, onClose }: SetupMCPModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mcp-modal-title">
      <button 
        type="button"
        aria-label="Close backdrop"
        className="absolute inset-0 bg-black/40 w-full h-full border-none cursor-default"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-surface-container-high text-on-surface rounded-3xl shadow-2xl flex flex-col max-h-[85dvh] border border-outline-variant font-sans">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 shrink-0">
          <button 
            type="button"
            aria-label="Back and close"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center rounded-full hover:bg-surface-container-highest p-1 -ml-1 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 id="mcp-modal-title" className="text-lg font-medium text-on-surface">Setup MCP</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 custom-scrollbar">
          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            Connect your IDE or CLI to Stitch via the Model Context Protocol (MCP).
          </p>

          {/* Client Dropdown */}
          <div className="mb-6">
            <label htmlFor="mcp-client-select" className="block text-on-surface-variant text-sm mb-2">Client</label>
            <div className="relative flex items-center">
              <select 
                id="mcp-client-select"
                className="w-full bg-surface-container-highest text-on-surface rounded-xl px-4 py-3.5 pr-10 appearance-none border border-outline-variant focus-visible:ring-2 focus-visible:ring-primary cursor-pointer text-sm"
              >
                <option>Gemini CLI</option>
                <option>VS Code</option>
                <option>Cursor</option>
              </select>
              <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* API Key */}
          <div className="mb-8">
            <label className="block text-on-surface-variant text-sm mb-2">API key</label>
            <div className="flex items-center gap-3 bg-surface-container-highest rounded-xl px-4 py-3.5 border border-outline-variant">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">key</span>
              <span className="text-on-surface font-mono text-sm tracking-wide">••••7454802194fe</span>
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h3 className="text-on-surface-variant text-sm mb-4 font-semibold">Configuration</h3>
            
            <div className="mb-6">
              <label className="block text-on-surface text-sm mb-2">Step 1: Install the Stitch extension</label>
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant">
                <code className="text-on-surface font-mono text-xs leading-relaxed break-all">
                  gemini extensions install https://github.com/gemini-cli-extensions/stitch
                </code>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-on-surface text-sm mb-2">Step 2: The extension will prompt for your API key on first use</label>
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant">
                <code className="text-on-surface font-mono text-xs leading-relaxed break-all">
                  YOUR_GEMINI_API_KEY
                </code>
              </div>
            </div>

            {/* Footer Text */}
            <div className="border-t border-outline-variant pt-6 pb-4 space-y-5">
              <p className="text-on-surface-variant text-xs leading-relaxed">
                See the <a href="#" className="text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary rounded">Stitch MCP docs</a> for detailed setup instructions.
              </p>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                Your use of the Stitch API is governed by the Google Terms and Use Policy, and the Google APIs Terms and your Stitch settings. The Stitch <a href="#" className="text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary rounded">Privacy Notice</a> describes how your data is handled
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 pt-4 shrink-0 bg-surface-container-high border-t border-outline-variant">
          <button 
            type="button" 
            className="w-full bg-primary text-on-primary font-medium py-3.5 rounded-xl hover:bg-primary/90 transition-colors active:scale-[0.98] text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
