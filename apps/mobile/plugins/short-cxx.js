/* eslint-disable -- CommonJS: Expo loads config plugins with require() */
// Windows only. CMake 3.22's ninja breaks on paths over 260 chars, so:
// 1. keep the app's CMake output in a short dir;
// 2. build every native module with a newer CMake from the SDK (its ninja handles long paths when
//    Windows long paths are enabled), set through cmake.dir in android/local.properties.
const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");

const CMAKE_VERSION = "3.31.6";

const withShortStaging = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents += `\nandroid.externalNativeBuild.cmake.buildStagingDirectory = file("C:/b")\n`;
    return c;
  });

const withNewerCmake = (config) =>
  withDangerousMod(config, [
    "android",
    (c) => {
      const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      const dir = sdk && path.join(sdk, "cmake", CMAKE_VERSION);
      if (!dir || !fs.existsSync(dir)) return c;
      const file = path.join(c.modRequest.platformProjectRoot, "local.properties");
      const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^cmake\.dir=.*\n?/m, "") : "";
      fs.writeFileSync(file, `${old}cmake.dir=${dir.replace(/\\/g, "/")}\n`);
      return c;
    },
  ]);

module.exports = (config) =>
  process.platform !== "win32" ? config : withNewerCmake(withShortStaging(config));
