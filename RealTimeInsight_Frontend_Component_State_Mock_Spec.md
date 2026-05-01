# RealTimeInsight 프런트엔드 구현 상세 명세서

부제: 컴포넌트 트리, 상태 모델, 이벤트 계약, Mock 데이터 스키마, Claude Code Designer/Frontend Engineer handoff

---

## 1. 문서 목적

이 문서는 이미 작성된 `RealTimeInsight_UI_Spec_For_Claude_Code_Designer.md`의 다음 단계 문서다.

목적은 단순하다.

- 화면 아이디어 수준을 넘어서 실제 프런트엔드 구현 가능한 구조로 내린다.
- Claude Code Designer 또는 프런트엔드 구현 에이전트가 바로 코드 구조를 잡을 수 있게 한다.
- 상태 관리, 이벤트 흐름, 타입 정의, mock 데이터, 브리지 API 계약을 명확히 한다.
- Rust/Tauri 코어와 UI 사이 경계를 분명히 한다.

이 문서는 UI 비주얼 가이드가 아니라 **실제 구현 설계서**다.

---

## 2. 구현 전제

### 2.1 권장 스택
- Tauri 2 desktop shell
- TypeScript
- React 또는 Svelte 중 하나
- 상태 관리는 중앙 store + panel-local state 혼합 구조
- 차트/고성능 패널은 Canvas/WebGL/WebGPU 계열 렌더링
- 일반 UI는 컴포넌트 라이브러리 사용 가능

### 2.2 권장 구조 원칙
1. 전역 상태와 패널 상태를 분리한다.
2. 데이터는 “채널 원본 전체”가 아니라 “현재 패널이 필요한 범위”만 구독한다.
3. Live/Replay 차이는 source adapter 수준에서 흡수하고 UI는 최대한 공통 컴포넌트를 사용한다.
4. 렌더 패널은 데이터 구독, 상호작용 상태, 뷰 상태를 분리한다.
5. LLM 패널은 데이터 소유자가 아니라 tool caller여야 한다.
6. 오프라인/에어갭 환경을 전제로 CDN 의존성을 두지 않는다.

---

## 3. 프런트엔드 아키텍처 개요

```text
AppShell
 ├─ BootLoader
 ├─ ErrorBoundary
 ├─ AppProviders
 │   ├─ ThemeProvider
 │   ├─ WorkspaceStoreProvider
 │   ├─ QueryCacheProvider
 │   ├─ KeyboardShortcutProvider
 │   ├─ DialogProvider
 │   └─ NotificationProvider
 └─ WorkstationLayout
     ├─ TopCommandBar
     ├─ LeftSidebar(ChannelExplorer)
     ├─ CenterDockWorkspace
     ├─ RightInsightPane
     ├─ BottomStatusConsole
     ├─ ModalLayer
     └─ CommandPalette
```

### 3.1 데이터 흐름 개요

```text
Rust Core / Tauri Commands / Event Stream
   -> UI Bridge Client
   -> Query Cache / Stream Buffer
   -> Global Store
   -> Panel Controllers
   -> Render Components
```

### 3.2 상태 분류
- **Persistent Global State**: 프로젝트, 워크스페이스, 레이아웃, 사용자 설정
- **Session State**: 현재 모드, 선택 run, 현재 cursor, 현재 selection
- **Streaming State**: live packet rate, buffer health, panel subscription data
- **Ephemeral UI State**: modal open, drag target, hover, focus, resize state
- **Derived State**: 패널에서 계산한 visible series, anomaly highlight set, relation subgraph

---

## 4. 디렉토리 구조 제안

```text
src/
  app/
    App.tsx
    routes.ts
    boot.ts
  shell/
    WorkstationLayout.tsx
    TopCommandBar.tsx
    LeftSidebar.tsx
    RightInsightPane.tsx
    BottomStatusConsole.tsx
  modules/
    workspace/
    channels/
    panels/
    replay/
    live/
    anomalies/
    graph/
    exports/
    integrations/
    llm/
    map/
    video/
    simdis/
  panels/
    strip/
    multistrip/
    xy/
    waterfall/
    numeric/
    discrete/
    eventlog/
    map2d/
    trajectory3d/
    attitude3d/
    antenna3d/
    video/
    relationgraph/
    simdisbridge/
  components/
    dock/
    tree/
    search/
    forms/
    layout/
    shared/
  store/
    workspaceStore.ts
    sessionStore.ts
    selectionStore.ts
    streamStore.ts
    integrationStore.ts
  bridge/
    tauriCommands.ts
    eventBus.ts
    schemas.ts
  mock/
    project.mock.json
    run.mock.json
    channels.mock.json
    anomalies.mock.json
    workspace.mock.json
  types/
    domain.ts
    panels.ts
    graph.ts
    api.ts
```

