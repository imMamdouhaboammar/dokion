import React, { useState, useEffect } from 'react';
import type { InstallationRecord, LicenseRecord, OrderRecord } from '../types/marketplace';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';

interface UserLibraryViewProps {
  onNavigate: (view: string, extraId?: string) => void;
}

export function UserLibraryView({ onNavigate }: UserLibraryViewProps) {
  const { user } = useAuth();
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'installed' | 'licenses' | 'purchases'>('installed');

  useEffect(() => {
    async function loadUserLibrary() {
      if (!user) return;
      const insts = await db.installations.where('userId').equals(user.id).toArray();
      setInstallations(insts);
      const lics = await db.licenses.where('userId').equals(user.id).toArray();
      setLicenses(lics);
      const ords = await db.orders.where('userId').equals(user.id).toArray();
      setOrders(ords);
    }
    loadUserLibrary();
  }, [user]);

  if (!user) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white border border-[#30323D]/15 rounded-2xl">
        <h2 className="text-xl font-bold font-headline mb-2">Sign In Required</h2>
        <p className="text-xs text-[#30323D]/70 mb-4">Please sign in to view your personal playbook library and commercial licenses.</p>
        <button type="button" onClick={() => onNavigate('store')} className="px-4 py-2 bg-[#30323D] text-white rounded-xl text-xs font-bold">
          Return to Store
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center bg-white border border-[#30323D]/15 p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-xs font-bold text-[#D97958] uppercase tracking-wider">Personal Workspace</span>
          <h1 className="text-2xl font-bold font-headline text-[#30323D]">My Library & Commercial Licenses</h1>
        </div>
        <div className="text-xs font-bold text-[#30323D]/70">
          User: <span className="text-[#D97958]">{user.name}</span> (@{user.handle})
        </div>
      </div>

      <div className="flex border-b border-[#30323D]/15 gap-4">
        {(['installed', 'licenses', 'purchases'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 font-bold text-xs uppercase tracking-wider transition-colors border-b-2 capitalize ${
              activeTab === tab ? 'border-[#D97958] text-[#D97958]' : 'border-transparent text-[#30323D]/60 hover:text-[#30323D]'
            }`}
          >
            {tab === 'installed' ? `Installed Playbooks (${installations.length})` : tab === 'licenses' ? `Commercial Licenses (${licenses.length})` : `Order History (${orders.length})`}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#30323D]/15 rounded-2xl p-6 shadow-sm min-h-[300px]">
        {activeTab === 'installed' && (
          <div className="space-y-4">
            {installations.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#30323D]/60">
                <p>No installed playbooks in your local library.</p>
                <button type="button" onClick={() => onNavigate('store')} className="mt-4 px-4 py-2 bg-[#D97958] text-white rounded-xl font-bold">
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {installations.map(inst => (
                  <div key={inst.id} className="p-4 border border-[#30323D]/15 rounded-xl bg-[#FFFDF8] flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-sm text-[#30323D]">{inst.playbookSlug}</div>
                      <div className="text-[#30323D]/60 font-mono mt-0.5">Version: v{inst.installedVersion}</div>
                      <div className="text-[10px] text-emerald-700 font-bold mt-1">✓ Activated & Locked</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('playbook-detail', inst.playbookSlug)}
                      className="px-3 py-1.5 bg-[#30323D] text-white font-bold rounded-lg hover:bg-[#30323D]/90"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'licenses' && (
          <div className="space-y-4">
            {licenses.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#30323D]/60">
                <p>No commercial licenses owned.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {licenses.map(lic => (
                  <div key={lic.id} className="p-4 border border-[#30323D]/15 rounded-xl bg-[#FFFDF8] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-[#30323D]">{lic.playbookSlug}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase">{lic.status}</span>
                    </div>
                    <div className="font-mono bg-[#30323D] text-[#FFFDF8] p-2 rounded-lg text-[11px]">
                      License Key: {lic.licenseKey}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#30323D]/60">
                <p>No purchase records found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(ord => (
                  <div key={ord.id} className="p-4 border border-[#30323D]/15 rounded-xl bg-[#FFFDF8] flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-[#30323D]">{ord.playbookTitle}</div>
                      <div className="text-[#30323D]/60 font-mono mt-0.5">Order ID: {ord.id}</div>
                      <div className="text-[10px] text-[#30323D]/50">{new Date(ord.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#D97958] text-sm">${(ord.amountCents / 100).toFixed(2)} USD</div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">{ord.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
