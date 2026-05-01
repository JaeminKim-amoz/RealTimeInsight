# RealTimeInsight Claude Code 마스터 프롬프트

이 문서는 Claude Code / Claude Code Designer에 **그대로 붙여 넣기 위한 단일 마스터 프롬프트**다.  
목표는 RealTimeInsight의 데스크톱 UI를 실제 구현 가능한 수준까지 빠르게 끌어올리는 것이다.

---

## 0. 역할

너는 **시니어 제품 디자이너 + 시니어 프런트엔드 아키텍트 + 실전 구현 엔지니어**다.  
단순 아이디어 제안이 아니라, **바로 코드로 옮길 수 있는 UI 구조와 구현 산출물**을 만들어야 한다.

출력은 반드시 다음 기준을 만족해야 한다.

- 추상적인 설명보다 **실제 구현 가능한 구조**를 제시할 것
- 화면 단위가 아니라 **컴포넌트 단위**로 분해할 것
- drag & drop, overlay, split, sync cursor, anomaly exploration 같은 **상호작용 규칙을 명시**할 것
- 오프라인/에어갭 환경, 지도, SimDIS, 비디오, 로컬 LLM, Matlab export 확장성을 고려할 것
- Tauri 데스크톱 앱 + 웹 프런트엔드 + GPU 렌더링 UI 전제를 유지할 것

---

## 1. 제품 개요

제품명은 **RealTimeInsight**다.

이 제품은 실시간 분석과 사후 분석을 따로 나눈 2개 앱이 아니라, **하나의 통합 워크스테이션**이다.

운영 모드는 두 가지다.

- **Live Mode**: 실시간 수신/분석/전시
- **DataInsight Mode**: 저장 데이터 재생/사후 분석

이 제품은 다음을 통합한다.

- 실시간 텔레메트리 수집 상태 모니터링
- 저장된 raw / decoded 데이터 재생
- 다채널 시계열 분석
- discrete / bitfield / state matrix 분석
- FFT / spectrum / waterfall 분석
- 지도 / 궤적 / 자세 / 3D 안테나 이득 시각화
- 비디오(H.264 MPEG-2 TS) 동기 재생
- SimDIS 연동 및 시나리오 replay 동기화
- relation graph / knowledge graph 기반 이상 추적
- CSV / Parquet / Arrow / Matlab export
- Local LLM 기반 설명/요약/원인 후보 제시
- 완전 오프라인/폐쇄망 운용

---

## 2. 기술 및 도메인 전제

### 2.1 앱 전제
- Desktop only
- Windows / Linux / macOS
- Tauri shell
- 프런트엔드는 TypeScript 기반
- React 또는 Svelte 가능
- 그래프는 DOM 차트가 아니라 Canvas/WebGL/WebGPU 계열 전제

### 2.2 데이터 전제
- 입력은 빠르면 **5 ms 주기 UDP packet**
- sync pattern으로 frame 경계 식별
- CRC-16 / CRC-32 검증
- 오류 없는 데이터만 전시하는 옵션 필요
- 오류 포함/미포함 export 정책 필요
- 채널 정의 / 환산식은 Excel import/export 가능
- word size는 8/10/16/32 bit
- 1/2/4 word 조합 가능
- gain / offset / P1~P10 파라미터 지원
- raw-only replay / formula-only evaluate 모두 지원

### 2.3 사용자가 다루는 데이터 예시
- 전압 / 전류 / RTD / thermocouple / 압력 / 응력
- discrete / digital communication / status bits
- 비행 궤적 / 비행 자세
- 3D 상대 안테나 이득
- 주파수 대역 데이터 / waterfall
- 영상 스트림(H.264 MPEG-2 TS)
- 지도/위성지도/전술상황 레이어

### 2.4 방산/전장 확장 전제
업로드된 공고문 기준으로, 이 제품은 **디지털 백본 / 지휘결심지원 / 폐쇄망 sLLM / 온디바이스 AI / 전술앱 / 센서-슈터 연결** 방향으로 확장될 수 있어야 한다. 특히 공고문은 네트워크 분야에서 드론·로봇 자산 정보를 제대 내에서 실시간 공유하는 디지털 백본, GCS-스마트폰 연동, 한국형 ATAK 유사 전술앱, 지휘소의 AI 기반 지휘결심지원과 타격자산 추천을 요구하고 있다. 또한 인공지능 분야에서 다양한 센서 신호의 융합 분석과 방책 추천, 군사환경 서버 운용, 폐쇄망 sLLM, 온디바이스 AI 운용성을 요구한다. fileciteturn3file1 fileciteturn3file2 fileciteturn3file4

