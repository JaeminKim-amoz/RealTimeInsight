use std::time::Duration;

use rti_core::bridge::{BridgeEvent, PanelDataSchema};
use rti_core::ingest::receiver::{DatagramSource, ReceiverSession};
use rti_core::pcm::{bits_to_bytes, create_test_frame, frame_to_bits, PcmProfile};
use rti_core::stream::PanelSubscription;

struct ScriptedDatagramSource {
    items: Vec<Result<Vec<u8>, String>>,
}

impl DatagramSource for ScriptedDatagramSource {
    fn recv_datagram(&mut self, _max_len: usize, _timeout: Duration) -> Result<Vec<u8>, String> {
        self.items.remove(0)
    }
}

fn session() -> ReceiverSession {
    ReceiverSession::new(
        PcmProfile::default(),
        8,
        "live",
        vec![PanelSubscription {
            subscription_id: "sub-scripted".to_string(),
            panel_id: "panel-scripted".to_string(),
            channel_ids: vec![8001],
            schema: PanelDataSchema::TimeseriesV1,
        }],
    )
}

#[test]
fn receiver_tick_from_source_decodes_scripted_datagrams_without_udp() {
    let profile = PcmProfile::default();
    let datagram = bits_to_bytes(&frame_to_bits(&create_test_frame(41, false, &profile), 2, &profile));
    let mut source = ScriptedDatagramSource { items: vec![Ok(datagram)] };
    let mut session = session();

    let tick = session
        .tick_from_source(&mut source, 4096, Duration::from_millis(1))
        .unwrap();

    assert_eq!(tick.ingest_report.accepted_frames, 1);
    assert_eq!(session.next_seq, 2);
    assert!(matches!(tick.panel_batch.events[0], BridgeEvent::PanelStreamData(_)));
}

#[test]
fn receiver_tick_from_source_counts_timeouts() {
    let mut source = ScriptedDatagramSource {
        items: vec![Err("timed out".to_string())],
    };
    let mut session = session();

    let result = session.tick_from_source(&mut source, 4096, Duration::from_millis(1));

    assert!(result.is_err());
    assert_eq!(session.timeout_count, 1);
    assert_eq!(session.next_seq, 1);
}
