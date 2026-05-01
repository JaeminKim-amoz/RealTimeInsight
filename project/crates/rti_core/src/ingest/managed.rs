use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::bridge::BridgeEvent;
use crate::ingest::receiver::ReceiverSession;
use crate::pcm::PcmProfile;
use crate::stream::PanelSubscription;

type EventSink = Box<dyn Fn(BridgeEvent) + Send + 'static>;

#[derive(Debug, Clone)]
pub struct ManagedReceiverConfig {
    pub profile: PcmProfile,
    pub capacity_per_channel: usize,
    pub data_namespace: String,
    pub subscriptions: Vec<PanelSubscription>,
    pub max_datagram_len: usize,
    pub timeout: Duration,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ManagedReceiverSnapshot {
    pub running: bool,
    pub accepted_frames: u64,
    pub rejected_frames: u64,
    pub accepted_samples: u64,
    pub timeout_count: u64,
    pub queued_events: usize,
}

#[derive(Debug)]
pub struct ManagedReceiverRuntime {
    running: Arc<AtomicBool>,
    snapshot: Arc<Mutex<ManagedReceiverSnapshot>>,
    events: Arc<Mutex<Vec<BridgeEvent>>>,
    handle: Option<JoinHandle<()>>,
}

impl ManagedReceiverRuntime {
    pub fn start(socket: UdpSocket, config: ManagedReceiverConfig) -> Result<Self, String> {
        Self::start_with_sink(socket, config, |_| {})
    }

    pub fn start_with_sink<F>(
        socket: UdpSocket,
        config: ManagedReceiverConfig,
        event_sink: F,
    ) -> Result<Self, String>
    where
        F: Fn(BridgeEvent) + Send + 'static,
    {
        if config.max_datagram_len == 0 {
            return Err("max_datagram_len must be non-zero".to_string());
        }
        let event_sink: EventSink = Box::new(event_sink);
        let running = Arc::new(AtomicBool::new(true));
        let snapshot = Arc::new(Mutex::new(ManagedReceiverSnapshot {
            running: true,
            ..ManagedReceiverSnapshot::default()
        }));
        let events = Arc::new(Mutex::new(Vec::new()));

        let worker_running = Arc::clone(&running);
        let worker_snapshot = Arc::clone(&snapshot);
        let worker_events = Arc::clone(&events);
        let handle = thread::spawn(move || {
            let mut session = ReceiverSession::new(
                config.profile,
                config.capacity_per_channel,
                config.data_namespace,
                config.subscriptions,
            );
            while worker_running.load(Ordering::SeqCst) {
                match session.tick(&socket, config.max_datagram_len, config.timeout) {
                    Ok(tick) => {
                        let mut next_events = tick.diagnostic_events;
                        next_events.extend(tick.panel_batch.events);
                        if let Ok(mut queue) = worker_events.lock() {
                            queue.extend(next_events.iter().cloned());
                        }
                        for event in next_events {
                            event_sink(event);
                        }
                    }
                    Err(_) => {}
                }
                update_snapshot(&worker_snapshot, &worker_events, &session, true);
            }
            update_snapshot(&worker_snapshot, &worker_events, &session, false);
        });

        Ok(Self {
            running,
            snapshot,
            events,
            handle: Some(handle),
        })
    }

    pub fn stop(&mut self) -> Result<(), String> {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            handle
                .join()
                .map_err(|_| "managed receiver thread panicked".to_string())?;
        }
        if let Ok(mut snapshot) = self.snapshot.lock() {
            snapshot.running = false;
        }
        Ok(())
    }

    pub fn snapshot(&self) -> ManagedReceiverSnapshot {
        self.snapshot.lock().map(|snapshot| snapshot.clone()).unwrap_or_default()
    }

    pub fn drain_events(&self) -> Vec<BridgeEvent> {
        let events = self
            .events
            .lock()
            .map(|mut queue| queue.drain(..).collect::<Vec<_>>())
            .unwrap_or_default();
        if let Ok(mut snapshot) = self.snapshot.lock() {
            snapshot.queued_events = 0;
        }
        events
    }
}

impl Drop for ManagedReceiverRuntime {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

fn update_snapshot(
    snapshot: &Arc<Mutex<ManagedReceiverSnapshot>>,
    events: &Arc<Mutex<Vec<BridgeEvent>>>,
    session: &ReceiverSession,
    running: bool,
) {
    if let Ok(mut snapshot) = snapshot.lock() {
        let stats = session.store.stats();
        snapshot.running = running;
        snapshot.accepted_frames = stats.accepted_frames;
        snapshot.rejected_frames = stats.rejected_frames;
        snapshot.accepted_samples = stats.accepted_samples;
        snapshot.timeout_count = session.timeout_count;
        snapshot.queued_events = events.lock().map(|queue| queue.len()).unwrap_or(0);
    }
}
