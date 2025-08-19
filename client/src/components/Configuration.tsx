import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface ServiceStatus {
  name: string;
  status: 'connected' | 'error' | 'testing' | 'not-configured';
  message: string;
  lastTested: string | null;
  icon: string;
  docs?: string;
}

interface ConfigData {
  environment: string;
  version: string;
  services: {
    [key: string]: ServiceStatus;
  };
  instantly: {
    campaigns: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
  pipedrive: {
    stages: Array<{
      id: number;
      name: string;
    }>;
  };
}

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config');
      setConfig(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch configuration:', err);
      setError('Failed to load configuration');
      // Set default config to show UI
      setConfig({
        environment: 'development',
        version: '1.0.0',
        services: {
          bundesagentur: {
            name: 'Bundesagentur für Arbeit',
            status: 'not-configured',
            message: 'Public API - no configuration needed',
            lastTested: null,
            icon: '🇩🇪',
            docs: 'https://jobsuche.api.bund.dev/'
          },
          'google-sheets': {
            name: 'Google Sheets',
            status: 'error',
            message: 'Credentials file not found',
            lastTested: null,
            icon: '📊',
            docs: 'https://developers.google.com/sheets/api'
          },
          apollo: {
            name: 'Apollo.io',
            status: 'not-configured',
            message: 'API key not configured',
            lastTested: null,
            icon: '🔍',
            docs: 'https://apolloio.github.io/apollo-api-docs/'
          },
          instantly: {
            name: 'Instantly',
            status: 'error',
            message: 'Invalid API key',
            lastTested: null,
            icon: '📧',
            docs: 'https://developer.instantly.ai/'
          },
          pipedrive: {
            name: 'Pipedrive',
            status: 'not-configured',
            message: 'Domain not configured',
            lastTested: null,
            icon: '🔄',
            docs: 'https://developers.pipedrive.com/'
          }
        },
        instantly: { campaigns: [] },
        pipedrive: { stages: [] }
      });
    } finally {
      setLoading(false);
    }
  };

  const testService = async (serviceKey: string) => {
    setTesting(prev => new Set(prev).add(serviceKey));
    
    try {
      const response = await api.get(`/config/test/${serviceKey}`);
      
      setConfig(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          services: {
            ...prev.services,
            [serviceKey]: {
              ...prev.services[serviceKey],
              status: response.data.success ? 'connected' : 'error',
              message: response.data.message || (response.data.success ? 'Connected successfully' : 'Connection failed'),
              lastTested: new Date().toISOString()
            }
          }
        };
      });
    } catch (err: any) {
      console.error(`Failed to test ${serviceKey}:`, err);
      setConfig(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          services: {
            ...prev.services,
            [serviceKey]: {
              ...prev.services[serviceKey],
              status: 'error',
              message: err.response?.data?.message || 'Connection test failed',
              lastTested: new Date().toISOString()
            }
          }
        };
      });
    } finally {
      setTesting(prev => {
        const newSet = new Set(prev);
        newSet.delete(serviceKey);
        return newSet;
      });
    }
  };

  const testAllServices = async () => {
    const services = Object.keys(config?.services || {});
    for (const service of services) {
      await testService(service);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'error': return '#ef4444';
      case 'testing': return '#f59e0b';
      case 'not-configured': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'error': return '❌';
      case 'testing': return '🔄';
      case 'not-configured': return '⚪';
      default: return '❓';
    }
  };

  const renderSetupInstructions = (serviceKey: string) => {
    const instructions = {
      'google-sheets': {
        title: 'Google Sheets Setup',
        steps: [
          '1. Go to Google Cloud Console (console.cloud.google.com)',
          '2. Create a new project or select existing one',
          '3. Enable Google Sheets API',
          '4. Create a Service Account',
          '5. Download the JSON credentials file',
          '6. Save it as credentials/google-sheets-credentials.json',
          '7. Create a Google Sheet and get the Spreadsheet ID from URL',
          '8. Add GOOGLE_SHEETS_SPREADSHEET_ID to .env file',
          '9. Share your sheet with the service account email'
        ],
        envVars: ['GOOGLE_SHEETS_SPREADSHEET_ID']
      },
      apollo: {
        title: 'Apollo.io Setup',
        steps: [
          '1. Sign up for Apollo.io account',
          '2. Go to Settings → Integrations → API',
          '3. Generate a new API key',
          '4. Add APOLLO_API_KEY to .env file'
        ],
        envVars: ['APOLLO_API_KEY']
      },
      instantly: {
        title: 'Instantly Setup',
        steps: [
          '1. Log in to your Instantly account',
          '2. Go to Settings → API Settings',
          '3. Generate a new API key',
          '4. Add INSTANTLY_API_KEY to .env file'
        ],
        envVars: ['INSTANTLY_API_KEY']
      },
      pipedrive: {
        title: 'Pipedrive Setup',
        steps: [
          '1. Log in to your Pipedrive account',
          '2. Go to Settings → Personal preferences → API',
          '3. Generate a new API token',
          '4. Find your company domain (e.g. yourcompany.pipedrive.com)',
          '5. Add both PIPEDRIVE_API_TOKEN and PIPEDRIVE_COMPANY_DOMAIN to .env file'
        ],
        envVars: ['PIPEDRIVE_API_TOKEN', 'PIPEDRIVE_COMPANY_DOMAIN']
      },
      bundesagentur: {
        title: 'Bundesagentur für Arbeit',
        steps: [
          '1. This is a public API - no setup required',
          '2. API documentation: https://jobsuche.api.bund.dev/',
          '3. No authentication needed'
        ],
        envVars: []
      }
    };

    const instruction = instructions[serviceKey as keyof typeof instructions];
    if (!instruction) return null;

    return (
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <h4 className="card-title">
            📋 {instruction.title}
          </h4>
        </div>

        <div style={{ marginBottom: '16px' }}>
          {instruction.steps.map((step, index) => (
            <div key={index} style={{ 
              padding: '8px 0', 
              borderLeft: index === 0 ? 'none' : '2px solid #e5e7eb',
              marginLeft: index === 0 ? '0' : '16px',
              paddingLeft: index === 0 ? '0' : '16px'
            }}>
              <span style={{ fontSize: '14px', color: '#374151' }}>{step}</span>
            </div>
          ))}
        </div>

        {instruction.envVars.length > 0 && (
          <div>
            <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Environment Variables:
            </h5>
            {instruction.envVars.map(envVar => (
              <div key={envVar} className="form-group">
                <label className="form-label">{envVar}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={`Enter your ${envVar.toLowerCase()}`}
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>
            ))}
            <div className="alert alert-info">
              <strong>💡 Tip:</strong> Add these variables to your .env file in the project root.
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card text-center">
        <div className="spinner-lg" style={{ margin: '40px auto' }}></div>
        <p className="text-muted">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div>
      {/* System Info */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            🛠️ System Configuration
          </h2>
        </div>

        {error && (
          <div className="alert alert-warning">
            <strong>⚠️ Notice:</strong> {error}
            <br />
            <small>Some configuration data may not be available. Check your API connections.</small>
          </div>
        )}

        <div className="grid grid-3">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#667eea', marginBottom: '8px' }}>
              {config?.environment || 'unknown'}
            </div>
            <div className="text-muted">Environment</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#667eea', marginBottom: '8px' }}>
              v{config?.version || '1.0.0'}
            </div>
            <div className="text-muted">Version</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#10b981', marginBottom: '8px' }}>
              {Object.values(config?.services || {}).filter(s => s.status === 'connected').length}/
              {Object.keys(config?.services || {}).length}
            </div>
            <div className="text-muted">Services Connected</div>
          </div>
        </div>
      </div>

      {/* API Services Status */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🔌 API Services Status
          </h3>
          <button 
            className="btn btn-info"
            onClick={testAllServices}
            disabled={testing.size > 0}
          >
            {testing.size > 0 ? (
              <>
                <span className="spinner"></span>
                Testing...
              </>
            ) : (
              <>
                🧪 Test All Connections
              </>
            )}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {Object.entries(config?.services || {}).map(([key, service]) => (
            <div 
              key={key}
              className="card"
              style={{ 
                border: `2px solid ${getStatusColor(service.status)}20`,
                backgroundColor: `${getStatusColor(service.status)}05`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{service.icon}</span>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      {service.name}
                    </h4>
                    <span 
                      className="badge"
                      style={{ 
                        backgroundColor: getStatusColor(service.status) + '20',
                        color: getStatusColor(service.status),
                        border: `1px solid ${getStatusColor(service.status)}40`
                      }}
                    >
                      {getStatusIcon(service.status)} {service.status.replace('-', ' ')}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                    {service.message}
                  </p>

                  {service.lastTested && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                      Last tested: {new Date(service.lastTested).toLocaleString()}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => testService(key)}
                    disabled={testing.has(key)}
                  >
                    {testing.has(key) ? (
                      <>
                        <span className="spinner"></span>
                        Testing...
                      </>
                    ) : (
                      <>
                        🔄 Test
                      </>
                    )}
                  </button>

                  <button 
                    className="btn btn-sm"
                    onClick={() => setShowInstructions(showInstructions === key ? null : key)}
                  >
                    📋 Setup
                  </button>

                  {service.docs && (
                    <a 
                      href={service.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-info"
                    >
                      📖 Docs
                    </a>
                  )}
                </div>
              </div>

              {showInstructions === key && renderSetupInstructions(key)}
            </div>
          ))}
        </div>
      </div>

      {/* Instantly Campaigns */}
      {config?.instantly?.campaigns && config.instantly.campaigns.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📧 Instantly Campaigns
            </h3>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {config?.instantly?.campaigns?.map((campaign) => (
                  <tr key={campaign.id}>
                    <td style={{ fontWeight: '500' }}>{campaign.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{campaign.id}</td>
                    <td>
                      <span className={`badge ${campaign.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm">
                        📊 View Stats
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipedrive Stages */}
      {config?.pipedrive?.stages && config.pipedrive.stages.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              🔄 Pipedrive Pipeline Stages
            </h3>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {config?.pipedrive?.stages?.map((stage, index) => (
              <div 
                key={stage.id}
                style={{
                  padding: '12px 16px',
                  background: `linear-gradient(135deg, ${index === 0 ? '#667eea' : '#6b7280'}20, ${index === 0 ? '#764ba2' : '#4b5563'}20)`,
                  borderRadius: '8px',
                  border: `2px solid ${index === 0 ? '#667eea' : '#6b7280'}40`,
                  minWidth: '120px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {stage.name}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  ID: {stage.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment Variables Help */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🔐 Environment Variables
          </h3>
        </div>

        <div className="alert alert-info">
          <strong>📝 Setup Instructions:</strong>
          <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Copy <code>.env.example</code> to <code>.env</code></li>
            <li>Fill in your API keys and configuration values</li>
            <li>Restart the application</li>
            <li>Use the "Test All Connections" button above</li>
          </ol>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
            Required Environment Variables:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', fontFamily: 'monospace' }}>
            <li>GOOGLE_SHEETS_SPREADSHEET_ID</li>
            <li>APOLLO_API_KEY</li>
            <li>INSTANTLY_API_KEY</li>
            <li>PIPEDRIVE_API_TOKEN</li>
            <li>PIPEDRIVE_COMPANY_DOMAIN</li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🚀 Quick Actions
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-success"
            onClick={fetchConfiguration}
          >
            🔄 Refresh Configuration
          </button>

          <button className="btn btn-warning">
            📋 Export Configuration
          </button>

          <button className="btn btn-info">
            📖 View Documentation
          </button>

          <button className="btn btn-secondary">
            🛠️ Advanced Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Configuration; 