// Dynamic Expo config: injects the Google Maps API key from .env so it never
// lives in committed source. Static config stays in app.json (spread as `config`).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
})
