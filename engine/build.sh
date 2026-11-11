#!/usr/bin/env bash
# Builds the Go torrent engine with gomobile into the local Expo module.
#   bash engine/build.sh android   -> modules/m-torrent/android/libs/mtorrent.aar
#   bash engine/build.sh ios       -> modules/m-torrent/ios/Mtorrent.xcframework
# Optional: ANDROID_TARGETS (default android/arm64,android/arm)
set -euo pipefail
cd "$(dirname "$0")"
go install golang.org/x/mobile/cmd/gomobile@latest
go install golang.org/x/mobile/cmd/gobind@latest
export PATH="$(go env GOPATH)/bin:$PATH"
go get golang.org/x/mobile/bind@latest
gomobile init
case "$1" in
  android)
    mkdir -p ../modules/m-torrent/android/libs
    gomobile bind -target="${ANDROID_TARGETS:-android/arm64,android/arm}" -androidapi 24 -ldflags="-s -w -checklinkname=0" -trimpath \
      -o ../modules/m-torrent/android/libs/mtorrent.aar .
    ls -la ../modules/m-torrent/android/libs ;;
  ios)
    rm -rf ../modules/m-torrent/ios/Mtorrent.xcframework
    gomobile bind -target=ios -iosversion 15.1 -ldflags="-s -w" -trimpath -o ../modules/m-torrent/ios/Mtorrent.xcframework .
    du -sh ../modules/m-torrent/ios/Mtorrent.xcframework ;;
  *) echo "usage: build.sh android|ios"; exit 1 ;;
esac
