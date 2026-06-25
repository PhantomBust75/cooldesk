'use client';

import { searchJobs } from '@/lib/api/search';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  scheduled: { color: '#3B82F6', background: 'rgba(59,130,246,0.1)' },
  in_progress: { color: '#10B981', background: 'rgba(16,185,129,0.1)' },
  pending: { color: '#F59E0B', background: 'rgba(245,158,11,0.1)' },
  needs_revisit: { color: '#EF4444', background: 'rgba(239,68,68,0.1)' },
  completed: { color: '#10B981', background: 'rgba(16,185,129,0.1)' },
  cancelled: { color: '#EF4444', background: 'rgba(239,68,68,0.1)' },
};

function getStatusColors(status: string) {
  return STATUS_COLORS[status] ?? { color: '#737373', background: '#F5F5F5' };
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Reset query when modal opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  // Debounce query updates (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchJobs(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30_000,
  });

  const results = data?.jobs ?? [];

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
            <Search size={16} strokeWidth={1.5} style={{ color: '#737373', flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, customers…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#171717', backgroundColor: 'transparent' }}
            />
            <button type="button" onClick={onClose} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#737373', padding: 0, display: 'inline-flex' }}>
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Results */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {isFetching ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>Searching…</div>
            ) : debouncedQuery.trim() && results.length === 0 ? (
              <div style={{ padding: '16px', fontSize: '13px', color: '#737373' }}>No results for &quot;{query}&quot;</div>
            ) : results.length > 0 ? (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jobs</div>
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
                      <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '9999px', backgroundColor: colors.background, color: colors.color }}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px 16px', fontSize: '13px', color: '#737373', textAlign: 'center' }}>
                Type to search jobs and customers
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
