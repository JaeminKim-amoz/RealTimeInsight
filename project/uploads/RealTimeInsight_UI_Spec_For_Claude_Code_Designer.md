# RealTimeInsight UI 구현 명세서 (Claude Code Designer 전달용)

## 1. 문서 목적

이 문서는 **Claude Code Designer가 RealTimeInsight의 데스크톱 UI를 구현**할 수 있도록 만드는 단일 UI 명세서다.

이 문서는 다음을 목표로 한다.

- 실시간 분석과 사후 분석을 모두 지원하는 **하나의 통합 워크스테이션 UI** 정의
- 다수 채널, 다수 그래프, 지도, 비디오, 3D, LLM, 이상 탐지, 관계 그래프를 동시에 다루는 **고밀도 전문 UI** 정의
- 드래그 앤 드롭, 오버레이, 분할, 저장 가능한 워크스페이스, 오프라인 운용, SimDIS/지도/비디오/Matlab 연계를 반영한 **구체적 화면 동작 규칙** 정의
- Claude Code Designer가 **즉시 컴포넌트 구조와 화면 구현에 들어갈 수 있을 정도의 명확성** 제공

이 문서는 UI 구현 범위를 정의한다. 백엔드 프로토콜, Rust 코어, 디코더 내부 구현은 이 문서의 주범위가 아니다. 다만 UI가 전제로 삼아야 할 도메인 제약과 데이터 모델은 포함한다.

---

## 2. 제품 정의

### 2.1 제품명
- 제품명: **RealTimeInsight**
- 운영 모드:
  - **Live Mode**: 실시간 수신/분석/전시
  - **DataInsight Mode**: 저장 데이터 재생/사후 분석

### 2.2 제품 포지션
RealTimeInsight는 단순 차트 뷰어가 아니다. 다음을 통합하는 **오프라인 우선형 텔레메트리/전장 데이터 분석 워크스테이션**이다.

- 실시간 텔레메트리 수집 상태 모니터링
- 저장 데이터 재생 및 비교 분석
- 다채널 시계열 분석
- 스펙트럼/워터폴/이산신호/상태행렬 분석
- 비디오 동기 재생
- 지도/궤적/자세/3D 안테나 이득 시각화
- 이상 탐지 및 root cause 탐색
- relation graph / knowledge graph 기반 연관 분석
- 로컬 LLM 기반 설명/요약/질의 보조
- SimDIS/전술앱/전장 디지털 백본 확장 가능 구조

### 2.3 UI 설계 핵심 원칙
1. **한 화면에서 많은 정보를 동시에 볼 수 있어야 한다.**
2. **초보자는 단순하게, 전문가는 깊게 들어갈 수 있어야 한다.**
3. **실시간 분석과 사후 분석의 UX는 최대한 동일해야 한다.**
4. **그래프 배치, 그룹화, 오버레이, 분할은 사용자가 자유롭게 해야 한다.**
5. **오프라인 환경에서도 완전 동작 가능해야 한다.**
6. **LLM은 장식이 아니라 분석 보조도구여야 하며, 근거 기반이어야 한다.**
7. **이상점 클릭 → 연관 이상 추적 → 근거 그래프 탐색** 흐름이 매우 빨라야 한다.

---

## 3. 구현 대상 플랫폼

### 3.1 우선 플랫폼
- Desktop only
- Windows / Linux / macOS

### 3.2 UI 기술 전제
Claude Code Designer는 다음 전제를 기준으로 UI를 설계한다.

- Tauri 데스크톱 앱 셸
- 프런트엔드는 웹 기술 기반
- 고성능 그래프는 DOM 위젯이 아니라 **Canvas/WebGL/WebGPU 계열 렌더링 UI**를 전제로 구성
- 일반 폼/목록/트리/대화창은 일반 UI 컴포넌트 사용 가능

### 3.3 반응형 전략
이 앱은 모바일 앱이 아니다.

