// Color themes. The logo stays the original M artwork in every theme.
export const THEMES = {
  orbit: {
    key: 'orbit', dark: true,
    bg: '#0B0D17', bg2: '#12152A', card: '#1A1E36', line: 'rgba(255,255,255,0.08)',
    text: '#F2F4FF', sub: '#A3A9C9', dim: '#6B7194',
    accent: '#8B5CF6', accent2: '#22D3EE', onAccent: '#FFFFFF',
    grad: ['#A77BFF', '#22D3EE'],
  },
  crimson: {
    key: 'crimson', dark: true,
    bg: '#000000', bg2: '#0E0E0E', card: '#1B1B1B', line: 'rgba(255,255,255,0.09)',
    text: '#FFFFFF', sub: '#B3B3B3', dim: '#737373',
    accent: '#E50914', accent2: '#FF4B55', onAccent: '#FFFFFF',
    grad: ['#FF3B47', '#B20710'],
  },
  emerald: {
    key: 'emerald', dark: true,
    bg: '#06110D', bg2: '#0B1C16', card: '#12291F', line: 'rgba(255,255,255,0.08)',
    text: '#EFFFF7', sub: '#9CC7B4', dim: '#5E8C79',
    accent: '#10B981', accent2: '#A3E635', onAccent: '#04130D',
    grad: ['#34D399', '#A3E635'],
  },
  gold: {
    key: 'gold', dark: true,
    bg: '#0F0C07', bg2: '#1A150C', card: '#262013', line: 'rgba(255,255,255,0.08)',
    text: '#FFF8EA', sub: '#CDBE9C', dim: '#8C7F62',
    accent: '#F5B83D', accent2: '#FFD978', onAccent: '#1A1205',
    grad: ['#FFD978', '#E58E1A'],
  },
  ocean: {
    key: 'ocean', dark: true,
    bg: '#04101C', bg2: '#081B2E', card: '#0F2740', line: 'rgba(255,255,255,0.08)',
    text: '#EEF7FF', sub: '#9BB8D3', dim: '#5D7C99',
    accent: '#0EA5E9', accent2: '#38BDF8', onAccent: '#FFFFFF',
    grad: ['#38BDF8', '#2563EB'],
  },
  light: {
    key: 'light', dark: false,
    bg: '#F5F6FA', bg2: '#FFFFFF', card: '#FFFFFF', line: 'rgba(0,0,0,0.08)',
    text: '#11131C', sub: '#555B70', dim: '#8C91A3',
    accent: '#6D4AFF', accent2: '#0891B2', onAccent: '#FFFFFF',
    grad: ['#8B5CF6', '#06B6D4'],
  },
};
export const THEME_ORDER = ['orbit', 'crimson', 'emerald', 'gold', 'ocean', 'light'];

export const AVATAR_COLORS = ['#8B5CF6', '#22D3EE', '#E50914', '#10B981', '#F5B83D', '#EC4899', '#F97316', '#64748B'];
// Original avatar glyphs (vector icons from Ionicons), no third-party characters.
export const AVATAR_ICONS = ['planet', 'rocket', 'moon', 'flash', 'leaf', 'paw', 'game-controller', 'musical-notes', 'happy', 'star', 'football', 'film'];
