import { Alert, Linking } from 'react-native'

// 외부 지도 앱으로 길찾기(목적지 안내) — API 키 불필요. 사용자의 카카오맵/구글지도 앱(또는 웹)으로 연결한다.
//  카카오맵: map.kakao.com/link/to 는 앱 설치 시 앱으로, 없으면 웹으로 열려 항상 동작.
export async function openDirections(lat: number, lng: number, name: string) {
  const place = name?.trim() || '목적지'
  const kakaoWeb = `https://map.kakao.com/link/to/${encodeURIComponent(place)},${lat},${lng}`
  const kakaoApp = `kakaomap://route?ep=${lat},${lng}&by=PUBLICTRANSIT`
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit`

  Alert.alert('길찾기', `${place}까지 안내받을 앱을 선택하세요`, [
    {
      text: '카카오맵',
      onPress: async () => {
        try {
          if (await Linking.canOpenURL(kakaoApp)) await Linking.openURL(kakaoApp)
          else await Linking.openURL(kakaoWeb)
        } catch {
          Linking.openURL(kakaoWeb).catch(() => {})
        }
      },
    },
    { text: '구글지도', onPress: () => Linking.openURL(google).catch(() => {}) },
    { text: '취소', style: 'cancel' },
  ])
}