- 최소 대상 해상도: **1440 x 900**
- 권장 해상도: **1920 x 1080 이상**
- 최적 사용 환경: **듀얼 모니터 / 초광폭 모니터**

좁은 화면에서도 동작해야 하지만, 설계 기준은 **고밀도 데스크톱 전문 워크스테이션**이다.

---

## 4. 사용 대상

### 4.1 주요 사용자
- 전자/전기 엔지니어
- 기계 엔지니어
- 항공우주 엔지니어
- RF/통신/무선 신호처리 엔지니어
- 시험 계측 엔지니어
- 방산/전술 시스템 통합 엔지니어
- 데이터 분석가
- 지휘/상황 분석 보조 인력

### 4.2 사용자 수준
- 일반 사용자: 미리 정의된 레이아웃에서 기본 조회
- 중급 사용자: 채널 검색/드래그 앤 드롭/레이아웃 편집
- 고급 사용자: 멀티패널, SimDIS/지도/비디오 연동, anomaly graph, LLM 분석, Matlab export

---

## 5. 핵심 UX 시나리오

### 5.1 시나리오 A: 실시간 모니터링
1. 사용자가 Live Mode로 진입한다.
2. 좌측 채널 탐색기에서 채널을 검색한다.
3. 원하는 채널을 그래프 패널로 드래그한다.
4. 같은 패널 중앙에 놓으면 오버레이된다.
5. 패널 가장자리에 놓으면 상하/좌우 분할된다.
6. 하단 이벤트 로그에서 CRC 실패, 알람, sync loss를 본다.
7. 특정 이상점을 클릭한다.
8. 우측 Insight Pane에 root cause 후보와 relation graph가 열린다.
9. 지도 패널 또는 비디오 패널과 시간축이 동기화된다.
10. 필요한 구간만 CSV / Parquet / Matlab으로 내보낸다.

### 5.2 시나리오 B: 사후 분석
1. 사용자가 DataInsight Mode로 진입한다.
2. 저장된 raw/decoded run을 선택한다.
3. 시간범위를 스크럽한다.
4. 워터폴, XY, 3D attitude, map, video를 동시에 띄운다.
5. 이상 구간을 북마크한다.
6. 이상점 클릭 후 relation graph로 확장한다.
7. LLM에게 “왜 여기서 전류와 압력이 같이 튀었는가?”를 질의한다.
8. 관련 채널 추천을 받고, 클릭하여 추가 그래프를 자동 생성한다.
9. Matlab plot으로 같은 구간을 넘긴다.

### 5.3 시나리오 C: 전장/디지털 백본 확장형 분석
1. 사용자에게 지도 기반 상황 화면이 열린다.
2. 드론/로봇/플랫폼 트랙이 지도 또는 SimDIS 브리지 패널에 표시된다.
3. 관련 텔레메트리 그래프가 동기화되어 보인다.
4. 표적 이벤트나 이상 이벤트를 클릭하면 시간축과 위치가 같이 이동한다.
5. 의사결정 보조 카드가 우측에 열린다.
6. 사용자는 근거 채널, 관계 그래프, 관련 비디오, 관련 위치정보를 함께 본다.

---

## 6. 정보 구조(Information Architecture)

앱은 다음 8개 최상위 영역을 가진다.

1. **Top Command Bar**
2. **Channel Explorer Pane**
3. **Main Workspace**
4. **Insight Pane**
5. **Bottom Event / Status Bar**
6. **Command Palette / Search Overlay**
7. **Export / Integration Modal Layer**
8. **Settings / Workspace / Offline Asset Manager**

---

## 7. 기본 레이아웃

