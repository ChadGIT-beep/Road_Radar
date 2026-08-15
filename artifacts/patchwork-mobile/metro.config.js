const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web stubs for native-only map modules. MapLibre wraps the native Android/iOS
// SDKs and has no web implementation; the browser client is
// artifacts/pothole-reporter, which uses maplibre-gl directly.
const WEB_STUBS = {
  '@maplibre/maplibre-react-native': path.resolve(
    __dirname,
    'stubs/maplibre-react-native.web.js'
  ),
  'react-native/Libraries/Utilities/codegenNativeCommands': path.resolve(
    __dirname,
    'stubs/codegenNativeCommands.js'
  ),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_STUBS[moduleName] };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
