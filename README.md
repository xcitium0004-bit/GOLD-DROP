# 골드드롭 (GoldDrop)

> **"떨어뜨릴 때마다 심장이 뛰는 숫자 퍼즐"**
> 설치 없이 브라우저에서 바로 돌아가는 웹게임입니다.
> 이 문서 하나로 **GitHub Pages 무료 호스팅 → Google 애드센스 승인 → 광고 붙이기 → 수익 확인**까지 전부 끝낼 수 있습니다.

---

## 게임 소개

블록을 탭한 열로 떨어뜨려 같은 숫자끼리 합치는 미션형 퍼즐입니다.

- **단계 미션**: 단계마다 목표 점수 + 제한 드롭. 클리어 시 별 1~3개와 젬 보상
- **연쇄 설계**: 연쇄 배율 0.6배 → 2 → 4 → 7 → 11 → 16배. 아무 데나 눌러서는 절대 목표점수에 못 미는 구조
- **두배 도전**: 클리어 보상을 안전하게 가져가거나, 확률 게임(46%→36%→26%)에 걸고 2·4·8배로 불리기
- **오늘의 행운 룰렛**: 하루 1회 무료 스핀. 연속 접속 일수(스트릭)에 따라 가중치 유리
- **마감 보석 상자**: 판 종료마다 등급 추첨(일반/희귀/영웅/전설). 시청 광고로 하루… 가 아니라 *판마다* 한 번 더 열기 가능
- **황금코인**: 머지 폭발 옆에 끼면 산산조각 나며 점수 + 젬 지급
- **오프라인 플레이**: 한 번 들어오면 서비스워커 덕분에 와이파이 없어도 계속 됩니다

게임의 모든 재화(점수·별·젬)는 **현금과 무관한 가상 재화**입니다. 구매·현금 교환 기능은 일절 없으며,
광고 시청 또는 게임 플레이로만 얻을 수 있습니다. 이 구조는 Google 정책상 시뮬레이션 도박 이슈와도
거리가 있도록 설계되어 있으니, 이 부분을 다른 방식으로 변경하지 마세요. (자세한 것은 "정책 체크" 항목)

---

## 폴더 구조

```
업로드할 폴더 (내용물 전체)
├── index.html          게임 홈페이지 (심장)
├── privacy.html        개인정보 처리방침 (애드센스 심사에 반드시 필요)
├── 404.html            잘못된 주소 안내 페이지
├── manifest.json       홈 화면 추가(PWA) 설정
├── sw.js               오프라인 지원 (파일 수정 시 CACHE_NAME 문자열 변경 필수!)
├── robots.txt          검색엔진 크롤러 안내
├── ads.txt             ← 애드센스 승인 후 직접 만들어 넣으세요 (아래 STEP 5)
├── css/style.css       디자인 전부
├── js/
│   ├── config.js       ★ 밸런스·보상 확률·광고 빈도 조절 전용 (코멘트 읽고 숫자만 바꾸세요)
│   ├── audio.js        효과음 (Web Audio 합성, 음원 파일 0바이트)
│   ├── economy.js      젬·룰렛·두배 도전·상자 확률 로직
│   ├── board.js        게임 규칙 엔진 (머지/코인/돌블록/목표점수 공식)
│   ├── renderer.js     캔버스 그리기
│   └── main.js         흐름 제어 + 광고 매니저
└── icons/              앱 아이콘 3종
```

---

## STEP 1. GitHub Pages 배포 (약 5분, 무료)

### 방법 A. 웹사이트에서 클릭만 하기 (추천)

1. https://github.com 회원가입 / 로그인
2. 우측 상단 **`+` → New repository** 클릭
   - Repository name: 예) `gold-drop`
   - Public 선택 → **Create repository**
3. 생성된 저장소 화면에서 **"uploading an existing file"** 링크 클릭
   - 이 폴더의 **파일 전부**(폴더 자체 말고 내용물!)를 드래그해서 놓기
   - `index.html`, `js`, `css`, `icons` 등이 최상위에 보여야 합니다
4. 맨 아래 **Commit changes** 클릭 → 업로드 완료
5. 저장소 상단 메뉴 **Settings → 좌측 Pages** 클릭
   - Branch: `main` / 폴더: `/(root)` 로 두고 **Save**
