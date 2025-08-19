import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface AutomationStatus {
  isRunning: boolean;
  isScheduled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  scheduleCron: string | null;
  defaultSearchParams: {
    keywords: string;
    location: string;
    radius: number;
    size: number;
    publishedSince: number;
  };
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunStatus: string;
  };
}

interface TestResults {
  [service: string]: {
    status: 'success' | 'error' | 'testing';
    message: string;
  };
}

const AutomationControl: React.FC = () => {
  const [status, setStatus] = useState<AutomationStatus | null>({
    isRunning: false,
    isScheduled: false,
    lastRun: null,
    nextRun: null,
    scheduleCron: null,
    defaultSearchParams: {
      keywords: 'software',
      location: 'Multi-city search',
      radius: 100,
      size: 50,
      publishedSince: 30
    },
    stats: {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunStatus: 'Never'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResults>({});
  
  const [searchParams, setSearchParams] = useState({
    keywords: 'software',
    location: 'Berlin',
    radius: 50,
    size: 50,
    publishedSince: 30
  });
  
  const [scheduleSettings, setScheduleSettings] = useState({
    enabled: false,
    cronPattern: '0 9 * * MON', // Every Monday at 9 AM
    customCron: ''
  });

  const cronPresets = [
    { label: 'Every Monday at 9 AM', value: '0 9 * * MON' },
    { label: 'Every day at 8 AM', value: '0 8 * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every 2 hours (business days)', value: '0 */2 * * MON-FRI' },
    { label: 'Custom', value: 'custom' }
  ];

  useEffect(() => {
    fetchAutomationStatus();
    const interval = setInterval(fetchAutomationStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAutomationStatus = async () => {
    try {
      const response = await api.get('/automation/status');
      const data = response.data.data; // Extract data from API response
      
      setStatus(data);
      
      if (data.defaultSearchParams) {
        setSearchParams(data.defaultSearchParams);
      }
      
      if (data.scheduleCron) {
        setScheduleSettings({
          enabled: data.isScheduled,
          cronPattern: data.scheduleCron,
          customCron: cronPresets.some(p => p.value === data.scheduleCron) ? '' : data.scheduleCron
        });
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch automation status:', err);
      setError('Failed to load automation status');
      // Set default status to show UI
      setStatus({
        isRunning: false,
        isScheduled: false,
        lastRun: null,
        nextRun: null,
        scheduleCron: null,
        defaultSearchParams: searchParams,
        stats: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          lastRunStatus: 'Never'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const runAutomation = async () => {
    setOperationLoading('run');
    setError(null);
    
    try {
      const response = await api.post('/automation/run', {
        searchParams: searchParams
      });
      
      if (response.data.success) {
        alert('✅ Automation started successfully! Check the logs for progress.');
        fetchAutomationStatus();
      } else {
        setError(response.data.message || 'Failed to start automation');
      }
    } catch (err: any) {
      console.error('Failed to run automation:', err);
      setError(err.response?.data?.message || 'Failed to start automation. Check API configuration.');
    } finally {
      setOperationLoading(null);
    }
  };

  const updateSchedule = async () => {
    setOperationLoading('schedule');
    setError(null);
    
    const cronPattern = scheduleSettings.cronPattern === 'custom' 
      ? scheduleSettings.customCron 
      : scheduleSettings.cronPattern;
    
    try {
      if (scheduleSettings.enabled) {
        const response = await api.post('/automation/schedule', {
          cronPattern: cronPattern,
          searchParams: searchParams
        });
        
        if (response.data.success) {
          alert('✅ Automation scheduled successfully!');
          fetchAutomationStatus();
        } else {
          setError(response.data.message || 'Failed to schedule automation');
        }
      } else {
        const response = await api.post('/automation/stop-schedule');
        
        if (response.data.success) {
          alert('⏹️ Automation schedule stopped.');
          fetchAutomationStatus();
        } else {
          setError(response.data.message || 'Failed to stop schedule');
        }
      }
    } catch (err: any) {
      console.error('Failed to update schedule:', err);
      setError(err.response?.data?.message || 'Failed to update schedule');
    } finally {
      setOperationLoading(null);
    }
  };

  const updateDefaultParams = async () => {
    setOperationLoading('params');
    setError(null);
    
    try {
      const response = await api.post('/automation/update-params', {
        searchParams: searchParams
      });
      
      if (response.data.success) {
        alert('✅ Default search parameters updated!');
        fetchAutomationStatus();
      } else {
        setError(response.data.message || 'Failed to update parameters');
      }
    } catch (err: any) {
      console.error('Failed to update params:', err);
      setError(err.response?.data?.message || 'Failed to update parameters');
    } finally {
      setOperationLoading(null);
    }
  };

  const testAllIntegrations = async () => {
    setOperationLoading('test');
    setTestResults({});
    
    const services = ['bundesagentur', 'google-sheets', 'apollo', 'instantly', 'pipedrive'];
    
    // Set all services to testing state
    const initialResults: TestResults = {};
    services.forEach(service => {
      initialResults[service] = { status: 'testing', message: 'Testing...' };
    });
    setTestResults(initialResults);
    
    try {
      const response = await api.get('/config/test-connections');
      const results = response.data.results || {};
      
      const finalResults: TestResults = {};
      services.forEach(service => {
        const result = results[service];
        finalResults[service] = {
          status: result?.success ? 'success' : 'error',
          message: result?.message || (result?.success ? 'Connected' : 'Configuration needed')
        };
      });
      
      setTestResults(finalResults);
    } catch (err: any) {
      console.error('Failed to test integrations:', err);
      setError('Failed to test API integrations');
    } finally {
      setOperationLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="card text-center">
        <div className="spinner-lg" style={{ margin: '40px auto' }}></div>
        <p className="text-muted">Loading automation settings...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Current Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            ⚙️ Automation Status
          </h2>
        </div>

        {error && (
          <div className="alert alert-warning">
            <strong>⚠️ Notice:</strong> {error}
          </div>
        )}

        <div className="grid grid-3">
          <div className="stat-card">
            <div className="stat-value" style={{ color: status?.isRunning ? '#10b981' : '#6b7280' }}>
              {status?.isRunning ? '🟢' : '⭕'}
            </div>
            <div className="stat-label">
              {status?.isRunning ? 'Running' : 'Idle'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: status?.isScheduled ? '#f59e0b' : '#6b7280' }}>
              {status?.isScheduled ? '📅' : '❌'}
            </div>
            <div className="stat-label">
              {status?.isScheduled ? 'Scheduled' : 'Not Scheduled'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{status?.stats?.totalRuns || 0}</div>
            <div className="stat-label">Total Runs</div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: '20px' }}>
          <div>
            <label className="form-label">Last Run</label>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              {status?.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}
            </p>
          </div>

          <div>
            <label className="form-label">Next Scheduled Run</label>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              {status?.nextRun ? new Date(status.nextRun).toLocaleString() : 'Not scheduled'}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Control */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🎮 Manual Control
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-success"
            onClick={runAutomation}
            disabled={!!operationLoading || status?.isRunning}
          >
            {operationLoading === 'run' ? (
              <>
                <span className="spinner"></span>
                Starting...
              </>
            ) : (
              <>
                🚀 Run Automation Now
              </>
            )}
          </button>

          <button 
            className="btn btn-info"
            onClick={testAllIntegrations}
            disabled={!!operationLoading}
          >
            {operationLoading === 'test' ? (
              <>
                <span className="spinner"></span>
                Testing...
              </>
            ) : (
              <>
                🧪 Test All Integrations
              </>
            )}
          </button>

          <button 
            className="btn btn-warning"
            onClick={updateDefaultParams}
            disabled={!!operationLoading}
          >
            {operationLoading === 'params' ? (
              <>
                <span className="spinner"></span>
                Updating...
              </>
            ) : (
              <>
                💾 Save Search Parameters
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search Parameters */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🔍 Default Search Parameters
          </h3>
        </div>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Keywords</label>
            <input
              type="text"
              className="form-input"
              value={searchParams.keywords}
              onChange={(e) => setSearchParams({...searchParams, keywords: e.target.value})}
                              placeholder="e.g. software, developer, react, java"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              className="form-input"
              value={searchParams.location}
              onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
              placeholder="e.g. Berlin, München"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Search Radius (km)</label>
            <select
              className="form-select"
              value={searchParams.radius}
              onChange={(e) => setSearchParams({...searchParams, radius: parseInt(e.target.value)})}
            >
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Jobs per Run</label>
            <select
              className="form-select"
              value={searchParams.size}
              onChange={(e) => setSearchParams({...searchParams, size: parseInt(e.target.value)})}
            >
              <option value={10}>10 jobs</option>
              <option value={20}>20 jobs</option>
              <option value={50}>50 jobs</option>
              <option value={100}>100 jobs</option>
              <option value={200}>200 jobs</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Published Since (days)</label>
            <select
              className="form-select"
              value={searchParams.publishedSince}
              onChange={(e) => setSearchParams({...searchParams, publishedSince: parseInt(e.target.value)})}
            >
              <option value={1}>Last 24 hours</option>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last week</option>
              <option value={14}>Last 2 weeks</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scheduling */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            📅 Automation Scheduling
          </h3>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={scheduleSettings.enabled}
              onChange={(e) => setScheduleSettings({...scheduleSettings, enabled: e.target.checked})}
              style={{ transform: 'scale(1.2)' }}
            />
            <span className="form-label" style={{ margin: 0 }}>Enable Automatic Scheduling</span>
          </label>
        </div>

        {scheduleSettings.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">Schedule Pattern</label>
              <select
                className="form-select"
                value={scheduleSettings.cronPattern}
                onChange={(e) => setScheduleSettings({...scheduleSettings, cronPattern: e.target.value})}
              >
                {cronPresets.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {scheduleSettings.cronPattern === 'custom' && (
              <div className="form-group">
                <label className="form-label">Custom Cron Pattern</label>
                <input
                  type="text"
                  className="form-input"
                  value={scheduleSettings.customCron}
                  onChange={(e) => setScheduleSettings({...scheduleSettings, customCron: e.target.value})}
                  placeholder="e.g. 0 */4 * * * (every 4 hours)"
                />
                <small className="text-muted">
                  Format: second minute hour day month dayOfWeek
                </small>
              </div>
            )}
          </>
        )}

        <button 
          className="btn btn-warning"
          onClick={updateSchedule}
          disabled={!!operationLoading}
        >
          {operationLoading === 'schedule' ? (
            <>
              <span className="spinner"></span>
              Updating...
            </>
          ) : (
            <>
              📅 {scheduleSettings.enabled ? 'Update Schedule' : 'Disable Schedule'}
            </>
          )}
        </button>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              🧪 Integration Test Results
            </h3>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {Object.entries(testResults).map(([service, result]) => (
              <div 
                key={service}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}
              >
                <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                  {service.replace('-', ' ')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {result.status === 'testing' && <span className="spinner"></span>}
                  <span className={`badge badge-${
                    result.status === 'success' ? 'success' : 
                    result.status === 'error' ? 'danger' : 'info'
                  }`}>
                    {result.status === 'success' ? '✅' : 
                     result.status === 'error' ? '❌' : '🔄'} 
                    {result.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      {status?.stats && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📊 Automation Statistics
            </h3>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{status?.stats?.totalRuns || 0}</div>
              <div className="stat-label">Total Runs</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: '#10b981' }}>
                {status?.stats?.successfulRuns || 0}
              </div>
              <div className="stat-label">Successful</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {status?.stats?.failedRuns || 0}
              </div>
              <div className="stat-label">Failed</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.8rem' }}>
                {status?.stats?.totalRuns && status.stats.totalRuns > 0 
                  ? Math.round(((status?.stats?.successfulRuns || 0) / status.stats.totalRuns) * 100)
                  : 0}%
              </div>
              <div className="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationControl; 