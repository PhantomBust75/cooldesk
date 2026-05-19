import { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight, CreditCard } from 'lucide-react';
import { mockPaymentMethods } from '../data/mockData';

export function PaymentMethods() {
  const [methods, setMethods] = useState(mockPaymentMethods);
  const [newName, setNewName] = useState('');

  const toggleActive = (id: string) => {
    setMethods(m => m.map(pm => pm.id === id ? { ...pm, is_active: !pm.is_active } : pm));
  };

  const addMethod = () => {
    if (!newName.trim()) return;
    setMethods(m => [...m, { id: `pm${Date.now()}`, name: newName.trim(), is_active: true }]);
    setNewName('');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '700px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Payment Methods</h1>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>Method name</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((pm) => (
              <tr key={pm.id} style={{ borderBottom: '1px solid #F5F5F5' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
              >
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={14} strokeWidth={1.5} color={pm.is_active ? '#525252' : '#A3A3A3'} />
                    <span style={{ fontSize: '14px', color: pm.is_active ? '#171717' : '#A3A3A3' }}>{pm.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
                    backgroundColor: pm.is_active ? '#D1FAE5' : '#F5F5F5',
                    color: pm.is_active ? '#065F46' : '#525252',
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: pm.is_active ? '#10B981' : '#A3A3A3' }} />
                    {pm.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <button
                    onClick={() => toggleActive(pm.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}
                  >
                    {pm.is_active ? <ToggleRight size={14} strokeWidth={1.5} color="#10B981" /> : <ToggleLeft size={14} strokeWidth={1.5} color="#A3A3A3" />}
                    {pm.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', padding: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#171717', margin: '0 0 12px' }}>Add payment method</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMethod()}
            placeholder="e.g. Apple Pay, Mada"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#171717', fontFamily: 'inherit' }}
            onFocus={e => (e.target.style.borderColor = '#2563EB')}
            onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
          />
          <button
            onClick={addMethod}
            disabled={!newName.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: newName.trim() ? '#0A0A0A' : '#E5E5E5', color: newName.trim() ? '#fff' : '#A3A3A3', cursor: newName.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}
          >
            <Plus size={14} strokeWidth={1.5} /> Add
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#737373', margin: '8px 0 0' }}>
          Deactivated methods are hidden from new job payment dropdowns but retained in historical records.
        </p>
      </div>
    </div>
  );
}