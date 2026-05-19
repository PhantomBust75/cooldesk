import { useState } from 'react';
import { Download, Star } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { mockTechnicians, mockBrands } from '../data/mockData';

const businessData = [
  { date: 'Apr 30', revenue: 6200, installations: 4, complaints: 2, completionRate: 80 },
  { date: 'May 1', revenue: 7100, installations: 5, complaints: 3, completionRate: 87 },
  { date: 'May 2', revenue: 5800, installations: 3, complaints: 4, completionRate: 78 },
  { date: 'May 3', revenue: 8900, installations: 6, complaints: 2, completionRate: 92 },
  { date: 'May 4', revenue: 7400, installations: 5, complaints: 1, completionRate: 88 },
  { date: 'May 5', revenue: 8450, installations: 5, complaints: 3, completionRate: 87 },
];

const brandData = [
  { brand: 'Daikin', installations: 18, complaints: 4, revenue: 32000, revisits: 2 },
  { brand: 'Carrier', installations: 12, complaints: 7, revenue: 18000, revisits: 3 },
  { brand: 'Midea', installations: 9, complaints: 6, revenue: 12000, revisits: 4 },
  { brand: 'LG', installations: 11, complaints: 5, revenue: 15000, revisits: 1 },
  { brand: 'Samsung', installations: 8, complaints: 3, revenue: 11000, revisits: 0 },
  { brand: 'Gree', installations: 6, complaints: 2, revenue: 8000, revisits: 1 },
];

const dealerData = [
  { dealer: 'CoolAir Solutions', submitted: 24, complaints: 8, installations: 16, resolved: 20, pending: 4, avgMins: 145 },
  { dealer: 'Premium HVAC', submitted: 18, complaints: 5, installations: 13, resolved: 15, pending: 3, avgMins: 162 },
  { dealer: 'Gulf Climate', submitted: 15, complaints: 4, installations: 11, resolved: 13, pending: 2, avgMins: 138 },
];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 18px', fontSize: '13px', fontWeight: active ? 500 : 400,
        color: active ? '#171717' : '#737373',
        borderBottom: `2px solid ${active ? '#0A0A0A' : 'transparent'}`,
        background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
        marginBottom: '-1px', transition: 'color 120ms',
      }}
    >{children}</button>
  );
}

