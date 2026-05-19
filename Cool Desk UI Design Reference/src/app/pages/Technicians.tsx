import { useState } from 'react';
import { Users, Plus, X, UserCheck, AlertCircle } from 'lucide-react';
import { mockTechnicians, type Technician } from '../data/mockData';
import { TechnicianProfileOverlay } from '../components/technicians/TechnicianProfileOverlay';

/* ── Shared helpers ──────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
const PALETTE = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#DBEAFE', text: '#1E40AF' },
];
function avatarColors(name: string) {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
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

/* ── Add Technician modal ────────────────────────────────────── */
interface AddModalProps { onClose: () => void; onAdd: (t: Technician) => void; }
function AddTechnicianModal({ onClose, onAdd }: AddModalProps) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', region: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required';
    if (!form.region.trim()) e.region = 'Region is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    const newTech: Technician = {
      id: `t-${Date.now()}`, name: form.name.trim(),
      is_active: true, jobs_assigned: 0, on_time_rate: 0, avg_star_rating: 0,
    };
    onAdd(newTech); onClose();
  };

  const Field = ({ label, field, type = 'text', placeholder }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
        {label} <span style={{ color: '#EF4444' }}>*</span>
      </label>
      <input
        type={type} value={(form as Record<string, string>)[field]}
        onChange={e => set(field, e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px',
          border: `1px solid ${errors[field] ? '#FCA5A5' : '#E5E5E5'}`,
          borderRadius: '8px', fontSize: '13px', outline: 'none',
          fontFamily: 'inherit', color: '#171717', boxSizing: 'border-box', backgroundColor: '#fff',
        }}
        onFocus={e => { e.target.style.borderColor = '#A3A3A3'; }}
        onBlur={e => { e.target.style.borderColor = errors[field] ? '#FCA5A5' : '#E5E5E5'; }}
      />
      {errors[field] && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11px', color: '#EF4444' }}>
          <AlertCircle size={10} strokeWidth={2} />{errors[field]}
        </div>
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '14px', width: '460px', maxWidth: '95vw', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0A0A0A' }}>Add technician</div>
            <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>New account will be set to Active by default</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737373', lineHeight: 0, padding: '4px' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Full name" field="name" placeholder="e.g. Ahmed Al-Rashid" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone" field="phone" type="tel" placeholder="+966 50 000 0000" />
            <Field label="Region / Area" field="region" placeholder="e.g. Riyadh" />
          </div>
          <Field label="Email" field="email" type="email" placeholder="name@cooldesk.sa" />
        </div>
        <div style={{ padding: '0 22px 20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>Cancel</button>
          <button onClick={handleAdd} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <UserCheck size={13} strokeWidth={1.5} /> Create account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Technician Row ──────────────────────────────────────────── */
interface RowProps { tech: Technician; onClick: () => void; onToggle: (e: React.MouseEvent) => void; }
function TechRow({ tech, onClick, onToggle }: RowProps) {
  const av = avatarColors(tech.name);

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#fff', borderRadius: '12px', padding: '18px 20px',
        border: '1px solid #E5E5E5', cursor: 'pointer',
        opacity: tech.is_active ? 1 : 0.6,
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
        {initials(tech.name)}
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 500, color: '#171717' }}>{tech.name}</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '32px', backgroundColor: '#E5E5E5', flexShrink: 0 }} />

      {/* Status toggle */}
      <div style={{ flexShrink: 0 }}>
        <StatusToggle isActive={tech.is_active} onToggle={onToggle} />
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export function Technicians() {
  const [techs, setTechs] = useState<Technician[]>(mockTechnicians);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const activeCount = techs.filter(t => t.is_active).length;
  const selectedTech = techs.find(t => t.id === selectedId) ?? null;

  const toggleStatus = (id: string) => setTechs(ts => ts.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
  const addTech = (newTech: Technician) => setTechs(ts => [newTech, ...ts]);

  return (
    <>
      <div style={{ padding: '24px', maxWidth: '1100px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Technicians</h1>
            <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0', fontWeight: 400 }}>
              {activeCount} active · {techs.length} total
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              backgroundColor: '#0A0A0A', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 500, flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={14} strokeWidth={2} /> Add technician
          </button>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {techs.map(tech => (
            <TechRow
              key={tech.id}
              tech={tech}
              onClick={() => setSelectedId(tech.id)}
              onToggle={e => { e.stopPropagation(); toggleStatus(tech.id); }}
            />
          ))}
        </div>

        {/* Empty state */}
        {techs.length === 0 && (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <Users size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', color: '#A3A3A3' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#404040' }}>No technicians yet</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>Click "Add technician" to get started.</p>
          </div>
        )}
      </div>

      {showAdd && <AddTechnicianModal onClose={() => setShowAdd(false)} onAdd={addTech} />}
      {selectedTech && (
        <TechnicianProfileOverlay
          tech={selectedTech}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleStatus(selectedTech.id)}
        />
      )}
    </>
  );
}