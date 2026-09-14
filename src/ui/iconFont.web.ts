import materialCommunityIcons from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';

/**
 * React Native Paper draws every icon with the MaterialCommunityIcons font. On
 * native the font ships inside the app; on web nothing registers it, so icons
 * render as empty boxes unless the @font-face is injected here.
 */
export function loadIconFonts(): void {
  if (typeof document === 'undefined' || document.getElementById('rc-icon-fonts')) return;
  const style = document.createElement('style');
  style.id = 'rc-icon-fonts';
  style.appendChild(
    document.createTextNode(
      `@font-face { font-family: 'MaterialCommunityIcons'; src: url(${materialCommunityIcons}) format('truetype'); }`,
    ),
  );
  document.head.appendChild(style);
}
