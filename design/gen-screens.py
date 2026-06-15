import subprocess, os
OUT = "/Users/yoon/Documents/travelpack/design/screens"; os.makedirs(OUT, exist_ok=True)
FONT = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"
ORANGE="#FF6B35"; DEEP="#C24818"; WEAK="#FFF0E9"; NAVY="#1D3557"; GREEN="#12B76A"
LINE="#E7EAEE"; BG="#F7F7F9"; SUB="#6B7684"; HINT="#8B95A1"; INK="#191F28"

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def T(x,y,s,size=13,fill=INK,w="400",anchor="start"):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{w}" text-anchor="{anchor}">{esc(s)}</text>'
def R(x,y,w,h,rx,fill,stroke=None,sw=1):
    s=f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}/>'
def pill(x,y,label,bg=WEAK,fg=DEEP,w=None):
    wpx = w or (len(label)*7.2+18)
    return R(x,y,wpx,22,11,bg)+T(x+wpx/2,y+15,label,11,fg,"600","middle")
def btn(label,y=540,fill=ORANGE):
    return R(28,y,244,42,12,fill)+T(150,y+27,label,14,"#fff","700","middle")
def marker(x,y,n,color=ORANGE):
    return f'<circle cx="{x}" cy="{y}" r="13" fill="{color}" stroke="#fff" stroke-width="3"/>'+T(x,y+4,str(n),11,"#fff","700","middle")

import base64
PHOTODIR="/Users/yoon/Documents/travelpack/design/screens/photos"
def img(x,y,w,h,slug,rx=12):
    b=base64.b64encode(open(f"{PHOTODIR}/{slug}.jpg","rb").read()).decode()
    cid=f"c{slug}{x}{y}"
    return (f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/></clipPath>'
            f'<image href="data:image/jpeg;base64,{b}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{cid})"/>')
def overlay(x,y,w,h,rx=14,op=0.32):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="#0B1B2E" opacity="{op}"/>'

def tabbar(active=0):
    labels=["홈","탐색","내 여행","저장","MY"]
    out=[R(8,556,284,36,0,"#fff")]
    out.append(f'<line x1="8" y1="556" x2="292" y2="556" stroke="{LINE}"/>')
    for i,l in enumerate(labels):
        cx=8+ (i+0.5)*(284/5)
        col=ORANGE if i==active else HINT
        out.append(f'<circle cx="{cx}" cy="572" r="3.2" fill="{col}"/>')
        out.append(T(cx,587,l,9,col,"700" if i==active else "400","middle"))
    return "".join(out)

def frame(inner, active=None):
    tb = tabbar(active) if active is not None else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600" viewBox="0 0 300 600" font-family="{FONT}">