따라서 UI도 단순 시험계측 툴이 아니라 다음을 지원하는 구조여야 한다.

- 지도 기반 상황 인식
- 전술 오버레이 확장
- 다중 자산 상태 표시
- 지휘결심 보조 사이드 패널
- 오프라인/폐쇄망 환경 대응
- 센서-슈터 관계 탐색

---

## 3. 절대 바꾸면 안 되는 제품 원칙

1. **하나의 통합 앱**이어야 한다.  
2. **Live Mode와 DataInsight Mode는 가능한 한 같은 UI 패턴**을 써야 한다.  
3. 사용자는 **채널 검색 후 drag & drop으로 그래프에 넣고**, overlay 또는 split을 선택할 수 있어야 한다.  
4. 사용자는 **그래프를 여러 개 겹쳐 그리거나 분리해서 그릴 수 있어야 한다.**  
5. 사용자는 **자유롭게 패널 배치**를 바꾸고, 그 배치를 저장해야 한다.  
6. 특정 이상점을 찍으면 **그와 연관된 이상점을 knowledge graph 방식으로 이어서 탐색**할 수 있어야 한다.  
7. 이 앱은 **오프라인으로도 구동 가능**해야 한다.  
8. 지도/SimDIS/비디오/LLM/Matlab은 모두 **확장 포인트가 아니라 핵심 설계 고려사항**이다.  
9. UI는 고성능이지만, 초보자도 최소 동작은 할 수 있어야 한다.  
10. LLM은 단순 채팅창이 아니라 **근거 기반 분석 보조도구**여야 한다.

---

## 4. 최우선 구현 대상 화면

다음 5개 영역이 항상 존재하는 워크스테이션을 설계하라.

### A. Top Command Bar
포함 기능:
- 프로젝트명
- 모드 전환(Live / DataInsight)
- run/source 선택
- 시간축 표시
- sync status / CRC status / packet rate 요약
- export 버튼
- layout 저장/불러오기
- command palette 진입
- offline/connected 상태 표시

### B. Left Sidebar: Channel Explorer
포함 기능:
- search input
- filter chips(group, unit, type, alarmed, favorite 등)
- 채널 트리/group tree
- 즐겨찾기/frequent channels
- drag source
- quick preview(최근 값, unit, quality, small sparkline)

핵심 상호작용:
- 채널을 드래그해서 workspace 패널에 드롭 가능
- 다중 선택 후 한 번에 드래그 가능
- 채널 search는 대규모 채널셋에서도 빠르게 동작해야 함

### C. Center Dock Workspace
핵심 특성:
- 멀티패널 도킹
- 분할/병합 가능
- overlay / replace / split H / split V 지원
- 다중 모니터 사용 고려
- 하나 이상의 패널이 같은 시간축을 공유 가능

필수 패널 타입:
- Strip Chart
- Multi-Strip Chart
- XY Plot
- Waterfall
- Numeric Tile Panel
- Discrete / State Matrix
- Event Log
- Map / Satellite Map
- 3D Trajectory / Attitude
- Antenna Gain 3D
- Video Panel
- Relation Graph
- SimDIS Bridge Panel

### D. Right Insight Pane
포함 기능:
- anomaly details
- root cause candidates
- relation graph summary
- selected data point context
- LLM insight panel
- evidence list
- export selection helper

### E. Bottom Status Console
포함 기능:
- event log
- CRC failures
- decoder warnings
- ingest health
- replay status
- background tasks/export status
- performance/FPS/buffer health

---

## 5. 핵심 상호작용 규칙

### 5.1 채널 drag & drop 규칙
사용자는 좌측 탐색기에서 채널을 패널로 끌어다 놓는다.

드롭 규칙은 반드시 시각적으로 명확해야 한다.

- 패널 **중앙**에 드롭 → **Overlay**
- 패널 **좌/우 가장자리**에 드롭 → **좌우 분할**
- 패널 **상/하 가장자리**에 드롭 → **상하 분할**
- 빈 workspace에 드롭 → **새 패널 생성**
- modifier key(예: Alt/Shift)로 replace / force new panel 선택 가능

디자이너는 이 상호작용이 **실수 없이 직관적**이도록 hover preview와 ghost indicator를 설계해야 한다.

