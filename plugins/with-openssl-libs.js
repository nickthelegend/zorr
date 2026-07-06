/**
 * Expo config plugin: package OpenSSL shared libs into the Android APK.
 *
 * react-native-quick-crypto links libQuickCrypto.so against the shared
 * libcrypto.so / libssl.so from the `io.github.ronickg:openssl` prefab, but
 * AGP does not package those prefab .so files into the APK — causing a runtime
 * crash: UnsatisfiedLinkError: library "libcrypto.so" not found.
 *
 * This copies the tracked libs from ./native-libs/openssl/<abi>/ into
 * android/app/src/main/jniLibs/<abi>/ during prebuild, so a clean prebuild
 * still produces a working build.
 */
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

module.exports = function withOpenSSLLibs(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'native-libs', 'openssl')
      const jniLibs = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'jniLibs')

      if (!fs.existsSync(src)) {
        return cfg
      }

      for (const abi of fs.readdirSync(src)) {
        const abiSrc = path.join(src, abi)
        if (!fs.statSync(abiSrc).isDirectory()) continue
        const abiDest = path.join(jniLibs, abi)
        fs.mkdirSync(abiDest, { recursive: true })
        for (const file of fs.readdirSync(abiSrc)) {
          fs.copyFileSync(path.join(abiSrc, file), path.join(abiDest, file))
        }
      }

      return cfg
    },
  ])
}
