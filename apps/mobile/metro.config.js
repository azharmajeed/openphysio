/* eslint-disable -- CommonJS: Metro loads this with require() */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// drizzle's generated migrations.js imports the .sql files as text.
config.resolver.sourceExts.push("sql");
module.exports = config;
