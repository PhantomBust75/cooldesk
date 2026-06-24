import { describe, it, expect } from 'vitest';

const COLOR_PAIRS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FFE4E6', text: '#9F1239' },
  { bg: '#F0FDF4', text: '#14532D' },
  { bg: '#FFF7ED', text: '#9A3412' },
];

function avatarColorPair(name: string) {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLOR_PAIRS.length;
  return COLOR_PAIRS[index];
}

describe('avatarColorPair', () => {
  it('always returns the same color for the same name', () => {
    const a = avatarColorPair('Ahmed Ali');
    const b = avatarColorPair('Ahmed Ali');
    expect(a).toEqual(b);
  });

  it('returns a valid color pair from the palette', () => {
    const pair = avatarColorPair('Test User');
    expect(COLOR_PAIRS).toContainEqual(pair);
  });
});
