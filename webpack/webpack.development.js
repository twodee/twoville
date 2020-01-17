module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    publicPath: 'dist',
  },
  devServer: {
    contentBase: 'public',
  }
};
