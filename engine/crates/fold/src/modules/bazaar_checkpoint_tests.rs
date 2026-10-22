//! Oracle retains whole-fold warm starts. Bazaar must resume its rows, day-scoped dedupe,
//! live watch queue and announce cursor without serializing the installed knowledge input.

use super::tests::{line, Names};
use super::{BazaarModule, ItemIndex};
use crate::event::Event;
use crate::knowledge::Knowledge;
use crate::EqModule;
use serde_json::{json, Value};
use std::sync::Arc;

fn ready() -> BazaarModule {
    let mut module = BazaarModule::new();
    let knowledge: Arc<dyn Knowledge> = Arc::new(Names);
    module.install_knowledge(&knowledge);
    module
}

// Existing donor examples, including the repeated offer, guess and next-day boundary. These
// are inputs to the checkpoint contract, not a new player-log fixture or parser vocabulary.
const LINES: &[(&str, bool)] = &[
    (
        "[Wed Sep 23 17:54:48 2026] Leric tells General:1, 'WTS Fleeting Quiver 20k'",
        false,
    ),
    (
        "[Wed Sep 23 18:04:48 2026] Leric tells General:1, 'WTS Fleeting Quiver 20k'",
        false,
    ),
    (
        "[Wed Sep 23 18:10:00 2026] Aaron tells General:1, 'WTS Fleeting Quiver 18k'",
        true,
    ),
    (
        "[Wed Sep 23 18:11:00 2026] Bbqz tells General:1, 'WTB Fleeting Quiver'",
        true,
    ),
    (
        "[Wed Sep 23 18:12:00 2026] Leric tells General:1, 'WTT Fleeting Quiver'",
        true,
    ),
    (
        "[Wed Sep 23 18:13:00 2026] Leric tells General:1, 'WTB Fleeting Quiver 40'",
        true,
    ),
    (
        "[Wed Sep 23 18:14:00 2026] Leric tells General:1, 'WTB Fleeting Quiver 40'",
        true,
    ),
    (
        "[Wed Sep 23 18:15:00 2026] Aaron tells General:1, 'WTS Fleeting Quiver +4 3k'",
        true,
    ),
    (
        "[Thu Sep 24 09:00:00 2026] Leric tells General:1, 'WTS Fleeting Quiver 20k'",
        true,
    ),
];

fn feed(module: &mut BazaarModule, start: usize, end: usize) {
    for (index, &(raw, live)) in LINES.iter().enumerate().take(end).skip(start) {
        module.on_event(&line(index as i64 + 1, raw), live);
    }
}

#[test]
fn every_offer_cut_resumes_to_the_same_rows_live_queue_dedupe_and_cursors() {
    let mut whole = ready();
    feed(&mut whole, 0, LINES.len());
    for cut in 0..=LINES.len() {
        let mut prefix = ready();
        feed(&mut prefix, 0, cut);
        let bytes = prefix.checkpoint().expect("bazaar can checkpoint");
        let mut restored = ready();
        assert!(restored.restore(&bytes), "cut {cut}");
        assert_eq!(restored.snapshot(), prefix.snapshot(), "cut {cut}");
        assert_eq!(
            restored.published_seq(),
            prefix.published_seq(),
            "cut {cut}"
        );
        feed(&mut restored, cut, LINES.len());
        assert_eq!(restored.snapshot(), whole.snapshot(), "cut {cut}");
        assert_eq!(restored.published_seq(), whole.published_seq(), "cut {cut}");
        assert_eq!(restored.checkpoint(), whole.checkpoint(), "cut {cut}");
    }
}

#[test]
fn repeated_live_offer_after_restore_neither_recounts_nor_realerts() {
    let mut source = ready();
    feed(&mut source, 0, 4);
    let mut restored = ready();
    assert!(restored.restore(&source.checkpoint().unwrap()));
    let rows = restored.snapshot()["state"]["rows"].clone();
    let live = restored.snapshot()["state"]["live"].clone();
    let announced = restored.published_seq();
    restored.on_event(&line(99, LINES[2].0), true);
    assert_eq!(restored.snapshot()["seq"], 99);
    assert_eq!(restored.snapshot()["state"]["rows"], rows);
    assert_eq!(restored.snapshot()["state"]["live"], live);
    assert_eq!(restored.published_seq(), announced);
    restored.on_event(
        &line(
            100,
            "[Wed Sep 23 18:20:00 2026] Aaron tells General:1, 'WTS Fleeting Quiver 19k'",
        ),
        true,
    );
    assert_eq!(restored.snapshot()["state"]["live"][2]["seq"], 100);
    assert!(restored.published_seq().unwrap() > 100);
}

