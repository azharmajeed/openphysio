// Windows only: ninja (CMake 3.22) breaks on paths over 260 chars, so keep the app's CMake output in a short dir.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = (config) =>
  process.platform !== "win32"
    ? config
    : withAppBuildGradle(config, (c) => {
        c.modResults.contents += `\nandroid.externalNativeBuild.cmake.buildStagingDirectory = file("C:/b")\n`;
        return c;
      });
