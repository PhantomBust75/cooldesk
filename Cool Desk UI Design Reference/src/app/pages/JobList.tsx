import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Filter, X, Search, ChevronRight } from 'lucide-react';
import { mockJobs, type JobStatus, type JobType } from '../data/mockData';
import { StatusChip } from '../components/ui/StatusChip';
import { JobTypeChip, SourceChip, BrandSwatch, TagChip } from '../components/ui/JobTypeChip';

const ALL_STATUSES: JobStatus[] = [
  'pending_schedule', 'scheduled', 'assigned', 'acknowledged',
  'in_transit', 'in_process', 'completed', 'new', 'resolved',
  'needs_revisit', 'revisit_scheduled', 'resolved_on_revisit',
  'cancellation_requested', 'cancelled',
];

const ALL_BRANDS = [...new Set(mockJobs.map(j => j.brand_name))].sort();

/* ── Animated filter panel ───────────────────────────────────── */
function FilterPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Measure real content height so the transition always feels tight
  useEffect(() => {
    if (innerRef.current) setHeight(innerRef.current.scrollHeight);
  }, [open]);

  return (
    <div
      style={{
        overflow: 'hidden',
        maxHeight: open ? `${height}px` : '0px',
        opacity: open ? 1 : 0,
        marginTop: open ? '10px' : '0px',
        transition: [
          'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          'opacity 200ms ease',
          'margin-top 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        ].join(', '),
      }}
    >
      {/* Inner div with a slight upward-slide on close */}
      <div
        ref={innerRef}
        style={{
          transform: open ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function JobList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const statusFilter = searchParams.get('status') || '';
  const typeFilter   = searchParams.get('type')   || '';
  const brandFilter  = searchParams.get('brand')  || '';
  const chronicFilter = searchParams.get('chronic') === 'true';

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  const clearFilters = () => setSearchParams({});

  const filtered = mockJobs.filter(job => {
    if (statusFilter  && job.status    !== statusFilter)             return false;
    if (typeFilter    && job.type      !== (typeFilter as JobType))  return false;
    if (brandFilter   && job.brand_name !== brandFilter)             return false;
    if (chronicFilter && !job.is_chronic)                            return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        job.customer_name.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q) ||
        job.brand_name.toLowerCase().includes(q) ||
        (job.technician_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const hasFilters = !!(statusFilter || typeFilter || brandFilter || chronicFilter);

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: '13px',
    border: '1px solid #E5E5E5', borderRadius: '8px', outline: 'none',
    backgroundColor: '#fff', color: '#404040', cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 500, color: '#A3A3A3',
    display: 'block', marginBottom: '5px', letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>All jobs</h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>
            {filtered.length} jobs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowFilters(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
              borderRadius: '8px',
              border: `1px solid ${showFilters ? '#0A0A0A' : '#E5E5E5'}`,
              backgroundColor: showFilters ? '#0A0A0A' : '#fff',
              color: showFilters ? '#fff' : '#404040',
              cursor: 'pointer', fontSize: '13px',
              transition: 'border-color 180ms ease, background-color 180ms ease, color 180ms ease',
            }}
          >
            <Filter size={14} strokeWidth={1.5} />
            Filters
            {hasFilters && (
              <span style={{
                backgroundColor: showFilters ? 'rgba(255,255,255,0.25)' : '#0A0A0A',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: '10px', padding: '1px 6px', fontWeight: 600,
                minWidth: '16px', textAlign: 'center',
              }}>
                {[statusFilter, typeFilter, brandFilter, chronicFilter ? 'c' : ''].filter(Boolean).length}
              </span>
            )}
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px',
                borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff',
                cursor: 'pointer', fontSize: '13px', color: '#404040',
              }}
            >
              <X size={13} strokeWidth={1.5} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={14} strokeWidth={1.5} style={{
          position: 'absolute', left: '10px', top: '50%',
          transform: 'translateY(-50%)', color: '#A3A3A3',
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, job ID, brand…"
          style={{
            width: '100%', padding: '8px 12px 8px 32px',
            border: '1px solid #E5E5E5', borderRadius: '8px',
            fontSize: '13px', outline: 'none', color: '#171717',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = '#0A0A0A')}
          onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
        />
      </div>

      {/* Animated filter panel */}
      <FilterPanel open={showFilters}>
        <div style={{
          display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end',
          padding: '14px 16px',
          backgroundColor: '#FAFAFA',
          borderRadius: '8px', border: '1px solid #E5E5E5',
        }}>
          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select value={statusFilter} onChange={e => setFilter('status', e.target.value)} style={selectStyle}>
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Type</label>
            <select value={typeFilter} onChange={e => setFilter('type', e.target.value)} style={selectStyle}>
              <option value="">All types</option>
              <option value="installation">Installation</option>
              <option value="complaint">Complaint</option>
            </select>
          </div>

          {/* Brand */}
          <div>
            <label style={labelStyle}>Brand</label>
            <select value={brandFilter} onChange={e => setFilter('brand', e.target.value)} style={selectStyle}>
              <option value="">All brands</option>
              {ALL_BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Chronic */}
          <div style={{ paddingBottom: '2px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#404040', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={chronicFilter}
                onChange={e => setFilter('chronic', e.target.checked ? 'true' : '')}
                style={{ accentColor: '#0A0A0A', width: '14px', height: '14px' }}
              />
              Chronic only
            </label>
          </div>
        </div>
      </FilterPanel>

      {/* Table */}
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px',
        border: '1px solid #E5E5E5', overflow: 'hidden',
        marginTop: '16px',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#737373' }}>
            <Search size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#404040' }}>No jobs match your filters.</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Try adjusting your search or clearing filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                  {['Job ID', 'Customer', 'Phone', 'Type', 'Source', 'Brand', 'Technician', 'Scheduled', 'Status', 'Tags', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: '11px', fontWeight: 500, color: '#A3A3A3',
                      whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    style={{ borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    onClick={() => window.location.assign(`/jobs/${job.id}`)}
                  >
                    <td style={{
                      padding: '14px 16px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px', color: '#171717', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {job.id.replace('j-', '')}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#171717', whiteSpace: 'nowrap', fontSize: '14px' }}>
                      {job.customer_name}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#525252', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                      {job.phone}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <JobTypeChip type={job.type} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <SourceChip source={job.source} dealerName={job.dealer_name} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <BrandSwatch name={job.brand_name} colorHex={job.brand_color} />
                    </td>
                    <td style={{ padding: '14px 16px', color: '#404040', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {job.technician_name || <span style={{ color: '#A3A3A3', fontStyle: 'italic' }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#525252', fontSize: '13px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {job.scheduled_at
                        ? new Date(job.scheduled_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : <span style={{ color: '#A3A3A3' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusChip status={job.status} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {job.is_chronic  && <TagChip label="Chronic"  variant="chronic"  />}
                        {job.is_frequent && <TagChip label="Frequent" variant="frequent" />}
                        {job.is_repeat && !job.is_frequent && <TagChip label="Repeat" variant="repeat" />}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <ChevronRight size={16} strokeWidth={1.5} color="#A3A3A3" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}