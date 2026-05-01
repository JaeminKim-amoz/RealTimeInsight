use rti_core::simdis::{
    sidecar_health_from_heartbeat, validate_entity_state, DisError, DisValidationProfile, EntityId,
    EntityIdRange, EntityState, PduRateLimiter, SimdisSidecarHealth,
};

fn state(entity_id: EntityId) -> EntityState {
    EntityState {
        exercise_id: 1,
        entity_id,
        force_id: 1,
        timestamp: 1,
        location: [0.0, 0.0, 0.0],
        velocity: [0.0, 0.0, 0.0],
        orientation: [0.0, 0.0, 0.0],
    }
}

#[test]
fn rejects_zero_or_out_of_range_entity_ids() {
    let profile = DisValidationProfile {
        allowed_entity_range: Some(EntityIdRange {
            min_site: 1,
            max_site: 4,
            min_application: 1,
            max_application: 50,
            min_entity: 1,
            max_entity: 999,
        }),
        max_pdus_per_second: 20,
    };

    assert_eq!(
        validate_entity_state(&state(EntityId { site: 0, application: 1, entity: 1 }), &profile),
        Err(DisError::InvalidEntityId)
    );
    assert_eq!(
        validate_entity_state(&state(EntityId { site: 9, application: 1, entity: 1 }), &profile),
        Err(DisError::EntityIdNotAllowed(EntityId { site: 9, application: 1, entity: 1 }))
    );
    assert!(validate_entity_state(&state(EntityId { site: 1, application: 42, entity: 900 }), &profile).is_ok());
}

#[test]
fn rate_limiter_rejects_pdus_over_configured_limit() {
    let mut limiter = PduRateLimiter::new(2);

    assert!(limiter.admit(1_000).is_ok());
    assert!(limiter.admit(1_100).is_ok());
    assert_eq!(limiter.admit(1_200), Err(DisError::RateLimited));
    assert!(limiter.admit(2_000).is_ok());
}

#[test]
fn sidecar_timeout_maps_to_degraded_health() {
    assert_eq!(
        sidecar_health_from_heartbeat(10_000, Some(9_500), 1_000),
        SimdisSidecarHealth::Connected
    );
    assert_eq!(
        sidecar_health_from_heartbeat(10_000, Some(8_000), 1_000),
        SimdisSidecarHealth::Degraded("heartbeat timeout".to_string())
    );
    assert_eq!(
        sidecar_health_from_heartbeat(10_000, None, 1_000),
        SimdisSidecarHealth::Degraded("sidecar missing".to_string())
    );
}
