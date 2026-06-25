import { describe, it, expect } from 'vitest';

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

function avatarColorPair(name: string) {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length;
  return PALETTE[index];
}

describe('avatarColorPair', () => {
  it('always returns the same color for the same name', () => {
    const a = avatarColorPair('Ahmed Ali');
    const b = avatarColorPair('Ahmed Ali');
    expect(a).toEqual(b);
  });

  it('returns a valid color pair from the palette', () => {
    const pair = avatarColorPair('Test User');
    expect(PALETTE).toContainEqual(pair);
  });
});