---

## 5. 최상위 컴포넌트 트리

```text
App
 └─ WorkstationLayout
    ├─ TopCommandBar
    │  ├─ ProjectSelector
    │  ├─ ModeSwitch
    │  ├─ SourceStatusCluster
    │  ├─ ReplayControls
    │  ├─ GlobalTimeDisplay
    │  ├─ LayoutMenu
    │  ├─ ExportMenu
    │  ├─ IntegrationsMenu
    │  ├─ LlmToggleButton
    │  └─ SettingsButton
    ├─ LeftSidebar
    │  ├─ ChannelSearchBox
    │  ├─ SearchFilterChips
    │  ├─ FavoritesTabs
    │  ├─ ChannelTree
    │  │  ├─ ChannelGroupNode
    │  │  └─ ChannelLeafRow
    │  └─ DragPreviewLayer
    ├─ CenterDockWorkspace
    │  ├─ DockToolbar
    │  ├─ DockGrid
    │  │  ├─ PanelContainer
    │  │  │  ├─ PanelHeader
    │  │  │  ├─ PanelToolbar
    │  │  │  ├─ PanelBody
    │  │  │  └─ PanelFooter(optional)
    │  │  └─ DropTargetOverlay
    │  └─ WorkspaceEmptyState
    ├─ RightInsightPane
    │  ├─ InsightTabs
    │  ├─ RootCausePane
    │  ├─ RelationGraphPane
    │  ├─ EvidencePane
    │  ├─ LlmAssistantPane
    │  └─ ToolResultPane
    ├─ BottomStatusConsole
    │  ├─ AlarmTicker
    │  ├─ DecoderWarnings
    │  ├─ CrcStatus
    │  ├─ SyncStatus
    │  ├─ PerformanceMetrics
    │  └─ CursorReadout
    ├─ GlobalModalLayer
    │  ├─ ExportDialog
    │  ├─ LayoutManagerDialog
    │  ├─ WorkspaceManagerDialog
    │  ├─ SettingsDialog
    │  ├─ OfflineAssetsDialog
    │  ├─ IntegrationDialog
    │  └─ ChannelInspectorDialog
    └─ CommandPalette
```

---

## 6. 패널 시스템 설계

## 6.1 PanelContainer 공통 인터페이스

모든 패널은 공통 shell을 따른다.

```ts
export type PanelKind =
  | 'strip'
  | 'multistrip'
  | 'xy'
  | 'waterfall'
  | 'numeric'
  | 'discrete'
  | 'eventlog'
  | 'map2d'
  | 'trajectory3d'
  | 'attitude3d'
  | 'antenna3d'
  | 'video'
  | 'relationgraph'
  | 'simdisbridge'
  | 'table'
  | 'markdown';

export interface PanelInstance {
  id: string;
  kind: PanelKind;
  title: string;
  layoutNodeId: string;
  bindings: PanelBinding[];
  options: Record<string, unknown>;
  uiState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 PanelBinding

```ts
export type PanelBinding =
  | { type: 'channel'; channelId: number }
  | { type: 'channelGroup'; groupId: string }
  | { type: 'anomaly'; anomalyId: string }
  | { type: 'video'; videoId: string }
  | { type: 'mapLayer'; layerId: string }
  | { type: 'graphNode'; nodeId: string };
```

### 6.3 Panel 공통 Toolbar 액션
- pin/unpin
- duplicate
- convert panel kind
- clear bindings
- link/unlink cursor
- export panel snapshot
- focus mode
- close

---

## 7. 도킹 및 레이아웃 상태 모델

## 7.1 도킹 모델

React 사용 시 `GoldenLayout`류 외부 라이브러리를 검토할 수 있지만, 완전 제어와 성능 때문에 내부 레이아웃 모델을 별도로 가지는 것을 권장한다.

```ts
export type LayoutNode = SplitNode | TabNode | PanelNode;

export interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratio: number[];
  children: LayoutNode[];
}

export interface TabNode {
  type: 'tabs';
  id: string;
  activePanelId: string;
  children: PanelNode[];
}

export interface PanelNode {
  type: 'panel';
  id: string;
  panelId: string;
}
```

## 7.2 DnD drop zone 규칙

드래그 대상이 패널에 들어올 때 5개 zone을 제공한다.

- center: overlay/tab 또는 same-panel add
- top: split above
- bottom: split below
- left: split left
- right: split right

### 7.2.1 드롭 동작 규칙
- strip 계열 패널 중앙 드롭: 기본은 overlay
- strip 계열 패널 가장자리 드롭: split
- numeric/discrete 패널 중앙 드롭: replace 또는 multi-tile add
- map/video/3D 패널 중앙 드롭: compatible binding만 허용
- incompatibility 시 drop denied tooltip 표기

### 7.2.2 modifier key 규칙
- `Shift + drop center`: force split
- `Alt + drop center`: overlay with secondary axis
- `Ctrl/Cmd + drop`: duplicate source binding 유지

---

## 8. 글로벌 상태 모델

아래는 전역 상태를 store 단위로 나눈다.

## 8.1 WorkspaceStore

```ts
export interface WorkspaceStoreState {
  workspaceId: string | null;
  workspaceName: string | null;
  layoutTree: LayoutNode | null;
  panels: Record<string, PanelInstance>;
  presets: WorkspacePresetSummary[];
  dirty: boolean;
}
```

책임:
- 레이아웃 생성/분할/합치기
- 패널 인스턴스 생성/삭제/복제
- 워크스페이스 저장/불러오기

## 8.2 SessionStore

```ts
export interface SessionStoreState {
  appMode: 'live' | 'replay';
  activeProjectId: string | null;
  activeRunId: string | null;
  playback: {
    isPlaying: boolean;
    rate: number;
    currentTimeNs: string;
    selectionRange: [string, string] | null;
    loopEnabled: boolean;
  };
  ingest: {
    sourceConnected: boolean;
    packetRateHz: number;
    frameRateHz: number;
    crcFailRate: number;
    syncLossCount: number;
  };
}
```

## 8.3 SelectionStore

```ts
export interface SelectionStoreState {
  selectedChannelIds: number[];
  selectedPanelId: string | null;
  selectedAnomalyId: string | null;
  selectedGraphNodeId: string | null;
  selectedPoint: SelectedPoint | null;
  hoverPoint: SelectedPoint | null;
  linkedCursorEnabled: boolean;
  globalCursorNs: string | null;
}
```

## 8.4 StreamStore

```ts
export interface StreamStoreState {
  subscriptions: Record<string, StreamSubscription>;
  buffers: Record<string, StreamBufferMeta>;
  panelDataRefs: Record<string, string[]>;
  performance: {
    uiFps: number;
    renderLatencyMsP95: number;
    eventQueueDepth: number;
  };
}
```

## 8.5 IntegrationStore

```ts
export interface IntegrationStoreState {
  matlab: MatlabIntegrationState;
  llm: LlmIntegrationState;
  simdis: SimdisIntegrationState;
  map: MapIntegrationState;
  exportJobs: ExportJobState[];
  offlineAssets: OfflineAssetState;
}
```

---

## 9. 패널별 상태 모델

## 9.1 Strip / MultiStrip panel state

```ts
export interface StripPanelState {
  series: StripSeriesBinding[];
  xAxis: TimeAxisState;
  yAxes: YAxisState[];
  overlayMode: 'single-axis' | 'multi-axis';
  qualityOverlay: boolean;
  anomalyMarkers: boolean;
  cursorLinked: boolean;
  legendVisible: boolean;
  decimationMode: 'auto' | 'minmax' | 'lttb' | 'raw';
}
```

## 9.2 Waterfall panel state

```ts
export interface WaterfallPanelState {
  channelId: number | null;
  timeWindow: [string, string] | null;
  colorMap: 'viridis' | 'inferno' | 'gray' | 'jet';
  dynamicRangeDb: [number, number];
  peakOverlay: boolean;
  averageOverlay: boolean;
  cursorLinked: boolean;
}
```

## 9.3 Map panel state

```ts
export interface MapPanelState {
  baseMapId: string | null;
  overlayLayers: string[];
  entityTrackBindings: number[];
  selectedEntityId: string | null;
  camera: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  offlineMode: boolean;
  cotOverlayEnabled: boolean;
  simdisSyncEnabled: boolean;
}
```

## 9.4 Video panel state

```ts
export interface VideoPanelState {
  videoId: string | null;
  programNumber: number | null;
  pid: number | null;
  syncMode: 'telemetry-master' | 'video-master';
  cursorLinked: boolean;
  rangeSelection: [string, string] | null;
  showMarkers: boolean;
}
```

## 9.5 Relation graph panel state

```ts
export interface RelationGraphPanelState {
  rootNodeId: string | null;
  hopLimit: number;
  evidenceThreshold: number;
  layoutMode: 'force' | 'radial' | 'timeline';
  groupBy: 'subsystem' | 'evidence' | 'channelType';
  selectedEdgeId: string | null;
  freezeLayout: boolean;
}
```

## 9.6 Insight pane state

```ts
export interface InsightPaneState {
  activeTab: 'root-cause' | 'graph' | 'evidence' | 'llm' | 'tool-results';
  activeObservationNodeId: string | null;
  expandedEvidenceIds: string[];
  pinnedCandidateIds: string[];
}
```

---

## 10. 도메인 타입 정의

## 10.1 Channel metadata

```ts
export interface ChannelSummary {
  channelId: number;
  name: string;
  displayName: string;
  group: string;
  subgroup?: string;
  unit?: string;
  channelType:
    | 'analog'
    | 'discrete'
    | 'enum'
    | 'counter'
    | 'spectrum'
    | 'trajectory'
    | 'pose3d'
    | 'antenna3d'
    | 'video-ref'
    | 'derived';
  sampleRateHz?: number;
  qualityPolicy: 'keep-all' | 'good-crc-only' | 'decode-valid-only';
  tags: string[];
}
```

## 10.2 SelectedPoint / anomaly anchor

```ts
export interface SelectedPoint {
  panelId: string;
  channelId: number;
  timestampNs: string;
  rawValue?: string | number;
  engValue?: number;
  qualityFlags: string[];
  frameId?: string;
  sampleIndex?: number;
  anomalyId?: string;
}
```

## 10.3 Knowledge graph nodes and edges

```ts
export interface EvidenceNode {
  id: string;
  kind:
    | 'observation'
    | 'channel'
    | 'alarm'
    | 'crc-cluster'
    | 'frame-sync-loss'
    | 'derived-formula'
    | 'video-event'
    | 'map-entity'
    | 'recommendation';
  label: string;
  score?: number;
  payload?: Record<string, unknown>;
}

