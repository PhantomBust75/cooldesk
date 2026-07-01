const PALETTE = [
  { bg: '#EDE9FE', color: '#5B21B6' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#DBEAFE', color: '#1E40AF' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}

function avatarColorPair(name: string): { bg: string; color: string } {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const pair = avatarColorPair(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '9999px',
        backgroundColor: pair.bg,
        color: pair.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
