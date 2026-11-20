use super::tests::{line, Names};
use super::{wire, BazaarModule, BazaarRow, Dir, Quote, LIVE_MODULE_ID};
use crate::knowledge::Knowledge;
use crate::{EqModule, Registry};
use std::sync::Arc;

#[test]
fn history_keeps_newest_complete_rows_under_its_budget_and_full_checkpoint() {
    let mut module = BazaarModule::new();
    for i in 0..1600 {
        let day = if i == 1599 {
            "2026-09-24"
        } else {
            "2026-09-23"
        }
        .to_string();
        let item = format!("Item {i:04}");
        let quotes = (0..20)
            .map(|j| Quote {
                at: "12:00:00".into(),
                who: format!("Seller {j}"),
                price: Some(500.0),
                // Non-ASCII and escaped characters deliberately cost extra wire bytes.
                msg: format!("{item} {}", "氷\\\"".repeat(50)),
            })
            .collect();
        module.rows.insert(
            (day.clone(), Dir::Sell, item.clone(), 0),
            BazaarRow {
                day,
                item,
                dir: Dir::Sell.as_str(),
                quotes,
                ..BazaarRow::default()
            },
        );
    }
    let snap = module.snapshot();
    assert!(serde_json::to_vec(&snap).unwrap().len() <= wire::HISTORY_BUDGET + 512);
    let rows = snap["state"]["rows"].as_array().unwrap();
    assert_eq!(rows.last().unwrap()["day"], "2026-09-24");
    assert!(rows
        .windows(2)
        .all(|pair| pair[0]["item"].as_str() < pair[1]["item"].as_str()));
    assert!(rows.len() < module.rows.len());
    assert_eq!(snap["state"]["omittedRows"], module.rows.len() - rows.len());
    let mut restored = BazaarModule::new();
    assert!(restored.restore(&module.checkpoint().unwrap()));
    assert_eq!(restored.rows.len(), 1600);
    assert_eq!(restored.snapshot(), snap);
}

#[test]
fn live_alias_serves_only_live_offers_with_a_seven_day_median() {
    let mut registry = Registry::new();
    registry.register(Box::new(BazaarModule::new()));
    let knowledge: Arc<dyn Knowledge> = Arc::new(Names);
    registry.install_knowledge(&knowledge);
    let historical = [
        "[Thu Sep 24 12:00:00 2026] Leric tells General:1, 'WTS Fleeting Quiver 90k'",
        "[Fri Sep 25 12:00:00 2026] Leric tells General:1, 'WTS Fleeting Quiver 20k'",
        "[Sat Sep 26 12:00:00 2026] Leric tells General:1, 'WTB Fleeting Quiver 100k'",
        "[Sun Sep 27 12:00:00 2026] Leric tells General:1, 'WTS Fleeting Quiver +4 90k'",
    ];
    for (i, raw) in historical.iter().enumerate() {
        registry.dispatch(&line(i as i64 + 1, raw), false, &mut Vec::new());
    }
    assert_eq!(registry.ids(), ["bazaar"]);
    assert!(registry.published_seqs().contains(&(LIVE_MODULE_ID, 0)));
    registry.dispatch(
        &line(
            5,
            "[Thu Oct 1 12:00:00 2026] Aaron tells General:1, 'WTS Fleeting Quiver 18k'",
        ),
        true,
        &mut Vec::new(),
    );
    let snapshot = registry.snapshot_of(LIVE_MODULE_ID).unwrap();
    let history = registry.snapshot_of("bazaar").unwrap();
    assert!(snapshot["state"].get("rows").is_none());
    assert!(history["state"].get("live").is_none());
    let offers = snapshot["state"]["live"].as_array().unwrap();
    assert_eq!(offers.len(), 1);
    assert_eq!(offers[0]["askingMedian"], 19_000.0);
    let cursor = snapshot["seq"].as_i64().unwrap();
    assert!(registry
        .published_seqs()
        .contains(&(LIVE_MODULE_ID, cursor)));
}

#[test]
fn oversized_prices_do_not_enter_the_ledger() {
    let mut module = BazaarModule::new();
    let knowledge: Arc<dyn Knowledge> = Arc::new(Names);
    module.install_knowledge(&knowledge);
    let raw = format!(
        "[Thu Oct 1 12:00:00 2026] Aaron tells General:1, 'WTS Fleeting Quiver {}pp'",
        "9".repeat(305)
    );
    module.on_event(&line(1, &raw), false);
    let snap = module.snapshot();
    assert_eq!(
        snap["state"]["rows"][0]["prices"].as_array().unwrap().len(),
        0
    );
    let mut restored = BazaarModule::new();
    assert!(restored.restore(&module.checkpoint().unwrap()));
    assert_eq!(restored.snapshot(), snap);
}
