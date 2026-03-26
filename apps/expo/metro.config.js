// Learn more: https://docs.expo.dev/guides/monorepos/
require("setimmediate");

const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Configure for monorepo - merge with existing watchFolders
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// Add monorepo node_modules paths
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// XXX: Resolve our exports in workspace packages
// https://github.com/expo/expo/issues/26926
config.resolver.unstable_enablePackageExports = false;

// Apply NativeWind configuration
const nativeWindConfig = withNativeWind(config, {
  input: "./src/styles.css",
  configPath: "./tailwind.config.ts",
});

// Apply Turborepo managed cache
const finalConfig = withTurborepoManagedCache(nativeWindConfig);

module.exports = finalConfig;

/**
 * Move the Metro cache to the `.cache/metro` folder.
 * If you have any environment variables, you can configure Turborepo to invalidate it when needed.
 *
 * @see https://turbo.build/repo/docs/reference/configuration#env
 * @param {import('@expo/metro-config').MetroConfig} config
 * @returns {import('@expo/metro-config').MetroConfig}
 */
function withTurborepoManagedCache(config) {
  config.cacheStores = [
    new FileStore({ root: path.join(__dirname, ".cache/metro") }),
  ];
  return config;
}