<rect x="8" y="8" width="284" height="584" rx="34" fill="#fff" stroke="{LINE}" stroke-width="2"/>
<rect x="120" y="20" width="60" height="8" rx="4" fill="{LINE}"/>
{inner}{tb}</svg>'''

S = {}

# 1) 홈
S["01-home"] = (
 T(24,54,"TravelPack",22,ORANGE,"800")
 + R(20,68,260,72,14,WEAK) + T(36,98,"커뮤니티 인기 여행팩",14,DEEP,"800")
 + T(36,120,"여행 고수의 코스를 무료로 둘러보기",10.5,DEEP) + T(264,108,"›",20,DEEP,"700","end")
 + T(24,172,"이번 주 추천 코스",14,NAVY,"700")
 + R(20,184,120,124,12,"#fff",LINE)+img(20,184,120,66,"seongsan")+T(30,272,"제주 동부 힐링 2일",10.5,NAVY,"700")+T(30,290,"명소 8곳 · 2일",9,HINT)
 + R(150,184,120,124,12,"#fff",LINE)+img(150,184,120,66,"hamdeok")+T(160,272,"제주 함덕 바다 1일",10.5,NAVY,"700")+T(160,290,"명소 5곳 · 당일",9,HINT)
 + T(24,338,"어디로 떠날까요",14,NAVY,"700")
 + pill(20,352,"제주 12",WEAK,DEEP)+T(86,366,"인기",9,ORANGE,"700")
 + pill(112,352,"부산 8")+pill(168,352,"경주 6")+pill(224,352,"여수 5")
 + T(24,420,"#힐링",14,NAVY,"700")
 + R(20,434,120,96,12,"#fff",LINE)+img(20,434,120,52,"gwangchigi")+T(30,508,"광치기 해변",10,NAVY,"700")
 + R(150,434,120,96,12,"#fff",LINE)+img(150,434,120,52,"woljeongri")+T(160,508,"월정리 해변",10,NAVY,"700")
)
# 2) 코스 상세
S["02-course"] = (
 img(20,40,260,108,"seongsan",14)+overlay(20,40,260,108)+T(150,100,"제주 동부 힐링 2일",16,"#fff","800","middle")
 + T(24,178,"제주 동부 힐링 2일",16,NAVY,"800")+T(24,200,"검증된 코스를 따라 편하게",11,SUB)
 + pill(24,214,"2일")+pill(60,214,"명소 8곳")+pill(140,214,"약 20만원")
 + T(24,266,"Day 1",13,ORANGE,"800")+R(60,256,44,16,8,WEAK)+T(82,267,"Day 2",10,DEEP,"600","middle")
 + marker(34,300,1)+T(54,304,"성산일출봉",12,INK,"600")+T(264,304,"90분",10,HINT,"400","end")
 + marker(34,336,2)+T(54,340,"광치기 해변",12,INK,"600")+T(264,340,"40분",10,HINT,"400","end")
 + marker(34,372,3)+T(54,376,"섭지코지",12,INK,"600")+T(264,376,"60분",10,HINT,"400","end")
 + R(20,402,260,86,12,BG)
 + '<path d="M70,430 L150,450 L120,478 L200,470" stroke="'+ORANGE+'" stroke-width="3" fill="none" stroke-linecap="round"/>'
 + marker(70,430,1,GREEN)+marker(200,470,4)
 + btn("이 코스로 여행 시작",500)
)
# 3) 가이드 모드
S["03-guide"] = (
 T(24,52,"가이드 모드",15,NAVY,"800")
 + R(20,66,260,300,14,BG)
 + '<path d="M70,120 L150,180 L120,270 L210,320" stroke="'+ORANGE+'" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 + marker(70,120,1,GREEN)+marker(150,180,2,GREEN)+marker(120,270,3)+marker(210,320,4)
 + R(20,380,260,72,12,"#fff",LINE)+T(36,406,"다음 목적지",10,HINT)+T(36,430,"성산일출봉",15,NAVY,"700")+T(264,430,"1.2km",13,ORANGE,"700","end")
 + btn("도착했어요 · 체크인",474)
)
# 4) 체크인 완료
S["04-checkin"] = (
 f'<circle cx="150" cy="150" r="46" fill="{GREEN}" opacity="0.12"/>'
 + f'<path d="M131,150 l13,13 l25,-27" stroke="{GREEN}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
 + f'<circle cx="150" cy="150" r="46" fill="none" stroke="{GREEN}" stroke-width="3"/>'
 + T(150,250,"체크인 완료!",18,NAVY,"800","middle")
 + T(150,276,"성산일출봉에 잘 도착했어요",12,SUB,"400","middle")
 + R(40,310,220,70,14,BG)+T(60,340,"여행 진행률",11,HINT)+T(60,362,"3 / 8 완료",16,NAVY,"800")
 + R(150,326,90,38,8,WEAK)+T(195,350,"37%",16,DEEP,"800","middle")
 + btn("다음 장소로 안내",470)
)
# 5) 마켓플레이스
S["05-market"] = (
 T(24,52,"여행팩 둘러보기",15,NAVY,"800")
 + pill(20,66,"인기순",ORANGE,"#fff",64)+pill(90,66,"최신순",BG,SUB,64)
 + R(20,104,260,118,12,"#fff",LINE)+R(20,104,260,64,12,"#FCE2D6")
 + T(34,192,"현지인의 제주 비밀코스",13,NAVY,"800")
 + T(34,210,"제주 · 1박2일 · 명소 7곳",10,HINT)+pill(150,200,"by 노하우장인","#E8EDF5",NAVY)+T(264,210,"♡ 128",11,HINT,"600","end")
 + R(20,234,260,118,12,"#fff",LINE)+R(20,234,260,64,12,"#D9F0E3")
 + T(34,322,"부산 토박이 먹방코스",13,NAVY,"800")
 + T(34,340,"부산 · 당일 · 명소 6곳",10,HINT)+pill(150,330,"by 미식가J","#E8EDF5",NAVY)+T(264,340,"♡ 94",11,HINT,"600","end")
 + R(20,364,260,118,12,"#fff",LINE)+R(20,364,260,64,12,"#BFE3F5")
 + T(34,452,"경주 역사 한바퀴",13,NAVY,"800")
 + T(34,470,"경주 · 당일 · 명소 8곳",10,HINT)+pill(150,460,"by 역사덕","#E8EDF5",NAVY)+T(264,470,"♡ 71",11,HINT,"600","end")
)
# 6) 커뮤니티 여행팩 상세 (무료 — 전체 공개)
S["06-paywall"] = (
 R(20,40,260,84,14,ORANGE)+T(150,78,"현지인의 제주 비밀코스",14,"#fff","800","middle")+T(150,102,"by 노하우장인",11,"#FFE0D2","400","middle")
 + pill(20,138,"무료",WEAK,DEEP,46)+pill(72,138,"1박2일")+pill(130,138,"명소 7곳")+T(264,152,"♡ 128 저장",10,HINT,"600","end")
 + T(24,186,"Day 1",12,ORANGE,"800")
 + marker(34,214,1)+T(54,218,"성산일출봉",12,INK,"600")+T(264,218,"90분",10,HINT,"400","end")
 + marker(34,250,2)+T(54,254,"광치기 해변",12,INK,"600")+T(264,254,"40분",10,HINT,"400","end")
 + marker(34,286,3)+T(54,290,"섭지코지",12,INK,"600")+T(264,290,"60분",10,HINT,"400","end")
 + T(24,328,"Day 2",12,NAVY,"800")
 + marker(34,356,1)+T(54,360,"비자림",12,INK,"600")+T(264,360,"80분",10,HINT,"400","end")
 + marker(34,392,2)+T(54,396,"월정리 해변",12,INK,"600")+T(264,396,"90분",10,HINT,"400","end")
 + R(20,494,46,42,12,"#fff",LINE)+T(43,520,"♡",18,SUB,"400","middle")
 + R(74,494,198,42,12,ORANGE)+T(173,521,"이 코스로 여행 시작",14,"#fff","800","middle")
)
# 7) 코스 작성기
S["07-editor"] = (
 T(24,52,"여행팩 만들기",15,NAVY,"800")
 + T(24,84,"제목",11,SUB,"700")+R(20,92,260,34,8,"#fff",LINE)+T(32,114,"현지인의 제주 비밀코스",12,INK)
 + T(24,146,"지역",11,SUB,"700")+pill(20,154,"제주",ORANGE,"#fff")+pill(72,154,"부산")+pill(124,154,"경주")
 + T(24,200,"기간",11,SUB,"700")
 + R(20,208,150,34,8,"#fff",LINE)+T(40,230,"−      2일      +",12,NAVY,"700")
 + T(24,266,"Day 1",12,NAVY,"800")
 + R(20,276,260,30,8,BG)+T(34,295,"1  성산일출봉",11,INK,"600")+T(248,295,"▲ ▼ ✕",10,SUB,"400","end")
 + R(20,310,260,30,8,BG)+T(34,329,"2  광치기 해변",11,INK,"600")+T(248,329,"▲ ▼ ✕",10,SUB,"400","end")
 + R(20,346,260,30,8,WEAK)+T(150,365,"+ 스팟 추가",11,ORANGE,"700","middle")
 + R(20,500,124,40,12,"#fff",LINE)+T(82,525,"임시저장",13,SUB,"700","middle")
 + R(156,500,124,40,12,ORANGE)+T(218,525,"검수 요청",13,"#fff","700","middle")
)
# 8) 사업자정보·약관
S["08-about"] = (
 T(24,52,"사업자 정보 · 약관",15,NAVY,"800")
 + R(20,68,260,150,12,"#fff",LINE)+T(34,92,"사업자 정보",13,NAVY,"800")
 + T(34,116,"상호",10,SUB)+T(140,116,"프로젝트윤",10,INK,"600")
 + T(34,136,"대표자",10,SUB)+T(140,136,"윤은미",10,INK,"600")
 + T(34,156,"위치기반서비스",10,SUB)+T(140,156,"신고 완료",10,INK,"600")
 + T(34,176,"통신판매업",10,SUB)+T(140,176,"간이과세자 면제",10,INK,"600")
 + T(34,196,"문의",10,SUB)+T(140,196,"yuneunmi814@gmail.com",10,INK,"600")
 + R(20,232,260,66,12,BG)+T(34,256,"통신판매중개자 고지",12,NAVY,"800")+T(34,277,"유료 코스 거래의 중개자이며 거래",10,SUB)+T(34,291,"당사자가 아닙니다.",10,SUB)
 + R(20,314,260,168,12,"#fff",LINE)+T(34,338,"약관 및 정책",13,NAVY,"800")
 + T(34,368,"이용약관",12,INK)+T(264,368,"›",14,HINT,"400","end")
 + T(34,400,"개인정보처리방침",12,INK)+T(264,400,"›",14,HINT,"400","end")
 + T(34,432,"위치기반서비스 이용약관",12,INK)+T(264,432,"›",14,HINT,"400","end")
 + T(34,464,"청약철회 및 환불정책",12,INK)+T(264,464,"›",14,HINT,"400","end")
)

ACTIVE={"01-home":0,"02-course":1,"03-guide":2,"04-checkin":2,"05-market":1,"06-paywall":1,"07-editor":4,"08-about":4}
for name, inner in S.items():
    svg = frame(inner, ACTIVE.get(name))
    sp=f"/tmp/{name}.svg"; pp=f"{OUT}/{name}.png"
    open(sp,"w").write(svg)
    subprocess.run(["rsvg-convert","-w","600","-h","1200","-o",pp,sp],check=True)
    print("wrote", pp)