6. 30초~2분 후 새로고침하면 상단에 주소가 뜹니다:
   `https://사용자명.github.io/gold-drop/`

> ⚠️ 업로드했는데 404가 나오면? STEP 1-5에서 Pages 저장 버튼을 눌렀는지,
> index.html이 저장소 최상위(root)에 있는지부터 확인하세요. 반영에 최대 몇 분 걸립니다.

### 방법 B. git 커맨드라인

```bash
git clone https://github.com/사용자명/gold-drop.git
cd gold-drop
# 이 폴더 안 파일들을 여기에 복사한 뒤:
git add .
git commit -m "첫 배포"
git push origin main
```

이후 Settings → Pages 에서 위와 동일하게 활성화하면 됩니다.

### 사이트 주소 짧게 줄이기 (선택)

GitHub Pages 주소는 `username.github.io/저장소이름` 형태입니다. 도메인을 갖고 있다면
Settings → Pages → Custom domain 에 입력하고 DNS에 CNAME 레코드만 추가하면 됩니다.
지금은 생략해도 아무 지장 없습니다.

---

## STEP 2. 애드센스 가입 & 심사 준비

1. https://adsense.google.com 접속 → **시작하기**
2. 사이트 URL에 STEP 1에서 만든 주소(`https://...github.io/gold-drop/`) 입력
3. 결제 정보 등록 (수익 수령용. 지금 당장 돈 내는 건 아무것도 없음)

### 심사 통과 체크리스트 (통과율을 올리는 실전 팁)

- [ ] `privacy.html` 안의 `[본인 이메일 주소를 여기에 적으세요]` 를 실제 주소로 교체 (메모장으로 열어 수정 후 재업로드)
- [ ] 사이트가 `https://` 로 열리는지 확인 (GitHub Pages는 자동으로 https)
- [ ] **콘텐츠량 보강**: index.html 하단에는 이미 소개·조작법·FAQ 글이 들어있지만,
      여기에 더해 자신만의 글 2~3편을 추가하면 통과율이 확실히 올라갑니다.
      예) 공략글("3연쇄 쌓는 법"), 팁 모음, 업데이트 소식 등. 검색 노출(SEO)에도 직결됩니다.
- [ ] 페이지가 모바일에서 깨지지 않는지 휴대폰으로 직접 접속 확인
- [ ] `robots.txt`, `privacy.html` 존재 확인 (이미 포함되어 있습니다)

심사는 보통 며칠~2주 걸립니다. 통과하면 애드센스 알림 메일이 옵니다.

---

## STEP 3. 사이트 인증 코드 삽입 (승인 첫걸음)

애드센스 최초 연결 시 발급되는 인증 meta 태그:

1. 애드센스 홈 → **계정 → 사이트** → 내 사이트 → "사이트 인증" 코드 복사
   (`<meta name="google-adsense-account" content="ca-pub-XXXXXXXXXXXXXXXX">` 형태)
2. `index.html` 을 편집기(메모장·VS Code 등)로 열기
3. `<head>` 안쪽의 **"[애드센스 ①단계] 사이트 인증 코드 넣는 자리"** 주석을 찾기
4. 아래처럼 주석을 제거하고 본인 코드를 붙여넣기:

```html
<meta name="google-adsense-account" content="ca-pub-본인번호">
```

5. 저장 후 STEP 1 방법대로 GitHub에 재업로드(파일 교체 드래그 → Commit)

---

## STEP 4. 광고 단위 만들어 붙이기 (핵심!)

애드센스 승인 후: **광고 → 단위별 광고 → 디스플레이 광고** 로 이동해 아래 5종을 만듭니다.
각각 만들 때마다 발급되는 코드 조각(`<ins class="adsbygoogle"...></ins>`과 그 앞 script 한 줄)을
정해진 자리에 붙여넣으면 됩니다.

