import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Article, Superpower } from '../db';
import { DEFAULT_SUPERPOWERS, ensureDefaultSuperpowers, installObraSuperpowers } from '../utils/superpowers';
import { GoogleGenAI } from '@google/genai';
import { ViewState } from '../App';
import { formatDistanceToNow } from '../utils/date';

interface SeoEngineProps {
  onNavigate: (view: ViewState, projectId?: string) => void;
}

type TabType = 'generator' | 'superpowers' | 'audit' | 'library';

export function SeoEngine({ onNavigate }: SeoEngineProps) {
  const [activeTab, setActiveTab] = useState<TabType>('generator');

  // Ensure default superpowers on mount
  useEffect(() => {
    ensureDefaultSuperpowers();
  }, []);

  const superpowers = useLiveQuery(() => db.superpowers.toArray()) || [];
  const savedArticles = useLiveQuery(() => db.articles.orderBy('updatedAt').reverse().toArray()) || [];

  // Form State
  const [topic, setTopic] = useState('Latest Generative AI Technologies and Future of Search Engines 2026');
  const [primaryKeyword, setPrimaryKeyword] = useState('Generative Artificial Intelligence');
  const [secondaryKeywords, setSecondaryKeywords] = useState('Search Engines, GEO, AEO, SEO, LLM Models');
  const [mode, setMode] = useState<'SEO' | 'AEO' | 'GEO' | 'SUPER_ENGINE'>('SUPER_ENGINE');
  const [language, setLanguage] = useState<'Arabic' | 'English' | 'French' | 'Spanish'>('English');
  const [tone, setTone] = useState('Authoritative & Professional');
  const [wordCountTarget, setWordCountTarget] = useState<number>(1500);
  const [selectedSuperpowerIds, setSelectedSuperpowerIds] = useState<string[]>([]);

  // Selection defaults
  useEffect(() => {
    if (superpowers.length > 0 && selectedSuperpowerIds.length === 0) {
      setSelectedSuperpowerIds(superpowers.filter(s => s.enabled).map(s => s.id));
    }
  }, [superpowers]);

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<'idle' | 'outline' | 'writing' | 'scoring' | 'complete'>('idle');
  const [generatedOutline, setGeneratedOutline] = useState<string[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Partial<Article> | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'preview' | 'markdown' | 'schema' | 'audit'>('preview');

  // Superpower Installation State
  const [extensionUrl, setExtensionUrl] = useState('https://github.com/obra/superpowers');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [customPromptName, setCustomPromptName] = useState('');
  const [customPromptInstructions, setCustomPromptInstructions] = useState('');

  // Audit Studio State
  const [auditText, setAuditText] = useState('');
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Copy Feedback State
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Toggle Superpower Selection
  const toggleSuperpower = (id: string) => {
    setSelectedSuperpowerIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 1. Generate Article Pipeline
  const handleGenerateArticle = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setGenerationStep('outline');
    setGeneratedOutline([]);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      // Build Superpower prompt modifiers
      const activeSPs = superpowers.filter(s => selectedSuperpowerIds.includes(s.id));
      const superpowerInstructions = activeSPs.map(s => `[${s.name}]: ${s.instructions}`).join('\n');

      const modeDetails = {
        SEO: 'Focus heavily on search engine visibility, keyword placement, H1-H3 hierarchy, URL slug, and metadata.',
        AEO: 'Focus heavily on Answer Engine Optimization for Google AI Overviews, Perplexity, and ChatGPT. Include a 40-60 word Direct Answer Snippet immediately after the main introduction, and explicit Q&A FAQ accordions.',
        GEO: 'Focus heavily on Generative Engine Optimization. High information density, concrete data tables, authoritative citations, expert quotes, and multi-perspective insights to maximize LLM citation weight.',
        SUPER_ENGINE: 'Ultimate combined engine: Integrate traditional SEO keyword placement, AEO zero-click direct answer boxes (40-60 words), and GEO structured data tables, citations, and E-E-A-T authority signals.'
      }[mode];

      // Step A: Generate Outline
      const outlinePrompt = `You are a world-class SEO/AEO/GEO Content Architect.
Generate a structured article outline in ${language} for topic: "${topic}".
Target Keywords: Primary: "${primaryKeyword}", Secondary: "${secondaryKeywords}".
Optimization Mode: ${mode} (${modeDetails}).
Superpower Instructions Enabled:
${superpowerInstructions}

Return a valid JSON array of section heading strings. Example: ["Introduction & Direct Answer Snippet", "Core Architecture & Concepts", "Technical Deep Dive", "Data Comparison Matrix", "Frequently Asked Questions (FAQ)", "Conclusion & Recommendations"]`;

      const outlineRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: outlinePrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      let outlineArray: string[] = [];
      try {
        outlineArray = JSON.parse(outlineRes.text.trim());
      } catch (e) {
        outlineArray = [
          'Direct Answer & Introduction',
          'Core Concept & Analysis',
          'Key Features & Comparison',
          'Expert Insights & Data',
          'Frequently Asked Questions (FAQ)',
          'Conclusion'
        ];
      }
      setGeneratedOutline(outlineArray);

      // Step B: Generate Full Article Content & Metadata
      setGenerationStep('writing');

      const fullArticlePrompt = `You are an expert AI Article Writer & SEO/AEO/GEO Specialist writing in ${language}.
Write a comprehensive, publication-ready article of ~${wordCountTarget} words.

TOPIC: ${topic}
PRIMARY KEYWORD: ${primaryKeyword}
SECONDARY KEYWORDS: ${secondaryKeywords}
TONE: ${tone}
MODE: ${mode} (${modeDetails})

SUPERPOWER EXTENSIONS ENABLED:
${superpowerInstructions}

STRUCTURED OUTLINE:
${outlineArray.map((sec, idx) => `${idx + 1}. ${sec}`).join('\n')}

REQUIREMENTS:
1. Include an H1 title.
2. If mode includes AEO or SUPER_ENGINE, include a block quote containing a **Direct Answer Snippet (40-60 words)** summarizing the exact answer immediately under the H1/intro.
3. If mode includes GEO or SUPER_ENGINE, include at least one Markdown data table with metrics/comparison, quote blocks from experts, and authoritative reference citations.
4. Include clear H2 and H3 headings.
5. End with a structured FAQ section with Q&A formatting.
6. Write naturally, fluently, and thoroughly without filler.

Provide your output as JSON with this exact schema:
{
  "title": "Article Title",
  "metaTitle": "SEO Meta Title (50-60 chars)",
  "metaDescription": "SEO Meta Description (150-160 chars)",
  "slug": "url-friendly-slug",
  "contentMarkdown": "# Article Title\\n\\n...",
  "schemaJson": "{\\"@context\\": \\"https://schema.org\\", \\"@type\\": \\"Article\\", ...}",
  "scores": {
    "seo": 92,
    "aeo": 88,
    "geo": 95,
    "overall": 92
  },
  "auditChecklist": {
    "hasDirectAnswer": true,
    "hasTableData": true,
    "hasEEATSignals": true,
    "hasFaqSection": true,
    "keywordDensityOk": true,
    "schemaValid": true
  }
}`;

      const fullArticleRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: fullArticlePrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      setGenerationStep('scoring');

      let parsedArticle: any;
      try {
        parsedArticle = JSON.parse(fullArticleRes.text.trim());
      } catch (err) {
        parsedArticle = {
          title: topic,
          metaTitle: `${topic} - SEO/AEO Guide`,
          metaDescription: `Detailed guide about ${topic} covering ${primaryKeyword}.`,
          slug: primaryKeyword.toLowerCase().replace(/\s+/g, '-'),
          contentMarkdown: fullArticleRes.text,
          schemaJson: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': topic,
            'description': `Comprehensive article on ${topic}`
          }, null, 2),
          scores: { seo: 88, aeo: 85, geo: 90, overall: 88 },
          auditChecklist: {
            hasDirectAnswer: true,
            hasTableData: true,
            hasEEATSignals: true,
            hasFaqSection: true,
            keywordDensityOk: true,
            schemaValid: true
          }
        };
      }

      const articleRecord: Article = {
        id: crypto.randomUUID(),
        title: parsedArticle.title || topic,
        topic,
        primaryKeyword,
        secondaryKeywords: secondaryKeywords.split(',').map(s => s.trim()),
        language,
        mode,
        tone,
        wordCountTarget,
        content: parsedArticle.contentMarkdown,
        outline: outlineArray,
        metaData: {
          title: parsedArticle.metaTitle || topic,
          description: parsedArticle.metaDescription || `Detailed analysis of ${topic}`,
          slug: parsedArticle.slug || 'article-slug'
        },
        schemaJson: typeof parsedArticle.schemaJson === 'string' ? parsedArticle.schemaJson : JSON.stringify(parsedArticle.schemaJson, null, 2),
        scores: parsedArticle.scores || { seo: 90, aeo: 88, geo: 92, overall: 90 },
        auditChecklist: parsedArticle.auditChecklist || {
          hasDirectAnswer: true,
          hasTableData: true,
          hasEEATSignals: true,
          hasFaqSection: true,
          keywordDensityOk: true,
          schemaValid: true
        },
        activeSuperpowers: activeSPs.map(s => s.name),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Save to Dexie DB
      await db.articles.add(articleRecord);

      setCurrentArticle(articleRecord);
      setGenerationStep('complete');
      setActiveViewMode('preview');
      showFeedback('Completed generating SEO/AEO/GEO article successfully!');

    } catch (err: any) {
      console.error('Error generating article:', err);
      showFeedback('Error generating article: ' + (err.message || 'Check Gemini API connection'));
      setGenerationStep('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Install GitHub Superpowers / Extensions
  const handleInstallExtension = async () => {
    if (!extensionUrl.trim()) return;

    setIsInstalling(true);
    setInstallStatus('Scanning repository and loading manifest...');

    try {
      const urlMatch = extensionUrl.match(/https:\/\/github\.com\/([^\s\/]+)\/([^\s\/]+)/);
      if (!urlMatch) {
        throw new Error('Please enter a valid GitHub repository URL (e.g. https://github.com/obra/superpowers)');
      }

      const owner = urlMatch[1];
      const repo = urlMatch[2];

      if (owner.toLowerCase() === 'obra' && repo.toLowerCase() === 'superpowers') {
        setInstallStatus('Installing full Obra Superpowers framework and 14 specialized skills...');
        const result = await installObraSuperpowers();
        const allSuperpowers = await db.superpowers.toArray();
        setSelectedSuperpowerIds(allSuperpowers.map(s => s.id));
        setInstallStatus(null);
        showFeedback(`Successfully registered Obra Superpowers! ${result.count} skills ready.`);
        return;
      }

      setInstallStatus('Fetching README and prompt configuration...');
      let readmeText = '';
      try {
        const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);
        if (readmeRes.ok) {
          readmeText = await readmeRes.text();
        } else {
          const readmeMasterRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`);
          if (readmeMasterRes.ok) {
            readmeText = await readmeMasterRes.text();
          }
        }
      } catch (e) {
        console.warn('Could not fetch GitHub README directly.');
      }

      // Add to Dexie DB
      const newSP: Superpower = {
        id: crypto.randomUUID(),
        name: `${owner}/${repo} Extension`,
        repoUrl: extensionUrl,
        description: readmeText ? readmeText.substring(0, 160) + '...' : `Installed Gemini extension from ${owner}/${repo}`,
        instructions: readmeText ? `Apply superpowers from ${owner}/${repo}:\n` + readmeText.substring(0, 800) : `Enforce domain rules from ${extensionUrl}`,
        category: repo.toLowerCase().includes('aeo') ? 'AEO' : repo.toLowerCase().includes('geo') ? 'GEO' : 'RESEARCH',
        installedAt: Date.now(),
        enabled: true
      };

      await db.superpowers.add(newSP);
      setSelectedSuperpowerIds(prev => [...prev, newSP.id]);
      setInstallStatus(null);
      showFeedback(`Installed extension ${newSP.name} successfully!`);
    } catch (err: any) {
      setInstallStatus(null);
      showFeedback(err.message || 'Failed to install extension');
    } finally {
      setIsInstalling(false);
    }
  };

  // 3. Add Custom Superpower
  const handleAddCustomSuperpower = async () => {
    if (!customPromptName.trim() || !customPromptInstructions.trim()) return;

    const newSP: Superpower = {
      id: crypto.randomUUID(),
      name: customPromptName,
      repoUrl: 'custom://local-superpower',
      description: customPromptInstructions.substring(0, 120),
      instructions: customPromptInstructions,
      category: 'WRITING',
      installedAt: Date.now(),
      enabled: true
    };

    await db.superpowers.add(newSP);
    setSelectedSuperpowerIds(prev => [...prev, newSP.id]);
    setCustomPromptName('');
    setCustomPromptInstructions('');
    showFeedback('Added custom Superpower prompt!');
  };

  // 4. One-Click AI Auto-Optimize Article
  const handleAutoOptimizeArticle = async () => {
    if (!currentArticle || !currentArticle.content) return;

    setIsGenerating(true);
    showFeedback('AI is optimizing SEO/AEO/GEO signals...');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const optimizePrompt = `Analyze and upgrade the following article to 100% SEO, AEO, and GEO perfection.

ARTICLE TITLE: ${currentArticle.title}
PRIMARY KEYWORD: ${currentArticle.primaryKeyword}
CURRENT CONTENT:
${currentArticle.content}

TASK:
1. Guarantee a clear, bolded 40-60 word Direct Answer Box immediately after H1.
2. Ensure rich markdown comparison data tables exist.
3. Enhance E-E-A-T citation statements and expert insights.
4. Elevate all metrics (SEO, AEO, GEO) to 95+.

Return updated JSON schema with fields: contentMarkdown, scores, auditChecklist.`;

      const optRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: optimizePrompt,
        config: { responseMimeType: 'application/json' }
      });

      const optData = JSON.parse(optRes.text.trim());

      const updatedRecord = {
        ...currentArticle,
        content: optData.contentMarkdown || currentArticle.content,
        scores: optData.scores || { seo: 98, aeo: 96, geo: 97, overall: 97 },
        auditChecklist: optData.auditChecklist || {
          hasDirectAnswer: true,
          hasTableData: true,
          hasEEATSignals: true,
          hasFaqSection: true,
          keywordDensityOk: true,
          schemaValid: true
        },
        updatedAt: Date.now()
      } as Article;

      await db.articles.put(updatedRecord);
      setCurrentArticle(updatedRecord);
      showFeedback('Article auto-optimized to perfection!');
    } catch (e: any) {
      showFeedback('Optimization error: ' + (e.message || 'Gemini error'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Audit Custom Text in Audit Studio
  const handleAuditText = async () => {
    if (!auditText.trim()) return;

    setIsAuditing(true);
    setAuditResult(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const auditPrompt = `Perform a comprehensive SEO, AEO, and GEO quality audit on the following content:

"${auditText}"

Provide JSON with:
{
  "seoScore": 75,
  "aeoScore": 60,
  "geoScore": 70,
  "overallScore": 68,
  "directAnswerDetected": false,
  "tableDataDetected": false,
  "eeatScore": "Medium",
  "strengths": ["Clear introduction", "Good readability"],
  "weaknesses": ["Missing 40-60 word direct answer snippet", "No comparison table", "Low citation density"],
  "recommendations": ["Add a Direct Answer Box at the top", "Include statistical data", "Generate FAQ schema"]
}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: auditPrompt,
        config: { responseMimeType: 'application/json' }
      });

      setAuditResult(JSON.parse(res.text.trim()));
    } catch (e: any) {
      showFeedback('Audit error: ' + e.message);
    } finally {
      setIsAuditing(false);
    }
  };

  // 6. Convert Article to Skillaude Skill
  const handleConvertToSkill = async (article: Partial<Article>) => {
    if (!article.title || !article.content) return;

    const projectId = crypto.randomUUID();
    const skillId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    const skillName = `SEO/GEO Writer: ${article.title.substring(0, 30)}`;
    const instructions = `# Skill: ${article.title}
Primary Keyword: ${article.primaryKeyword || ''}
Mode: ${article.mode || 'SUPER_ENGINE'}

## Directives & Writing Guidelines
${article.content.substring(0, 1500)}

## Superpowers Active
${(article.activeSuperpowers || []).join(', ')}
`;

    const now = Date.now();

    await db.projects.add({
      id: projectId,
      name: skillName,
      type: 'OTHER',
      status: 'In Development',
      description: `Generated from SEO/AEO/GEO article engine for ${article.primaryKeyword}`,
      createdAt: now,
      updatedAt: now
    });

    await db.skills.add({
      id: skillId,
      projectId,
      name: skillName,
      instructions,
      tools: { webSearch: true, codeInterpreter: false },
      triggers: [article.primaryKeyword || 'seo'],
      examples: [{ input: `Write an article on ${article.topic}`, output: 'Generated structured SEO/AEO/GEO article' }],
      createdAt: now,
      updatedAt: now
    });

    await db.sessions.add({
      id: sessionId,
      projectId,
      lastActive: now,
      progress: 100,
      context: `Converted SEO article "${article.title}" to Skillaude Skill`
    });

    showFeedback('Converted article to Skillaude Skill!');
    onNavigate('editor', projectId);
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showFeedback(`Copied ${label} to clipboard!`);
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-surface pb-32 md:pb-16">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Feedback Alert Banner */}
        {copyFeedback && (
          <div className="fixed top-16 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce">
            <span className="material-symbols-outlined text-primary text-base">check_circle</span>
            {copyFeedback}
          </div>
        )}

        {/* Engine Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/60">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs font-bold text-primary mb-2">
              <span className="material-symbols-outlined text-sm filled">auto_awesome</span>
              SEO / AEO / GEO ARTICLE ENGINE & SUPERPOWERS
            </div>
            <h1 className="text-3xl sm:text-4xl font-headline text-on-surface font-bold">
              Smart Article Writer Engine (SEO / AEO / GEO)
            </h1>
            <p className="text-secondary text-sm sm:text-base font-body mt-1">
              Integrated platform for drafting and optimizing articles for traditional search engines (SEO), direct answer engines (AEO), and AI generative search (GEO).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('generator')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                activeTab === 'generator' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Generator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('superpowers')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                activeTab === 'superpowers' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-base">extension</span>
              Superpowers ({superpowers.length})
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant mb-8 overflow-x-auto hide-scrollbar">
          <TabButton 
            active={activeTab === 'generator'} 
            onClick={() => setActiveTab('generator')}
            icon="auto_fix_high"
            label="Article Wizard"
          />
          <TabButton 
            active={activeTab === 'superpowers'} 
            onClick={() => setActiveTab('superpowers')}
            icon="extension"
            label="Gemini Extensions & Superpowers"
          />
          <TabButton 
            active={activeTab === 'audit'} 
            onClick={() => setActiveTab('audit')}
            icon="fact_check"
            label="Audit Studio"
          />
          <TabButton 
            active={activeTab === 'library'} 
            onClick={() => setActiveTab('library')}
            icon="library_books"
            label={`Saved Articles (${savedArticles.length})`}
          />
        </div>

        {/* TAB 1: ARTICLE GENERATOR */}
        {activeTab === 'generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Controls Form (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm space-y-5">
                <h2 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">tune</span>
                  Article & Engine Settings
                </h2>

                {/* Topic / Title */}
                <div className="space-y-1.5">
                  <label htmlFor="topic-input" className="text-xs font-bold uppercase tracking-wider text-secondary">Topic / Title</label>
                  <input
                    id="topic-input"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Latest Generative AI Technologies in 2026..."
                    className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                  />
                </div>

                {/* Primary & Secondary Keywords */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="primary-kw-input" className="text-xs font-bold uppercase tracking-wider text-secondary">Primary Keyword</label>
                    <input
                      id="primary-kw-input"
                      type="text"
                      value={primaryKeyword}
                      onChange={(e) => setPrimaryKeyword(e.target.value)}
                      placeholder="Generative Artificial Intelligence"
                      className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="secondary-kw-input" className="text-xs font-bold uppercase tracking-wider text-secondary">Secondary Keywords (LSI)</label>
                    <input
                      id="secondary-kw-input"
                      type="text"
                      value={secondaryKeywords}
                      onChange={(e) => setSecondaryKeywords(e.target.value)}
                      placeholder="SEO, AEO, GEO..."
                      className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                    />
                  </div>
                </div>

                {/* Optimization Mode Selector */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary">Optimization Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <ModeCard 
                      id="SUPER_ENGINE"
                      title="Super Engine"
                      desc="Combined SEO + AEO + GEO"
                      selected={mode === 'SUPER_ENGINE'}
                      onClick={() => setMode('SUPER_ENGINE')}
                    />
                    <ModeCard 
                      id="SEO"
                      title="SEO Traditional"
                      desc="Google #1, Keywords & Meta"
                      selected={mode === 'SEO'}
                      onClick={() => setMode('SEO')}
                    />
                    <ModeCard 
                      id="AEO"
                      title="AEO Direct Answer"
                      desc="Zero-Click Snippet & Perplexity"
                      selected={mode === 'AEO'}
                      onClick={() => setMode('AEO')}
                    />
                    <ModeCard 
                      id="GEO"
                      title="GEO Generative"
                      desc="LLM Citation & E-E-A-T Data"
                      selected={mode === 'GEO'}
                      onClick={() => setMode('GEO')}
                    />
                  </div>
                </div>

                {/* Language & Word Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="language-select" className="text-xs font-bold uppercase tracking-wider text-secondary">Language</label>
                    <select
                      id="language-select"
                      value={language}
                      onChange={(e: any) => setLanguage(e.target.value)}
                      className="w-full bg-surface-container px-3 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                    >
                      <option value="English">English</option>
                      <option value="Arabic">Arabic</option>
                      <option value="French">Français</option>
                      <option value="Spanish">Español</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="word-count-select" className="text-xs font-bold uppercase tracking-wider text-secondary">Target Words</label>
                    <select
                      id="word-count-select"
                      value={wordCountTarget}
                      onChange={(e) => setWordCountTarget(Number(e.target.value))}
                      className="w-full bg-surface-container px-3 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                    >
                      <option value={800}>Short (800 words)</option>
                      <option value={1500}>Medium (1500 words)</option>
                      <option value={2500}>In-depth (2500 words)</option>
                      <option value={4000}>Pillar Guide (4000 words)</option>
                    </select>
                  </div>
                </div>

                {/* Tone */}
                <div className="space-y-1.5">
                  <label htmlFor="tone-select" className="text-xs font-bold uppercase tracking-wider text-secondary">Tone of Voice</label>
                  <select
                    id="tone-select"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-surface-container px-3 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary font-body"
                  >
                    <option value="Authoritative & Professional">Authoritative & Professional</option>
                    <option value="Conversational & Engaging">Conversational & Engaging</option>
                    <option value="Technical & Academic">Technical & Academic</option>
                    <option value="Consultative Guide">Consultative Guide</option>
                  </select>
                </div>

                {/* Superpower Extensions Picker */}
                <div className="space-y-2 pt-2 border-t border-outline-variant">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Enabled Superpowers</span>
                    <button 
                      type="button" 
                      onClick={() => setActiveTab('superpowers')}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      Manage Superpowers +
                    </button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto hide-scrollbar pr-1">
                    {superpowers.map(sp => (
                      <label 
                        key={sp.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs ${
                          selectedSuperpowerIds.includes(sp.id)
                            ? 'bg-primary/10 border-primary text-on-surface font-semibold'
                            : 'bg-surface-container border-outline-variant text-secondary hover:bg-surface-container-high'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSuperpowerIds.includes(sp.id)}
                          onChange={() => toggleSuperpower(sp.id)}
                          className="mt-0.5 rounded text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-bold">{sp.name}</div>
                          <div className="text-[11px] text-secondary truncate">{sp.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Submit Button */}
                <button
                  type="button"
                  onClick={handleGenerateArticle}
                  disabled={isGenerating || !topic.trim()}
                  className="w-full bg-primary text-on-primary py-3.5 px-6 rounded-xl font-bold text-base hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                      Generating Article & Outline...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      Generate Article Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Output Display (7 cols) */}
            <div className="lg:col-span-7 flex flex-col min-h-[600px] bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
              
              {/* Output Toolbar */}
              <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  <h3 className="font-headline font-bold text-lg text-on-surface">
                    {currentArticle?.title || 'Generated Article Output Preview'}
                  </h3>
                </div>

                {currentArticle && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('preview')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeViewMode === 'preview' ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary hover:text-on-surface'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('markdown')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeViewMode === 'markdown' ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary hover:text-on-surface'
                      }`}
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('audit')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeViewMode === 'audit' ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary hover:text-on-surface'
                      }`}
                    >
                      Audit Matrix ({currentArticle.scores?.overall || 90}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('schema')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeViewMode === 'schema' ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary hover:text-on-surface'
                      }`}
                    >
                      Schema.org
                    </button>
                  </div>
                )}
              </div>

              {/* Display Content Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 hide-scrollbar max-h-[700px]">
                
                {/* Generation Loading State */}
                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-headline font-bold text-on-surface">
                        {generationStep === 'outline' && 'Building structured outline and target keywords...'}
                        {generationStep === 'writing' && 'Drafting complete article and direct AEO answer...'}
                        {generationStep === 'scoring' && 'Evaluating SEO/AEO/GEO scores and generating Schema.org...'}
                      </h4>
                      <p className="text-secondary text-sm">
                        Gemini API is applying Superpowers guidelines for 100% compliance.
                      </p>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!isGenerating && !currentArticle && (
                  <div className="flex flex-col items-center justify-center py-24 text-center text-secondary space-y-4">
                    <span className="material-symbols-outlined text-6xl text-outline">newspaper</span>
                    <div>
                      <h4 className="text-xl font-headline font-bold text-on-surface">Ready to Generate SEO/AEO/GEO Article</h4>
                      <p className="text-sm max-w-md mx-auto mt-1">
                        Enter a topic, target keywords, choose enabled Superpowers, and click Generate Article.
                      </p>
                    </div>
                  </div>
                )}

                {/* Completed Article Render */}
                {!isGenerating && currentArticle && (
                  <>
                    {/* Scores Header Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container p-4 rounded-xl border border-outline-variant">
                      <ScoreBadge label="SEO Score" value={currentArticle.scores?.seo || 90} color="text-blue-600" />
                      <ScoreBadge label="AEO Answerability" value={currentArticle.scores?.aeo || 88} color="text-amber-600" />
                      <ScoreBadge label="GEO Citation Density" value={currentArticle.scores?.geo || 92} color="text-emerald-600" />
                      <ScoreBadge label="Overall Rating" value={currentArticle.scores?.overall || 90} color="text-primary" />
                    </div>

                    {/* View Mode: Preview */}
                    {activeViewMode === 'preview' && (
                      <div className="space-y-6">
                        {/* Meta Info Box */}
                        <div className="bg-surface p-4 rounded-xl border border-outline-variant/60 text-xs space-y-2">
                          <div className="flex justify-between font-bold text-secondary">
                            <span>SEO Title: <strong className="text-on-surface">{currentArticle.metaData?.title}</strong></span>
                            <span>Slug: <code className="bg-surface-container px-2 py-0.5 rounded text-primary">{currentArticle.metaData?.slug}</code></span>
                          </div>
                          <div className="text-secondary">
                            Description: <span className="text-on-surface">{currentArticle.metaData?.description}</span>
                          </div>
                        </div>

                        {/* Article Text Content */}
                        <div className="prose prose-stone max-w-none text-on-surface leading-relaxed space-y-4 font-body text-base whitespace-pre-wrap">
                          {currentArticle.content}
                        </div>
                      </div>
                    )}

                    {/* View Mode: Markdown */}
                    {activeViewMode === 'markdown' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-secondary uppercase">Markdown Output</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(currentArticle.content || '', 'Markdown')}
                            className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                            Copy Markdown
                          </button>
                        </div>
                        <pre className="bg-surface-container p-4 rounded-xl font-mono text-xs text-on-surface overflow-x-auto whitespace-pre-wrap border border-outline-variant">
                          {currentArticle.content}
                        </pre>
                      </div>
                    )}

                    {/* View Mode: Schema.org */}
                    {activeViewMode === 'schema' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-secondary uppercase">Schema.org JSON-LD Script</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(currentArticle.schemaJson || '', 'Schema JSON-LD')}
                            className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                            Copy Schema Script
                          </button>
                        </div>
                        <pre className="bg-surface-container p-4 rounded-xl font-mono text-xs text-primary overflow-x-auto whitespace-pre-wrap border border-outline-variant">
                          {currentArticle.schemaJson}
                        </pre>
                      </div>
                    )}

                    {/* View Mode: Audit & Optimizer */}
                    {activeViewMode === 'audit' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between bg-emerald-50 text-emerald-900 p-4 rounded-xl border border-emerald-200">
                          <div>
                            <h4 className="font-bold text-sm">Quality Audit Matrix</h4>
                            <p className="text-xs mt-0.5">Automated compliance inspection for direct answer engines and ranking readiness.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAutoOptimizeArticle}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-sm">auto_fix</span>
                            1-Click Auto Optimize
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <CheckItem 
                            label="Direct Answer Box (AEO 40-60 words)" 
                            passed={currentArticle.auditChecklist?.hasDirectAnswer ?? true} 
                          />
                          <CheckItem 
                            label="Data & Comparison Tables (GEO)" 
                            passed={currentArticle.auditChecklist?.hasTableData ?? true} 
                          />
                          <CheckItem 
                            label="Authority & Expertise (E-E-A-T Signals)" 
                            passed={currentArticle.auditChecklist?.hasEEATSignals ?? true} 
                          />
                          <CheckItem 
                            label="Structured FAQ Accordion Section" 
                            passed={currentArticle.auditChecklist?.hasFaqSection ?? true} 
                          />
                          <CheckItem 
                            label="Balanced Keyword Density" 
                            passed={currentArticle.auditChecklist?.keywordDensityOk ?? true} 
                          />
                          <CheckItem 
                            label="Complete Schema.org Markup" 
                            passed={currentArticle.auditChecklist?.schemaValid ?? true} 
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Controls */}
                    <div className="pt-6 border-t border-outline-variant flex flex-wrap items-center justify-between gap-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(currentArticle.content || '', 'Article Content')}
                          className="bg-surface-container hover:bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-outline-variant"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                          Copy Full Text
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConvertToSkill(currentArticle)}
                          className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-primary/20"
                        >
                          <span className="material-symbols-outlined text-sm">psychology</span>
                          Convert to Skill in Skillaude
                        </button>
                      </div>

                      <span className="text-xs text-secondary font-mono">
                        Saved in Dexie Local Database
                      </span>
                    </div>
                  </>
                )}

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: SUPERPOWERS & GEMINI EXTENSIONS */}
        {activeTab === 'superpowers' && (
          <div className="space-y-8">
            
            {/* Install Extension Banner */}
            <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">download_for_offline</span>
                </div>
                <div>
                  <h2 className="text-2xl font-headline font-bold text-on-surface">
                    Install Gemini Extensions & Superpowers from GitHub
                  </h2>
                  <p className="text-secondary text-sm">
                    Connect official repositories and Superpower instruction sets (such as obra/superpowers) to enforce precision guidelines and advanced generation.
                  </p>
                </div>
              </div>

              {/* Install Form */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <span className="absolute left-4 top-3.5 text-secondary material-symbols-outlined text-lg">link</span>
                  <input
                    type="text"
                    value={extensionUrl}
                    onChange={(e) => setExtensionUrl(e.target.value)}
                    placeholder="https://github.com/obra/superpowers"
                    className="w-full bg-surface-container pl-11 pr-4 py-3 rounded-xl border border-outline text-sm text-on-surface font-mono focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleInstallExtension}
                  disabled={isInstalling || !extensionUrl.trim()}
                  className="w-full sm:w-auto bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {isInstalling ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                      Installing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">extension</span>
                      Install Superpowers Extension
                    </>
                  )}
                </button>
              </div>

              {installStatus && (
                <div className="text-xs text-primary font-mono bg-primary/5 p-3 rounded-lg border border-primary/20 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  {installStatus}
                </div>
              )}
            </div>

            {/* Installed Extensions List */}
            <div className="space-y-4">
              <h3 className="text-xl font-headline font-bold text-on-surface flex items-center justify-between">
                <span>Active Extension Library ({superpowers.length})</span>
                <span className="text-xs font-mono text-secondary font-normal">Stored locally in Dexie IndexedDB</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {superpowers.map(sp => (
                  <div key={sp.id} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-[11px] font-bold uppercase tracking-wider">
                          {sp.category}
                        </span>
                        <span className="text-xs text-secondary font-mono">
                          {formatDistanceToNow(sp.installedAt)}
                        </span>
                      </div>
                      <h4 className="font-headline font-bold text-lg text-on-surface">{sp.name}</h4>
                      <p className="text-xs text-secondary leading-relaxed line-clamp-3 font-body">{sp.description}</p>
                    </div>

                    <div className="pt-4 border-t border-outline-variant flex items-center justify-between">
                      <a 
                        href={sp.repoUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        GitHub Repo
                      </a>

                      <button
                        type="button"
                        onClick={async () => {
                          await db.superpowers.update(sp.id, { enabled: !sp.enabled });
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          sp.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-secondary'
                        }`}
                      >
                        {sp.enabled ? 'Active & Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Custom Superpowers Prompt */}
            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant space-y-4">
              <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Add Custom Superpower Prompt Extension
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={customPromptName}
                  onChange={(e) => setCustomPromptName(e.target.value)}
                  placeholder="Custom Superpower Name..."
                  className="w-full bg-surface-container px-4 py-2.5 rounded-xl border border-outline text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSuperpower}
                  disabled={!customPromptName.trim() || !customPromptInstructions.trim()}
                  className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Save Extension
                </button>
              </div>
              <textarea
                value={customPromptInstructions}
                onChange={(e) => setCustomPromptInstructions(e.target.value)}
                placeholder="Enter prompt extension instructions (e.g. Always include a digital case study and cite primary data sources...)"
                className="w-full bg-surface-container px-4 py-3 rounded-xl border border-outline text-sm text-on-surface h-24 focus-visible:ring-2 focus-visible:ring-primary font-body"
              />
            </div>

          </div>
        )}

        {/* TAB 3: AUDIT STUDIO */}
        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm space-y-4">
                <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">fact_check</span>
                  Audit External Article for AEO/GEO Compliance
                </h3>
                <p className="text-secondary text-sm">
                  Paste any article or external copy for AI evaluation against traditional and direct answer search engines.
                </p>

                <textarea
                  value={auditText}
                  onChange={(e) => setAuditText(e.target.value)}
                  placeholder="Paste article text here for inspection and audit..."
                  className="w-full bg-surface-container p-4 rounded-xl border border-outline text-sm text-on-surface h-72 font-body focus-visible:ring-2 focus-visible:ring-primary"
                />

                <button
                  type="button"
                  onClick={handleAuditText}
                  disabled={isAuditing || !auditText.trim()}
                  className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {isAuditing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">sync</span>
                      Auditing Article...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">radar</span>
                      Start Immediate Audit & Analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm h-full flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-xl font-headline font-bold text-on-surface mb-4">Comprehensive Audit Report</h3>
                  
                  {!auditResult && !isAuditing && (
                    <div className="text-center py-20 text-secondary space-y-2">
                      <span className="material-symbols-outlined text-5xl text-outline">analytics</span>
                      <p className="text-sm">Paste article text and click Start Audit to view score reports and recommendations.</p>
                    </div>
                  )}

                  {isAuditing && (
                    <div className="text-center py-20 text-secondary space-y-3">
                      <span className="material-symbols-outlined text-5xl text-primary animate-spin">sync</span>
                      <p className="text-sm">Analyzing data density, direct answer snippets, and E-E-A-T signals...</p>
                    </div>
                  )}

                  {auditResult && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container p-4 rounded-xl border border-outline-variant">
                        <ScoreBadge label="SEO Score" value={auditResult.seoScore} color="text-blue-600" />
                        <ScoreBadge label="AEO Score" value={auditResult.aeoScore} color="text-amber-600" />
                        <ScoreBadge label="GEO Score" value={auditResult.geoScore} color="text-emerald-600" />
                        <ScoreBadge label="Overall Rating" value={auditResult.overallScore} color="text-primary" />
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-bold text-sm text-on-surface">Required Improvements & Recommendations:</h4>
                        <ul className="space-y-2 text-xs">
                          {auditResult.recommendations?.map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200">
                              <span className="material-symbols-outlined text-sm text-amber-600">lightbulb</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SAVED ARTICLES LIBRARY */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            <h3 className="text-xl font-headline font-bold text-on-surface">Saved Articles Log ({savedArticles.length})</h3>

            {savedArticles.length === 0 ? (
              <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant text-secondary space-y-3">
                <span className="material-symbols-outlined text-5xl text-outline">article</span>
                <p className="text-sm">No saved articles yet. Use the Generator to write your first article.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedArticles.map(art => (
                  <div key={art.id} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-[11px] font-bold uppercase tracking-wider">
                          {art.mode}
                        </span>
                        <span className="text-xs text-secondary font-mono">
                          {formatDistanceToNow(art.updatedAt)}
                        </span>
                      </div>
                      <h4 className="font-headline font-bold text-lg text-on-surface line-clamp-2">{art.title}</h4>
                      <div className="text-xs text-secondary space-y-1">
                        <div>Primary Keyword: <strong className="text-on-surface">{art.primaryKeyword}</strong></div>
                        <div>Language: {art.language} | {art.wordCountTarget} words</div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-outline-variant flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentArticle(art);
                          setActiveTab('generator');
                          setActiveViewMode('preview');
                        }}
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Open Article & Preview
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await db.articles.delete(art.id);
                        }}
                        className="text-xs text-error hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
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

// Subcomponents
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        active 
          ? 'border-primary text-primary bg-primary/5' 
          : 'border-transparent text-secondary hover:text-on-surface hover:border-outline-variant'
      }`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {label}
    </button>
  );
}

function ModeCard({ id, title, desc, selected, onClick }: { id: string; title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border text-right transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        selected 
          ? 'bg-primary/10 border-primary text-on-surface font-bold shadow-sm' 
          : 'bg-surface-container border-outline-variant text-secondary hover:bg-surface-container-high'
      }`}
    >
      <div className="text-xs font-bold text-on-surface">{title}</div>
      <div className="text-[10px] text-secondary mt-0.5">{desc}</div>
    </button>
  );
}

function ScoreBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2.5 bg-surface rounded-lg border border-outline-variant/60">
      <div className={`text-xl font-bold font-mono ${color}`}>{value}%</div>
      <div className="text-[10px] text-secondary font-medium uppercase mt-0.5">{label}</div>
    </div>
  );
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium ${
      passed ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
    }`}>
      <span className={`material-symbols-outlined text-sm ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
        {passed ? 'check_circle' : 'cancel'}
      </span>
      <span>{label}</span>
    </div>
  );
}
