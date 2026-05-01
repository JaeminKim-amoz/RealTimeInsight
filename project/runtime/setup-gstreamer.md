# GStreamer Runtime Setup

Date: 2026-04-22

RealTimeInsight can run without GStreamer, but real MPEG-TS/H.264 demux and
appsink video seek requires the local GStreamer runtime.

## Linux / WSL Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-libav
```

Verify:

```bash
gst-launch-1.0 --version
gst-inspect-1.0 tsdemux
gst-inspect-1.0 appsink
RUN_GSTREAMER_SMOKE=1 node project/runtime/gstreamer-smoke.js
```

## Windows

Install the official GStreamer MSVC runtime and development package for
Windows x86_64 from the GStreamer project. Add the runtime `bin` folder to
`PATH`, for example:

```powershell
$env:PATH = "C:\gstreamer\1.0\msvc_x86_64\bin;$env:PATH"
gst-launch-1.0 --version
gst-inspect-1.0 tsdemux
gst-inspect-1.0 appsink
$env:RUN_GSTREAMER_SMOKE = "1"
node project/runtime/gstreamer-smoke.js
```

## Required Capabilities

- `gst-launch-1.0` is on `PATH`.
- `gst-inspect-1.0` is on `PATH`.
- `tsdemux` plugin is installed.
- `appsink` plugin is installed.
- Local MPEG-TS paths are used; remote URLs and shell launchers are rejected by
  `rti_core::runtime_policy`.

## Current Status

Current runtime discovery reports GStreamer as missing. Segment indexing,
cursor-to-frame seeking, and safe local seek command construction are already
implemented and tested; real demux/appsink execution starts once this runtime is
installed.