### 7.1 기본 화면 구조

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Command Bar                                                             │
│ Project | Mode | Source | Record | Replay | Time | Export | Layout | LLM    │
├────────────────┬────────────────────────────────────────────┬────────────────┤
│ Channel        │ Main Workspace                             │ Insight Pane   │
│ Explorer       │                                            │                │
│                │  [Dockable Panels Grid]                    │ Relation Graph │
│ Search         │                                            │ Root Cause     │
│ Filters        │  Strip / XY / Waterfall / Map / Video      │ LLM Assistant  │
│ Tree           │  3D / Discrete / Event / SimDIS            │ Candidate List │
│ Favorites      │                                            │ Evidence Cards │
├────────────────┴────────────────────────────────────────────┴────────────────┤
│ Bottom Event / Decoder / Alarm / CRC / FPS / Status / Time Cursor          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 기본 비율
- Top Bar: 고정 높이
- Left Channel Explorer: 280~360 px
- Right Insight Pane: 340~420 px
- Main Workspace: 가변
- Bottom Event Bar: 접힘/펼침 가능

### 7.3 레이아웃 원칙
- 좌측은 **탐색과 삽입**
- 중앙은 **분석과 시각화**
- 우측은 **해석과 추적**
- 하단은 **품질과 이벤트**

---

## 8. Top Command Bar 명세

### 8.1 포함 항목
- Project selector
- Mode switch (`Live`, `Replay`)
- Source status chip
- Record button / indicator
- Replay controls button group
- Global time / cursor display
- Layout preset dropdown
- Workspace save/load
- Export button
- Integrations menu
- LLM toggle
- Settings button

### 8.2 동작 규칙
- Live Mode에서는 source health, packet rate, frame validity 표시
- Replay Mode에서는 run name, playback rate, current time, loop 상태 표시
- Record 버튼은 Live Mode에서만 활성
- Replay controls는 Replay Mode에서만 활성
- Export는 항상 보이지만, context-aware modal로 동작

### 8.3 Replay control 구성
- Play / Pause
- Step forward / step backward
- Jump to bookmark
- Jump to alarm
- Speed x0.25 / x0.5 / x1 / x2 / x4
- Loop selection

---

## 9. Channel Explorer Pane 명세

### 9.1 목적
사용자가 채널을 찾고, 선택하고, 즐겨찾기하고, 드래그하여 패널에 배치하는 핵심 영역이다.

### 9.2 내부 구성
1. Search box
2. Quick filters
3. Group tree / channel tree
4. Favorites section
5. Recent section
6. Drag preview badge

### 9.3 Search 기능
검색은 다음 기준을 지원해야 한다.

- 채널명
- display name
- group / subgroup
- unit
- signal type
- frame id
- formula id
- enum label
- 태그

예시:
- `voltage`
- `rtd`
- `pressure unit:psi`
- `group:power`
- `type:spectrum`

### 9.4 Filter chips
- Analog
- Discrete
- Spectrum
- Derived
- Alarmed
- Favorite
- Good only
- Has formula
- Map-capable
- Video-linked
- AI-related

### 9.5 드래그 앤 드롭 규칙
채널/채널 그룹/저장된 쿼리/북마크 구간은 드래그 가능해야 한다.

드롭 시 규칙:
- **패널 중앙 드롭**: 기존 패널에 추가
- **패널 가장자리 드롭**: 새 분할 생성
- **빈 워크스페이스 드롭**: 새 패널 생성
- **패널 헤더 드롭**: 패널 탭 추가 또는 오버레이 그룹 선택 모드
- **특정 위젯 타입에 드롭**: 타입 호환 시 자동 매핑

### 9.6 다중 선택
- Ctrl/Cmd + click: 다중 선택
- Shift + click: 범위 선택
- 선택 채널 묶음을 한번에 드래그 가능

### 9.7 추천 기능
사용자가 하나의 채널을 선택하면, 하단 또는 우측 컨텍스트 팝업으로 다음을 제안할 수 있다.
- related channels
- same frame channels
- same subsystem
- same unit
- frequently overlaid with this channel
- anomaly correlated channels

---

## 10. Main Workspace 명세

### 10.1 개념
Main Workspace는 **도킹 가능한 패널 그리드**다.

각 패널은 다음 중 하나를 가진다.
- 단일 위젯
- 위젯 탭 그룹
- 다중 오버레이 그래프
- 상하/좌우 nested split

