import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

/**
 * Richfield Connect design tokens on top of Material Design 3.
 *
 * Screens should take colours from `theme.colors` (via `useTheme()`) rather than
 * hardcoding hex values, so the whole app restyles from this one file.
 */
export const theme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1D3A8A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DCE4FF',
    onPrimaryContainer: '#0B1B4D',
    secondary: '#0F766E',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CCF0EC',
    onSecondaryContainer: '#063B37',
    tertiary: '#B45309',
    tertiaryContainer: '#FDE7CC',
    error: '#B42318',
    background: '#F6F8FA',
    surface: '#FFFFFF',
    surfaceVariant: '#EEF1F6',
    onSurface: '#101828',
    onSurfaceVariant: '#475467',
    outline: '#D0D5DD',
    outlineVariant: '#E4E7EC',
  },
};