| # | 광고 단위 | 이름(예시) | 붙여넣을 위치 |
|---|----------|-----------|---------------|
| 1 | 디스플레이 (고정 320×100 또는 반응형) | top-banner | index.html 의 `▲▼▼ 여기에 상단 광고 단위 코드 ▼▼▼` 자리 |
| 2 | 디스플레이 (반응형) | bottom-banner | index.html 의 `▼▼▼ 여기에 하단 광고 단위 코드 ▼▼▼` 자리 |
| 3 | 전면형 오버레이용 디스플레이 | inter-panel | index.html 의 `▼▼▼ 전면형 광고 단위 코드 ▼▼▼` 자리 (id=`adRealBox`) |
| 4 | 리워드형(H5 게임용 리워드 등) | reward-unit | index.html 의 `▼▼▼ 리워드형 광고 단위 코드 ▼▼▼` 자리 (id=`adRewardBox`) |
| 5 | 인아티클 | in-article | index.html 하단 article 의 `ad-inarticle` div 안 |

붙여넣기 규칙(공통):

```html
<!-- 예: 상단 배너 -->
<div class="ad-slot ad-top">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-본인번호"
          crossorigin="anonymous"></script>
  <ins class="adsbygoogle"
       style="display:block"
       data-ad-client="ca-pub-본인번호"
       data-ad-slot="1234567890"
       data-ad-format="auto"
       data-full-width-responsive="true"></ins>
</div>
```

- 3·4번(전면/리워드 패널)은 **div 사이에 ins 태그만 있으면** 게임 코드가 자동으로 인식합니다.
  실제 광고가 들어있으면 테스트 화면 대신 진짜 광고가 노출됩니다.
- 게임오버 2번째마다 / 클리어 3번째마다 전면 패널이 뜨고(90초 쿨다운),
  부활·상자 재개봉에 리워드 패널이 사용됩니다. 빈도 조절은 `config.js`의 `ADS` 섹션에서:
  - `INTERSTITIAL_EVERY_N_OVER`: 게임오버 몇 번마다 전면 노출
  - `INTERSTITIAL_MIN_GAP_MS`: 최소 간격 (90초 이하로 낮추면 정책 위험!)
  - `TEST_MODE`: ★ **실서비스 시작 시 false 로 바꾸세요.** true 로 두면 광고가 없는
    환경에서 임시 안내판이 표시됩니다. 실제 광고 코드가 전부 붙은 뒤에도 남겨두면
    광고 차단 상황(국가·확장프로그램)에서 임시판이 뜨므로 운영 단계에서는 반드시 false.

### H5 Games Ads 리워드 어댑터 (고급, 선택)

AdSense H5 Games Ads Beta를 쓴다면 `index.html` 에 스크립트 추가 후 아래 전역 객체만 정의하세요:

```html
<script>
window.MDRewarded = {
  show: function(onReward, onFail) {
    // H5 Games Ads SDK 호출부를 여기에 작성
    // 성공: onReward() 호출 / 실패: onFail()
  }
};
</script>
```

없으면 게임 내장 리워드 패널(id=`ovReward`)로 동작합니다.

---

## STEP 5. ads.txt 만들기 (루트에 필수)

승인 후 몇 주 내 콘솔에 "ads.txt" 경고가 뜨면:

1. 메모장에 아래 한 줄 (본인 pub 번호로 교체):

```
google.com, pub-본인번호, DIRECT, f08c47fec0942fa0
```

2. 파일명 `ads.txt`(확장자 없음)로 저장 → 저장소 최상위에 업로드

인식까지 보통 며칠 걸립니다.

---

## 정책 체크 (광고 정지 안 당하는 운영 원칙)

- ❌ "광고를 눌러주세요", "클릭해 주세요" 같은 문구는 절대 UI에 넣지 마세요.
- ❌ 자기 사이트 광고를 본인이 클릭하지 마세요. (계정 정지 1순위 사유)
- ❌ 게임 재화를 현금/상품권으로 교환하는 기능을 붙이지 마세요. 현재 구조는 현금 무관 가상 재화라 안전합니다.
- ⚠️ 광고 코드 위치(div들)는 그대로 두고 config 숫자로만 빈도 조절하세요.
- ✅ 콘텐츠(공략 글 등)를 계속 늘리면 심사·수익 모두 좋아집니다.
- 아동 대상 서비스 표시 권한: 애드센스 설정에서 사이트에 대한 "아동 대상" 라벨(Tagged for child-directed)은
  기본값(비아동)으로 두면 됩니다.

---

## Search Console 등록 (검색 유입 받기)

