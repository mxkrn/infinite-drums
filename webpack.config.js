const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { ProvidePlugin } = require('webpack');

module.exports = () => {
  return {
    target: ['web'],
    entry: path.resolve(__dirname, 'src/js/main.js'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.min.js',
      library: {
        type: 'umd'
      }
    },
    resolve: {
      alias: {
        'fs': 'browserfs/dist/shims/fs.js',
        'buffer': 'browserfs/dist/shims/buffer.js',
        'path': 'browserfs/dist/shims/path.js',
        'processGlobal': 'browserfs/dist/shims/process.js',
        'bufferGlobal': 'browserfs/dist/shims/bufferGlobal.js',
        'bfsGlobal': require.resolve('browserfs'),
        'tone': require.resolve('tone'),
        'util': require.resolve('util/')
      }
    },
    module: {
      noParse: /browserfs\.js/
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'node_modules/onnxruntime-web/dist/*.wasm', to: '[name][ext]'},
          { from: 'src/cables', to: 'cables/[name][ext]' },
        ]
      }),
      new ProvidePlugin({
        BrowserFS: 'bfsGlobal', process: 'processGlobal'
      })
    ],
    mode: 'production',
  }
};
