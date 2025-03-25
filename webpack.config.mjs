// webpack.config.cjs
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import nodeExternals from 'webpack-node-externals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  mode: 'development',
  entry: './renderer.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },
  target: 'electron-renderer',
  externals: [nodeExternals({
    allowlist: []
  })],
  resolve: {
    fallback: {
      util: false,
      path: false,
      url: false,
      fs: false,
      crypto: false,
    },
  },
  module: {
    rules: [],
  },
  devtool: 'source-map', // Add this line
};