export interface EvidenceEdge {
  id: string;
  sourceId: string;
  targetId: string;
  evidenceKind:
    | 'temporal-lead'
    | 'correlation'
    | 'formula-dependency'
    | 'shared-frame'
    | 'shared-subsystem'
    | 'operator-bookmark'
    | 'video-alignment'
    | 'geospatial-proximity';
  weight: number;
  explanation: string;
}
```

---

## 11. Tauri 브리지 계약

## 11.1 Command 기반 API

모든 요청은 request/response를 가진다.

```ts
export interface UiBridge {
  listProjects(): Promise<ProjectSummary[]>;
  loadWorkspace(workspaceId: string): Promise<WorkspacePayload>;
  saveWorkspace(payload: WorkspacePayload): Promise<void>;
  queryChannels(filter: ChannelFilterInput): Promise<ChannelSummary[]>;
  subscribePanelData(input: PanelDataSubscriptionInput): Promise<SubscriptionHandle>;
  unsubscribePanelData(subscriptionId: string): Promise<void>;
  fetchWindow(input: WindowQueryInput): Promise<WindowQueryResult>;
  fetchAnomalies(input: AnomalyQueryInput): Promise<AnomalySummary[]>;
  fetchRelationGraph(input: RelationGraphQueryInput): Promise<RelationGraphPayload>;
  exportData(input: ExportJobInput): Promise<ExportJobAck>;
  matlabPlot(input: MatlabPlotInput): Promise<MatlabPlotResult>;
  llmToolQuery(input: LlmToolQueryInput): Promise<LlmToolQueryResult>;
}
```

## 11.2 Event stream 기반 API

```ts
export type BridgeEvent =
  | { type: 'ingest_status'; payload: IngestStatusEvent }
  | { type: 'panel_stream_data'; payload: PanelStreamDataEvent }
  | { type: 'alarm_event'; payload: AlarmEvent }
  | { type: 'crc_event'; payload: CrcEvent }
  | { type: 'sync_loss_event'; payload: SyncLossEvent }
  | { type: 'export_progress'; payload: ExportProgressEvent }
  | { type: 'llm_tool_progress'; payload: LlmToolProgressEvent }
  | { type: 'video_sync_event'; payload: VideoSyncEvent };
