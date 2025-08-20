import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface JobStatistics {
  total: number;
  byStatus: {
    new: number;
    enriched: number;
    inCampaign: number;
    converted: number;
    error: number;
  };
  byDate: Array<{
    date: string;
    count: number;
    conversions: number;
  }>;
  conversionRate: number;
  topCompanies: Array<{
    name: string;
    count: number;
  }>;
  topLocations: Array<{
    name: string;
    count: number;
  }>;
  automationStats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgJobsPerRun: number;
    avgEnrichmentRate: number;
    avgConversionRate: number;
  };
}

interface TrendData {
  period: string;
  value: number;
  change: number;
}

const Statistics: React.FC = () => {
  const [stats, setStats] = useState<JobStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30'); // days
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Restore last stats from localStorage immediately for better UX
    try {
      const cached = localStorage.getItem('dashboard_stats_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as JobStatistics;
        setStats(parsed);
        setLoading(false);
      }
    } catch {}

    fetchStatistics();
    const interval = setInterval(() => {
      fetchStatistics(true); // Silent refresh
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchStatistics = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const response = await api.get(`/sheets/stats?days=${timeRange}`);
      const automationResponse = await api.get('/automation/status');
      
      // Use real data from API with fallbacks
      const realStats: JobStatistics = {
        total: response.data.data?.totalJobs || 0,
        byStatus: response.data.data?.byStatus || {
          new: 0,
          enriched: 0,
          inCampaign: 0,
          converted: 0,
          error: 0
        },
        byDate: response.data.data?.byDate || [],
        conversionRate: parseFloat(response.data.data?.conversionRate || '0'),
        topCompanies: response.data.data?.topCompanies || [],
        topLocations: response.data.data?.topLocations || [],
        automationStats: {
          totalRuns: automationResponse.data?.data?.stats?.totalRuns || 0,
          successfulRuns: automationResponse.data?.data?.stats?.successfulRuns || 0,
          failedRuns: automationResponse.data?.data?.stats?.failedRuns || 0,
          avgJobsPerRun: automationResponse.data?.data?.stats?.avgJobsPerRun || 0,
          avgEnrichmentRate: automationResponse.data?.data?.stats?.avgEnrichmentRate || 0,
          avgConversionRate: automationResponse.data?.data?.stats?.avgConversionRate || 0
        }
      };

      setStats(realStats);
      setError(null);

      // Cache to localStorage for persistence across reloads
      try { localStorage.setItem('dashboard_stats_cache', JSON.stringify(realStats)); } catch {}
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err);
      if (!silent) {
        setError('Failed to load statistics');
        // Keep any cached stats already shown; if none, set defaults
        if (!stats) {
        setStats({
          total: 0,
          byStatus: { new: 0, enriched: 0, inCampaign: 0, converted: 0, error: 0 },
          byDate: [],
          conversionRate: 0,
          topCompanies: [],
          topLocations: [],
          automationStats: {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            avgJobsPerRun: 0,
            avgEnrichmentRate: 0,
            avgConversionRate: 0
          }
        });
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };



  const calculateTrend = (data: Array<{count: number}>): TrendData => {
    if (data.length < 2) return { period: timeRange + ' days', value: 0, change: 0 };
    
    const recent = data.slice(-7).reduce((sum, item) => sum + item.count, 0) / 7;
    const previous = data.slice(-14, -7).reduce((sum, item) => sum + item.count, 0) / 7;
    const change = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
    
    return {
      period: timeRange + ' days',
      value: recent,
      change: Math.round(change * 10) / 10
    };
  };

  const renderMiniChart = (data: Array<{count: number}>, color: string) => {
    if (data.length === 0) return null;
    
    const max = Math.max(...data.map(d => d.count));
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.count / max) * 100);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg 
        width="100" 
        height="40" 
        style={{ position: 'absolute', bottom: '10px', right: '10px', opacity: 0.7 }}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="card text-center">
        <div className="spinner-lg" style={{ margin: '40px auto' }}></div>
        <p className="text-muted">Loading statistics...</p>
      </div>
    );
  }

  const trend = stats?.byDate ? calculateTrend(stats.byDate) : { period: '', value: 0, change: 0 };

  return (
    <div>
      {/* Controls */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            📈 System Statistics
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {refreshing && <span className="spinner"></span>}
            <select
              className="form-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              style={{ width: 'auto', minWidth: '120px' }}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 2 weeks</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-warning">
            <strong>⚠️ Notice:</strong> {error}
            <br />
            <small>Some statistics may be based on sample data. Configure Google Sheets for real metrics.</small>
          </div>
        )}
      </div>

      {/* Key Metrics Overview */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            🎯 Key Performance Indicators
          </h3>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ position: 'relative' }}>
            <div className="stat-value">{stats?.total || 0}</div>
            <div className="stat-label">Total Jobs Processed</div>
            {stats?.byDate && renderMiniChart(stats.byDate, '#667eea')}
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>
              {stats?.byStatus.converted || 0}
            </div>
            <div className="stat-label">Converted Leads</div>
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {stats?.conversionRate.toFixed(1) || '0.0'}%
            </div>
            <div className="stat-label">Conversion Rate</div>
          </div>

          <div className="stat-card">
            <div className="stat-value" style={{ color: '#0891b2' }}>
              {trend.value.toFixed(1)}
            </div>
            <div className="stat-label">
              Avg Jobs/Day
              <div style={{ 
                fontSize: '12px', 
                color: trend.change >= 0 ? '#10b981' : '#ef4444',
                marginTop: '4px'
              }}>
                {trend.change >= 0 ? '↗' : '↘'} {Math.abs(trend.change)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Pipeline Flow */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              🔄 Pipeline Flow
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { key: 'new', label: 'New Jobs', color: '#6b7280', icon: '📝' },
              { key: 'enriched', label: 'Enriched', color: '#0891b2', icon: '✨' },
              { key: 'inCampaign', label: 'In Campaign', color: '#f59e0b', icon: '📧' },
              { key: 'converted', label: 'Converted', color: '#10b981', icon: '💰' },
              { key: 'error', label: 'Errors', color: '#ef4444', icon: '❌' }
            ].map((status) => {
              const count = stats?.byStatus[status.key as keyof typeof stats.byStatus] || 0;
              const percentage = stats?.total ? (count / stats.total) * 100 : 0;
              
              return (
                <div key={status.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: status.color + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    {status.icon}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500' }}>{status.label}</span>
                      <span style={{ fontWeight: '600' }}>{count}</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#f3f4f6', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        backgroundColor: status.color,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {percentage.toFixed(1)}% of total
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Automation Performance */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              ⚙️ Automation Performance
            </h3>
          </div>

          <div className="stats-grid">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#667eea', marginBottom: '8px' }}>
                {stats?.automationStats.totalRuns || 0}
              </div>
              <div className="text-muted">Total Runs</div>
            </div>

                         <div style={{ textAlign: 'center' }}>
               <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                 {stats?.automationStats && stats.automationStats.totalRuns > 0 
                   ? Math.round(((stats.automationStats.successfulRuns || 0) / stats.automationStats.totalRuns) * 100)
                   : 0}%
               </div>
               <div className="text-muted">Success Rate</div>
             </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b', marginBottom: '8px' }}>
                {stats?.automationStats.avgJobsPerRun?.toFixed(1) || '0.0'}
              </div>
              <div className="text-muted">Avg Jobs/Run</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#0891b2', marginBottom: '8px' }}>
                {stats?.automationStats.avgEnrichmentRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-muted">Enrichment Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Analysis */}
      {stats?.byDate && stats.byDate.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📊 Daily Activity Trend
            </h3>
          </div>

          <div style={{ 
            height: '300px', 
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '12px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line
                  key={y}
                  x1="60"
                  y1={`${20 + (y * 2.4)}%`}
                  x2="95%"
                  y2={`${20 + (y * 2.4)}%`}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              
              {/* Trend line */}
              {stats.byDate.length > 1 && (() => {
                const maxJobs = Math.max(...stats.byDate.map(d => d.count));
                const points = stats.byDate.map((d, i) => {
                  const x = 60 + ((i / (stats.byDate.length - 1)) * 35);
                  const y = 80 - ((d.count / maxJobs) * 60);
                  return `${x}%,${y}%`;
                }).join(' ');

                return (
                  <>
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#667eea"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Data points */}
                    {stats.byDate.map((d, i) => {
                      const x = 60 + ((i / (stats.byDate.length - 1)) * 35);
                      const y = 80 - ((d.count / maxJobs) * 60);
                      return (
                        <circle
                          key={i}
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="4"
                          fill="#667eea"
                          stroke="#fff"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </>
                );
              })()}
              
              {/* Labels */}
              <text x="30" y="20%" fill="#6b7280" fontSize="12" textAnchor="middle">Jobs</text>
              <text x="30" y="40%" fill="#6b7280" fontSize="12" textAnchor="middle">{Math.max(...(stats?.byDate.map(d => d.count) || [0]))}</text>
              <text x="30" y="80%" fill="#6b7280" fontSize="12" textAnchor="middle">0</text>
            </svg>
            
            <div style={{ 
              position: 'absolute', 
              bottom: '10px', 
              left: '60px', 
              right: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#6b7280'
            }}>
              {stats.byDate.slice(0, 7).map((d, i) => (
                <span key={i}>
                  {new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {/* Top Companies */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              🏢 Top Companies
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(stats?.topCompanies || []).map((company, index) => (
              <div 
                key={company.name}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: index === 0 ? 'linear-gradient(135deg, #667eea20, #764ba220)' : '#f8fafc',
                  borderRadius: '8px',
                  border: index === 0 ? '2px solid #667eea40' : '1px solid #e5e7eb'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    backgroundColor: '#667eea',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {index + 1}
                  </div>
                  <span style={{ fontWeight: '500' }}>{company.name}</span>
                </div>
                <span className="badge badge-info">{company.count} jobs</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Locations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📍 Top Locations
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(stats?.topLocations || []).map((location, index) => {
              const total = stats?.topLocations?.reduce((sum, l) => sum + l.count, 0) || 1;
              const percentage = (location.count / total) * 100;
              
              return (
                <div key={location.name} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '500' }}>{location.name}</span>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {location.count} ({percentage.toFixed(1)}%)
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
                      width: `${percentage}%`, 
                      height: '100%', 
                      background: `linear-gradient(135deg, #667eea, #764ba2)`,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            📋 Export & Reports
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary"
            onClick={() => {
              try {
                if (!stats) { alert('No data to export'); return; }
                const escape = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
                const lines: string[] = [];
                lines.push('Section,Metric,Value');
                lines.push(`Summary,Total Jobs,${escape(stats.total)}`);
                lines.push(`Summary,Conversion Rate,${escape(stats.conversionRate)}%`);
                lines.push('');
                lines.push('Top Companies,Count');
                (stats.topCompanies || []).forEach(c => lines.push(`${escape(c.name)},${escape(c.count)}`));
                lines.push('');
                lines.push('Top Locations,Count');
                (stats.topLocations || []).forEach(l => lines.push(`${escape(l.name)},${escape(l.count)}`));
                lines.push('');
                lines.push('By Date,Jobs,Conversions');
                (stats.byDate || []).forEach(d => lines.push(`${escape(d.date)},${escape(d.count)},${escape(d.conversions)}`));
                const csv = lines.join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dashboard_stats_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (e) {
                console.error('Export failed', e);
                alert('Export failed');
              }
            }}
          >
            📊 Export to Excel
          </button>
          
          <button className="btn btn-secondary"
            onClick={() => {
              try {
                window.print();
              } catch (e) {
                console.error('PDF generation failed', e);
                alert('PDF generation failed');
              }
            }}
          >
            📄 Generate PDF Report
          </button>
          
          <button className="btn btn-secondary"
            onClick={async () => {
              try {
                const shareUrl = window.location.href;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(shareUrl);
                  alert('Dashboard link copied to clipboard');
                } else {
                  const input = document.createElement('input');
                  input.value = shareUrl;
                  document.body.appendChild(input);
                  input.select();
                  document.execCommand('copy');
                  document.body.removeChild(input);
                  alert('Dashboard link copied to clipboard');
                }
              } catch (e) {
                console.error('Share failed', e);
                alert('Share failed');
              }
            }}
          >
            📈 Share Dashboard
          </button>
          
          <button 
            className="btn btn-info"
            onClick={() => fetchStatistics()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Refreshing...
              </>
            ) : (
              <>
                🔄 Refresh Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Statistics; 