### 5.2 overlay 규칙
- 같은 패널에 여러 채널을 겹쳐 그릴 수 있어야 한다.
- 축 공유 여부를 선택할 수 있어야 한다.
- 채널별 색상/굵기/보임숨김 제어 필요
- overlay legend에서 개별 선택/하이라이트 가능
- discrete와 analog를 무리하게 같은 스타일로 섞지 말 것

### 5.3 split 규칙
- 패널은 자유롭게 분할 가능해야 한다.
- 중첩 split 구조 지원
- 패널 탭 사용 가능
- 저장된 layout 재호출 가능

### 5.4 이상점 클릭 규칙
사용자가 그래프의 한 점 또는 구간을 클릭하면 다음이 일어나야 한다.

1. 현재 선택 지점이 `Observation`으로 고정된다.
2. 같은 시점 전후의 관련 신호 후보를 자동 계산한다.
3. 우측 Insight Pane에 연관 이상 후보가 뜬다.
4. Relation Graph 패널이 열리거나 강조된다.
5. 사용자는 연결 근거를 클릭해 drill-down 할 수 있다.

중요: 그래프는 예쁜 장식용이 아니라 **evidence graph**여야 한다.

### 5.5 sync cursor 규칙
- Strip / Waterfall / Map / Video / Event Log / Relation Graph는 선택적으로 같은 시간축에 lock 가능해야 한다.
- 하나의 cursor 이동이 여러 패널에 동시 반영되어야 한다.
- video frame / map marker / graph highlight가 같은 시점으로 맞아야 한다.

---

## 6. 패널별 설계 요구사항

### 6.1 Strip / Multi-Strip
- 실시간/재생 모두 동일 컴포넌트 사용
- zoom/pan/brush/select
- overlay 가능
- anomaly marker 표시
- quality flag가 bad인 샘플 시각적 구분
- dense mode / detailed mode 지원

### 6.2 Waterfall
- 1 Hz 이상 spectrum frame 누적 가능
- color map 전환 가능
- peak hold / average overlay 지원
- 시간 스크롤 / 구간 선택 지원

### 6.3 Map / Satellite Map
- 오프라인 지도 타일 지원
- 위성지도 / 일반지도 / 지형도 레이어 전환
- trajectory overlay
- marker / event / threat / asset layer
- 군/전술 overlay 확장 가능 구조
- 향후 TAK/COT/전술앱 연동 고려

### 6.4 3D Trajectory / Attitude
- roll/pitch/yaw 또는 quaternion 표시
- 3D camera reset / orbit / follow mode
- attitude와 trajectory 동기 가능
- 안테나 gain 3D와 연동 가능

### 6.5 Video Panel
- H.264 MPEG-2 TS 기반 구간 재생
- telemetry cursor와 동기화
- frame step / slow replay / loop
- alarm/anomaly bookmark jump 지원

### 6.6 Relation Graph
- observation 중심 그래프 확장
- edge 유형 표시(시간상관, 수식의존, 토폴로지, 이벤트 공발생 등)
- confidence / evidence 분리 표시
- node 클릭 시 해당 신호 그래프 자동 열기 가능

### 6.7 SimDIS Bridge Panel
- SimDIS 자체를 완전히 재구현하지 말 것
- 시나리오 연동/상태 브리지/launch control 개념으로 설계
- time sync 상태 표시
- link health / scenario id / object count / selected track 표시
- 향후 external process bridge 가능 구조

### 6.8 LLM Insight Panel
- 채팅창처럼 보일 수 있지만 핵심은 tool-based analysis
- selected time range, selected channels, selected observation을 context로 사용
- “왜 이 점이 이상한가?” “연관 채널 보여줘” 같은 액션 버튼 제공
- 답변에는 evidence references가 보여야 함
- 완전 오프라인 환경 고려

### 6.9 Export Panel / Dialog
- CSV / Parquet / Arrow / Matlab export
- error inclusion policy 선택 가능
- time range / selected channels / selected panel scope 선택 가능
- keep-all / good-crc-only / split-by-quality 같은 정책 명시

---

## 7. 저장 가능한 사용자 환경

이 앱은 사용자가 원하는 방식으로 환경을 저장할 수 있어야 한다.

저장 대상:
- 패널 배치
- 패널 크기
- overlay group
- 축 설정
- 색상/스타일
- linked cursor 설정
- 지도 레이어 설정
- 3D camera pose
- 열린 비디오/지도/graph 패널 상태
- favorites / recent searches
- export preset

중요:
- **프로젝트 정의**와 **사용자 워크스페이스**를 분리해서 저장하라.
- 한 프로젝트에 대해 여러 사용자 워크스페이스가 공존해야 한다.

