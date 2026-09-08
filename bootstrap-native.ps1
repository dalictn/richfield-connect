$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$temp = Join-Path $env:TEMP 'richfield-connect-native-shell'

if (Test-Path $temp) {
  Remove-Item -Recurse -Force $temp
}

New-Item -ItemType Directory -Path $temp | Out-Null
Push-Location $temp
try {
  npx @react-native-community/cli@20 init RichfieldConnectNative --version 0.81.4 --skip-install
  Copy-Item -Recurse -Force (Join-Path $temp 'RichfieldConnectNative/android') (Join-Path $root 'android')
  Copy-Item -Recurse -Force (Join-Path $temp 'RichfieldConnectNative/ios') (Join-Path $root 'ios')
  Write-Host 'Native Android/iOS shells copied into the Phase 1 project.'
} finally {
  Pop-Location
}
