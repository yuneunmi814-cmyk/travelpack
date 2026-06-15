import subprocess, os
SRC = open('/Users/yoon/Documents/travelpack/design/gen-screens.py').read()
prefix = SRC.split('\nACTIVE=')[0]           # 헬퍼+S(화면정의)까지만, 하단 생성 루프 제외
ns = {}; exec(prefix, ns)
S, frame = ns['S'], ns['frame']
FONT, ORANGE = ns['FONT'], ns['ORANGE']
ACTIVE = {"01-home":0,"02-course":1,"03-guide":2,"04-checkin":2,"05-market":1,"06-paywall":1,"07-editor":4,"08-about":4}
CAP = {"01-home":"검증된 추천 코스로 시작","02-course":"일자별 일정을 한눈에","03-guide":"가이드 모드로 경로 안내",
       "04-checkin":"도착하면 자동 체크인","05-market":"여행 고수의 코스 둘러보기","06-paywall":"전체 일정, 무료 공개",
       "07-editor":"나만의 여행팩 만들기","08-about":"안전한 서비스·약관 안내"}
def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

OUT = "/Users/yoon/Documents/travelpack/design/store/ios"; os.makedirs(OUT, exist_ok=True)
W, H = 1290, 2796               # iPhone 6.7" — App Store Connect 필수 사이즈
PW = 980; PH = PW*2; PX = (W-PW)//2; PY = 720
sx = PW/300.0; sy = PH/600.0
cardX = PX + round(8*sx); cardY = PY + round(8*sy)
cardW = round(284*sx); cardH = round(584*sy); cardR = round(34*sx)

for name, inner in S.items():
    fsvg = frame(inner, ACTIVE.get(name))
    nested = fsvg.replace('width="300" height="600"', f'x="{PX}" y="{PY}" width="{PW}" height="{PH}"', 1)
    canvas = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23456b"/><stop offset="1" stop-color="#14283f"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<text x="{W//2}" y="210" font-size="46" fill="{ORANGE}" font-weight="800" text-anchor="middle">TravelPack</text>
<text x="{W//2}" y="372" font-size="78" fill="#ffffff" font-weight="800" text-anchor="middle">{esc(CAP[name])}</text>
<rect x="{cardX+10}" y="{cardY+20}" width="{cardW}" height="{cardH}" rx="{cardR}" fill="#06101d" opacity="0.33"/>
{nested}
</svg>'''
    sp = f"/tmp/ios-{name}.svg"; pp = f"{OUT}/{name}.png"
    open(sp, "w").write(canvas)
    subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), "-o", pp, sp], check=True)
    print("wrote", pp)
print("done")
