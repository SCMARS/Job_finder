import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import JobSearch from './components/JobSearch';
import Statistics from './components/Statistics';
import AutomationControl from './components/AutomationControl';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';


type TabType = 'dashboard' | 'search' | 'automation' | 'stats';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'search', name: 'Job Search', icon: '🔍' },
    { id: 'automation', name: 'Automation', icon: '⚙️' },
    { id: 'stats', name: 'Statistics', icon: '📈' }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'search':
        return <JobSearch />;
      case 'automation':
        return <AutomationControl />;
      case 'stats':
        return <Statistics />;
      default:
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <ErrorBoundary>
    <div style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <h1 className="app-title">
                  🚀 Job Automation System
                </h1>
                <p className="app-subtitle">
                  Bundesagentur → Apollo → Instantly → Pipedrive
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="status-indicator">
                System Online
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="tab-nav" style={{ margin: '0 20px', marginTop: '20px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={activeTab === tab.id ? 'active' : ''}
          >
            <span className="icon">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>

      <main className="container">
        {renderActiveTab()}
      </main>

      <footer className="app-footer">
        <p className="version">
          ✨ Job Automation System v1.0
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
          Automated job searching and lead generation platform
        </p>
        <p className="endpoints">
          Backend: localhost:3002 • Frontend: localhost:3000
        </p>
      </footer>
    </div>
    </ErrorBoundary>
  );
}

export default App;
