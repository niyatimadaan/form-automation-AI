const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.AZURE_API_KEY': JSON.stringify(process.env.AZURE_API_KEY),
      'process.env.AZURE_ENDPOINT': JSON.stringify(process.env.AZURE_ENDPOINT),
      'process.env.AZURE_DEPLOYMENT_NAME': JSON.stringify(process.env.AZURE_DEPLOYMENT_NAME),
      'process.env.HUGGINGFACE_API_KEY': JSON.stringify(process.env.HUGGINGFACE_API_KEY),
      'process.env.AI_PROVIDER': JSON.stringify(process.env.AI_PROVIDER),
      'process.env.HUGGINGFACE_MODEL': JSON.stringify(process.env.HUGGINGFACE_MODEL)
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'src/content/content.css', to: 'content.css' },
        { from: 'icons', to: 'icons' }
      ]
    })
  ]
};