```

### 11.2.1 panel_stream_data payload

```ts
export interface PanelStreamDataEvent {
  subscriptionId: string;
  panelId: string;
  schema: 'timeseries-v1' | 'waterfall-v1' | 'discrete-v1' | 'xy-v1';
  dataRef: string;
  rangeNs: [string, string];
  seq: number;
}
```

실제 대용량 데이터는 base64 JSON보다 binary handle 또는 shared buffer reference를 우선 고려한다.

---

## 12. 검색 및 드래그앤드롭 UX 로직

## 12.1 Channel search input 동작
- 이름, 태그, 그룹, 단위, 설명, channel id로 검색 가능
- 검색 결과는 virtualized list 사용
- fuzzy search + exact match chips 제공
- 검색 결과 row에서 바로:
  - add to current panel
  - add as overlay
  - add as split
  - inspect channel
  - favorite toggle

## 12.2 Drag source payload

```ts
export interface DragChannelPayload {
  kind: 'channel-drag';
  channelId: number;
  displayName: string;
  channelType: string;
  unit?: string;
}
```

## 12.3 Drop target decision table

| Target panel | Channel type | Center drop | Edge drop |
|---|---|---|---|
| strip | analog/derived/counter | overlay | split |
| multistrip | analog/discrete | add lane or overlay mode chooser | split |
| xy | analog | prompt choose x/y role if needed | split |
| waterfall | spectrum | replace or add compare layer | split |
| numeric | any scalar | add tile | split |
| discrete | discrete/enum/bitfield | add row | split |
| map2d | trajectory/entity location | add track | split |
| trajectory3d | trajectory | add track | split |
| attitude3d | pose3d | replace or add comparison | split |
| video | video-ref | set source | split denied |
| relationgraph | anomaly/channel | set root node | split |

## 12.4 Smart insert 정책
- 사용자가 처음 채널을 드롭하면 strip panel 자동 생성
- discrete 채널이면 discrete panel 자동 생성
- spectrum 채널이면 waterfall panel 자동 생성
- lat/lon/alt 조합이 감지되면 map/trajectory 추천 toast 제공
- roll/pitch/yaw 또는 quaternion 조합이 감지되면 3D attitude 추천 toast 제공

---

## 13. 이상점 클릭과 연관 추적 UX

이 기능은 RealTimeInsight의 차별화 핵심이다.

## 13.1 상호작용 규칙
1. 그래프에서 사용자가 포인트 클릭
2. `SelectedPoint` 생성
3. 중앙의 클릭 상태는 강조 표시
4. 우측 Insight Pane 자동 open
5. Relation Graph root를 `observation:<channel>:<timestamp>`로 생성
6. Rust core에 다음 질의 자동 발행:
   - same-window alarms
   - crc failures around point
   - sync loss around point
   - formula dependencies
   - correlated channels in window
   - spatially related entities if map-linked
   - temporally aligned video markers if video-linked
7. 결과를 evidence graph로 구성
8. 사용자는 후보를 클릭해 계속 graph를 expand

## 13.2 UX 표시 항목
- Observation card
- Top 5 root cause candidates
- Evidence edge badges
- Linked channels quick add buttons
- Open in new graph / overlay in current panel / jump to video / jump on map

## 13.3 색상 규칙
- observation anchor: 노란색 또는 흰색 강조
- confirmed anomaly: 빨간색
- related anomaly: 주황색
- weak relation: 회색/희미하게
- user-pinned evidence: 청록색 강조

---

## 14. 오프라인 우선 UX

## 14.1 Offline assets manager

오프라인 구동 요구 때문에 별도 자산 관리자 필요.

포함 항목:
- local map tile packs
- DEM / terrain assets
- offline icon packs
- SimDIS scenario bridge config
- local LLM model inventory
- video decoder/runtime status
- Matlab connectivity status

```ts
export interface OfflineAssetState {
  mode: 'online-allowed' | 'offline-preferred' | 'airgapped';
  mapTilePacks: AssetPackSummary[];
  terrainPacks: AssetPackSummary[];
  llmModels: LocalModelSummary[];
  simdisProfiles: SimdisProfileSummary[];
  licenses: LicenseStateSummary[];
}
```

## 14.2 UI 규칙
- airgapped 모드면 외부 링크, 온라인 도움말, 클라우드 동기 버튼 숨김
- 지도 패널은 온라인 지도가 아니라 local tile source 우선
- LLM 패널은 local provider만 노출
- integration dialog는 허용된 오프라인 도구만 보여줌

---

## 15. SimDIS 및 지도 패널 UX 확장

## 15.1 SimDIS bridge panel

목표:
- SimDIS 자체를 다시 구현하는 것이 아니라, 동기화된 bridge/control panel 제공
- scenario time sync
- entity selection sync
- telemetry overlay control

```ts
export interface SimdisIntegrationState {
  connected: boolean;
  mode: 'disconnected' | 'file-replay' | 'network-bridge';
  currentScenario?: string;
  selectedEntityId?: string;
  syncEnabled: boolean;
}
```

### 15.1.1 패널 기능
- connect/disconnect
- scenario picker
- entity sync toggle
- follow selected track
- push selected anomaly timestamp to SimDIS
- receive selected entity/time from SimDIS

## 15.2 Map panel 필수 기능
- 2D satellite/base map
- tactical symbol overlay
- track trail on/off
- geofence / region overlay
- CoT/TAK compatible object import-ready structure
- click entity -> related telemetry panels sync

---

## 16. Export UI 명세

## 16.1 Export dialog 탭
- CSV
- Parquet
- Arrow IPC
- Matlab
- Snapshot/Report

## 16.2 Export dialog 공통 입력
- 대상: selected channels / active panel / current layout / selected range / anomaly window
- 시간범위: current viewport / selected range / custom range
- 품질정책: keep-all / good-crc-only / decode-valid-only / split-by-quality
- 값 형식: raw / eng / both
- 메타데이터 포함 여부

## 16.3 CSV export form state

```ts
export interface CsvExportFormState {
  targetKind: 'channels' | 'panel' | 'selection';
  channelIds: number[];
  timeRange: [string, string] | null;
  qualityPolicy: 'keep-all' | 'good-crc-only' | 'decode-valid-only' | 'split-by-quality';
  valueMode: 'raw' | 'eng' | 'both';
  includeMetadata: boolean;
  fileName: string;
}
```

## 16.4 Matlab export flow
- 사용자가 range/target 선택
- preset plot template 선택
- `matlabPlot` command 발행
- 성공 시:
  - MATLAB에서 figure 열기
  - script path 보여주기
  - 재실행 가능한 command 저장

---

## 17. LLM Assistant 패널 UX

LLM 패널은 반드시 “근거 기반 도구 패널”처럼 보여야 한다.

## 17.1 탭 구성
- Ask
- Suggested Questions
- Tool Trace
- Explanation
- Report Draft

## 17.2 필수 표시 요소
- active context summary
- selected range
- selected anomaly / selected channels
- tools invoked list
- evidence references
- confidence / inference disclaimer

## 17.3 금지사항
- 근거 없이 자유 텍스트만 길게 노출하지 않는다.
- raw data 전체를 모델에 보낸 것처럼 보이게 하지 않는다.
- “AI thinks” 중심 문구보다 “evidence from …” 구조를 사용한다.

---

## 18. Mock 데이터 스키마

아래 mock 데이터는 UI 초기 개발에 바로 사용한다.

## 18.1 project.mock.json

```json
{
  "projectId": "project-rti-demo",
  "name": "RTI Flight Test Demo",
  "modeCapabilities": ["live", "replay"],
  "channels": 128,
  "sourceKinds": ["udp", "raw-file", "decoded-file", "video-ts"],
  "videoSources": [
    {
      "videoId": "cam-front",
      "label": "Front EO Camera",
      "programNumber": 1,
      "pid": 256
    }
  ],
  "mapProfiles": [
    {
      "id": "offline-korea-sat",
      "label": "Korea Offline Satellite"
    }
  ],
  "simdisProfiles": [
    {
      "id": "simdis-lab-1",
      "label": "Lab SimDIS Bridge"
    }
  ]
}
```

## 18.2 channels.mock.json

```json
[
  {
    "channelId": 1001,
    "name": "bus_voltage",
    "displayName": "Bus Voltage",
    "group": "Power",
    "unit": "V",
    "channelType": "analog",
    "sampleRateHz": 200,
    "qualityPolicy": "good-crc-only",
    "tags": ["power", "critical"]
  },
  {
    "channelId": 1205,
    "name": "hyd_pressure",
    "displayName": "Hydraulic Pressure",
    "group": "Hydraulic",
    "unit": "bar",
    "channelType": "analog",
    "sampleRateHz": 200,
    "qualityPolicy": "keep-all",
    "tags": ["pressure"]
  },
  {
    "channelId": 2210,
    "name": "rpy_roll",
    "displayName": "Roll",
    "group": "Pose",
    "unit": "deg",
    "channelType": "pose3d",
    "sampleRateHz": 100,
    "qualityPolicy": "good-crc-only",
    "tags": ["pose", "attitude"]
  },
  {
    "channelId": 5001,
    "name": "rf_spectrum",
    "displayName": "RF Spectrum",
    "group": "RF",
    "unit": "dBm",
    "channelType": "spectrum",
    "sampleRateHz": 1,
    "qualityPolicy": "keep-all",
    "tags": ["rf", "waterfall"]
  }
]
```

## 18.3 anomalies.mock.json

```json
[
  {
    "anomalyId": "anom-001",
    "channelId": 1205,
    "timestampNs": "182340000000",
    "severity": "high",
    "score": 0.93,
    "label": "Pressure spike with correlated current disturbance"
  },
  {
    "anomalyId": "anom-002",
    "channelId": 1001,
    "timestampNs": "182341000000",
    "severity": "medium",
    "score": 0.76,
    "label": "Transient voltage dip"
  }
]
```

## 18.4 workspace.mock.json

```json
{
  "workspaceId": "ws-default",
  "workspaceName": "Default Flight Analysis",
  "layoutTree": {
    "type": "split",
    "id": "root",
    "direction": "horizontal",
    "ratio": [0.6, 0.4],
    "children": [
      {
        "type": "split",
        "id": "left-main",
        "direction": "vertical",
        "ratio": [0.6, 0.4],
        "children": [
          { "type": "panel", "id": "node-a", "panelId": "panel-strip-1" },
          { "type": "panel", "id": "node-b", "panelId": "panel-waterfall-1" }
        ]
      },
      {
        "type": "split",
        "id": "right-main",
        "direction": "vertical",
        "ratio": [0.5, 0.5],
        "children": [
          { "type": "panel", "id": "node-c", "panelId": "panel-map-1" },
          { "type": "panel", "id": "node-d", "panelId": "panel-video-1" }
        ]
      }
    ]
  },
  "panels": {
    "panel-strip-1": {
      "id": "panel-strip-1",
      "kind": "strip",
      "title": "Power + Pressure",
      "layoutNodeId": "node-a",
      "bindings": [
        { "type": "channel", "channelId": 1001 },
        { "type": "channel", "channelId": 1205 }
      ],
      "options": {
        "overlayMode": "multi-axis"
      },
      "uiState": {},
      "createdAt": "2026-04-20T13:00:00Z",
      "updatedAt": "2026-04-20T13:05:00Z"
    }
  }
}
```

---

## 19. 패널별 Mock 데이터 계약

## 19.1 timeseries-v1

```ts
export interface TimeSeriesChunkV1 {
  schema: 'timeseries-v1';
  channelId: number;
  rangeNs: [string, string];
  points: Array<{
    t: string;
    y: number | null;
    q: number;
    raw?: string | number;
  }>;
}
```

## 19.2 discrete-v1

```ts
export interface DiscreteChunkV1 {
  schema: 'discrete-v1';
  channelId: number;
  rangeNs: [string, string];
  segments: Array<{
    startNs: string;
    endNs: string;
    value: string | number;
    q: number;
  }>;
}
```

## 19.3 waterfall-v1

```ts
export interface WaterfallChunkV1 {
  schema: 'waterfall-v1';
  channelId: number;
  timeBins: string[];
  freqAxisHz: number[];
  valuesDb: number[][];
}
```

## 19.4 relationgraph-v1

```ts
export interface RelationGraphPayload {
  rootNodeId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}
