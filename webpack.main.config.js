/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('node:path');

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: './src/main/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '.webpack/main')
  },
  target: 'electron-main'
};