1. https://search.google.com/search-console 접속
2. 속성 유형 **URL 접두어** 선택 → 자신의 Pages 주소 입력
3. 소유권 확인: "HTML 태그" 방식 → 발급된 meta 태그를 `index.html <head>`에 추가 → 업로드 → 확인
4. 좌측 Sitemaps 메뉴에 `sitemap.xml`이 없어도 OK. 색인 요청만 해도 크롤링됩니다.
   (원한다면 "sitemap 빌더" 검색해서 xml 하나 만들어 올려도 좋습니다)

검색 노출 키워드는 index.html 의 `<meta name="keywords">`와 FAQ 본문이 담당합니다.

---

## 밸런스·보상 조절 가이드 (config.js)

운영하면서 숫자를 조정할 일이 많은 곳만 모았습니다. 코드 몰라도 주석 따라 바꾸면 됩니다.

| 원하는 것 | 고칠 곳 |
|---|---|
| 초반 난이도 완화 | `STAGE.TARGET_BASE/LINEAR/GROWTH` ↓ |
| 한 단계 더 오래 하고 싶다 | `STAGE.DROPS_BASE/CAP` ↑ |
| 클리어 보상 풍성하게 | `GEMS.CLEAR_BASE / PER_STAR` ↑ |
| 두배 도전 확률 조절 | `DOUBLEUP.CHANCES` (기본 46/36/26%) |
| 룰렛 짜릿함 ↑ | `WHEEL.SEGMENTS` 의 w 값 비중 조정 — 현재 평균 약 19젬/회전 |
| 상자 더 통하게 | `CHEST.TABLE` 의 chance & gems — 현재 평균 약 8젬/개봉 |
| 코인 더 자주 등장 | `COIN.BASE_CHANCE/MAX_CHANCE` (과하면 판 관리가 쉬워져 골미달이라 주의) |
| 부활 가격 | `GEMS.REVIVE_COST` |

확률값은 코드 변경 없이 동작합니다. 단, `CHEST.TABLE.chance` 합이 100이 되도록 유지하면 관리가 편합니다.

---

## 업데이트 배포 시 주의 (캐시)

서비스워커(sw.js) 덕분에 오프라인이 되지만, 그 대가로 파일을 고쳐도 **방문자 화면에 옛날
버전이 남을 수 있습니다.** 게임 파일(js/css/html)을 수정해 다시 올릴 때는
`sw.js` 파일의 `CACHE_NAME = 'gold-drop-core'` 문자열을 살짝 바꿔 올리세요.
(예: `'gold-drop-core-b'` → `'gold-drop-core-c'`) 방문자가 다음 접속 시 최신 파일을 받습니다.

---

## 트러블슈팅

| 증상 | 확인할 곳 |
|---|---|
| 사이트 404 | STEP 1-5 Pages 활성화 여부, index.html이 root에 있는지 |
| 광고가 아예 안 떠요 | 승인 전인지? 인증 meta 넣었는지? TEST_MODE 값을 false 로 했는지? |
| 광고 심사 거절 | privacy 이메일 치환 여부, 콘텐츠 양(공략 글 추가), 트래픽 유입 경로 |
| 부활 버튼이 사라짐 | 리워드 광고 코드가 없는데 TEST_MODE=false 일 때의 정상 동작 |
| 젬/기록 초기화 | 브라우저 사이트 데이터 삭제 시 초기화됩니다 (기기 동기화 없음) |
| 수정했는데 반영 안 됨 | sw.js의 CACHE_NAME 문자열 변경 후 재업로드 |

---

## 트래픽 분석 달기 (선택)

GA4(https://analytics.google.com)에서 데이터 스트림 만들기 → 발급되는
`<script async src=...gtag...>` 두 줄을 `index.html`의 `<head>`에 넣으면
방문 수·플레이 시간·유입 경로가 쌓입니다. 광고 배치 실험(A/B)에 필수적인 데이터라 추천합니다.

수익 기대치 참고: 웹게임+퍼즐 장르 RPM은 지역·시즌에 따라 크게 다르지만(한국 모바일 기준 통상
몇백 원~수천 원/1,000노출), 지금 구조는 광고 노출을 **게임 흐름 사이(전면)** + **보상 대가(리워드)** +
**본문(배너·인아티클)** 세 겹으로 배치해, 세션당 노출 횟수를 늘리면서 이탈은 피하도록 설계되어 있습니다.
