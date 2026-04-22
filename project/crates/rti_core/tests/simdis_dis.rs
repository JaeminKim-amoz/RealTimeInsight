use rti_core::simdis::{
    decode_entity_state_pdu, encode_entity_state_pdu, DisError, EntityId, EntityState,
    ENTITY_STATE_PDU_LENGTH,
};

fn sample_entity() -> EntityState {
    EntityState {
        exercise_id: 7,
        entity_id: EntityId {
            site: 1,
            application: 42,
            entity: 900,
        },
        force_id: 1,
        timestamp: 123_456,
        location: [127.123, 36.456, 3500.0],
        velocity: [210.0, -3.5, 0.25],
        orientation: [0.1, 0.2, 0.3],
    }
}

#[test]
fn encodes_and_decodes_entity_state_pdu() {
    let original = sample_entity();
    let bytes = encode_entity_state_pdu(&original);

    assert_eq!(bytes.len(), ENTITY_STATE_PDU_LENGTH);
    assert_eq!(bytes[2], 1);

    let decoded = decode_entity_state_pdu(&bytes).expect("entity state pdu decodes");
    assert_eq!(decoded.exercise_id, original.exercise_id);
    assert_eq!(decoded.entity_id, original.entity_id);
    assert_eq!(decoded.force_id, original.force_id);
    assert_eq!(decoded.timestamp, original.timestamp);
    assert_eq!(decoded.location, original.location);
    assert_eq!(decoded.velocity, original.velocity);
    assert_eq!(decoded.orientation, original.orientation);
}

#[test]
fn rejects_wrong_pdu_type() {
    let mut bytes = encode_entity_state_pdu(&sample_entity());
    bytes[2] = 99;

    assert_eq!(decode_entity_state_pdu(&bytes), Err(DisError::UnsupportedPduType(99)));
}

#[test]
fn rejects_truncated_entity_state_pdu() {
    let bytes = encode_entity_state_pdu(&sample_entity());

    assert_eq!(
        decode_entity_state_pdu(&bytes[..40]),
        Err(DisError::InvalidLength {
            expected: ENTITY_STATE_PDU_LENGTH,
            actual: 40,
        })
    );
}
