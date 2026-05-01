# 문제 해결 (Troubleshooting)

> 자주 발생하는 문제와 해결 방법. 한 번에 안 되시면 → GitHub Issues.

## 목차

1. [설치·실행](#1-설치실행)
2. [Globe / Space 시트](#2-globe--space-시트)
3. [Replay 모드](#3-replay-모드)
4. [UDP 수신 / Bridge offline](#4-udp-수신--bridge-offline)
5. [빌드 오류](#5-빌드-오류)
6. [테스트 실패](#6-테스트-실패)
7. [성능 이슈](#7-성능-이슈)

---

## 1. 설치·실행

### "npm install" 이 멈춥니다

```bash
# npm cache 청소
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

WSL 사용자는 Windows 측 디렉토리에서 실행 시 매우 느립니다 — WSL 측 `/home/<user>/...` 로 이동하세요.

### "tauri:dev" 가 webview 에러로 실패

| OS | 설치할 것 |
|---|---|
| Windows | WebView2 Runtime (대부분 자동 설치되어 있음) |
| macOS | Xcode CLT: `xcode-select --install` |
| Ubuntu | `sudo apt install libwebkit2gtk-4.0-dev libgtk-3-dev` |

전체 prerequisites: https://tauri.app/v2/guides/getting-started/prerequisites/

### "npm run dev" 후 브라우저에서 빈 화면

브라우저 콘솔 (F12) 확인. 흔한 원인:
- 캐시: 강력 새로고침 (`Cmd+Shift+R` / `Ctrl+Shift+F5`)
- 다른 포트와 충돌: `vite.config.ts` 의 `server.port` 를 다른 값으로 (예: 5174)

---

## 2. Globe / Space 시트

### Q. Space 탭에서 지구가 안 보여요

**Slice 3 에서 해결됨**. 다음을 확인:

1. 최신 코드인지: `git pull` 후 `npm install` + `npm run dev`
2. 화면 우상단 9개 토글 중 **"지구 텍스처"** 가 ON 인지
3. 줌이 너무 멀어졌으면 마우스 휠로 zoom-in (camera.position.z 1.15–6 범위)
4. WebGL 지원 확인: 브라우저 주소창에 `chrome://gpu` 또는 `about:gpu`

### Q. 지구가 회색이고 대륙이 안 보여요

procedural earth texture 가 생성되지 않은 것입니다. 콘솔에 다음 메시지가 있는지:

```
WebGL: INVALID_OPERATION ...
THREE.WebGLRenderer: ...
```

원인:
- 그래픽 드라이버 outdated → 업데이트
- VM / VirtualBox에서 WebGL 비활성 → 호스트 OS에서 실행

### Q. 별 배경이 너무 많아 어지러워요

우상단 토글 → **별 배경** OFF.

### Q. 위성이 안 움직여요

우상단 토글 → **자동 회전** OFF 인지 확인. 또는 **궤도 + 위성** 이 OFF 일 수도 있습니다.

### Q. jsdom (테스트) 에서 globe가 SVG로 표시됩니다

이는 **의도된 동작** 입니다 (Slice 3 US-3-005). WebGL 없는 환경에서는 SVG fallback이 표시됩니다.

---

## 3. Replay 모드

### Q. Replay 모드 들어가도 transport 컨트롤이 안 보여요

`sessionStore.appMode === 'replay'` 인지 확인:

```js
// 브라우저 콘솔
__TAURI_INVOKE_DEBUG__?.sessionStore?.getState()
// 또는 React DevTools 의 useSessionStore hook 검사
```

수동으로 진입:
```js
useSessionStore.getState().enterReplayMode()
```

### Q. Scrub slider 를 움직여도 데이터가 변하지 않아요

`hydrateBuffer` 가 호출되었는지:
- TopBar → Library → recording 클릭 시 자동 hydrate
- 수동: `useStreamStore.getState().hydrateBuffer(subscriptionId, frames)`

Replay buffer는 **60초 fixture** (12000 frames @ 200 Hz) 입니다.
재생 헤드가 60초를 넘기면 자동으로 paused 또는 loop.

### Q. 재생 속도 4× 인데도 느려요

- 브라우저 background tab은 RAF가 1 Hz로 throttle 됨 → tab을 foreground 로 두세요
- 다른 무거운 패널 (waterfall, globe) 동시 띄우면 60 FPS 유지 어려움

---

## 4. UDP 수신 / Bridge offline

### Q. 채널 #1001 에 "Bridge offline" 표시

**의도된 안전 장치** (Critic C3): 송신기가 없을 때 silent synth fallback 대신 placeholder 표시.

해결:
1. `npm run tauri:dev` 로 실행 (브라우저 dev는 mock만 동작)
2. `pcm_gen` 송신기 시작:
   ```bash
   cargo run --manifest-path project/crates/rti_core/Cargo.toml --bin pcm_gen
   ```

자세한 내용: [`UDP_BRIDGE.md`](UDP_BRIDGE.md).

### Q. 송신기는 돌고 있는데 수신이 안 됩니다

체크리스트:
1. **방화벽**: UDP 5001 포트 inbound 허용 (Windows: `New-NetFirewallRule`)
2. **IP/포트 매칭**: `Stream Config` 의 IP:Port 가 송신기와 같은지
3. **Multicast 라우팅**: `239.x.x.x` 사용 시 인터페이스 명시 필요
   ```bash
   sudo ip route add 239.0.0.0/8 dev eth0
   ```
4. **tcpdump / Wireshark** 로 패킷이 실제 도착하는지 확인:
   ```bash
   sudo tcpdump -i any -n udp port 5001 -A
   ```

### Q. CRC fail rate 가 너무 높아요

Stream Config → Frame Layout 탭 → CRC word index 가 송신측과 일치하는지 확인.
또는 sync pattern hex가 정확한지 (`FE6B2840` vs 다른 값).

### Q. AES-256 키가 64자 hex 라고 거부됩니다

- 정확히 64 chars + `[0-9a-fA-F]` 만
- 공백 제거: `key.replace(/\s/g, '').length === 64`
- 새 키 생성: `openssl rand -hex 32`

---

## 5. 빌드 오류

### Q. "vitest" 가 plugin-react ESM 에러

```
Error: Cannot use import statement outside a module
@vitejs/plugin-react ...
```

**해결**: `vitest.config.ts` 에서 plugin-react 를 빼고 esbuild의 jsx automatic을 사용 (이미 적용됨).
만약 직접 vitest config을 수정했다면 원본으로 복구:

```ts
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  // ...
});
```

### Q. `npm run build` 가 "Some chunks are larger than 500 kB"

**경고일 뿐 에러 아님**. exit 0 이면 빌드 성공.

청크 분할로 줄이려면 `vite.config.ts` 에 `build.rollupOptions.output.manualChunks` 추가.

### Q. cargo build 에서 linker 에러

#### Windows
- VS C++ Build Tools 설치 필요: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- "Desktop development with C++" workload 선택

#### macOS
```bash
xcode-select --install
```

#### Ubuntu
```bash
sudo apt install build-essential pkg-config libssl-dev
```

---

## 6. 테스트 실패

### Q. `HTMLCanvasElement.prototype.getContext` not implemented

jsdom의 알려진 제약. 우리 코드에서 다음 가드로 처리:

```ts
if (typeof window.WebGLRenderingContext === 'undefined') return false;
```

따라서 정상 동작 (test 자체는 pass) — 단지 stderr 에 warning만 출력. 무시하세요.

### Q. `getByTestId` "Found multiple elements"

같은 testid 가 두 곳에 있을 때 발생. 고유한 prefix 부여:
- ❌ `pdop-forecast` (GpsLosSheet 와 GpsLosPanel 둘 다 있어 충돌)
- ✅ `gps-pdop-forecast` (각각 다른 prefix)

### Q. PRD acceptance test 가 fail

`prd.json` 의 story id 또는 `passes: true` 가 변경됐을 때.
`slice2-acceptance.spec.tsx` / `slice3-visual.spec.tsx` 는 PRD 메타데이터를 검증.

PRD 수정 시 두 spec을 함께 업데이트.

### Q. Math.random 의존 테스트가 가끔 fail

`Math.random` 을 stubbing 해서 결정적으로:

```ts
const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

it('all-pass', () => {
  Math.random = () => 0.99;
  // ... 테스트
});
```

---

## 7. 성능 이슈

### Q. 패널이 여러 개 켜지면 FPS 가 떨어져요

| 패널 | GPU 부하 | CPU 부하 |
|---|---|---|
| globe (3D earth + 18 sats + 2400 stars) | 높음 | 중간 |
| trajectory3d / attitude3d / antenna3d | 높음 | 낮음 |
| waterfall (FFT spectrogram) | 중간 | 높음 |
| relationgraph (force-directed) | 낮음 | 중간 |
| strip / numeric / discrete | 낮음 | 낮음 |

대시보드에 globe + waterfall + 4 strip 정도가 권장 한계.

### Q. RAF coalescer 가 동작 안 하는 것 같아요

`tickRaf()` 호출이 RAF 루프에 등록되어 있는지 확인:

```ts
// App.tsx
useEffect(() => {
  let rafId = 0;
  const loop = () => { tickRaf(); rafId = requestAnimationFrame(loop); };
  rafId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafId);
}, [tickRaf]);
```

수동 검증:
```ts
const sub = useStreamStore.subscribe(() => count++);
for (let i = 0; i < 1000; i++) pushFrame(...);   // count 그대로
tickRaf();                                       // count === 1
```

### Q. Memory 가 점점 늘어요

`StreamBuffer.MAX_BUFFER = 60_000` (~5분 @ 200Hz). 그 이상은 자동으로 ring 동작.
패널 unmount 시 `unsubscribe(subscriptionId)` 호출 — 보통 useEffect cleanup으로 자동.

만약 leak가 있다면 React DevTools Profiler 로 확인 후 issue 등록.

---

## 그래도 안 풀리면

다음 정보를 GitHub Issues에 첨부해 주세요:

```markdown
**환경**
- OS: Windows 11 22H2 / macOS 14.4 / Ubuntu 22.04
- Node: 20.10
- Rust: 1.75
- Browser: Chrome 122 / Tauri 2.0

**증상**
(스크린샷 + 콘솔 출력)

**재현 단계**
1. ...
2. ...
3. (실제 결과 vs 기대 결과)

**시도한 것**
- ...
```