### 10.2 패널 공통 구조
각 패널은 다음을 가진다.
- Header
- Title
- Widget type badge
- Bound channels summary
- Quick actions
- Body
- Footer(optional)

### 10.3 패널 헤더 액션
- Rename panel
- Change widget type
- Overlay mode toggle
- Split horizontally
- Split vertically
- Undock / popout
- Clone
- Link cursor on/off
- Axis link on/off
- Export panel image
- Save as preset
- Close

### 10.4 도킹 규칙
- 패널은 자유 분할 가능
- 최소 패널 크기 존재
- 패널 재배치 drag handle 필요
- 탭 그룹 가능
- 동일 유형 패널끼리 자동 정렬 옵션 가능

### 10.5 Overlay / Split 규칙
#### Overlay
- 동일 패널에 여러 신호를 겹쳐 그린다.
- 같은 x축 공유
- y축은 다음 중 하나:
  - shared y-axis
  - left/right dual axis
  - normalized overlay
  - per-series scaled overlay

#### Split
- 채널을 서로 다른 축에 나누어 본다.
- 상하 / 좌우 분할 모두 가능
- 다수 채널 드롭 시 자동 split wizard 제공 가능

#### Compare mode
- 같은 채널의 서로 다른 run 비교
- 같은 시간 정렬 또는 event anchor 정렬

---

## 11. 위젯 타입 상세 명세

### 11.1 Strip Chart
**목적**: 가장 기본적인 시간축 시계열 표시

필수 기능:
- 다중 시계열 overlay
- zoom / pan
- cursor readout
- time-aligned vertical crosshair
- quality-colored markers
- anomaly marker
- alarm threshold line
- drag-to-select range
- point click

### 11.2 Multi-Strip
**목적**: 채널을 여러 행으로 분리해 공통 시간축으로 표시

필수 기능:
- 공통 x축
- 행별 y축 독립
- 행 reorder
- collapse/expand
- quick stats per row

### 11.3 Numeric Tile
**목적**: 현재값, 최소/최대, 평균, 품질, 단위 표시

필수 기능:
- status color
- stale indicator
- trend sparkline
- latest timestamp

### 11.4 Discrete / State Panel
**목적**: 이산신호, enum, bitfield, on/off 상태 표시

필수 기능:
- timeline mode
- lamp mode
- bit grid mode
- enum label display
- change events list

### 11.5 XY Plot
**목적**: 두 채널 간 관계 표시

필수 기능:
- scatter / line toggle
- time coloring option
- selected time window only
- anomaly points 강조

### 11.6 Waterfall
**목적**: 주파수 대역 데이터를 시간에 따라 누적 표시

필수 기능:
- scrolling waterfall
- colormap selector
- dynamic range control
- peak line overlay
- average line overlay
- pause / inspect row
- export image

### 11.7 Event Log
**목적**: 알람, CRC 실패, sync loss, user bookmark, anomaly, video discontinuity 등 표시

필수 기능:
- severity filter
- jump to time
- pin event
- generate analysis context

### 11.8 Map / Satellite Map
**목적**: 2D 지도 또는 위성지도 위 플랫폼/트랙/이벤트 표시

필수 기능:
- offline tile support
- basemap switch
- layers toggle
- tracks overlay
- icons / headings / trails
- time synchronized cursor
- click event to jump timeline
- measure tool
- ownship / target / AOI display

지도 타입:
- 2D vector map
- satellite imagery
- terrain-aware view (옵션)

### 11.9 SimDIS Bridge Panel
**목적**: SimDIS 연동 상태와 동기화 컨트롤 제공

필수 기능:
- connected / disconnected 상태
- linked timeline status
- selected track handoff
- open in SimDIS button
- receive from SimDIS selection button
- track sync table

주의:
- UI는 SimDIS를 앱 내부 기본 렌더러로 가정하지 않는다.
- 기본은 브리지/연동 패널이다.

### 11.10 Video Panel
**목적**: H.264 MPEG-2 TS 비디오 구간을 텔레메트리와 동기 재생

