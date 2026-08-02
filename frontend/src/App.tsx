import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { MarketplaceStorefront } from './views/MarketplaceStorefront';
import { PlaybookDetailView } from './views/PlaybookDetailView';
import { CreatorPublishingWizard } from './views/CreatorPublishingWizard';
import { ModerationStudioView } from './views/ModerationStudioView';
import { UserLibraryView } from './views/UserLibraryView';
import { InstalledCache } from './views/InstalledCache';
import { Registries } from './views/Registries';
import { Settings } from './views/Settings';

export type ViewState =
  | 'store'
  | 'explore'
  | 'playbook-detail'
  | 'creator-publishing'
  | 'moderation-studio'
  | 'user-library'
  | 'installed'
  | 'registries'
  | 'settings'
  | 'home'
  | 'library'
  | 'editor'
  | 'chat'
  | 'validation'
  | 'seo-engine'
  | 'github'
  | 'skills-sh'
  | 'create'
  | 'sell';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('store');
  const [currentPlaybookSlug, setCurrentPlaybookSlug] = useState<string>('secure-api-review');

  const handleNavigate = (view: string, extraId?: string) => {
    setCurrentView(view as ViewState);
    if (extraId) {
      setCurrentPlaybookSlug(extraId);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'store':
      case 'explore':
        return <MarketplaceStorefront onNavigate={handleNavigate} />;
      case 'playbook-detail':
        return <PlaybookDetailView slug={currentPlaybookSlug} onNavigate={handleNavigate} />;
      case 'creator-publishing':
        return <CreatorPublishingWizard onNavigate={handleNavigate} />;
      case 'moderation-studio':
        return <ModerationStudioView onNavigate={handleNavigate} />;
      case 'user-library':
        return <UserLibraryView onNavigate={handleNavigate} />;
      case 'installed':
        return <InstalledCache onNavigate={handleNavigate} />;
      case 'registries':
        return <Registries onNavigate={handleNavigate} />;
      case 'settings':
        return <Settings onNavigate={handleNavigate} />;
      default:
        return <MarketplaceStorefront onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
      <Layout currentView={currentView} onNavigate={handleNavigate}>
        {renderView()}
      </Layout>
    </AuthProvider>
  );
}
