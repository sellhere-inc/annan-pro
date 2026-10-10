export default {
  expo: {
    name: 'Annan Pro', slug: 'annan-pro', version: '2.0.0',
    orientation: 'portrait', userInterfaceStyle: 'dark', backgroundColor: '#000000',
    scheme: 'annanpro',
    icon: './public/icon-512.png',
    ios: { supportsTablet: true, bundleIdentifier: 'com.annanpro.app' },
    android: { package: 'com.annanpro.app', googleServicesFile: process.env.GOOGLE_SERVICES_JSON },
    plugins: ['expo-notifications'],
    extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined } },
    web: { bundler: 'metro', name: 'Annan Pro' },
  },
};