```

---

## 20. 첫 구현 스프린트 범위

초기 스프린트에서 모두 만들려고 하면 실패한다. 아래 순서로 자른다.

## Sprint 1
- App shell
- TopCommandBar
- LeftSidebar basic search/tree
- Dock workspace basic split layout
- Strip panel
- Numeric panel
- Event log panel
- Workspace save/load mock
- Mock data wiring

## Sprint 2
- Drag & drop overlay/split
- Replay controls
- Linked cursor
- Insight pane basic
- anomaly click -> evidence list
- CSV export dialog

## Sprint 3
- Waterfall
- Map panel
- Video panel shell
- Relation graph panel
- Offline assets dialog

## Sprint 4
- SimDIS bridge panel
- Matlab integration modal
- LLM tool trace pane
- 3D panels

---

## 21. Claude Code Designer용 직접 입력 프롬프트

아래 문장을 그대로 넣어도 된다.

```text
Build the frontend UI for RealTimeInsight as a desktop telemetry analysis workstation.

Requirements:
- Use a dockable multi-panel layout.
- Left sidebar must support fast channel search, filter chips, favorites, and drag-and-drop.
- Dragging a channel to the center of a strip panel overlays it; dropping on an edge splits the panel.
- The app must support Live Mode and Replay Mode with mostly shared UI.
- The right insight pane must show root-cause candidates, relation graph, evidence cards, and an LLM assistant trace panel.
- The bottom console must show alarms, CRC failures, decoder warnings, sync loss, and performance stats.
- Create panel types for strip, multistrip, numeric, discrete, XY, waterfall, map, video, relation graph, and SimDIS bridge.
- The UI must be offline-first and must not assume internet access.
- Use mock data and typed TypeScript interfaces.
- Separate global workspace state from panel-local UI state.
- Produce production-grade component structure, state models, and placeholder renderers.
```

---

## 22. Acceptance criteria

### 22.1 구조
- 패널 생성/분할/닫기/저장이 동작해야 한다.
- 채널 드래그 앤 드롭이 동작해야 한다.
- 워크스페이스 복원 후 같은 배치가 다시 열려야 한다.

### 22.2 상호작용
- strip panel에 2개 이상 채널 overlay 가능
- edge drop으로 split 가능
- 이상점 클릭 시 우측 insight pane 갱신
- global cursor를 통해 여러 패널이 동기화

### 22.3 mock 기반 기능
- mock project, channels, anomalies, workspace로 앱이 즉시 뜰 것
- 최소 3종 패널이 mock 데이터로 렌더될 것
- export dialog가 mock에서도 작동 형태를 보일 것

### 22.4 품질
- 렌더 패널에서 불필요한 전체 리렌더를 피할 것
- 1만개 이상 채널 메타데이터를 검색 가능한 구조일 것
- airgapped/offline 모드를 UI 레벨에서 지원할 것

---

## 23. 마지막 판단

이 문서대로 가면 프런트엔드는 다음 세 가지를 동시에 만족할 수 있다.

1. 당장 mock 기반으로 빠르게 화면을 만든다.  
2. 나중에 Rust/Tauri 실데이터 브리지로 교체하기 쉽다.  
3. 지도/SimDIS/비디오/LLM/Matlab까지 확장해도 구조가 안 무너진다.

핵심은 하나다.

**패널 시스템, 상태 모델, 이벤트 계약을 먼저 고정하고, 차트 모양은 그 다음에 올린다.**

이 순서를 바꾸면 다시 뜯어고치게 된다.
