import { useState } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import { colors } from '../theme'

// 지도 렌더 — OpenStreetMap(Leaflet) 기반. API 키·도메인 등록이 전혀 필요 없어 어디서나 동작한다.
//  (과거 Kakao JS SDK WebView는 등록 도메인에서만 동작해 실기기/에뮬레이터에서 자주 실패 → OSM로 일원화)
// 번호 마커 + 경로선(폴리라인) + 자동 영역 맞춤.
export const MAP_ENABLED = true

export interface MapMarker { lat: number; lng: number; label?: string; done?: boolean }

interface Props {
  lat: number
  lng: number
  markers?: MapMarker[]
  zoomLevel?: number
  height?: number
  style?: ViewStyle
}

export function MapView({ lat, lng, markers, zoomLevel = 13, height = 200, style }: Props) {
  const [failed, setFailed] = useState(false)
  const pts = markers && markers.length > 0 ? markers : [{ lat, lng }]
  if (failed) return <Placeholder height={height} markers={markers} style={style} />
  return (
    <View style={[{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bg2 }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(lat, lng, zoomLevel, pts), baseUrl: 'https://travelpack.app' }}
        style={{ flex: 1, backgroundColor: colors.bg2 }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        mixedContentMode="always"
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      />
    </View>
  )
}

function buildHtml(lat: number, lng: number, level: number, pts: MapMarker[]): string {
  const data = JSON.stringify(pts.map((p) => ({ lat: p.lat, lng: p.lng, done: Boolean(p.done) })))
  // Leaflet 줌(0~19) — 코스 단위는 13 안팎이 적절
  const zoom = Math.max(3, Math.min(18, level))
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#F7F7F9}
  .num{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
       background:#FF6B35;color:#fff;font:700 13px/1 -apple-system,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
  .num.done{background:#12B76A}
  .leaflet-control-attribution{font-size:9px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  try{
    var pts=${data};
    var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    var line=[],bounds=[];
    pts.forEach(function(p,i){
      var icon=L.divIcon({className:'',html:'<div class="num'+(p.done?' done':'')+'">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]});
      L.marker([p.lat,p.lng],{icon:icon}).addTo(map);
      line.push([p.lat,p.lng]);bounds.push([p.lat,p.lng]);
    });
    if(pts.length>1){
      L.polyline(line,{color:'#FF6B35',weight:4,opacity:0.9}).addTo(map);
      map.fitBounds(bounds,{padding:[28,28]});
    }
  }catch(e){
    document.body.innerHTML='<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#8B95A1;font-family:-apple-system,sans-serif">지도를 불러올 수 없어요</div>';
  }
</script></body></html>`
}

function Placeholder({ height, markers, style }: { height: number; markers?: MapMarker[]; style?: ViewStyle }) {
  const done = markers?.filter((m) => m.done).length ?? 0
  return (
    <View style={[styles.ph, { height }, style]}>
      <Text style={styles.phText}>지도</Text>
      {markers && markers.length > 0 && (
        <Text style={styles.phSub}>경유지 {markers.length}곳{done ? ` · ${done} 완료` : ''}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  ph: { backgroundColor: colors.bg2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  phText: { color: colors.textSub, fontWeight: '600' },
  phSub: { color: colors.textHint, fontSize: 12 },
})
