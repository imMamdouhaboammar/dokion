import React, { useState } from 'react';
import { PackageValidator } from '../services/packageValidator';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';
import type { PlaybookListing, ValidationRun } from '../types/marketplace';

interface CreatorPublishingWizardProps {
  onNavigate: (view: string, extraId?: string) => void;
}

export function CreatorPublishingWizard({ onNavigate }: CreatorPublishingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Form Fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Security Scanning');
  const [tags, setTags] = useState('owasp, api, review');
  const [priceUsd, setPriceUsd] = useState(0);
  const [licenseType, setLicenseType] = useState('Apache-2.0');
  const [manifestYaml, setManifestYaml] = useState(`schema_version: 1
id: com.example.custom-playbook
name: Custom Security Playbook
slug: custom-security-playbook
version: 1.0.0
license:
  type: Apache-2.0
compatibility:
  dokion: ">=1.8.0 <2.0.0"
permissions:
  filesystem:
    read: ["project"]
    write: [".dokion/reports"]
outputs:
  protocol: dokion-findings`);

  const [validationRun, setValidationRun] = useState<ValidationRun | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const handleRunValidation = async () => {
    setValidating(true);
    setError(null);

    const val = await PackageValidator.runFullValidation({
      versionId: `ver-${Date.now().toString(36)}`,
      playbookSlug: slug || 'custom-playbook',
      manifestContent: manifestYaml,
      files: [
        { path: 'playbook.yaml', type: 'yaml', size: manifestYaml.length, content: manifestYaml }
      ],
      packageSizeBytes: manifestYaml.length
    });

    setValidationRun(val);
    setValidating(false);
  };

  const handleSubmitRelease = async () => {
    if (!user) {
      setError('Please sign in as a creator to publish.');
      return;
    }

    setSubmitting(true);
    try {
      const listing: PlaybookListing = {
        id: `pb-${Date.now().toString(36)}`,
        slug: slug || 'custom-playbook',
        idDomain: `com.${user.handle}.${slug}`,
        title: title || 'Custom Playbook',
        summary: summary || 'Automated security analysis playbook.',
        description: description || 'Detailed description of analysis rules.',
        iconUrl: '/dokion-mascot-full-set/mascot/color/dokion-01-core.svg',
        publisherId: user.publisherId || user.id,
        publisherHandle: user.handle,
        publisherName: user.name,
        publisherVerified: true,
        category,
        tags: tags.split(',').map(t => t.trim()),
        isPaid: priceUsd > 0,
        priceUsdCents: Math.round(priceUsd * 100),
        priceTokens: Math.round(priceUsd * 10),
        licenseType,
        currentVersion: '1.0.0',
        featured: false,
        isOfficial: user.role === 'ADMIN',
        ratingAverage: 5.0,
        ratingCount: 0,
        downloadCount: 1,
        saveCount: 0,
        lastVerifiedAt: Date.now(),
        status: 'SUBMITTED',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.playbookListings.put(listing);

      if (validationRun) {
        await db.validationRuns.put(validationRun);
      }

      setSubmitting(false);
      onNavigate('playbook-detail', listing.slug);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Submission failed.';
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Step Progress Bar */}
      <div className="mb-8 bg-white border border-[#30323D]/15 rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center text-xs font-bold text-[#30323D]/70 mb-2">
          <span>STEP {step} OF 8</span>
          <span className="text-[#D97958]">
            {['Basic Info', 'Package Upload', 'Compatibility', 'Permissions', 'Docs', 'Pricing', 'Validation Pipeline', 'Submission'][step - 1]}
          </span>
        </div>
        <div className="w-full bg-[#30323D]/10 h-2 rounded-full overflow-hidden">
          <div className="bg-[#D97958] h-full transition-all duration-300" style={{ width: `${(step / 8) * 100}%` }} />
        </div>
      </div>

      <div className="bg-white border border-[#30323D]/15 rounded-2xl p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Basic Playbook Information</h2>
            <p className="text-xs text-[#30323D]/70">Define the core title, unique slug, summary, and category for your playbook listing.</p>

            <div>
              <label htmlFor="playbook-title" className="block text-xs font-bold text-[#30323D] mb-1">Playbook Name</label>
              <input
                id="playbook-title"
                type="text"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. Secure API Review & OWASP Compliance"
                className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
              />
            </div>

            <div>
              <label htmlFor="playbook-slug" className="block text-xs font-bold text-[#30323D] mb-1">Package Slug</label>
              <input
                id="playbook-slug"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="secure-api-review"
                className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8] font-mono"
              />
            </div>

            <div>
              <label htmlFor="playbook-summary" className="block text-xs font-bold text-[#30323D] mb-1">Short Summary</label>
              <input
                id="playbook-summary"
                type="text"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Brief summary displayed on cards..."
                className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="playbook-category" className="block text-xs font-bold text-[#30323D] mb-1">Category</label>
                <select
                  id="playbook-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
                >
                  <option value="Security Scanning">Security Scanning</option>
                  <option value="APIs">APIs</option>
                  <option value="Secrets Detection">Secrets Detection</option>
                  <option value="Cloud Security">Cloud Security</option>
                  <option value="Code Review">Code Review</option>
                </select>
              </div>

              <div>
                <label htmlFor="playbook-tags" className="block text-xs font-bold text-[#30323D] mb-1">Tags (comma separated)</label>
                <input
                  id="playbook-tags"
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="owasp, rest, api"
                  className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Package Manifest & Archive</h2>
            <p className="text-xs text-[#30323D]/70">Paste your root <code className="font-mono bg-[#30323D]/10 px-1 rounded">playbook.yaml</code> manifest for automated inspection.</p>

            <div>
              <label htmlFor="manifest-yaml" className="block text-xs font-bold text-[#30323D] mb-1">playbook.yaml Content</label>
              <textarea
                id="manifest-yaml"
                rows={12}
                value={manifestYaml}
                onChange={e => setManifestYaml(e.target.value)}
                className="w-full p-3 border border-[#30323D]/20 rounded-xl text-xs font-mono bg-[#30323D] text-emerald-400"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Compatibility Requirements</h2>
            <div className="p-4 bg-[#FFFDF8] border border-[#30323D]/10 rounded-xl space-y-2 text-xs">
              <div><strong>Dokion Engine Compatibility:</strong> &ge;1.8.0 &lt;2.0.0</div>
              <div><strong>Operating Systems:</strong> Linux, macOS, Windows</div>
              <div><strong>Runtimes:</strong> Node.js, Python, Bun</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Permission Scopes</h2>
            <p className="text-xs text-[#30323D]/70">Explicit permission declarations displayed to buyers prior to execution.</p>
            <div className="p-3 bg-[#30323D]/5 border border-[#30323D]/10 rounded-xl space-y-2 text-xs font-mono">
              <div>✓ Filesystem Read: project source files</div>
              <div>✓ Filesystem Write: .dokion/reports directory</div>
              <div>✗ Network Access: Not required</div>
              <div>✗ Shell Execution: Not required</div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Full Documentation & Usage</h2>
            <div>
              <label htmlFor="playbook-description" className="block text-xs font-bold text-[#30323D] mb-1">Full Description (Markdown supported)</label>
              <textarea
                id="playbook-description"
                rows={6}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detailed usage guide, inputs, outputs, and examples..."
                className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Commercial Pricing & License Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="playbook-price" className="block text-xs font-bold text-[#30323D] mb-1">Price ($USD, 0 for Free)</label>
                <input
                  id="playbook-price"
                  type="number"
                  min={0}
                  step={1}
                  value={priceUsd}
                  onChange={e => setPriceUsd(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
                />
              </div>

              <div>
                <label htmlFor="playbook-license-type" className="block text-xs font-bold text-[#30323D] mb-1">License Type</label>
                <select
                  id="playbook-license-type"
                  value={licenseType}
                  onChange={e => setLicenseType(e.target.value)}
                  className="w-full p-2.5 border border-[#30323D]/20 rounded-xl text-xs bg-[#FFFDF8]"
                >
                  <option value="Apache-2.0">Apache 2.0</option>
                  <option value="MIT">MIT</option>
                  <option value="Commercial">Commercial Proprietary</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Automated Validation Pipeline</h2>
            <p className="text-xs text-[#30323D]/70">Run the automated security, static analysis, and isolated test runner checks.</p>

            <button
              type="button"
              onClick={handleRunValidation}
              disabled={validating}
              className="px-4 py-2.5 bg-[#30323D] text-white font-bold rounded-xl text-xs hover:bg-[#30323D]/90 flex items-center gap-2"
            >
              {validating ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Executing Pipeline...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  <span>Run Validation Checks</span>
                </>
              )}
            </button>

            {validationRun && (
              <div className="space-y-2 pt-3 border-t border-[#30323D]/10">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${validationRun.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {validationRun.passed ? '✓ Validation Passed' : '✗ Validation Failed'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {validationRun.steps.map((st, i) => (
                    <div key={i} className="p-2 bg-[#FFFDF8] border border-[#30323D]/10 rounded-lg text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                      <span><strong>{st.step}:</strong> {st.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Review & Submit Release</h2>
            <p className="text-xs text-[#30323D]/70">Confirm your details and accept publisher terms to submit for moderation review.</p>

            <div className="p-4 bg-[#FFFDF8] border border-[#30323D]/15 rounded-xl text-xs space-y-2">
              <div><strong>Title:</strong> {title || 'Custom Playbook'}</div>
              <div><strong>Slug:</strong> {slug}</div>
              <div><strong>Price:</strong> {priceUsd > 0 ? `$${priceUsd}.00 USD` : 'FREE'}</div>
              <div><strong>Validation Status:</strong> {validationRun?.passed ? 'Passed' : 'Pending'}</div>
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <button
              type="button"
              onClick={handleSubmitRelease}
              disabled={submitting}
              className="w-full py-3 bg-[#D97958] text-white font-bold rounded-xl text-xs hover:bg-[#c26543] transition-colors shadow-sm"
            >
              {submitting ? 'Submitting Release...' : 'Submit Release for Moderation'}
            </button>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-[#30323D]/10">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 border border-[#30323D]/20 rounded-xl text-xs font-semibold hover:bg-[#30323D]/5 disabled:opacity-40"
          >
            Previous
          </button>

          {step < 8 && (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(8, s + 1))}
              className="px-5 py-2 bg-[#30323D] text-white font-bold rounded-xl text-xs hover:bg-[#30323D]/90"
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