---

## 8. 오프라인/에어갭 UX 원칙

이 앱은 반드시 **완전 오프라인**으로도 운용될 수 있어야 한다.

UI 차원에서 고려할 것:
- 인터넷 연결이 없어도 깨지지 않는 디자인
- CDN 의존성 금지
- 외부 지도 호출 전제 금지
- local tile cache / local tile server 모드 고려
- local model / local index / local media / local styles만으로 동작 가능
- offline badge / asset readiness panel 필요

Asset readiness panel 예시:
- LLM model installed
- offline map tiles present
- SimDIS bridge available
- video codec available
- matlab integration available
- project schema loaded

---

## 9. Claude Code가 만들어야 할 산출물

다음 산출물을 만들어라.

### 9.1 필수 산출물
1. 화면 구조 제안
2. 컴포넌트 트리
3. 주요 상태 모델
4. drag & drop interaction spec
5. panel registry 설계
6. layout persistence 구조
7. mock data schema
8. Tauri bridge API shape
9. UI용 타입 정의
10. 최소 동작 프로토타입 코드

### 9.2 권장 추가 산출물
- keyboard shortcut map
- command palette action list
- context menu spec
- panel toolbar 규격
- anomaly investigation flowchart
- map/video/time sync flow
- Storybook 또는 screen demo 구조

---

## 10. 구현 우선순위

### Phase 1
- App shell
- Top bar / left explorer / center dock / right insight / bottom console
- Strip / Multi-strip / Numeric / Event Log
- drag & drop overlay/split
- workspace save/load
- mock data hookup

### Phase 2
- XY / Waterfall / Discrete / State Matrix
- anomaly selection flow
- relation graph panel
- export dialog

### Phase 3
- map / satellite map
- 3D trajectory / attitude
- video panel
- time sync across panels

### Phase 4
- SimDIS bridge panel
- LLM insight panel
- Matlab export/integration panel
- offline asset manager

---

## 11. 구현 스타일 지침

- 전문 장비 UI처럼 **정보 밀도는 높게**, 그러나 읽기 어렵게 만들지 말 것
- 기본 톤은 다크 모드 우선
- 색은 기능적으로 써야 한다
- 빨간색은 truly bad/alarm에만 제한적으로 사용
- grid / spacing / typography는 일정해야 한다
- 패널 툴바는 작고 강력해야 한다
- 전문 사용자가 좋아하는 **키보드 중심 조작**을 지원할 것
- hover/selection/focus 상태를 명확히 보여줄 것
- 시계열 그래프는 부드러움보다 정확성과 반응성을 우선할 것

---

## 12. 하지 말아야 할 것

- 마케팅 랜딩페이지처럼 화려한 UI를 만들지 말 것
- 모바일 우선 반응형처럼 만들지 말 것
- 일반 BI 대시보드처럼 카드만 잔뜩 놓지 말 것
- drag & drop 규칙을 अस्पष्ट하게 두지 말 것
- 지도/비디오/관계그래프를 “나중에 추가” 수준으로 미루지 말 것
- LLM 패널을 일반 챗봇처럼만 만들지 말 것
- 오프라인 요구를 약하게 취급하지 말 것

---

## 13. Claude Code 출력 형식 요구

출력은 다음 순서로 하라.

1. 전체 UI 구조 요약  
2. 정보 구조(IA)  
3. 컴포넌트 트리  
4. 상태 모델  
5. drag & drop interaction spec  
6. 패널 타입별 props / state / actions  
7. mock 타입 정의  
8. Tauri bridge contract  
9. MVP 구현 파일 트리  
10. 실제 코드 초안  
11. 남은 리스크와 추후 작업 목록

중요: 설명만 하지 말고, **실제 코드와 타입 정의까지 제시**하라.

---

## 14. 시작 지시

지금부터 다음 순서로 진행하라.

1. 먼저 RealTimeInsight 워크스테이션의 최상위 레이아웃을 설계하라.  
2. 그 다음 패널 도킹과 drag & drop 규칙을 정의하라.  
3. 그 다음 Strip / Multi-strip / Event Log / Insight Pane을 먼저 구현하는 MVP 구조를 제시하라.  
4. 이후 map / video / relation graph / SimDIS / LLM / Matlab 확장 구조를 추가하라.  
5. 마지막으로 실제 구현 가능한 파일 구조와 코드 초안을 제시하라.

질문을 되묻기보다, **합리적인 가정을 세워서 바로 설계를 진행하라.**

