 var path = require('path');
 var webpack = require('webpack');

 module.exports = {
    entry: './build/EventsListener.js',
    output: {
        path: path.resolve(__dirname, '.'),
        filename: 'equal.bundle.js',
        libraryTarget: "var",
        library: "eQ"
    },
    mode: 'development',
    stats: {
        colors: true
    },
    devtool: 'source-map',
    resolve: {
        modules: [
            path.resolve(__dirname, 'build/'),
            path.join(__dirname, 'node_modules/')
        ],
        extensions: ['*', '.js']
    },
    module: {
        rules: [
            // should we need to make specific Classes available as standalone modules, it has to be defined here
            {
                test: require.resolve("jquery"),
                loader: "expose-loader",
                options: {
                    exposes: {
                        globalName: "$",
                        override: true
                    }
                }
            },
/*
            {
                test: /\.jquery\.js$/,
                use: [
                    {
                        loader: 'raw-loader',
                        options: {
                            esModule: false,
                        }
                    }
                ],
            },
*/
            {
                test: /\.css$/,
                use: [
                'style-loader',
                'css-loader',
                ],
            }
        ]
    },
    plugins: [
        // Provides jQuery for other JS bundled with Webpack
        new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery'
        })
    ],
    optimization: {
        minimize: true
    }
 };