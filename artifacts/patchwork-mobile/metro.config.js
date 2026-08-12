const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web stubs for native-only modules that react-native-maps@1.18.0 imports
const WEB_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'stubs/react-native-maps.web.js'),
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
