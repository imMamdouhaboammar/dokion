import React, { useState, useEffect } from 'react';
import { ViewState } from '../App';
import { db } from '../db';

interface SettingsProps {
  onNavigate: (view: ViewState) => void;
}

export function Settings({ onNavigate }: SettingsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [autoSave, setAutoSave] = useState(() => {
    return localStorage.getItem('autoSave') !== 'false';
  });
  const [notifications, setNotifications] = useState(() => {
    return localStorage.getItem('notifications') !== 'false';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('autoSave', autoSave.toString());
  }, [autoSave]);

  useEffect(() => {
    localStorage.setItem('notifications', notifications.toString());
  }, [notifications]);

  const handleClearData = async () => {
    await db.projects.clear();
    await db.skills.clear();
    await db.sessions.clear();
    await db.chats.clear();
    setShowConfirmModal(false);
    onNavigate('home');
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface-bright p-6 lg:p-10 pb-32 md:pb-16 relative">
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-lg border border-outline-variant">
            <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Clear Local Data?</h3>
            <p className="text-secondary text-sm mb-6">Are you sure you want to clear all local data? This action cannot be undone and will delete all your projects and skills.</p>
            <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-bold text-secondary hover:bg-surface-container-low rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleClearData}
                className="px-4 py-2 text-sm font-bold bg-error text-white hover:bg-error/90 rounded-lg transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              >
                Yes, Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-headline text-on-surface leading-tight mb-8">Settings</h1>
        
        <div className="space-y-8">
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-headline font-bold mb-4">Profile</h2>
            <div className="flex items-center gap-4 mb-6">
              <img 
                src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=f2ece4" 
                alt="User Profile" 
                className="w-16 h-16 rounded-full border border-outline-variant bg-surface-container"
              />
              <div>
                <p className="font-bold text-on-surface">Felix Developer</p>
                <p className="text-sm text-secondary">felix@skillaude.dev</p>
              </div>
              <button type="button" className="ml-auto px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-surface-container-low transition-colors focus-visible:ring-2 focus-visible:ring-primary">
                Edit Profile
              </button>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-headline font-bold mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-outline-variant/40">
                <div>
                  <p className="font-bold text-sm text-on-surface">Dark Mode</p>
                  <p className="text-xs text-secondary">Toggle dark mode appearance</p>
                </div>
                <button 
                  type="button"
                  role="switch"
                  aria-checked={darkMode}
                  aria-label="Dark Mode"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-11 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${darkMode ? 'bg-primary justify-end' : 'bg-surface-dim border border-outline-variant justify-start'}`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant/40">
                <div>
                  <p className="font-bold text-sm text-on-surface">Auto-save</p>
                  <p className="text-xs text-secondary">Automatically save changes in the editor</p>
                </div>
                <button 
                  type="button"
                  role="switch"
                  aria-checked={autoSave}
                  aria-label="Auto-save"
                  onClick={() => setAutoSave(!autoSave)}
                  className={`w-11 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${autoSave ? 'bg-primary justify-end' : 'bg-surface-dim border border-outline-variant justify-start'}`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold text-sm text-on-surface">Notifications</p>
                  <p className="text-xs text-secondary">Receive alerts for validation checks</p>
                </div>
                <button 
                  type="button"
                  role="switch"
                  aria-checked={notifications}
                  aria-label="Notifications"
                  onClick={() => setNotifications(!notifications)}
                  className={`w-11 h-6 rounded-full p-1 flex items-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${notifications ? 'bg-primary justify-end' : 'bg-surface-dim border border-outline-variant justify-start'}`}
                >
                  <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>
          </section>

          <section className="bg-error/5 border border-error/20 rounded-2xl p-6">
            <h2 className="text-xl font-headline font-bold text-error mb-2">Danger Zone</h2>
            <p className="text-sm text-secondary mb-4">Irreversible actions for your account and data.</p>
            <button 
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-2 bg-error text-white rounded-lg text-sm font-bold hover:bg-error/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Clear All Local Data
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
