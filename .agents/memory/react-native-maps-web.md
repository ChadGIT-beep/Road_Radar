---
name: react-native-maps web compatibility
description: How to fix react-native-maps@1.18.0 crashing on web in Expo Router projects
---

## The rule

react-native-maps@1.18.0 (the Expo Go compatible version) crashes on web bundling with two errors:
1. `Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands"` during Metro bundling
2. `UIManager.hasViewManagerConfig is not a function` at runtime (even after fixing #1)

**Why:** The package's `decorateMapComponent.js` calls `UIManager.hasViewManagerConfig` at module load time (not inside a component), so Platform.OS checks don't help.

## How to apply

In `metro.config.js`, add a `resolveRequest` that redirects both modules to stubs when `platform === 'web'`:

```js
const WEB_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'stubs/react-native-maps.web.js'),
  'react-native/Libraries/Utilities/codegenNativeCommands': path.resolve(__dirname, 'stubs/codegenNativeCommands.js'),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_STUBS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

The `stubs/react-native-maps.web.js` exports a MapView that renders a styled placeholder View. The `stubs/codegenNativeCommands.js` exports a no-op function.

The real map (with markers, gestures, GPS) works correctly in Expo Go on device — only the web preview falls back to the placeholder.
