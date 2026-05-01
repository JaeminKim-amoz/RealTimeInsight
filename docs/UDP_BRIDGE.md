# UDP Bridge 설정 가이드

> 데스크톱 (Tauri) 모드에서 실제 PCM/UDP 텔레메트리 패킷을 받기 위한 설정.
> 브라우저 dev 모드에서는 mock synthesizer만 동작하고 이 문서는 적용되지 않습니다.

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [기본 동작](#기본-동작)
3. [송신기 (pcm_gen) 사용](#송신기-pcm_gen-사용)
4. [Stream Config 모달 4 탭](#stream-config-모달-4-탭)
5. [멀티 스트림](#멀티-스트림)
6. [AES-256 암호화](#aes-256-암호화)
7. [방화벽 / 포트](#방화벽--포트)
8. [상태 확인](#상태-확인)

---

## 아키텍처 개요

```
┌──────────────────┐    UDP/IP    ┌────────────────────────┐
│ 외부 송신기      │  ──────────→ │ rti_core (Rust)        │
│ (pcm_gen,        │  239.x:5001  │  • UDP listener        │
│  실측 장비, Sim) │              │  • IRIG-Ch10 decoder   │
└──────────────────┘              │  • CRC validator       │
                                  │  • RAF coalescer       │
                                  └──────────┬─────────────┘
                                             │ Tauri invoke
                                             ▼
                                  ┌────────────────────────┐
                                  │ React UI (zustand)     │
                                  │  • streamStore buffers │
                                  │  • panel renderers     │
                                  └────────────────────────┘
```

핵심 포인트:
- 수신은 **Rust (rti_core)** 에서 처리, JS는 디코드 후 frame array만 받습니다.
- **RAF coalescer**: pushFrame은 0 zustand notification, tickRaf 하나당 1 notification 보장 (60 FPS UI).
- **3개 채널 기본 활성**: `1001` (bus_volt_28v), `8001` (sortie_track), `1205` (hyd_pA).

---

## 기본 동작

### 1. Tauri dev 시작

```bash
npm run tauri:dev
```

`project/src-tauri/src/main.rs` 의 `start_managed_receiver_loop` 가 자동으로 호출되어
`239.192.1.10:5001` (default) 에 UDP listener를 엽니다.

### 2. 빈 화면 표시 ("Bridge offline")

송신기가 없으면 채널 #1001 의 strip 패널은 **"Bridge offline"** 플레이스홀더를 표시합니다 (Critic C3 mitigation).
이는 의도된 동작 — silent synth fallback이 production에서 잘못된 데이터를 보여주는 것을 방지합니다.

---

## 송신기 (pcm_gen) 사용

`rti_core` crate는 PCM 패킷을 생성·송신하는 CLI 바이너리를 함께 제공합니다.

### 빌드

```bash
cargo build --release --manifest-path project/crates/rti_core/Cargo.toml --bin pcm_gen
```

### 실행

```bash
cargo run --manifest-path project/crates/rti_core/Cargo.toml --bin pcm_gen -- \
  --target 239.192.1.10:5001 \
  --bitrate 10 \
  --frame-words 256 \
  --word-bits 16 \
  --sync-pattern FE6B2840 \
  --duration 60
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--target <IP:PORT>` | `239.192.1.10:5001` | 송신 대상 (multicast 또는 unicast) |
| `--bitrate <Mbps>` | 10 | 목표 bitrate |
| `--frame-words <N>` | 256 | 한 프레임의 word 개수 |
| `--word-bits <N>` | 16 | word 비트 수 (8 / 10 / 16 / 32) |
| `--sync-pattern <HEX>` | `FE6B2840` | 32비트 동기 패턴 |
| `--duration <SEC>` | 무한 | 송신 시간 (초) |
| `--crc-fail-rate <%>` | 0 | 의도적 CRC fail 주입 (테스트용) |

### Multicast vs Unicast

기본값은 multicast (`239.x.x.x`). 사내 네트워크가 multicast 차단되면 unicast로:

```bash
# 송신
cargo run ... -- --target 192.168.1.50:5001

# 수신측 (Stream Config 모달에서 IP 변경 또는 main.rs에서 수정)
```

---

## Stream Config 모달 4 탭

TopBar → **Settings → Streams** 또는 메뉴에서 **Stream Config** 를 열면 4개 탭이 표시됩니다.

### Tab 1: Sync Pattern

| 필드 | 설명 | 기본값 |
|---|---|---|
| **Sync pattern (hex)** | 32-bit 동기 워드 | `FE6B2840` |
| **Sync width (bits)** | 동기 패턴 비트 수 | 16 / 24 / **32** |
| **Frame words** | 한 프레임당 word 수 | 256 |

### Tab 2: Frame Layout

| 필드 | 설명 |
|---|---|
| **Word bits** | 8 / 10 / 16 / 32 |
| **CRC word index** | CRC 위치 (0-base, 보통 마지막 word — frameWords-1) |
| **Sync placement** | start / end |
| **Subcom mask bits** | sub-commutation bit 수 |

### Tab 3: Streams

여러 stream을 동시에 수신할 수 있습니다.

```
streamId    | ip             | port | bitrate (Mbps)
────────────┼────────────────┼──────┼────────────────
s-primary   | 239.192.1.10   | 5001 | 42.8
s-video     | 10.10.20.14    | 5101 | 18.4
[+ Add Stream]
```

각 row 우측의 `Remove` 버튼으로 삭제 가능. 하단에 총 bitrate 가 자동 합산됩니다.

### Tab 4: Encryption

AES-256 옵션. 자세한 내용은 다음 섹션 참조.

### Apply 버튼

설정이 valid 하면 `onApply(config)` 가 호출되고 토스트 "Configuration applied successfully" 가 표시된 후 모달이 자동 닫힙니다.

검증 실패 시 (예: hex 형식 오류, port 범위 0-65535 초과, IP 형식 오류) 빨간 에러 라인 표시.

---

## 멀티 스트림

### 시나리오: telemetry + video 동시 수신

```
Tab "Streams":
  s-telemetry   239.192.1.10  5001   10 Mbps
  s-video       239.192.1.20  5101   20 Mbps
  s-rtcm        192.168.1.50  5201    1 Mbps   (NTRIP correction)
```

### Bitrate 합산

화면 하단에 `Total bitrate: 31.00 Mbps` 가 자동 표시됩니다.
설계 한계 (예: 100 Mbps NIC) 에 근접하면 빨간색으로 변경됩니다.

### Stream 별 분리 디코드

`rti_core` 가 stream-id 별로 별도 thread + ring buffer를 운용합니다.
한 stream이 burst 로 막히더라도 다른 stream의 60 FPS UI는 영향받지 않습니다.

---

## AES-256 암호화

### 활성화

Tab "Encryption" → **AES-256 enabled** 체크박스 ON.

### 키 입력 형식 2가지

| 형식 | 설명 | 입력 예시 |
|---|---|---|
| **Hex** (권장) | 64자 16진수 = 256 비트 | `00112233...eeff` (64 chars) |
| **Text** | 32자 이상 ASCII | "MyVeryLongPassphraseAtLeast32Chars!" |

검증:
- Hex 모드: 정확히 64 chars + `[0-9a-fA-F]` 만 허용
- Text 모드: 32 chars 이상

### 보안 권장

- **사내 generation**: `openssl rand -hex 32`
- **저장**: 키는 절대 `.env` 또는 git 에 커밋하지 마세요. 운영 환경에서는 OS keyring 사용.
- **로테이션**: 미션 시작마다 새 키.

---

## 방화벽 / 포트

### Windows

```powershell
New-NetFirewallRule -DisplayName "RTI UDP 5001" `
  -Direction Inbound -Protocol UDP -LocalPort 5001 -Action Allow
```

### macOS

System Settings → Network → Firewall → 앱 (RealTimeInsight) 에 incoming 허용.

### Linux (ufw)

```bash
sudo ufw allow 5001/udp
sudo ufw allow 5101/udp  # video stream
```

### Multicast 라우팅

```bash
# Linux: multicast 인터페이스 명시
sudo ip route add 239.0.0.0/8 dev eth0
```

---

## 상태 확인

### 1. BottomConsole

화면 하단에 실시간 상태 표시:

```
[ FPS 60.1 │ CRC 0.02% │ RX 9.84 Mbps │ Bridge ● ]
```

| 항목 | 정상 범위 |
|---|---|
| FPS | 55–60 |
| CRC fail rate | < 0.1% |
| RX bitrate | 송신 bitrate ± 5% |
| Bridge | 녹색 ● = OK / 빨강 = 끊김 |

### 2. TopBar RX LED

상단 우측에 stream 별 LED:
- 녹색 = 정상
- 노랑 = 손실 < 1%
- 빨강 = 손실 ≥ 1% 또는 timeout

### 3. 명령줄 디버그

```bash
# rti_core 로그 보기
RUST_LOG=debug npm run tauri:dev

# UDP 패킷 직접 확인
sudo tcpdump -i any -n udp port 5001 -A
```

---

## 트러블슈팅

자주 발생하는 문제는 [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) 참조.