필수 기능:
- play / pause / step
- frame time display
- segment range select
- linked timeline
- event markers on scrub bar
- telemetry overlay toggle
- jump to selected anomaly

### 11.11 3D Attitude / Trajectory
**목적**: 자세, 방향, 궤적, platform state 표시

필수 기능:
- orbit camera
- reset view
- attitude axes
- playback trail
- follow mode
- inertial/body frame toggle

### 11.12 3D Antenna Gain Viewer
**목적**: 비행 자세와 연동된 상대 안테나 이득 3D 표시

필수 기능:
- mesh display
- pose-linked rotation
- gain scale legend
- lobe visibility control
- relative direction indicator

### 11.13 Relation Graph / Knowledge Graph
**목적**: 채널/이벤트/플랫폼/분석 결과 간 연관관계 표시

필수 기능:
- node expand/collapse
- evidence labels
- edge type filter
- highlight selected anomaly path
- click node to open graph(s)
- click edge to show why connected

이 그래프는 장식용이 아니라 **근거 그래프**여야 한다.

---

## 12. Insight Pane 명세

### 12.1 목적
Insight Pane은 사용자가 특정 구간 또는 특정 이상점을 선택했을 때, 그에 대한 해석·설명·후속 후보를 보여주는 영역이다.

### 12.2 기본 탭
- Summary
- Root Cause
- Relation Graph
- Evidence
- Related Channels
- LLM Chat
- Export Context

### 12.3 Summary 탭
표시 항목:
- 현재 선택 시간범위
- 선택 채널/이벤트 요약
- 품질상태
- 이상 여부
- 관련 시스템 그룹

### 12.4 Root Cause 탭
표시 항목:
- ranked candidate list
- confidence / score
- lead/lag 관계
- formula dependency
- shared subsystem tags
- evidence source chips

### 12.5 Evidence 탭
표시 항목:
- why this anomaly was detected
- which channels are involved
- which alarms fired
- CRC/sync issues around this time
- related video/map markers
- exportable evidence card

### 12.6 Related Channels 탭
- recommended channels list
- one-click add as overlay
- one-click add as split panel
- one-click open comparison layout

### 12.7 LLM Chat 탭
LLM은 자유 채팅처럼 보이되, 실제 UX는 **도구 기반 분석 assistant**여야 한다.

필수 요소:
- 질문 입력창
- suggested prompts
- tool calls summary strip
- cited evidence chips
- “add channels from answer” 버튼
- “create temporary analysis layout” 버튼

금지:
- 근거 없는 확정적 서술
- raw hallucination처럼 보이는 UI

---

## 13. Bottom Event / Status Bar 명세

### 13.1 목적
실시간 품질과 이벤트를 항상 사용자가 볼 수 있게 한다.

### 13.2 포함 요소
- Packet rate
- Frame rate
- CRC fail rate
- Sync loss count
- Decode errors
- Formula errors
- Alarm count
- Replay speed
- Cursor time
- Render FPS
- LLM backend state
- Offline asset state

### 13.3 확장 패널
하단 바를 펼치면 다음 탭이 보인다.
- Event log
- Decoder warnings
- CRC failures
- Export jobs
- Background processing status

---

## 14. Command Palette / Global Search

### 14.1 호출
- `Ctrl/Cmd + K`

### 14.2 기능
- 채널 검색
- 레이아웃 열기
- 워크스페이스 전환
- 북마크 이동
- 최근 anomaly 이동
- 패널 생성
- 위젯 타입 변경
- export 실행
- matlab plot 실행
- llm prompt 실행

### 14.3 결과 카테고리
- Channels
- Panels
- Layouts
- Bookmarks
- Events
- Commands
- Integrations

---

## 15. 이상점 클릭 기반 Knowledge Flow

이 기능은 제품 차별화의 핵심이다.

### 15.1 시작점
사용자가 그래프 위 특정 데이터 포인트를 클릭하거나 범위를 선택한다.

