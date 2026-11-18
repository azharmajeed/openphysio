/* eslint-disable -- CommonJS: Metro loads this with require() */
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
// drizzle's generated migrations.js imports the .sql files as text.
config.resolver.sourceExts.push("sql");
module.exports = withUniwindConfig(config, { cssEntryFile: "./global.css", dtsFile: "./uniwind-types.d.ts" });
