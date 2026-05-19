import { useState } from 'react';
import { Plus, Edit, X, Save } from 'lucide-react';
import { mockDealers, mockBrands, type Dealer } from '../data/mockData';
import { DealerProfileOverlay } from '../components/dealers/DealerProfileOverlay';

/* ── Avatar helpers ──────────────────────────────────────────── */
const PALETTE = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#DBEAFE', text: '#1E40AF' },
];
function avatarColors(name: string) { return PALETTE[name.charCodeAt(0) % PALETTE.length]; }
function dealerInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

/* ── Status toggle switch ────────────────────────────────────── */
function StatusToggle({ isActive, onToggle }: { isActive: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        backgroundColor: '#EBEBEB',
        borderRadius: '9999px',
        padding: '3px',
        gap: '2px',
      }}
    >
      <button
        onClick={isActive ? undefined : onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '9999px', border: 'none',
          backgroundColor: isActive ? '#ECFDF5' : 'transparent',
          cursor: isActive ? 'default' : 'pointer',
          fontSize: '12px', fontWeight: 500,
          color: isActive ? '#065F46' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: isActive ? '#34D399' : 'transparent',
          transition: 'background-color 180ms',
        }} />
        Active
      </button>
      <button
        onClick={!isActive ? undefined : onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '9999px', border: 'none',
          backgroundColor: !isActive ? '#F1F5F9' : 'transparent',
          cursor: !isActive ? 'default' : 'pointer',
          fontSize: '12px', fontWeight: 500,
          color: !isActive ? '#475569' : '#A3A3A3',
          transition: 'background-color 180ms, color 180ms',
        }}
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: !isActive ? '#94A3B8' : 'transparent',
          transition: 'background-color 180ms',
        }} />
        Inactive
      </button>
    </div>
  );
}

/* ── Dealer Form modal ───────────────────────────────────────── */
function DealerForm({ dealer, onClose }: { dealer?: Dealer | null; onClose: () => void }) {
  const [form, setForm] = useState({
    business_name: dealer?.business_name || '',
    contact_name: dealer?.contact_name || '',
    email: dealer?.email || '',
    region: dealer?.region || '',
    brand_ids: dealer?.brand_ids || [] as string[],
    password: '',
  });

  const toggleBrand = (id: string) => {
    setForm(f => ({
      ...f,
      brand_ids: f.brand_ids.includes(id) ? f.brand_ids.filter(b => b !== id) : [...f.brand_ids, id],
    }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '520px', maxWidth: '95vw', boxShadow: '0 10px 38px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#171717' }}>{dealer ? 'Edit dealer' : 'Add new dealer'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0 }}><X size={18} strokeWidth={1.5} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
          {[
            { key: 'business_name', label: 'Business name', type: 'text', req: true },
            { key: 'contact_name', label: 'Contact name', type: 'text', req: true },
            { key: 'email', label: 'Email address', type: 'email', req: true },
            { key: 'region', label: 'Region', type: 'text', req: false },
          ].map(field => (
            <div key={field.key}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
                {field.label} {field.req && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              <input
                type={field.type}
                value={(form as Record<string, string>)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#171717', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = '#A3A3A3')}
                onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
              />
            </div>
          ))}
          {!dealer && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
                Initial password <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#171717', fontFamily: 'inherit' }}
                placeholder="Min. 8 characters"
                onFocus={e => (e.target.style.borderColor = '#A3A3A3')}
                onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
              />
              {form.password.length > 0 && form.password.length < 8 && (
                <p style={{ fontSize: '12px', color: '#991B1B', margin: '3px 0 0' }}>Password must be at least 8 characters</p>
              )}
            </div>
          )}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '8px' }}>Brand assignment</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {mockBrands.filter(b => b.is_active).map(brand => (
                <label key={brand.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #E5E5E5', cursor: 'pointer', fontSize: '13px', backgroundColor: form.brand_ids.includes(brand.id) ? '#FAFAFA' : '#fff' }}>
                  <input type="checkbox" checked={form.brand_ids.includes(brand.id)} onChange={() => toggleBrand(brand.id)} style={{ margin: 0 }} />
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: brand.colour_hex || '#A3A3A3', display: 'inline-block' }} />
                  {brand.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            <Save size={13} strokeWidth={1.5} /> {dealer ? 'Save changes' : 'Create dealer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Dealer Row ──────────────────────────────────────────────── */
interface DealerRowProps {
  dealer: Dealer;
  onRowClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
}
function DealerRow({ dealer, onRowClick, onToggle, onEdit }: DealerRowProps) {
  const av = avatarColors(dealer.business_name);

  return (
    <div
      onClick={onRowClick}
      style={{
        backgroundColor: '#fff', borderRadius: '12px', padding: '18px 20px',
        border: '1px solid #E5E5E5', cursor: 'pointer',
        opacity: dealer.is_active ? 1 : 0.6,
        display: 'flex', alignItems: 'center', gap: '16px',
        transition: 'box-shadow 140ms, border-color 140ms, opacity 200ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLElement).style.borderColor = '#D4D4D4';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5';
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '9999px',
        backgroundColor: av.bg, color: av.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0,
      }}>
        {dealerInitials(dealer.business_name)}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 500, color: '#171717' }}>{dealer.business_name}</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5', flexShrink: 0 }} />

      {/* Status toggle */}
      <div style={{ flexShrink: 0 }}>
        <StatusToggle isActive={dealer.is_active} onToggle={onToggle} />
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 10px', borderRadius: '8px',
          border: '1px solid #E5E5E5', backgroundColor: '#FAFAFA',
          cursor: 'pointer', fontSize: '12px', color: '#525252', flexShrink: 0,
          transition: 'background-color 120ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
      >
        <Edit size={12} strokeWidth={1.5} /> Edit
      </button>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export function DealerManagement() {
  const [dealers, setDealers] = useState(mockDealers);
  const [formOpen, setFormOpen] = useState(false);
  const [editDealer, setEditDealer] = useState<Dealer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleActive = (id: string) => {
    setDealers(d => d.map(dealer => dealer.id === id ? { ...dealer, is_active: !dealer.is_active } : dealer));
  };

  const selectedDealer = dealers.find(d => d.id === selectedId) ?? null;

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Dealer Management</h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>{dealers.length} dealers</p>
        </div>
        <button
          onClick={() => { setEditDealer(null); setFormOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: '#0A0A0A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
        >
          <Plus size={14} strokeWidth={1.5} /> Add dealer
        </button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {dealers.map(dealer => (
          <DealerRow
            key={dealer.id}
            dealer={dealer}
            onRowClick={() => setSelectedId(dealer.id)}
            onToggle={e => { e.stopPropagation(); toggleActive(dealer.id); }}
            onEdit={e => { e.stopPropagation(); setEditDealer(dealer); setFormOpen(true); }}
          />
        ))}
      </div>

      {formOpen && <DealerForm dealer={editDealer} onClose={() => setFormOpen(false)} />}

      {selectedDealer && (
        <DealerProfileOverlay
          dealer={selectedDealer}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleActive(selectedDealer.id)}
        />
      )}
    </div>
  );
}