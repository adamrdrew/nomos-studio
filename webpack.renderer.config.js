const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function rendererContentSecurityPolicy(isDev) {
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' http: https: ws:"
    ].join('; ');
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:"
  ].join('; ');
}

/** @type {import('webpack').Configuration} */
module.exports = {
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
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      csp: rendererContentSecurityPolicy(process.env.NODE_ENV !== 'production')
    })
  ],
  output: {
    path: path.resolve(__dirname, '.webpack/renderer')
  },
  target: 'web'
};
