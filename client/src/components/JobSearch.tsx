import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  externalUrl: string;
  applicationDeadline: string;
  publishedDate: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface SearchParams {
  keywords: string;
  location: string;
  radius: number;
  size: number;
  publishedSince: string;
  employmentType: string;
}

const JobSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    keywords: 'software',
    location: 'Berlin',
    radius: 50,
    size: 5,
    publishedSince: '30',
    employmentType: ''
  });
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [savingToSheets, setSavingToSheets] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState<string | null>(null);
  const [saveToSheetsAuto, setSaveToSheetsAuto] = useState(true);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newBlockedTerm, setNewBlockedTerm] = useState('');

  // Safely format dates to avoid crashing on invalid values
  const formatDate = (value?: string) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  // Load blacklist on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/config/blacklist');
        if (res.data.success) setBlacklist(res.data.data || []);
      } catch (e) {
        console.error('Failed to load blacklist', e);
      }
    })();
  }, []);

  const addBlockedTerm = async () => {
    const term = newBlockedTerm.trim();
    if (!term) return;
    try {
      const res = await api.post('/config/blacklist/add', { term });
      if (res.data.success) {
        setBlacklist(res.data.data);
        setNewBlockedTerm('');
      }
    } catch (e) {
      console.error('Failed to add term', e);
    }
  };

  const removeBlockedTerm = async (term: string) => {
    try {
      const res = await api.post('/config/blacklist/remove', { term });
      if (res.data.success) setBlacklist(res.data.data);
    } catch (e) {
      console.error('Failed to remove term', e);
    }
  };

  const isBlocked = (company?: string) => {
    if (!company) return false;
    const lower = company.toLowerCase();
    return blacklist.some(t => lower.includes(t));
  };

  const saveJobsToSheets = async (jobsToSave: Job[]) => {
    if (!jobsToSave || jobsToSave.length === 0) return;
    
    setSavingToSheets(true);
    try {
      console.log('Saving jobs to Google Sheets:', jobsToSave.length);
      
      const response = await api.post('/sheets/save-jobs', {
        jobs: jobsToSave,
        searchParams: searchParams
      });
      
      if (response.data.success) {
        console.log('Jobs saved to Google Sheets successfully');
        // You could show a success toast here
      } else {
        console.error('Failed to save to Google Sheets:', response.data.message);
      }
    } catch (error: any) {
      console.error('Error saving to Google Sheets:', error.response?.data?.message || error.message);
    } finally {
      setSavingToSheets(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting job search with params:', searchParams);
      
      const response = await api.post('/jobs/search', {
        ...searchParams,
        publishedSince: parseInt(searchParams.publishedSince)
      });
      
      console.log('API response received:', response.data);
      
      if (response.data.success) {
        console.log('Search successful, jobs found:', response.data.data.jobs?.length || 0);
        // Client-side hide blacklisted companies as well (UX)
        const items: Job[] = response.data.data.jobs || [];
        const visible = items.filter(j => !isBlocked(j.company));
        setJobs(visible);
        setLastSearchTime(new Date().toLocaleString());
        setSelectedJobs(new Set());
        
        // Auto-save to Google Sheets if enabled
        if (saveToSheetsAuto && response.data.data.jobs?.length > 0) {
          await saveJobsToSheets(visible);
        }
      } else {
        console.error('Search failed:', response.data.message);
        setError(response.data.message || 'Search failed');
        setJobs([]);
      }
    } catch (err: any) {
      console.error('Search error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.message || 'Failed to search jobs. Check API configuration.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToSheets = async () => {
    const jobsToSave = jobs.filter(job => selectedJobs.has(job.id));
    
    if (jobsToSave.length === 0) {
      setError('Please select jobs to save');
      return;
    }

    setSavingToSheets(true);
    setError(null);

    try {
      const response = await api.post('/sheets/save-jobs', {
        jobs: jobsToSave
      });

      if (response.data.success) {
        alert(`Successfully saved ${jobsToSave.length} jobs to Google Sheets!`);
        setSelectedJobs(new Set());
      } else {
        setError(response.data.message || 'Failed to save to Google Sheets');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.message || 'Failed to save to Google Sheets. Check configuration.');
    } finally {
      setSavingToSheets(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${type} copied to clipboard: ${text}`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`${type} copied to clipboard: ${text}`);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const selectAllJobs = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map(job => job.id)));
    }
  };

  return (
    <div>
      {/* Search Form */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            🔍 Job Search
          </h2>
        </div>

        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Keywords</label>
            <input
              type="text"
              className="form-input"
              value={searchParams.keywords}
              onChange={(e) => setSearchParams({...searchParams, keywords: e.target.value})}
              placeholder="Try: Pflege (nursing), Lehrer (teacher), Koch (cook), Fahrer (driver)"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              className="form-input"
              value={searchParams.location}
              onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
              placeholder="e.g. Berlin, Hamburg, Frankfurt, Cologne"
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              💡 <strong>Use German terms for better results:</strong><br/>
              🇬🇧 Nurse → 🇩🇪 Pflege | Teacher → Lehrer | Cook → Koch | Driver → Fahrer | Engineer → Ingenieur
            </div>
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
              <option value={200}>200 km</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Number of Results</label>
            <select
              className="form-select"
              value={searchParams.size}
              onChange={(e) => setSearchParams({...searchParams, size: parseInt(e.target.value)})}
            >
              <option value={1}>1 job (for testing)</option>
              <option value={5}>5 jobs</option>
              <option value={10}>10 jobs</option>
              <option value={20}>20 jobs</option>
              <option value={50}>50 jobs</option>
              <option value={100}>100 jobs</option>
              <option value={200}>200 jobs</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Published Since</label>
            <select
              className="form-select"
              value={searchParams.publishedSince}
              onChange={(e) => setSearchParams({...searchParams, publishedSince: e.target.value})}
            >
              <option value="1">Last 24 hours</option>
              <option value="3">Last 3 days</option>
              <option value="7">Last week</option>
              <option value="14">Last 2 weeks</option>
              <option value="30">Last month</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <select
              className="form-select"
              value={searchParams.employmentType}
              onChange={(e) => setSearchParams({...searchParams, employmentType: e.target.value})}
            >
              <option value="">All types</option>
              <option value="VOLLZEIT">Full-time</option>
              <option value="TEILZEIT">Part-time</option>
              <option value="AUSBILDUNG">Apprenticeship</option>
              <option value="PRAKTIKUM">Internship</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={saveToSheetsAuto}
              onChange={(e) => setSaveToSheetsAuto(e.target.checked)}
            />
            📊 Auto-save results to Google Sheets
          </label>
        </div>

        {/* Blacklist Manager */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3 className="card-title">🚫 Company blacklist</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add term, e.g. Zeitarbeit"
              value={newBlockedTerm}
              onChange={(e) => setNewBlockedTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addBlockedTerm(); }}
            />
            <button className="btn btn-secondary" onClick={addBlockedTerm}>Add</button>
          </div>
          {blacklist.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {blacklist.map(term => (
                <span key={term} className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {term}
                  <button className="btn btn-xs" onClick={() => removeBlockedTerm(term)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
          <button 
            className="btn btn-success"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Searching...
              </>
            ) : (
              <>
                🔍 Search Jobs
              </>
            )}
          </button>

          {jobs.length > 0 && (
            <button 
              className="btn btn-warning"
              onClick={handleSaveToSheets}
              disabled={savingToSheets || selectedJobs.size === 0}
            >
              {savingToSheets ? (
                <>
                  <span className="spinner"></span>
                  Saving to Sheets...
                </>
              ) : (
                <>
                  📊 Save Selected to Sheets ({selectedJobs.size})
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '16px' }}>
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {lastSearchTime && (
          <div className="alert alert-info" style={{ marginTop: '16px' }}>
            <strong>ℹ️ Last search:</strong> {lastSearchTime} • Found {jobs.length} jobs
          </div>
        )}
      </div>

      {/* Results */}
      {jobs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              📋 Search Results ({jobs.length} jobs)
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={selectAllJobs}
              >
                {selectedJobs.size === jobs.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="badge badge-info">
                {selectedJobs.size} selected
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {jobs.map((job) => (
              <div 
                key={job.id}
                className="card"
                style={{ 
                  cursor: 'pointer',
                  border: selectedJobs.has(job.id) ? '2px solid #667eea' : '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: selectedJobs.has(job.id) ? 'rgba(102, 126, 234, 0.05)' : undefined
                }}
                onClick={() => toggleJobSelection(job.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                      {job.title}
                    </h4>
                    <p style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#667eea', fontWeight: '500' }}>
                      🏢 {job.company}
                    </p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                      📍 {job.location}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedJobs.has(job.id) && (
                      <span className="badge badge-success">Selected</span>
                    )}
                    <input 
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => toggleJobSelection(job.id)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {job.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>📅 {formatDate(job.publishedDate)}</span>
                    {job.applicationDeadline && (
                      <span>⏰ Deadline: {formatDate(job.applicationDeadline)}</span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Contacts summary */}
                    <span className="badge" style={{ background: '#111827', border: '1px solid #374151' }}>
                      {job.contactEmail ? '📧 Email' : job.contactPhone ? '📞 Phone' : job.externalUrl ? '🔗 External link' : '—'}
                    </span>
                    {job.contactEmail && (
                      <span 
                        className="badge badge-info badge-clickable" 
                        title="Click to copy email to clipboard" 
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(job.contactEmail!, 'Email');
                        }} 
                        style={{ cursor: 'pointer' }}
                      >
                        📧 {job.contactEmail}
                      </span>
                    )}
                    {job.contactPhone && (
                      <span 
                        className="badge badge-info badge-clickable" 
                        title="Click to copy phone to clipboard"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(job.contactPhone!, 'Phone');
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        📞 {job.contactPhone}
                      </span>
                    )}
                    <a 
                      href={job.externalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 View Job
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && lastSearchTime && (
        <div className="card text-center">
          <div style={{ padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ marginBottom: '8px' }}>No Jobs Found</h3>
            <p className="text-muted">
              Try adjusting your search criteria or expanding the search radius.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobSearch; 