const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appDirectory = path.resolve(__dirname, '..');

// Packages that need transpilation by babel-loader
const compileNodeModules = [
  'react-native-web',
  '@react-navigation',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-svg',
  '@react-native-async-storage',
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

module.exports = {
  entry: path.resolve(appDirectory, 'index.js'),
  output: {
    path: path.resolve(appDirectory, 'dist'),
    filename: 'bundle.web.js',
    publicPath: '/',
  },
  resolve: {
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    alias: {
      'react-native$': 'react-native-web',
      '@react-native-firebase/app': path.resolve(appDirectory, 'node_modules/firebase/app'),
      '@react-native-firebase/auth': path.resolve(appDirectory, 'node_modules/firebase/auth'),
      '@react-native-firebase/firestore': path.resolve(appDirectory, 'node_modules/firebase/firestore'),
      '@react-native-firebase/functions': path.resolve(appDirectory, 'node_modules/firebase/functions'),
      '@react-native-firebase/storage': path.resolve(appDirectory, 'node_modules/firebase/storage'),
      '@': path.resolve(appDirectory, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: [
          path.resolve(appDirectory, 'index.js'),
          path.resolve(appDirectory, 'src'),
          ...compileNodeModules,
        ],
        resolve: {
          fullySpecified: false,
        },
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(png|jpe?g|gif|webp|ico)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
    }),
  ],
  devServer: {
    port: 8080,
    historyApiFallback: true,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};