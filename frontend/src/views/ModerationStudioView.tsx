import React, { useState, useEffect } from 'react';
import type { PlaybookListing, AuditLogEntry } from '../types/marketplace';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';

interface ModerationStudioViewProps {
  onNavigate: (view: string, extraId?: string) => void;
}

export function ModerationStudioView({ onNavigate }: ModerationStudioViewProps) {
  const { user, role } = useAuth();
  const [submissions, setSubmissions] = useState<PlaybookListing[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedListing, setSelectedListing] = useState<PlaybookListing | null>(null);
  const [modNote, setModNote] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const all = await db.playbookListings.toArray();
      setSubmissions(all);
      const logs = await db.auditLogs.orderBy('timestamp').reverse().toArray();
      setAuditLogs(logs);
      if (all.length > 0 && !selectedListing) {
        setSelectedListing(all[0]);
      }
    }
    loadData();
  }, [selectedListing]);

  if (role !== 'MODERATOR' && role !== 'ADMIN') {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-white border border-[#30323D]/15 rounded-2xl">
        <span className="material-symbols-outlined text-4xl text-red-600 mb-2">gavel</span>
        <h2 className="text-xl font-bold font-headline mb-2">Access Denied</h2>
        <p className="text-xs text-[#30323D]/70 mb-4">You must be logged in as a Moderator or Admin to access the Moderation Studio.</p>
        <button type="button" onClick={() => onNavigate('store')} className="px-4 py-2 bg-[#30323D] text-white rounded-xl text-xs font-bold">
          Return to Store
        </button>
      </div>
    );
  }

  const handleAction = async (newStatus: 'APPROVED' | 'CHANGES_REQUESTED' | 'SUSPENDED') => {
    if (!selectedListing || !user) return;

    await db.playbookListings.update(selectedListing.id, {
      status: newStatus,
      updatedAt: Date.now()
    });

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now().toString(36)}`,
      actorId: user.id,
      actorRole: role,
      action: `PLAYBOOK_${newStatus}`,
      targetType: 'playbook',
      targetId: selectedListing.id,
      details: modNote || `Changed status to ${newStatus}`,
      timestamp: Date.now()
    };

    await db.auditLogs.put(auditEntry);

    setActionMessage(`Playbook status updated to ${newStatus}. Audit log recorded.`);
    setModNote('');
    setSelectedListing(prev => (prev ? { ...prev, status: newStatus } : null));
    setSubmissions(prev => prev.map(s => (s.id === selectedListing.id ? { ...s, status: newStatus } : s)));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center bg-white border border-[#30323D]/15 p-6 rounded-2xl shadow-sm">
        <div>
          <span className="text-xs font-bold text-[#D97958] uppercase tracking-wider">Moderation Studio</span>
          <h1 className="text-2xl font-bold font-headline text-[#30323D]">Playbook Submissions Queue</h1>
        </div>
        <div className="text-xs text-right">
          <div>Logged in as: <strong>{user?.name}</strong></div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">{role}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Submissions List */}
        <div className="bg-white border border-[#30323D]/15 p-4 rounded-2xl space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#30323D]/70 mb-2">Submissions ({submissions.length})</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {submissions.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setSelectedListing(s); setActionMessage(null); }}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                  selectedListing?.id === s.id ? 'border-[#D97958] bg-[#D97958]/5' : 'border-[#30323D]/10 hover:bg-[#30323D]/5'
                }`}
              >
                <div className="font-bold text-[#30323D]">{s.title}</div>
                <div className="text-[11px] text-[#30323D]/60 flex justify-between mt-1">
                  <span>{s.publisherName}</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                    s.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' :
                    s.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                  }`}>{s.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Submission Inspector */}
        {selectedListing && (
          <div className="md:col-span-2 bg-white border border-[#30323D]/15 p-6 rounded-2xl space-y-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold font-headline">{selectedListing.title}</h2>
                <p className="text-xs text-[#30323D]/70 font-mono">ID: {selectedListing.idDomain} | Slug: {selectedListing.slug}</p>
              </div>
              <span className="px-2.5 py-1 bg-[#30323D] text-white text-xs font-bold rounded-lg font-mono">
                Status: {selectedListing.status}
              </span>
            </div>

            <div className="p-4 bg-[#FFFDF8] border border-[#30323D]/10 rounded-xl space-y-2 text-xs">
              <div><strong>Publisher:</strong> {selectedListing.publisherName} (@{selectedListing.publisherHandle})</div>
              <div><strong>Category:</strong> {selectedListing.category}</div>
              <div><strong>Pricing:</strong> {selectedListing.isPaid ? `$${(selectedListing.priceUsdCents / 100).toFixed(2)} USD` : 'FREE'}</div>
              <div><strong>Summary:</strong> {selectedListing.summary}</div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#30323D]">Moderator Action</h4>
              <textarea
                placeholder="Add moderator audit note or feedback for creator..."
                value={modNote}
                onChange={e => setModNote(e.target.value)}
                rows={3}
                className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
              />

              {actionMessage && <div className="text-xs text-emerald-700 font-bold">{actionMessage}</div>}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleAction('APPROVED')}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700"
                >
                  Approve & Publish Release
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('CHANGES_REQUESTED')}
                  className="px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('SUSPENDED')}
                  className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700"
                >
                  Suspend Version
                </button>
              </div>
            </div>

            {/* Audit Log Trail */}
            <div className="pt-4 border-t border-[#30323D]/10 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#30323D]/70">Audit Log History</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                {auditLogs.filter(l => l.targetId === selectedListing.id).map(l => (
                  <div key={l.id} className="p-2 bg-[#30323D]/5 rounded-lg flex justify-between">
                    <span><strong>{l.action}</strong> by {l.actorRole}: {l.details}</span>
                    <span className="text-[#30323D]/50">{new Date(l.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
