const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    publicPath: 'dist/',
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
  },
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
};
