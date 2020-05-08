module.exports = {
  mode: 'development',

  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    publicPath: 'dist/',
  },
  devServer: {
    contentBase: 'public',
  },
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      {
        test: /(?<!worker)\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-proposal-class-properties']
          }
        }
      },
      {
        test: /\.worker\.js$/,
        loaders: ['worker-loader', 'babel-loader'],
      },
    ]
  },
  // devtool: 'source-map',
};
