use super::tests::{generation, land, mark, world};
use super::*;

/// A synthetic install/profile; never reads a player's client or log.
fn captured_reference() -> (PathBuf, PathBuf, PathBuf, PathBuf) {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let dir = std::env::temp_dir().join(format!(
        "oracle-activation-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::SeqCst)
    ));
    let install = dir.join("game");
    let profile = dir.join("profile");
    let captured = profile.join("spells/materialized/captured-generation");
    std::fs::create_dir_all(install.join("Logs")).unwrap();
    std::fs::create_dir_all(&captured).unwrap();
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("../../../../tests/fixtures/spell-parity.json")).unwrap();
    std::fs::write(
        captured.join("spells_us.txt"),
        fixture[1]["row"].as_str().unwrap(),
    )
    .unwrap();
    std::fs::write(
        captured.join("dbstr_us.txt"),
        "114^5^Synthetic Taps
43^5^Synthetic Health
",
    )
    .unwrap();
    (dir, install, profile, captured)
}

#[test]
fn captured_reference_swaps_without_changing_live_world_state() {
    let (dir, install, profile, captured) = captured_reference();
    let world = world();
    world.attach(
        install.join("Logs/eqlog_Test_server.txt").to_str().unwrap(),
        profile.to_str(),
        eqlog::ZoneHint::default(),
    );
    let token = generation(&world);
    land(&world, token, mark(47, 100.0));
    let (writes, _) = channel();
    let (asks, _) = channel();
    {
        let mut state = world.lock();
        state.write_to = Some(writes);
        state.asks = Some(asks);
    }
    let before = world.mark();
    let epoch = *world.health().epoch;
    let previous = world.client_spells().unwrap();
    assert!(world
        .activate_client_spells(
            install.to_str().unwrap(),
            "snapshot-a",
            captured.join("spells_us.txt").to_str().unwrap(),
            captured.join("dbstr_us.txt").to_str().unwrap()
        )
        .unwrap());
    let active = world.client_spells().unwrap();
    assert_eq!(active.snapshot_id(), Some("snapshot-a"));
    assert!(active.spell("Oracle Synthetic Ember II").is_some());
    assert_eq!(
        active.category_names().get(&114).map(String::as_str),
        Some("Synthetic Taps")
    );
    assert!(previous.snapshot_id().is_none());
    assert_eq!(*world.health().epoch, epoch);
    assert_eq!(generation(&world), token);
    assert_eq!(world.mark(), before);
    let state = world.lock();
    assert!(state.write_to.is_some());
    assert!(state.asks.is_some());
    drop(state);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rejected_capture_preserves_the_previous_reference() {
    let (dir, install, profile, captured) = captured_reference();
    let world = world();
    let activate = |root: &Path, path: &Path| {
        world.activate_client_spells(
            root.to_str().unwrap(),
            "snapshot",
            path.join("spells_us.txt").to_str().unwrap(),
            path.join("dbstr_us.txt").to_str().unwrap(),
        )
    };
    assert!(
        activate(&install, &captured).is_err(),
        "activation requires attach"
    );
    world.attach(
        install.join("Logs/eqlog_Test_server.txt").to_str().unwrap(),
        profile.to_str(),
        eqlog::ZoneHint::default(),
    );
    let previous = world.client_spells().unwrap();
    assert!(activate(&profile, &captured).is_err(), "wrong install");
    std::fs::write(install.join("spells_us.txt"), "outside profile").unwrap();
    std::fs::write(install.join("dbstr_us.txt"), "outside profile").unwrap();
    assert!(activate(&install, &install).is_err(), "outside profile");
    std::fs::write(captured.join("spells_us.txt"), "malformed").unwrap();
    assert!(activate(&install, &captured).is_err(), "malformed file");
    assert!(Arc::ptr_eq(&previous, &world.client_spells().unwrap()));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn superseded_capture_and_reattach_cannot_publish_an_old_handle() {
    let (dir, install, profile, captured) = captured_reference();
    let world = world();
    let log = install.join("Logs/eqlog_Test_server.txt");
    world.attach(
        log.to_str().unwrap(),
        profile.to_str(),
        eqlog::ZoneHint::default(),
    );
    let replacement = Arc::new(
        crate::spells::ClientSpells::captured(
            captured.join("spells_us.txt"),
            captured.join("dbstr_us.txt"),
            "old".into(),
        )
        .unwrap(),
    );
    let (epoch, ticket) = {
        let state = world.lock();
        (state.epoch, state.client_spells_activation)
    };
    world.lock().client_spells_activation += 1;
    assert!(!world.publish_client_spells(epoch, ticket, replacement.clone()));
    let ticket = world.lock().client_spells_activation;
    world.attach(
        log.to_str().unwrap(),
        profile.to_str(),
        eqlog::ZoneHint::default(),
    );
    assert!(!world.publish_client_spells(epoch, ticket, replacement));
    assert!(world.client_spells().unwrap().snapshot_id().is_none());
    std::fs::remove_dir_all(dir).unwrap();
}
