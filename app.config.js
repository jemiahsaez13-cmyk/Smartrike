// Dynamic Expo config. Keeps app.json as the static base and injects the
// Google Maps API key (from .env → EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) into the
// native Google Maps SDK config. Without this, `PROVIDER_GOOGLE` MapViews render
// as a blank/gray tile on real Android builds (Expo Go uses its own key, which
// is why it can look fine in development but break in a standalone build).
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios && config.ios.config),
        googleMapsApiKey,
      },
    },
  };
};
