// electron-builder afterPack: flip the Electron fuses on the packaged binary.
//
// RunAsNode off: `ELECTRON_RUN_AS_NODE=1 DJtoGraphikz.app` is no longer a free
// Node with our asar on disk. Node CLI inspect and NODE_OPTIONS off: no
// --inspect into the running app. OnlyLoadAppFromAsar: the app ignores a
// loose app/ folder dropped next to the asar. Asar integrity validation only
// on macOS, where electron-builder embeds the hash in Info.plist; on Windows
// and Linux it would reject our own asar.
const path = require('path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

module.exports = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context
  const name = packager.appInfo.productFilename
  let electronPath
  if (electronPlatformName === 'darwin') electronPath = path.join(appOutDir, `${name}.app`, 'Contents', 'MacOS', name)
  else if (electronPlatformName === 'win32') electronPath = path.join(appOutDir, `${name}.exe`)
  else electronPath = path.join(appOutDir, packager.executableName)

  await flipFuses(electronPath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: electronPlatformName === 'darwin',
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })
  console.log(`[afterPack] fuses flipped on ${path.basename(electronPath)}`)
}
