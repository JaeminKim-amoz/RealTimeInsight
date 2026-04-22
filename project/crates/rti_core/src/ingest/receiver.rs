use std::net::UdpSocket;
use std::time::Duration;

use crate::bridge::{BridgeEvent, CrcEvent, SyncLossEvent};
use crate::data_ref::DataRefRegistry;
use crate::ingest::pipeline::{ingest_pcm_datagram, DatagramIngestReport};
use crate::ingest::udp::receive_datagram;
use crate::ingest::IngestStore;
use crate::pcm::PcmProfile;
use crate::stream::{build_panel_event_batch, PanelEventBatch, PanelSubscription};

pub trait DatagramSource {
    fn recv_datagram(&mut self, max_len: usize, timeout: Duration) -> Result<Vec<u8>, String>;
}

impl DatagramSource for &UdpSocket {
    fn recv_datagram(&mut self, max_len: usize, timeout: Duration) -> Result<Vec<u8>, String> {
        receive_datagram(self, max_len, timeout)
    }
}

#[derive(Debug)]
pub struct ReceiverTick {
    pub ingest_report: DatagramIngestReport,
    pub panel_batch: PanelEventBatch,
    pub diagnostic_events: Vec<BridgeEvent>,
}

#[derive(Debug)]
pub struct ReceiverSession {
    pub profile: PcmProfile,
    pub store: IngestStore,
    pub registry: DataRefRegistry,
    pub subscriptions: Vec<PanelSubscription>,
    pub next_seq: u64,
    pub timeout_count: u64,
}

impl ReceiverSession {
    pub fn new(
        profile: PcmProfile,
        capacity_per_channel: usize,
        data_namespace: impl Into<String>,
        subscriptions: Vec<PanelSubscription>,
    ) -> Self {
        Self {
            profile,
            store: IngestStore::new(capacity_per_channel),
            registry: DataRefRegistry::new(data_namespace),
            subscriptions,
            next_seq: 1,
            timeout_count: 0,
        }
    }

    pub fn tick(
        &mut self,
        socket: &UdpSocket,
        max_datagram_len: usize,
        timeout: Duration,
    ) -> Result<ReceiverTick, String> {
        let mut source = socket;
        self.tick_from_source(&mut source, max_datagram_len, timeout)
    }

    pub fn tick_from_source<S: DatagramSource>(
        &mut self,
        source: &mut S,
        max_datagram_len: usize,
        timeout: Duration,
    ) -> Result<ReceiverTick, String> {
        match source.recv_datagram(max_datagram_len, timeout) {
            Ok(datagram) => Ok(self.process_datagram(&datagram)),
            Err(err) => {
                if is_timeout_error(&err) {
                    self.timeout_count += 1;
                }
                Err(err)
            }
        }
    }

    pub fn process_datagram(&mut self, datagram: &[u8]) -> ReceiverTick {
        let tick = process_datagram_and_build_events(
            datagram,
            &self.profile,
            &mut self.store,
            &mut self.registry,
            &self.subscriptions,
            self.next_seq,
        );
        if tick.ingest_report.stats.sync_matches > 0 {
            self.next_seq += 1;
        }
        tick
    }
}

pub fn receive_decode_and_build_events(
    socket: &UdpSocket,
    max_datagram_len: usize,
    timeout: Duration,
    profile: &PcmProfile,
    store: &mut IngestStore,
    registry: &mut DataRefRegistry,
    subscriptions: &[PanelSubscription],
    seq: u64,
) -> Result<ReceiverTick, String> {
    let datagram = receive_datagram(socket, max_datagram_len, timeout)?;
    Ok(process_datagram_and_build_events(
        &datagram,
        profile,
        store,
        registry,
        subscriptions,
        seq,
    ))
}

pub fn process_datagram_and_build_events(
    datagram: &[u8],
    profile: &PcmProfile,
    store: &mut IngestStore,
    registry: &mut DataRefRegistry,
    subscriptions: &[PanelSubscription],
    seq: u64,
) -> ReceiverTick {
    let ingest_report = ingest_pcm_datagram(store, &datagram, profile);
    let panel_batch = build_panel_event_batch(registry, store, subscriptions, seq);
    let diagnostic_events = diagnostic_events_for_report(&ingest_report);
    ReceiverTick {
        ingest_report,
        panel_batch,
        diagnostic_events,
    }
}

pub fn diagnostic_events_for_report(report: &DatagramIngestReport) -> Vec<BridgeEvent> {
    let mut events = Vec::new();
    for frame_counter in &report.bad_frame_counters {
        events.push(BridgeEvent::CrcEvent(CrcEvent {
            frame_counter: *frame_counter,
            channel_ids: diagnostic_channel_ids(),
            reason: "crc-fail".to_string(),
            timestamp_ns: frame_counter_to_ns(*frame_counter),
        }));
    }
    if report.sync_lost {
        events.push(BridgeEvent::SyncLossEvent(SyncLossEvent {
            lost_at_ns: "0".to_string(),
            reacquired_at_ns: "0".to_string(),
            duration_ns: "0".to_string(),
            bit_offset: 0,
        }));
    }
    events
}

fn diagnostic_channel_ids() -> Vec<u32> {
    vec![8001, 8004, 1001, 1002, 1205, 1206]
}

fn frame_counter_to_ns(frame_counter: u32) -> String {
    ((182.2 + frame_counter as f64 / 30.0) * 1_000_000_000.0)
        .round()
        .to_string()
}

fn is_timeout_error(error: &str) -> bool {
    error.contains("timed out") || error.contains("WouldBlock") || error.contains("Resource temporarily unavailable")
}
