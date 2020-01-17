module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    publicPath: 'dist',
  },
  optimization: {
    minimize: true,
  },
};