#[test]
fn restore_keeps_the_receivers_installed_item_index() {
    let mut source = ready();
    feed(&mut source, 0, 1);
    let bytes = source.checkpoint().unwrap();
    let checkpoint: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(checkpoint[1].get("index").is_none());
    let mut restored = BazaarModule::new();
    restored.index = Some(ItemIndex::new(["Oracle Item".to_owned()]));
    assert!(restored.restore(&bytes));
    restored.on_event(
        &line(
            2,
            "[Wed Sep 23 18:00:00 2026] Aaron tells General:1, 'WTS Oracle Item 1k'",
        ),
        true,
    );
    assert!(restored.rows.values().any(|row| row.item == "Oracle Item"));
    // Knowledge can also be installed after restore, just as on a cold attachment.
    let mut no_index = BazaarModule::new();
    assert!(no_index.restore(&bytes));
    assert!(no_index.index.is_none());
    let knowledge: Arc<dyn Knowledge> = Arc::new(Names);
    no_index.install_knowledge(&knowledge);
    feed(&mut no_index, 2, 3);
    assert_eq!(no_index.snapshot()["state"]["rows"][0]["n"], 2);
}

#[test]
fn invalid_and_future_checkpoints_are_refused_without_mutating_the_receiver() {
    let mut module = ready();
    feed(&mut module, 0, 4);
    let before = module.snapshot();
    let announced = module.published_seq();
    let bytes = module.checkpoint().unwrap();
    let valid: Value = serde_json::from_slice(&bytes).unwrap();
    let mut future = valid.clone();
    future[0] = json!(2);
    let mut unknown_direction = valid.clone();
    unknown_direction[1]["rows"][0]["dir"] = json!("unexpected");
    let mut unknown_seen_direction = valid.clone();
    unknown_seen_direction[1]["seen"][0][1] = json!("unexpected");
    let mut duplicate_row = valid.clone();
    let row = duplicate_row[1]["rows"][0].clone();
    duplicate_row[1]["rows"].as_array_mut().unwrap().push(row);
    let mut missing = valid;
    missing[1].as_object_mut().unwrap().remove("seen_day");
    let mut invalid = vec![Vec::new(), b"truncated {".to_vec(), b"null".to_vec()];
    invalid.extend(
        [
            future,
            unknown_direction,
            unknown_seen_direction,
            duplicate_row,
            missing,
        ]
        .iter()
        .map(|value| serde_json::to_vec(value).unwrap()),
    );
    for bad in invalid {
        assert!(!module.restore(&bad));
        assert_eq!(module.snapshot(), before);
        assert_eq!(module.published_seq(), announced);
        assert!(module.index.is_some());
    }
}

#[test]
fn epoch_and_reset_clear_restored_state_but_preserve_knowledge() {
    let mut source = ready();
    feed(&mut source, 0, 4);
    let mut restored = ready();
    assert!(restored.restore(&source.checkpoint().unwrap()));
    let epoch = Event::from_json(&json!({"kind": "epoch", "seq": 50, "ts": 0}).to_string())
        .expect("epoch event");
    restored.on_event(&epoch, true);
    assert_eq!(
        restored.snapshot(),
        json!({"seq": 50, "state": {"rows": [], "live": []}})
    );
    assert!(restored.seen.is_empty());
    assert!(restored.seen_day.is_empty());
    assert_eq!(restored.published_seq(), Some(51));
    restored.on_event(&line(51, LINES[0].0), true);
    assert_eq!(restored.snapshot()["state"]["rows"][0]["n"], 1);
    assert_eq!(restored.snapshot()["state"]["live"][0]["seq"], 51);
    restored.reset();
    assert_eq!(
        restored.snapshot(),
        json!({"seq": 0, "state": {"rows": [], "live": []}})
    );
    assert_eq!(restored.published_seq(), Some(0));
    assert!(restored.index.is_some());
    restored.on_event(&line(1, LINES[0].0), true);
    assert_eq!(restored.snapshot()["state"]["rows"][0]["n"], 1);
}

#[test]
fn restored_live_queue_keeps_its_bound_when_new_offers_arrive() {
    let mut whole = ready();
    let mut restored = ready();
    for index in 0..105 {
        let raw = format!(
            "[Wed Sep 23 18:00:00 2026] Seller{}{} tells General:1, 'WTS Fleeting Quiver 20k'",
            (b'a' + index / 26) as char,
            (b'a' + index % 26) as char,
        );
        let event = line(i64::from(index) + 1, &raw);
        whole.on_event(&event, true);
        if index == 99 {
            assert!(restored.restore(&whole.checkpoint().unwrap()));
        } else if index > 99 {
            restored.on_event(&event, true);
        }
    }
    assert_eq!(restored.snapshot(), whole.snapshot());
    assert_eq!(restored.live.len(), 100);
    assert_eq!(restored.live.front().unwrap().seq, 6);
    assert_eq!(restored.live.back().unwrap().seq, 105);
    assert_eq!(restored.published_seq(), whole.published_seq());
}
