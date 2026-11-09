/* eslint-disable -- CommonJS: Babel loads this with require() */
module.exports = (api) => {
  api.cache(true);
  // drizzle's generated migrations.js imports .sql files as strings.
  return { presets: ["babel-preset-expo"], plugins: [["inline-import", { extensions: [".sql"] }]] };
};
