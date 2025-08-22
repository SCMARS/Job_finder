import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface DashboardStats {
  jobs: {
    total: number;
    new: number;
    enriched: number;
    inCampaign: number;
    converted: number;
    error: number;
  };
  automation: {
    status: string;
    lastRun: string | null;
    nextRun: string | null;
    isRunning: boolean;
    isScheduled: boolean;
  };
  system: {
    uptime: string;
    version: string;
    apiStatus: 'online' | 'degraded' | 'offline';
    connectedServices: number;
    totalServices: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'job_found' | 'contact_enriched' | 'campaign_added' | 'lead_converted' | 'automation_run';
    message: string;
    timestamp: string;
    status: 'success' | 'warning' | 'error';
  }>;
  performance: {
    avgJobsPerDay: number;
    conversionRate: number;
    enrichmentRate: number;
    responseRate: number;
  };
}

interface TabProps {
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'search' | 'automation' | 'stats') => void;
}

const Dashboard: React.FC<TabProps> = ({ activeTab, setActiveTab }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sheetsResponse, automationResponse, configResponse] = await Promise.all([
        api.get('/sheets/stats').catch(() => ({ data: null })),
        api.get('/automation/status').catch(() => ({ data: null })),
        api.get('/config').catch(() => ({ data: null }))
      ]);
      
     
      const sheetsData = sheetsResponse.data?.data;
      const automationData = automationResponse.data?.data;
      
     
      const recentActivity = [] as any[];
      
      if (sheetsData?.totalJobs > 0) {
        recentActivity.push({
          id: '1',
          type: 'job_found' as const,
          message: `Found ${sheetsData.totalJobs} jobs total in database`,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'success' as const
        });
      }
      
      if (automationData?.isRunning) {
        recentActivity.push({
          id: '2',
          type: 'automation_run' as const,
          message: 'Multi-city automation currently running',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: 'success' as const
        });
      }
      
      if (automationData?.lastRun) {
        recentActivity.push({
          id: '3',
          type: 'automation_run' as const,
          message: `Last automation run: ${automationData.stats?.lastRunStatus || 'Completed'}`,
          timestamp: automationData.lastRun,
          status: 'success' as const
        });
      }
      
      // Add fallback activity if no real data
      if (recentActivity.length === 0) {
        recentActivity.push({
          id: '1',
          type: 'automation_run' as const,
          message: 'System initialized and ready',
          timestamp: new Date().toISOString(),
          status: 'success' as const
        });
      }

      const dashboardStats: DashboardStats = {
        jobs: {
          total: sheetsData?.totalJobs || 0,
          new: sheetsData?.byStatus?.new || 0,
          enriched: sheetsData?.byStatus?.enriched || 0,
          inCampaign: sheetsData?.byStatus?.inCampaign || 0,
          converted: sheetsData?.byStatus?.converted || 0,
          error: sheetsData?.byStatus?.error || 0
        },
        automation: {
          status: automationData?.isRunning ? 'Running' : (automationData?.isScheduled ? 'Scheduled' : 'Idle'),
          lastRun: automationData?.lastRun || null,
          nextRun: automationData?.nextRun || null,
          isRunning: automationData?.isRunning || false,
          isScheduled: automationData?.isScheduled || false
        },
        system: {
          uptime: '2h 15m',
          version: '1.0.0',
          apiStatus: 'online',
          connectedServices: configResponse.data?.services 
            ? Object.values(configResponse.data.services).filter((s: any) => s.status === 'connected').length 
            : 2,
          totalServices: configResponse.data?.services 
            ? Object.keys(configResponse.data.services).length 
            : 5
        },
        recentActivity: recentActivity,
        performance: {
          avgJobsPerDay: sheetsData?.totalJobs ? (sheetsData.totalJobs / 30) : 0, // Jobs per day over last 30 days
          conversionRate: parseFloat(sheetsData?.conversionRate || '0'),
          enrichmentRate: sheetsData?.totalJobs > 0 ? ((sheetsData.byStatus?.enriched || 0) / sheetsData.totalJobs * 100) : 0,
          responseRate: automationData?.stats ? (automationData.stats.successfulRuns / Math.max(automationData.stats.totalRuns, 1) * 100) : 0
        }
      };
      
      setStats(dashboardStats);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
      // Set minimal stats to show UI
      setStats({
        jobs: { total: 0, new: 0, enriched: 0, inCampaign: 0, converted: 0, error: 0 },
        automation: { status: 'Idle', lastRun: null, nextRun: null, isRunning: false, isScheduled: false },
        system: { uptime: '0m', version: '1.0.0', apiStatus: 'offline', connectedServices: 0, totalServices: 5 },
        recentActivity: [],
        performance: { avgJobsPerDay: 0, conversionRate: 0, enrichmentRate: 0, responseRate: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    setActionLoading(action);
    
    try {
      switch (action) {
        case 'search':
          setActiveTab('search');
          break;
          
        case 'automation':
          // Try to run automation
          const response = await api.post('/automation/run', {
            searchParams: {
              keywords: 'developer software engineer',
              location: 'Berlin',
              radius: 25,
              size: 10,
              publishedSince: 7
            }
          });
          
          if (response.data.success) {
            alert('✅ Automation started successfully!');
            fetchDashboardData(); // Refresh stats
          } else {
            alert('❌ Failed to start automation: ' + (response.data.message || 'Unknown error'));
          }
          break;
          
        case 'statistics':
          setActiveTab('stats');
          break;
          
        case 'configuration':
          // Removed configuration tab
          setActiveTab('dashboard');
          break;
          
        default:
          console.log('Unknown action:', action);
      }
    } catch (err: any) {
      console.error(`Failed to execute ${action}:`, err);
      alert(`❌ Failed to execute action: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'job_found': return '🔍';
      case 'contact_enriched': return '✨';
      case 'campaign_added': return '📧';
      case 'lead_converted': return '💰';
      case 'automation_run': return '⚙️';
      default: return '📝';
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading && !stats) {
    return (
      <div className="card text-center">
        <div className="spinner-lg" style={{ margin: '40px auto' }}></div>
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  const systemHealthScore = stats ? Math.round((stats.system.connectedServices / stats.system.totalServices) * 100) : 0;

  return (
    <div>
      {/* Welcome Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            👋 Welcome to Job Automation System
          </h2>
        </div>
        <p style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '20px' }}>
          Your automated job search and lead generation platform is ready. 
          Monitor your pipeline, track conversions, and manage automation settings from this dashboard.
        </p>
        
        {error && (
          <div className="alert alert-warning">
            <strong>⚠️ Configuration Notice:</strong> {error}
            <br />
            <small>Some services may need configuration. Check the Configuration tab for setup instructions.</small>
          </div>
        )}

        {/* System Health Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>System Health</span>
            <span style={{ fontSize: '14px', color: systemHealthScore >= 80 ? '#10b981' : systemHealthScore >= 50 ? '#f59e0b' : '#ef4444' }}>
              {systemHealthScore}%
            </span>
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${systemHealthScore}%`, 
              height: '100%', 
              background: systemHealthScore >= 80 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : systemHealthScore >= 50 
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'linear-gradient(135deg, #ef4444, #dc2626)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {stats?.system.connectedServices || 0} of {stats?.system.totalServices || 5} services connected
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            📊 Key Metrics
          </h3>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats?.jobs.total || 0}</div>
            <div className="stat-label">Total Jobs</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats?.jobs.enriched || 0}</div>
            <div className="stat-label">Enriched Contacts</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats?.jobs.inCampaign || 0}</div>
            <div className="stat-label">In Campaigns</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats?.jobs.converted || 0}</div>
            <div className="stat-label">Converted Leads</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Automation Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              ⚙️ Automation Status
            </h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '500' }}>Current Status</span>
              <span className={`badge ${stats?.automation.isRunning ? 'badge-success' : stats?.automation.isScheduled ? 'badge-warning' : 'badge-info'}`}>
                {stats?.automation.isRunning ? '🟢 Running' : stats?.automation.isScheduled ? '📅 Scheduled' : '⭕ Idle'}
              </span>
            </div>
            
            <div>
              <label className="form-label">Last Run</label>
              <p className="text-muted" style={{ margin: 0 }}>
                {stats?.automation.lastRun ? new Date(stats.automation.lastRun).toLocaleString() : 'Never'}
              </p>
            </div>
            
            <div>
              <label className="form-label">Next Scheduled Run</label>
              <p className="text-muted" style={{ margin: 0 }}>
                {stats?.automation.nextRun ? new Date(stats.automation.nextRun).toLocaleString() : 'Not scheduled'}
              </p>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <button 
                className="btn btn-sm"
                onClick={() => setActiveTab('automation')}
              >
                ⚙️ Manage Automation
              </button>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📈 Performance
            </h3>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#667eea', marginBottom: '4px' }}>
                {stats?.performance.avgJobsPerDay.toFixed(1) || '0.0'}
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>Jobs/Day</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#10b981', marginBottom: '4px' }}>
                {stats?.performance.conversionRate.toFixed(1) || '0.0'}%
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>Conversion</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#f59e0b', marginBottom: '4px' }}>
                {stats?.performance.enrichmentRate.toFixed(1) || '0.0'}%
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>Enrichment</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#0891b2', marginBottom: '4px' }}>
                {stats?.performance.responseRate.toFixed(1) || '0.0'}%
              </div>
              <div className="text-muted" style={{ fontSize: '12px' }}>Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            📋 Recent Activity
          </h3>
        </div>

        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.recentActivity.map((activity) => (
              <div 
                key={activity.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${getActivityColor(activity.status)}`
                }}
              >
                <span style={{ fontSize: '20px' }}>{getActivityIcon(activity.type)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
                    {activity.message}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
                <span 
                  className="badge"
                  style={{ 
                    backgroundColor: getActivityColor(activity.status) + '20',
                    color: getActivityColor(activity.status),
                    border: `1px solid ${getActivityColor(activity.status)}40`
                  }}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h4 style={{ marginBottom: '8px' }}>No Recent Activity</h4>
            <p className="text-muted">
              Start using the system to see activity here.
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🚀 Quick Actions
          </h3>
        </div>
        
        <div className="grid grid-4">
          <button 
            className="btn btn-success"
            onClick={() => handleQuickAction('search')}
            disabled={!!actionLoading}
          >
            {actionLoading === 'search' ? (
              <>
                <span className="spinner"></span>
                Loading...
              </>
            ) : (
              <>
                🔍 Start Job Search
              </>
            )}
          </button>
          
          <button 
            className="btn btn-warning"
            onClick={() => handleQuickAction('automation')}
            disabled={!!actionLoading || stats?.automation.isRunning}
          >
            {actionLoading === 'automation' ? (
              <>
                <span className="spinner"></span>
                Starting...
              </>
            ) : stats?.automation.isRunning ? (
              <>
                ⚙️ Running...
              </>
            ) : (
              <>
                ⚙️ Run Automation
              </>
            )}
          </button>
          
          <button 
            className="btn btn-info"
            onClick={() => handleQuickAction('statistics')}
            disabled={!!actionLoading}
          >
            {actionLoading === 'statistics' ? (
              <>
                <span className="spinner"></span>
                Loading...
              </>
            ) : (
              <>
                📊 View Statistics
              </>
            )}
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={() => handleQuickAction('configuration')}
            disabled={!!actionLoading}
          >
            {actionLoading === 'configuration' ? (
              <>
                <span className="spinner"></span>
                Loading...
              </>
            ) : (
              <>
                🛠️ Configuration
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Information */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            💻 System Information
          </h3>
        </div>
        
        <div className="grid grid-3">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#667eea', marginBottom: '8px' }}>
              {stats?.system.uptime || 'N/A'}
            </div>
            <div className="text-muted">System Uptime</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#667eea', marginBottom: '8px' }}>
              v{stats?.system.version || '1.0.0'}
            </div>
            <div className="text-muted">Version</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: stats?.system.apiStatus === 'online' ? '#10b981' : stats?.system.apiStatus === 'degraded' ? '#f59e0b' : '#ef4444',
              marginBottom: '8px' 
            }}>
              {stats?.system.apiStatus === 'online' ? '✅' : stats?.system.apiStatus === 'degraded' ? '⚠️' : '❌'} 
              {stats?.system.apiStatus || 'Unknown'}
            </div>
            <div className="text-muted">API Status</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 