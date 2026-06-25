const PALETTE = [
  { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
  { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
  { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  { bg: 'rgba(59,130,246,0.18)', color: '#3B82F6' },
  { bg: 'rgba(239,68,68,0.18)', color: '#EF4444' },
  { bg: 'rgba(115,115,115,0.15)', color: '#525252' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}

function avatarColorPair(name: string): { bg: string; color: string } {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length;
  return PALETTE[index];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const pair = avatarColorPair(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '9999px',
        backgroundColor: pair.bg,
        color: pair.color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600,
        flexShrink: 0, userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
