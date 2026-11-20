//! Bounded history and the live watch projection of the Bazaar ledger.

use super::{BazaarModule, Dir, Offer};
use eqlog::{Clock, Tz};
use serde::Serialize;
use serde_json::{json, Value};
use std::io::{self, Write};

pub(super) const HISTORY_BUDGET: usize = 4 * 1024 * 1024;
const LIVE_BUDGET: usize = 256 * 1024;
const DAY_MS: i64 = 86_400_000;

/// Count the exact compact JSON row bytes without allocating another row-sized buffer.
struct RowBudget(usize);

impl Write for RowBudget {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0 = self
            .0
            .checked_sub(bytes.len())
            .ok_or(io::ErrorKind::WriteZero)?;
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Read newest first and keep complete rows. The older fold and checkpoint state are untouched.
fn newest_within<'a, T: Serialize + 'a>(
    source: impl Iterator<Item = &'a T>,
    mut remaining: usize,
) -> Vec<&'a T> {
    let mut rows = Vec::new();
    for row in source {
        // Reserve punctuation for the array. The reply and transport envelope have headroom.
        let mut budget = RowBudget(remaining.saturating_sub(1));
        if serde_json::to_writer(&mut budget, row).is_err() {
            // One outsize newest row should not prevent every smaller older row from loading.
            if rows.is_empty() {
                continue;
            }
            break;
        }
        remaining = budget.0;
        rows.push(row);
    }
    rows.reverse();
    rows
}

pub(super) fn history(module: &BazaarModule) -> Value {
    let rows = newest_within(module.rows.values().rev(), HISTORY_BUDGET);
    let omitted_rows = module.rows.len() - rows.len();
    let mut state = json!({ "rows": rows });
    if omitted_rows > 0 {
        state["omittedRows"] = json!(omitted_rows);
    }
    json!({ "seq": module.seq, "state": state })
}

pub(super) fn live(module: &BazaarModule) -> Value {
    let live = newest_within(module.live.iter().rev(), LIVE_BUDGET);
    json!({ "seq": module.live_announce.cursor(), "state": { "live": live } })
}

/// The seven calendar days ending at the offer, using the log's own wall-clock date.
fn recent_days(raw: &str) -> impl Iterator<Item = String> + '_ {
    let clock = Clock::new(Tz::UTC);
    let stamp = raw.strip_prefix('[').and_then(|s| s.split_once(']'));
    let end = stamp.map_or(0, |(stamp, _)| clock.parse_eq_timestamp(stamp));
    (0..7).filter_map(move |offset| {
        let day = clock.civil(end.checked_sub(offset * DAY_MS)?)?;
        Some(format!("{:04}-{:02}-{:02}", day.year, day.month, day.day))
    })
}

pub(super) fn asking_median(module: &BazaarModule, raw: &str, offer: &Offer) -> Option<f64> {
    if offer.dir != Dir::Sell {
        return None;
    }
    let mut prices: Vec<f64> = recent_days(raw)
        .filter_map(|day| {
            module
                .rows
                .get(&(day, Dir::Sell, offer.item.clone(), offer.tier))
        })
        .flat_map(|row| row.prices.iter().copied())
        .collect();
    if prices.is_empty() {
        return None;
    }
    let middle = prices.len() / 2;
    let even = prices.len() % 2 == 0;
    let (lower, median, _) = prices.select_nth_unstable_by(middle, f64::total_cmp);
    if even {
        let previous = lower.iter().copied().max_by(f64::total_cmp)?;
        Some(previous / 2.0 + *median / 2.0)
    } else {
        Some(*median)
    }
}
