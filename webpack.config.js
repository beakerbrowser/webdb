const path = require('path')
const webpack = require('webpack')

module.exports = {
    entry: './index.js',
    plugins: [
        new webpack.optimize.UglifyJsPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['babel-preset-env']
                    }
                }
            }
        ]
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'webdb-bundle.js',
        library: 'WebDB'
    }
}
