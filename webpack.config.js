//@ts-check
const path = require("path");

/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
    target: "node",
    mode: "development",
    entry: "./src/extension.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2"
    },
    externals: {
        vscode: "commonjs vscode",
        // Add other node modules that shouldn't be bundled
        'vscode-languageclient': 'commonjs vscode-languageclient'
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            configFile: 'tsconfig.json'
                        }
                    }
                ]
            }
        ]
    },
    devtool: "nosources-source-map",
    infrastructureLogging: {
        level: "log"
    }
};

module.exports = extensionConfig;
