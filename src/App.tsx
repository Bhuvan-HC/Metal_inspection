import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout, NavView } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SingleInspection } from './pages/SingleInspection';
import { BatchInspection } from './pages/BatchInspection';
import { InspectionHistory } from './pages/InspectionHistory';
import { ReviewCenter } from './pages/ReviewCenter';
import { Analytics } from './pages/Analytics';
import { ModelEvaluation } from './pages/ModelEvaluation';
import { ProductManagement } from './pages/ProductManagement';
import { AuditLogPage } from './pages/AuditLogPage';
import { CameraInspection } from './pages/CameraInspection';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-400">Initializing InspectAI Platform...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onSuccess={() => setCurrentView('dashboard')} />;
  }

  const handleSelectInspection = (id: string) => {
    setSelectedInspectionId(id);
    setCurrentView('history');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={(view) => setCurrentView(view)}
            onSelectInspection={handleSelectInspection}
          />
        );
      case 'single-inspection':
        return (
          <SingleInspection
            onNavigate={(view) => setCurrentView(view)}
            onSelectInspection={handleSelectInspection}
          />
        );
      case 'camera-inspection':
        return (
          <CameraInspection
            onNavigate={(view) => setCurrentView(view)}
            onSelectInspection={handleSelectInspection}
          />
        );
      case 'batch-inspection':
        return (
          <BatchInspection
            onNavigate={(view) => setCurrentView(view)}
            onSelectInspection={handleSelectInspection}
          />
        );
      case 'history':
        return (
          <InspectionHistory
            onNavigate={(view) => setCurrentView(view)}
            selectedInspectionId={selectedInspectionId}
            onClearSelected={() => setSelectedInspectionId(null)}
          />
        );
      case 'reviews':
        return <ReviewCenter />;
      case 'analytics':
        return <Analytics />;
      case 'evaluation':
        return <ModelEvaluation />;
      case 'products':
        return <ProductManagement />;
      case 'audit':
        return <AuditLogPage />;
      default:
        return (
          <Dashboard
            onNavigate={(view) => setCurrentView(view)}
            onSelectInspection={handleSelectInspection}
          />
        );
    }
  };

  return (
    <AppLayout currentView={currentView} onNavigate={(view) => setCurrentView(view)}>
      {renderView()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