### 15.2 즉시 수행되어야 할 UI 동작
1. 선택 포인트 강조
2. 같은 시간축의 vertical cursor 동기화
3. Insight Pane 자동 갱신
4. 관련 이벤트/알람 하이라이트
5. 관련 채널 추천 표시
6. relation graph 하위 그래프 표시
7. 지도/비디오/SimDIS 패널이 있으면 같은 시점으로 이동

### 15.3 그래프 확장 규칙
아래 근거 종류를 가진 edge를 시각화한다.
- temporal lead/lag
- formula dependency
- same subsystem
- same frame locality
- same platform
- alarm co-occurrence
- CRC cluster
- user-confirmed relation

### 15.4 시각적 규칙
- node color: object type
- edge style: relation type
- edge weight: confidence
- dashed edge: inferred
- solid edge: verified
- graph breadcrumbs 제공

---

## 16. Export UX 명세

### 16.1 목적
사용자는 자신이 원하는 방식으로 데이터를 외부 도구에서 다시 분석하고 싶어 한다. CSV/Parquet/Arrow/Matlab export는 매우 중요하다.

### 16.2 Export dialog 필수 옵션
- export format
  - CSV
  - Parquet
  - Arrow IPC
  - Matlab handoff
- selected channels
- selected time range
- raw / engineering / both
- include metadata
- time format
- file split option

### 16.3 오류 데이터 처리 정책 UI
반드시 명확히 보여야 한다.

옵션:
- **Keep all rows**
- **Only good CRC**
- **Only decode-valid / formula-valid**
- **Split good/bad into separate files**
- **Export only anomaly-adjacent rows**

표현 규칙:
- 사용자가 오류 데이터를 제외하면 어떤 기준으로 제외되는지 설명문 표시
- quality flags 미리보기 제공
- 예상 제외 행 수 표시

### 16.4 Export job UX
- background queue
- progress bar
- completed artifact list
- open folder
- export manifest 보기

---

## 17. Matlab Integration UX 명세

### 17.1 목적
사용자가 Matlab으로 직접 그리고 싶어 하거나, 앱이 Matlab MCP를 통해 자동 플롯을 생성할 수 있어야 한다.

### 17.2 진입 방식
- 패널 메뉴 → `Open in MATLAB`
- Export dialog → `Send to MATLAB`
- Insight Pane → `Plot evidence in MATLAB`
- Command Palette → `Matlab plot preset`

### 17.3 Matlab handoff dialog
필수 항목:
- channel selection
- time range
- plot preset
- export as temp file or direct bridge
- include bad data option
- include quality flags option
- script preview option

### 17.4 제공 프리셋
- overlay time plot
- split time plot
- scatter / XY
- spectrogram-like plot
- anomaly evidence bundle
- compare runs

---

## 18. 지도 / SimDIS / 전술 확장 UX 명세

### 18.1 지도 패널
필수 레이어:
- basemap
- satellite
- tracks
- event markers
- telemetry-linked markers
- AOI / route / zone overlays

### 18.2 오프라인 지도 자산 관리자
별도 Settings 섹션 또는 modal 필요

포함 항목:
- installed map packs
- storage usage
- active region packs
- terrain pack status
- import offline map pack
- checksum / version display

### 18.3 SimDIS bridge UX
사용자가 원하는 것은 “SimDIS 연동 가능성”이지, 기본 UI가 SimDIS 자체가 되는 것은 아니다.

따라서 UX는 다음을 목표로 한다.
- SimDIS 연결 상태 확인
- 특정 트랙/시점 handoff
- RealTimeInsight ↔ SimDIS 시간 동기
- 선택 트랙 open
- selected entity follow

### 18.4 전술/디지털 백본 확장 표시
데스크톱 앱 UI에는 다음만 포함한다.
- Mission Edge status widget
- connected clients summary
- tactical feed availability
- command support card

전술용 스마트폰 앱 UI 자체는 본 범위가 아니다.

---

## 19. 오프라인 우선 UX 명세

### 19.1 기본 원칙
이 앱은 인터넷이 없는 환경에서도 완전 동작 가능해야 한다.

