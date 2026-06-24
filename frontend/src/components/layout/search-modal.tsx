'use client';

import { searchJobs, SearchJobResult } from '@/lib/api/search';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: '#DBEAFE', color: '#1E40AF' },
  in_progress: { bg: '#D1FAE5', color: '#065F46' },
  pending: { bg: '#F5F5F5', color: '#525252' },
  needs_revisit: { bg: '#FEE2E2', color: '#991B1B' },
  completed: { bg: '#F0FDF4', color: '#166534' },
  cancelled: { bg: '#F5F5F5', color: '#737373' },
};

function getStatusColors(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#F5F5F5', color: '#525252' };
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchJobResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchJobs(query.trim());
        setResults(res.jobs);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 201, width: '100%', maxWidth: '560px', padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', boxShadow: '0 16px 48px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E5E5', gap: '10px' }}>
            <Search size={16} strokeWidth={1.5} style={{ color: '#A3A3A3', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, customers…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#171717', backgroundColor: 'transparent' }}
            />
            <button type="button" onClick={onClose} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#A3A3A3', padding: 0, display: 'inline-flex' }}>
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Results */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>Searching…</div>
            ) : query.trim() && results.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>No results for &quot;{query}&quot;</div>
            ) : results.length > 0 ? (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jobs</div>
                {results.map((job) => {
                  const colors = getStatusColors(job.status);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => { router.push(`/jobs/${job.id}`); onClose(); }}
                      style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', gap: '12px' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FAFAFA'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#525252', flexShrink: 0 }}>{job.id}</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#171717', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.customerName}</span>
                      <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '9999px', backgroundColor: colors.bg, color: colors.color }}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#A3A3A3', textAlign: 'center' }}>
                Type to search jobs and customers
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
