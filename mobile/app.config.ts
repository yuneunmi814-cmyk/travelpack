import type { ExpoConfig } from 'expo/config'

// 카카오 네이티브 앱 키 — .env의 EXPO_PUBLIC_KAKAO_NATIVE_KEY로 주입(카카오 개발자센터 발급).
// 비우면 지도/소셜은 플레이스홀더·비활성으로 동작(앱은 정상 실행).
const KAKAO_NATIVE_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_KEY ?? ''

const plugins: NonNullable<ExpoConfig['plugins']> = [
  ['expo-splash-screen', { backgroundColor: '#1D3557', image: './assets/splash-icon.png', imageWidth: 180 }],
  ['expo-location', { locationWhenInUsePermission: '가이드 모드에서 다음 목적지 안내와 체크인을 위해 위치를 사용합니다.' }],
]
// 카카오 SDK(지도·로그인) — 키가 있을 때만 네이티브 설정 주입
if (KAKAO_NATIVE_KEY) plugins.push(['@react-native-kakao/core', { nativeAppKey: KAKAO_NATIVE_KEY }])

const config: ExpoConfig = {
  name: 'TravelPack',
  slug: 'travelpack',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'travelpack',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.travelpack.mobile',
    // 표준 암호화(HTTPS)만 사용 → App Store 수출규정 자진신고 면제
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'app.travelpack.mobile',
    adaptiveIcon: {
      backgroundColor: '#1D3557',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    predictiveBackGestureEnabled: false,
  },
  plugins,
  web: { favicon: './assets/favicon.png' },
  owner: 'eunmiyoon',
  extra: { eas: { projectId: '1f304bfc-316e-4c2e-bde2-925ee7040daf' } },
}

export default config
