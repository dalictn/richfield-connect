const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    assetExts: assetExts.filter((extension) => extension !== 'svg'),
    sourceExts: [...sourceExts.filter((extension) => extension !== 'svg'), 'svg'],
    extraNodeModules: {
      '@': path.resolve(__dirname, 'src'),
    },
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@/')) {
        const relativePath = moduleName.slice(2);
        return context.resolveRequest(
          context,
          path.join(__dirname, 'src', relativePath),
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer/react-native'),
  },
});
