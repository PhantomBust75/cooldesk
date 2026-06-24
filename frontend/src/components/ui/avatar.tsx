const COLOR_PAIRS: Array<{ bg: string; text: string }> = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#14532D' },
  { bg: '#FFF7ED', text: '#9A3412' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0] || '').join('').toUpperCase().slice(0, 2);
}

function avatarColorPair(name: string): { bg: string; text: string } {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLOR_PAIRS.length;
  return COLOR_PAIRS[index];
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = avatarColorPair(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '9999px',
        backgroundColor: colors.bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.34))}px`,
        fontWeight: 600, color: colors.text,
        flexShrink: 0, userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