export function Analytics() {
  const [tab, setTab] = useState<'business' | 'technicians' | 'brand' | 'dealer'>('business');

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, color: '#0A0A0A', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Analytics</h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '3px 0 0', fontWeight: 400 }}>Last 7 days · May 2025</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #E5E5E5', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#404040' }}>
          <Download size={14} strokeWidth={1.5} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5', padding: '0 16px' }}>
          <TabButton active={tab === 'business'} onClick={() => setTab('business')}>Business</TabButton>
          <TabButton active={tab === 'technicians'} onClick={() => setTab('technicians')}>Technician scorecards</TabButton>
          <TabButton active={tab === 'brand'} onClick={() => setTab('brand')}>Brand</TabButton>
          <TabButton active={tab === 'dealer'} onClick={() => setTab('dealer')}>Dealer</TabButton>
        </div>

        <div style={{ padding: '24px' }}>
          {tab === 'business' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                  { label: 'Total revenue (7d)', value: 'SAR 43,850', trend: '+12%', up: true },
                  { label: 'Completion rate', value: '85.3%', trend: '+3.1%', up: true },
                  { label: 'On-time rate', value: '78.4%', trend: '-2.1%', up: false },
                  { label: 'Avg resolution', value: '1h 52m', trend: '+8min', up: false },
                ].map(m => (
                  <div key={m.label} style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E5E5' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 600, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                    <div style={{ fontSize: '12px', color: m.up ? '#10B981' : '#EF4444', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                      {m.trend} <span style={{ color: '#737373' }}>vs prev week</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue Chart */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 500, color: '#171717', marginBottom: '16px', marginTop: 0 }}>Daily revenue (SAR)</h3>
                <ResponsiveContainer key="revenue-chart" width="100%" height={240}>
                  <BarChart data={businessData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E5E5', boxShadow: 'none' }} />
                    <Bar dataKey="revenue" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Jobs Chart */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 500, color: '#171717', marginBottom: '16px', marginTop: 0 }}>Daily jobs</h3>
                <ResponsiveContainer key="jobs-chart" width="100%" height={200}>
                  <LineChart data={businessData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E5E5' }} />
                    <Legend />
                    <Line type="monotone" dataKey="installations" stroke="#525252" strokeWidth={1.5} dot={{ r: 3 }} name="Installations" />
                    <Line type="monotone" dataKey="complaints" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 3 }} name="Complaints" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === 'technicians' && (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                    {['Technician', 'Jobs assigned', 'On-time rate', 'Avg star rating', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockTechnicians.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F5F5F5' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: '#171717', fontSize: '14px' }}>{t.name}</td>
                      <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{t.jobs_assigned}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '4px', backgroundColor: '#F5F5F5', borderRadius: '9999px', maxWidth: '80px' }}>
                            <div style={{ width: `${t.on_time_rate * 100}%`, height: '100%', backgroundColor: t.on_time_rate >= 0.85 ? '#10B981' : t.on_time_rate >= 0.7 ? '#F59E0B' : '#EF4444', borderRadius: '9999px' }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#404040', fontVariantNumeric: 'tabular-nums' }}>{(t.on_time_rate * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Star size={13} fill="#F59E0B" color="#F59E0B" strokeWidth={1.5} />
                          <span style={{ fontSize: '13px', color: '#404040', fontVariantNumeric: 'tabular-nums' }}>{t.avg_star_rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '9999px', fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: t.is_active ? '#D1FAE5' : '#F5F5F5',
                          color: t.is_active ? '#065F46' : '#525252',
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: t.is_active ? '#10B981' : '#A3A3A3' }} />
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'brand' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <ResponsiveContainer key="brand-chart" width="100%" height={220}>
                  <BarChart data={brandData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                    <XAxis dataKey="brand" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E5E5' }} />
                    <Legend />
                    <Bar dataKey="installations" fill="#525252" radius={[3, 3, 0, 0]} name="Installations" />
                    <Bar dataKey="complaints" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Complaints" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                    {['Brand', 'Installations', 'Complaints', 'Revenue (SAR)', 'Revisits'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brandData.map((b) => {
                    const brand = mockBrands.find(br => br.name.includes(b.brand));
                    return (
                      <tr key={b.brand} style={{ borderBottom: '1px solid #F5F5F5' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 500, color: '#171717', fontSize: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: brand?.colour_hex || '#A3A3A3', display: 'inline-block', flexShrink: 0 }} />
                            {b.brand}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{b.installations}</td>
                        <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{b.complaints}</td>
                        <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{b.revenue.toLocaleString()}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: b.revisits > 2 ? '#92400E' : '#404040' }}>{b.revisits}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'dealer' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                  {['Dealer', 'Submitted', 'Complaints', 'Installations', 'Resolved', 'Pending', 'Avg resolution'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 500, color: '#525252' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealerData.map((d) => (
                  <tr key={d.dealer} style={{ borderBottom: '1px solid #F5F5F5' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FAFAFA')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: '#171717', fontSize: '14px' }}>{d.dealer}</td>
                    <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{d.submitted}</td>
                    <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{d.complaints}</td>
                    <td style={{ padding: '14px 16px', color: '#404040', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{d.installations}</td>
                    <td style={{ padding: '14px 16px', color: '#065F46', fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{d.resolved}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: d.pending > 3 ? '#92400E' : '#404040' }}>{d.pending}</td>
                    <td style={{ padding: '14px 16px', color: '#525252', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(d.avgMins / 60)}h {d.avgMins % 60}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}