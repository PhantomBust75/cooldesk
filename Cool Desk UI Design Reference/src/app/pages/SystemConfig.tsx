import { useState } from 'react';
import { Save, Info } from 'lucide-react';
import { SYSTEM_CONFIG } from '../data/mockData';

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '12px 20px', backgroundColor: '#FAFAFA', borderBottom: '1px solid #E5E5E5' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>{title}</span>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>{children}</div>
    </div>
  );
}

function NumberField({ label, help, value, onChange, min = 1 }: { label: string; help?: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
      <div>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#404040' }}>{label} <span style={{ color: '#EF4444' }}>*</span></label>
        {help && <p style={{ fontSize: '12px', color: '#737373', margin: '3px 0 0' }}>{help}</p>}
      </div>
      <input
        type="number" min={min} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ padding: '7px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', width: '120px', outline: 'none', color: '#171717', fontFamily: 'inherit' }}
        onFocus={e => (e.target.style.borderColor = '#2563EB')}
        onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
      />
    </div>
  );
}

function SelectField({ label, help, value, onChange, options }: { label: string; help?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
      <div>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#404040' }}>{label} <span style={{ color: '#EF4444' }}>*</span></label>
        {help && <p style={{ fontSize: '12px', color: '#737373', margin: '3px 0 0' }}>{help}</p>}
      </div>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '7px 10px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', width: '200px', outline: 'none', color: '#404040', backgroundColor: '#fff' }}
        onFocus={e => (e.target.style.borderColor = '#2563EB')}
        onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function SystemConfig() {
  const [config, setConfig] = useState({ ...SYSTEM_CONFIG });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof typeof config, val: number | string) =>
    setConfig(c => ({ ...c, [key]: val }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>System Config</h1>
      </div>

      <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '10px 14px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '8px', border: '1px solid #E5E5E5' }}>
        <Info size={14} strokeWidth={1.5} color="#525252" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '13px', color: '#525252' }}>Configuration changes apply only to new evaluations from the save point onward. Existing flags are point-in-time snapshots and are not retroactively recalculated.</span>
      </div>

      <ConfigSection title="Customer complaint rules">
        <NumberField label="Repeat complaint window (days)" help="Number of days used to determine if a complaint is a repeat" value={config.repeat_complaint_window_days} onChange={v => update('repeat_complaint_window_days', v)} />
        <NumberField label="Frequent complaint threshold (count)" help="Number of complaints within the window to flag as frequent" value={config.frequent_complaint_threshold} onChange={v => update('frequent_complaint_threshold', v)} />
        <NumberField label="Frequent complaint window (days)" help="Rolling window for counting frequent complaints" value={config.frequent_complaint_window_days} onChange={v => update('frequent_complaint_window_days', v)} />
      </ConfigSection>

      <ConfigSection title="Scheduling & punctuality">
        <NumberField label="Punctuality grace period (minutes)" help="Arrival within this window of scheduled time is considered on-time" value={config.punctuality_grace_period_mins} onChange={v => update('punctuality_grace_period_mins', v)} min={0} />
        <NumberField label="Standard job duration (minutes)" help="Used for scheduling conflict detection and batch schedule spacing" value={config.standard_job_duration_mins} onChange={v => update('standard_job_duration_mins', v)} />
      </ConfigSection>

      <ConfigSection title="Pending schedule thresholds">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#737373', fontWeight: 500 }}>Job type</div>
          <div style={{ fontSize: '12px', color: '#92400E', fontWeight: 500 }}>Amber (days)</div>
          <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: 500 }}>Red (days)</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', color: '#404040' }}>Installation</div>
          <input type="number" min={1} value={config.pending_schedule_amber_days_installation} onChange={e => update('pending_schedule_amber_days_installation', Number(e.target.value))} style={{ padding: '6px 8px', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '13px', width: '70px', outline: 'none' }} />
          <input type="number" min={1} value={config.pending_schedule_red_days_installation} onChange={e => update('pending_schedule_red_days_installation', Number(e.target.value))} style={{ padding: '6px 8px', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '13px', width: '70px', outline: 'none' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', color: '#404040' }}>Complaint</div>
          <input type="number" min={1} value={config.pending_schedule_amber_days_complaint} onChange={e => update('pending_schedule_amber_days_complaint', Number(e.target.value))} style={{ padding: '6px 8px', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '13px', width: '70px', outline: 'none' }} />
          <input type="number" min={1} value={config.pending_schedule_red_days_complaint} onChange={e => update('pending_schedule_red_days_complaint', Number(e.target.value))} style={{ padding: '6px 8px', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '13px', width: '70px', outline: 'none' }} />
        </div>
      </ConfigSection>

      <ConfigSection title="Customer reviews">
        <SelectField label="Customer review mode" value={config.customer_review_mode} onChange={v => update('customer_review_mode', v)} options={[{ value: 'off', label: 'Off' }, { value: 'optional', label: 'Optional' }, { value: 'mandatory', label: 'Mandatory' }]} />
      </ConfigSection>

      <ConfigSection title="Cancellation escalation">
        <NumberField label="Escalation threshold (minutes)" help="Unactioned cancellation requests escalate to a dashboard banner after this many minutes" value={config.cancellation_request_escalation_minutes} onChange={v => update('cancellation_request_escalation_minutes', v)} min={5} />
      </ConfigSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '24px' }}>
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            backgroundColor: saved ? '#065F46' : '#0A0A0A', color: '#fff',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            transition: 'background-color 200ms',
          }}
        >
          <Save size={14} strokeWidth={1.5} />
          {saved ? 'Saved!' : 'Save configuration'}
        </button>
      </div>
    </div>
  );
}