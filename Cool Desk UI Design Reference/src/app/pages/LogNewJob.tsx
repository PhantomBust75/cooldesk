import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle, Search, Plus, Minus } from 'lucide-react';
import { mockBrands, mockDealers } from '../data/mockData';

type Step = 1 | 2 | 3 | 4;

interface FormState {
  jobType: 'installation' | 'complaint' | '';
  source: 'direct' | 'via_dealer' | '';
  dealerId: string;
  phone: string;
  customerName: string;
  address: string;
  brandId: string;
  scheduledAt: string;
  units: { model: string; unit_type: string; num_units: number }[];
  issueDescription: string;
}

const defaultForm: FormState = {
  jobType: '', source: '', dealerId: '',
  phone: '', customerName: '', address: '',
  brandId: '', scheduledAt: '',
  units: [{ model: '', unit_type: '', num_units: 1 }],
  issueDescription: '',
};

function StepHeader({ current, total }: { current: Step; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < total ? 1 : 0 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '9999px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '12px', fontWeight: 500, flexShrink: 0,
            backgroundColor: n < current ? '#065F46' : n === current ? '#0A0A0A' : '#F5F5F5',
            color: n <= current ? '#fff' : '#A3A3A3',
          }}>
            {n < current ? <CheckCircle size={14} strokeWidth={1.5} /> : n}
          </div>
          {n < total && (
            <div style={{ flex: 1, height: '1px', backgroundColor: n < current ? '#10B981' : '#E5E5E5', minWidth: '40px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #E5E5E5',
  borderRadius: '8px', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', color: '#171717', fontFamily: 'inherit',
};

export function LogNewJob() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [vcidResult, setVcidResult] = useState<'searching' | 'found' | 'not_found' | null>(null);

  const update = (key: keyof FormState, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const handlePhoneBlur = () => {
    if (form.phone.length >= 10) {
      setVcidResult('searching');
      setTimeout(() => { setVcidResult(Math.random() > 0.4 ? 'found' : 'not_found'); }, 800);
    }
  };

  const addUnit = () => update('units', [...form.units, { model: '', unit_type: '', num_units: 1 }]);
  const removeUnit = (i: number) => update('units', form.units.filter((_, idx) => idx !== i));
  const updateUnit = (i: number, key: string, val: string | number) => {
    const units = [...form.units];
    units[i] = { ...units[i], [key]: val };
    update('units', units);
  };

  const step1Valid = form.jobType && form.source && (form.source === 'direct' || form.dealerId);
  const step2Valid = form.phone && form.customerName && form.address;
  const step3Valid = form.brandId && (form.jobType === 'complaint' ? form.issueDescription : true) && form.units.every(u => u.model && u.unit_type);

  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' };

  return (
    <div style={{ padding: '24px', maxWidth: '720px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#525252', textDecoration: 'none', marginBottom: '12px' }}>
          <ArrowLeft size={13} strokeWidth={1.5} /> Back to jobs
        </Link>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#171717', margin: 0 }}>Log new job</h1>
        <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>Step {step} of 4</p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', padding: '28px' }}>
        <StepHeader current={step} total={4} />

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#171717', marginBottom: '20px', marginTop: 0 }}>Job type & source</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Job type <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['installation', 'complaint'] as const).map(t => (
                  <label key={t} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', border: `1px solid ${form.jobType === t ? '#0A0A0A' : '#E5E5E5'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: form.jobType === t ? '#FAFAFA' : '#fff' }}>
                    <input type="radio" name="jobType" value={t} checked={form.jobType === t} onChange={() => update('jobType', t)} style={{ display: 'none' }} />
                    <span style={{ fontSize: '13px', fontWeight: form.jobType === t ? 500 : 400, color: form.jobType === t ? '#0A0A0A' : '#525252', textTransform: 'capitalize' }}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Source <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['direct', 'via_dealer'] as const).map(s => (
                  <label key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', border: `1px solid ${form.source === s ? '#0A0A0A' : '#E5E5E5'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: form.source === s ? '#FAFAFA' : '#fff' }}>
                    <input type="radio" name="source" value={s} checked={form.source === s} onChange={() => update('source', s)} style={{ display: 'none' }} />
                    <span style={{ fontSize: '13px', fontWeight: form.source === s ? 500 : 400, color: form.source === s ? '#0A0A0A' : '#525252' }}>{s === 'direct' ? 'Direct' : 'Via dealer'}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.source === 'via_dealer' && (
              <div>
                <label style={labelStyle}>Dealer <span style={{ color: '#EF4444' }}>*</span></label>
                <select value={form.dealerId} onChange={e => update('dealerId', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">Select dealer…</option>
                  {mockDealers.filter(d => d.is_active).map(d => (<option key={d.id} value={d.id}>{d.business_name}</option>))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#171717', marginBottom: '20px', marginTop: 0 }}>Customer identity</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Primary phone <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input type="tel" value={form.phone} onChange={e => { update('phone', e.target.value); setVcidResult(null); }} onBlur={handlePhoneBlur} placeholder="+966 50 000 0000" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur2={e => (e.target.style.borderColor = '#E5E5E5')} />
                  {vcidResult === 'searching' && <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#A3A3A3' }} />}
                </div>
                {vcidResult === 'found' && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#FAFAFA' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#065F46', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={12} strokeWidth={1.5} /> Best match
                    </div>
                    <div style={{ fontSize: '13px', color: '#404040' }}>Rania Al-Omari — 14 King Fahd Road, Riyadh</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => { update('customerName', 'Rania Al-Omari'); update('address', '14 King Fahd Road, Riyadh 11411'); }} style={{ padding: '5px 12px', borderRadius: '6px', backgroundColor: '#0A0A0A', color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Confirm</button>
                      <button onClick={() => setVcidResult(null)} style={{ padding: '5px 12px', borderRadius: '6px', backgroundColor: '#fff', color: '#404040', border: '1px solid #E5E5E5', fontSize: '12px', cursor: 'pointer' }}>Dismiss</button>
                    </div>
                  </div>
                )}
                {vcidResult === 'not_found' && (<p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0' }}>No match found. A new customer record will be created.</p>)}
              </div>
              {[{ key: 'customerName', label: 'Customer name', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label} <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type={field.type} value={(form as Record<string, string>)[field.key]} onChange={e => update(field.key as keyof FormState, e.target.value)} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E5E5E5')} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#171717', marginBottom: '20px', marginTop: 0 }}>Job details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Brand <span style={{ color: '#EF4444' }}>*</span></label>
                <select value={form.brandId} onChange={e => update('brandId', e.target.value)} style={{ ...inputStyle, width: '100%' }} onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E5E5E5')}>
                  <option value="">Select brand…</option>
                  {mockBrands.filter(b => b.is_active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {form.jobType === 'installation' && (
                <div>
                  <label style={labelStyle}>Scheduled at <span style={{ color: '#A3A3A3', fontWeight: 400 }}>(optional for via dealer)</span></label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={e => update('scheduledAt', e.target.value)} min={new Date().toISOString().slice(0, 16)} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E5E5E5')} />
                </div>
              )}
              {form.jobType === 'complaint' && (
                <div>
                  <label style={labelStyle}>Issue description <span style={{ color: '#EF4444' }}>*</span></label>
                  <textarea value={form.issueDescription} onChange={e => update('issueDescription', e.target.value)} rows={3} placeholder="Describe the issue in detail…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} onFocus={e => (e.target.style.borderColor = '#2563EB')} onBlur={e => (e.target.style.borderColor = '#E5E5E5')} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Unit details <span style={{ color: '#EF4444' }}>*</span></label>
                {form.units.map((unit, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 32px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input placeholder="Model" value={unit.model} onChange={e => updateUnit(i, 'model', e.target.value)} style={{ padding: '7px 8px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#171717' }} />
                    <input placeholder="Unit type" value={unit.unit_type} onChange={e => updateUnit(i, 'unit_type', e.target.value)} style={{ padding: '7px 8px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#171717' }} />
                    <input type="number" min={1} value={unit.num_units} onChange={e => updateUnit(i, 'num_units', Number(e.target.value))} style={{ padding: '7px 8px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#171717' }} />
                    {form.units.length > 1 && (
                      <button onClick={() => removeUnit(i)} style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#fff', border: '1px solid #E5E5E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991B1B' }}>
                        <Minus size={13} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addUnit} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#fff', border: '1px dashed #E5E5E5', cursor: 'pointer', fontSize: '13px', color: '#525252' }}>
                  <Plus size={12} strokeWidth={1.5} /> Add unit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#171717', marginBottom: '20px', marginTop: 0 }}>Review & submit</h2>
            <div style={{ backgroundColor: '#FAFAFA', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', border: '1px solid #E5E5E5' }}>
              {[
                ['Job type', form.jobType || '—'],
                ['Source', form.source || '—'],
                ['Dealer', form.dealerId ? mockDealers.find(d => d.id === form.dealerId)?.business_name : 'N/A'],
                ['Customer', form.customerName || '—'],
                ['Phone', form.phone || '—'],
                ['Address', form.address || '—'],
                ['Brand', form.brandId ? mockBrands.find(b => b.id === form.brandId)?.name : '—'],
                form.jobType === 'installation' ? ['Scheduled at', form.scheduledAt || 'Pending schedule'] : null,
                form.jobType === 'complaint' ? ['Issue', form.issueDescription || '—'] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <span style={{ minWidth: '120px', color: '#737373', fontWeight: 500 }}>{k}</span>
                  <span style={{ color: '#404040' }}>{v as string}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E5E5E5' }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => (s - 1) as Step)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>
              <ArrowLeft size={13} strokeWidth={1.5} /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : step === 3 ? !step3Valid : false}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: (step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) ? '#0A0A0A' : '#E5E5E5', color: (step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) ? '#fff' : '#A3A3A3', cursor: (step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}
            >
              Continue <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          ) : (
            <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0A0A0A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
              <CheckCircle size={14} strokeWidth={1.5} /> Create job
            </button>
          )}
        </div>
      </div>
    </div>
  );
}