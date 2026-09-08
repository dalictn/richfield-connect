const path = require('path');
const fs = require('fs');
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

const htmlTemplatePath = path.resolve(__dirname, 'index.html');

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
      // 1. Alias React Native to React Native Web
      'react-native$': 'react-native-web',
      
      // 2. Route native Firebase calls to standard web Firebase when running on Web
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
        // CRITICAL FIX: Allows importing files without typing '.js' extension in node_modules
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
      // Fix for .mjs files inside node_modules
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
    new HtmlWebpackPlugin(
      fs.existsSync(htmlTemplatePath)
        ? { template: htmlTemplatePath }
        : {
            title: 'Richfield Connect',
            templateContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Richfield Connect</title>
    <style>
      html, body, #root { height: 100%; width: 100%; display: flex; flex-direction: column; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
          },
    ),
  ],
  devServer: {
    port: 8080,
    historyApiFallback: true,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false, // <-- disables warning popup
      },
    },
  },