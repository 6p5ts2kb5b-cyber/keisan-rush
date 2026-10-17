#!/bin/bash
# cap add ios / cap sync のあとに 実行（Mac または Codemagic）
# iPhone専用・たて画面・カメラの説明文・暗号化なし・バージョン を 設定する
set -e
cd "$(dirname "$0")/.."
PL=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
setp(){ $PB -c "Set :$1 $3" "$PL" 2>/dev/null || $PB -c "Add :$1 $2 $3" "$PL"; }
setp CFBundleDisplayName string "まなびラッシュ"
setp NSCameraUsageDescription string "スタンプカードの しゃしんを とるために カメラを つかいます。しゃしんは この iPhone の 中だけで つかいます。"
setp NSPhotoLibraryUsageDescription string "スタンプカードに つかう しゃしんを えらぶために つかいます。しゃしんは この iPhone の 中だけで つかいます。"
setp ITSAppUsesNonExemptEncryption bool false
setp UIRequiresFullScreen bool true
$PB -c "Delete :UISupportedInterfaceOrientations" "$PL" 2>/dev/null || true
$PB -c "Add :UISupportedInterfaceOrientations array" "$PL"
$PB -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PL"
$PB -c "Delete :UISupportedInterfaceOrientations~ipad" "$PL" 2>/dev/null || true
# iPhone だけ（iPad の スクリーンショットを 用意しなくて よくなる）
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' ios/App/App.xcodeproj/project.pbxproj
# バージョン（MARKETING_VERSION は package.json の version）
VER=$(node -p "require('./package.json').version")
sed -i '' "s/MARKETING_VERSION = [0-9.]*;/MARKETING_VERSION = $VER;/g" ios/App/App.xcodeproj/project.pbxproj
if [ -n "$BUILD_NUMBER" ]; then sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" ios/App/App.xcodeproj/project.pbxproj; fi
echo "iOS の 設定 OK（version $VER build ${BUILD_NUMBER:-そのまま}）"