### 19.2 UI 차원에서 보여야 하는 것
- offline badge
- local-only mode badge
- local LLM backend state
- local map asset state
- no cloud dependency warning 없음
- external network required 기능은 기본 비활성

### 19.3 설정 영역
- local model selector
- local map pack selector
- local video cache path
- export path
- audit log path
- removable storage import/export tool

---

## 20. 워크스페이스 저장 / 복원 UX

### 20.1 저장 대상
- 패널 배치
- 패널 타입
- 오버레이 그룹
- 축 설정
- linked cursor 상태
- visible channels
- 열린 지도/비디오/graph state
- 선택한 anomaly focus
- saved queries
- bookmarks

### 20.2 저장 기능
- Save workspace
- Save as preset
- Duplicate workspace
- Per-user workspace
- Read-only mission preset

### 20.3 시작 화면
앱 시작 시 아래를 제공한다.
- Open recent workspace
- Open mission preset
- Resume live session
- Open replay run
- Open analysis pack

---

## 21. 비주얼 디자인 가이드

### 21.1 톤
- 가볍고 현대적이되 장난스럽지 않음
- 방산/시험계측/전문 SW 느낌
- 지나친 glossy / flashy 효과 금지
- 정보 밀도가 높아도 답답하지 않게 구성

### 21.2 디자인 원칙
- dark mode 우선
- high contrast
- grid-based alignment
- compact controls
- panel chrome 최소화
- 색은 의미 기반으로만 사용

### 21.3 색 역할
- normal / good
- warning
- alarm / error
- inactive / stale
- inferred relation
- selected highlight

### 21.4 타이포그래피
- 작은 크기에서도 읽히는 명확한 sans-serif
- 숫자/시계열 읽기 좋은 mono fallback 허용

---

## 22. 접근성 / 입력 장치

### 22.1 필수 입력 방식
- mouse
- keyboard
- trackpad

### 22.2 단축키 예시
- `Ctrl/Cmd + K`: global search
- `Space`: play/pause
- `[` `]`: step backward/forward
- `Shift + Drag`: range select
- `Alt + Drag`: overlay insert mode
- `Ctrl/Cmd + S`: save workspace
- `F`: focus selected panel

### 22.3 접근성 요구
- color alone로 상태 구분 금지
- keyboard focus ring 제공
- tables/lists basic accessibility

---

## 23. 성능 전제 및 UI 제약

### 23.1 UI 성능 목표
- 다수 패널 환경에서도 부드러운 상호작용
- 그래프 scroll / zoom / hover가 즉각적이어야 함
- 수집/재생과 UI 프리즈가 분리되어야 함

### 23.2 프런트엔드 제약
Claude Code Designer는 아래를 지켜야 한다.

- 일반 DOM 차트 라이브러리를 핵심 렌더러로 사용하지 말 것
- 긴 리스트는 virtualization 적용
- 패널 수 증가 시 lazy mount 고려
- heavy graph layout 계산은 비동기 처리
- 비디오/지도/3D는 동시에 떠도 UI가 무너지지 않게 설계

---

## 24. 추천 프런트엔드 컴포넌트 구조

### 24.1 상위 구조
- `AppShell`
- `TopCommandBar`
- `ChannelExplorer`
- `WorkspaceManager`
- `DockGrid`
- `PanelFrame`
- `InsightPane`
- `BottomStatusBar`
- `GlobalCommandPalette`
- `ExportModal`
- `MatlabHandoffModal`
- `WorkspaceManagerModal`
- `OfflineAssetManager`

### 24.2 위젯 컴포넌트
- `StripChartWidget`
- `MultiStripWidget`
- `NumericTileWidget`
- `DiscretePanelWidget`
- `XYPlotWidget`
- `WaterfallWidget`
- `EventLogWidget`
- `MapWidget`
- `VideoWidget`
- `Attitude3DWidget`
- `AntennaGain3DWidget`
- `RelationGraphWidget`
- `SimdisBridgeWidget`

