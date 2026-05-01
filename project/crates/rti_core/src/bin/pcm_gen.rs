//! `pcm_gen` — PCM frame UDP sender.
//!
//! Builds CRC-valid PCM frames via [`rti_core::pcm::generator::PcmGenerator`]
//! and emits them to a UDP target at a calibrated rate matching the
//! `--bitrate-mbps` argument. Used by US-009 to drive the receiver/decoder
//! pipeline at 10 Mbps for sustained throughput tests.

use std::net::SocketAddr;
use std::time::{Duration, Instant};

use clap::Parser;
use rti_core::pcm::{generator::PcmGenerator, PcmProfile};
use tokio::net::UdpSocket;
use tokio::time::{interval, MissedTickBehavior};

#[derive(Parser, Debug, Clone)]
#[command(
    name = "pcm_gen",
    about = "Stream CRC-valid PCM frames to a UDP target at a calibrated bitrate",
)]
struct Args {
    /// Local bind address. Default lets the OS pick an ephemeral port.
    #[arg(long, default_value = "127.0.0.1:0")]
    bind: SocketAddr,

    /// Destination UDP address.
    #[arg(long, default_value = "127.0.0.1:50001")]
    target: SocketAddr,

    /// Target line rate, in megabits per second.
    #[arg(long, default_value_t = 10.0)]
    bitrate_mbps: f64,

    /// Comma-separated list of PCM channel IDs to embed in payload words.
    #[arg(long, default_value = "1001")]
    channels: String,

    /// Run duration. Zero means run forever (until Ctrl-C).
    #[arg(long, default_value_t = 0u32)]
    duration_secs: u32,
}

fn parse_channels(spec: &str) -> Vec<u32> {
    spec.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<u32>().ok())
        .collect()
}

/// Build the default PCM profile used by the binary. Reuses the decoder's
/// reference 640-word × 16-bit geometry so the receiver-side decoder (which
/// indexes hardcoded sample slots up through word 65) accepts every frame.
/// At 10 Mbps with 1280 bytes/frame this calibrates to ~977 frames/s.
fn build_profile() -> PcmProfile {
    PcmProfile::default()
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> std::io::Result<()> {
    let args = Args::parse();
    let channels = parse_channels(&args.channels);
    if channels.is_empty() {
        eprintln!("pcm_gen: at least one channel id must be provided");
        std::process::exit(2);
    }

    let profile = build_profile();
    let mut gen = PcmGenerator::new(profile.clone(), channels.clone(), args.bitrate_mbps);

    let socket = UdpSocket::bind(args.bind).await?;
    let local_addr = socket.local_addr()?;
    println!(
        "pcm_gen: bind={local_addr} target={} bitrate={:.3} Mbps frame_rate={:.1} Hz bytes/frame={} channels={:?}",
        args.target,
        args.bitrate_mbps,
        gen.target_frame_rate_hz(),
        gen.bytes_per_frame,
        channels,
    );

    // Calibrated tick interval. Use Burst skip behaviour so we don't accumulate
    // backlog if the OS scheduler hiccups; we want steady-state line rate.
    let tick_secs = if gen.target_frame_rate_hz() > 0.0 {
        1.0 / gen.target_frame_rate_hz()
    } else {
        1.0 / 1000.0
    };
    let tick_dur = Duration::from_secs_f64(tick_secs);
    let mut ticker = interval(tick_dur);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);

    let start = Instant::now();
    let stop_after = if args.duration_secs == 0 {
        None
    } else {
        Some(Duration::from_secs(args.duration_secs as u64))
    };

    let mut bytes_total: u64 = 0;
    let mut frames_total: u64 = 0;
    let mut window_bytes: u64 = 0;
    let mut window_frames: u64 = 0;
    let mut last_report = Instant::now();
    let report_interval = Duration::from_secs(1);

    let target = args.target;

    let shutdown = tokio::signal::ctrl_c();
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                let bytes = gen.step_bytes();
                match socket.send_to(&bytes, target).await {
                    Ok(n) => {
                        bytes_total += n as u64;
                        frames_total += 1;
                        window_bytes += n as u64;
                        window_frames += 1;
                    }
                    Err(err) => {
                        // Don't block on transient send errors per acceptance criteria.
                        eprintln!("pcm_gen: send_to error: {err}");
                    }
                }

                if last_report.elapsed() >= report_interval {
                    let elapsed = last_report.elapsed().as_secs_f64();
                    let mbps = (window_bytes as f64 * 8.0) / 1.0e6 / elapsed;
                    let fps = window_frames as f64 / elapsed;
                    println!(
                        "pcm_gen: t={:.2}s frames/s={:.1} mbps={:.3} bytes_total={}",
                        start.elapsed().as_secs_f64(),
                        fps,
                        mbps,
                        bytes_total,
                    );
                    window_bytes = 0;
                    window_frames = 0;
                    last_report = Instant::now();
                }

                if let Some(limit) = stop_after {
                    if start.elapsed() >= limit {
                        break;
                    }
                }
            }
            _ = &mut shutdown => {
                println!("pcm_gen: shutdown signal received");
                break;
            }
        }
    }

    println!(
        "pcm_gen: done frames={} bytes={} elapsed={:.3}s",
        frames_total,
        bytes_total,
        start.elapsed().as_secs_f64(),
    );
    Ok(())
}
