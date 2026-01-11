/* eslint-disable @typescript-eslint/no-var-requires */
const { MakerDeb } = require('@electron-forge/maker-deb');
const { MakerRpm } = require('@electron-forge/maker-rpm');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { WebpackPlugin } = require('@electron-forge/plugin-webpack');

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true
  },
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new WebpackPlugin({
      // Renderer textures currently load via `blob:` URLs created from IPC-provided bytes.
      // Keep CSP narrowly scoped: relax image sources only, without widening default/script sources.
      devContentSecurityPolicy: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' http: https: ws:"
      ].join('; '),
      contentSecurityPolicy: [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:"
      ].join('; '),
      mainConfig: './webpack.main.config.js',
      renderer: {
        config: './webpack.renderer.config.js',
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload/preload.ts'
            }
          }
        ]
      }
    })
  ]
};