### 24.3 상태 모델
프런트엔드는 최소한 다음 상태를 관리할 수 있어야 한다.
- active project
- mode
- source status
- current time / range
- selected channels
- selected anomaly
- workspace layout tree
- linked cursor state
- panel bindings
- export job queue
- llm session UI state
- map asset state
- integrations state

---

## 25. Claude Code Designer 구현 지시문

아래 지시문을 그대로 구현 프롬프트로 사용할 수 있다.

---

### Implementation Prompt for Claude Code Designer

Build the desktop UI for **RealTimeInsight**, a high-density offline-first telemetry analysis workstation with two modes: **Live Mode** and **DataInsight Mode**.

The UI must support:
- channel search and drag-and-drop into graphs
- overlay vs split plotting behavior
- dockable multi-panel workspace
- synchronized time cursor across charts, video, map, and graph views
- anomaly click → evidence → relation graph → related channels workflow
- export dialogs for CSV/Parquet/Arrow/Matlab with quality/error inclusion policies
- local LLM assistant pane with evidence-backed answers
- offline map panel, video panel, and SimDIS bridge panel
- 3D attitude / trajectory / antenna gain views
- saved workspaces and presets

Important constraints:
- desktop-first, not mobile-first
- dark theme first
- high information density but visually clean
- charts must be designed as GPU-oriented rendering surfaces, not generic DOM charts
- channel explorer and event lists must support large-scale virtualization
- UI must remain responsive when many panels are open
- build the UI as if a Rust backend will provide typed telemetry, playback, anomalies, and graph evidence

Prioritize these screens:
1. Main integrated workspace
2. Live vs Replay mode controls
3. Channel explorer with powerful search + drag-and-drop
4. Insight pane with relation graph and root cause summary
5. Export/Matlab dialogs
6. Offline map / video / SimDIS bridge panels
7. Workspace save/load UX

Design the UI to feel like a serious aerospace/defense/test-instrumentation workstation, not a casual dashboard.

---

## 26. 인수 기준(Acceptance Criteria)

다음이 만족되면 UI 1차 구현 완료로 본다.

### 26.1 필수
- [ ] Live Mode / Replay Mode 전환 가능
- [ ] 채널 검색 가능
- [ ] 채널 드래그 앤 드롭으로 그래프 생성 가능
- [ ] 오버레이 / 분할 규칙이 UI로 드러남
- [ ] 다중 패널 도킹 가능
- [ ] Strip / Multi-strip / XY / Waterfall / Event / Map / Video / Graph 패널 최소 UI 구현
- [ ] 이상점 클릭 시 Insight Pane 업데이트
- [ ] relation graph 패널 존재
- [ ] export modal에서 오류 데이터 포함/제외 정책 선택 가능
- [ ] Matlab handoff modal 존재
- [ ] workspace 저장/복원 가능
- [ ] 오프라인 자산 상태 UI 존재

### 26.2 확장
- [ ] SimDIS bridge panel 존재
- [ ] 3D attitude / antenna gain placeholder 또는 구현 존재
- [ ] LLM assistant panel 존재
- [ ] evidence cards 존재
- [ ] map/video/timeline sync UX 표현 존재

---

## 27. 구현 범위 밖 항목

다음은 이 UI 문서의 직접 범위가 아니다.

- 실제 Rust 디코더/CRC 구현
- 실제 LLM 모델 서빙 구현
- 실제 Matlab 엔진 브리지 내부 구현
- 실제 SimDIS SDK 연동 내부 구현
- 실제 지도 타일 생성/패키징 도구 구현
- 군 전술 스마트폰 앱 자체 UI 구현

다만 위 항목들과 **연동 가능한 UI 훅과 자리**는 반드시 고려한다.

---

## 28. 최종 한 줄 요구사항

**RealTimeInsight UI는 “많은 데이터를 한 번에, 빠르게, 오프라인으로, 근거 기반으로” 볼 수 있는 고성능 전문 분석 워크스테이션처럼 보여야 한다.**

