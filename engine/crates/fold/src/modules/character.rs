//! `src/main/modules/character.ts` — the active CharacterRef, the current zone and the current
//! level, on one transport.
//!
//! The ref is pushed in, not folded: a construction input (`ClusterDeps::character`) derived from
//! the log's filename, so it states a fact about the RUN rather than about the log's contents.
//! `reset()` keeps it; everything log-derived clears.
//!
//! The level is the latest statement with `/who` breaking a tie, and it never enters the ding
//! series — a `/who` row is not a level-up, and the chart, the per-level history and the projection
//! are all anchored on that series.
//!
//! `seq` is this module's own revision, monotonic and never reset: state here moves without a log
//! event (`set_character`), and `useModule` dedupes with `d.seq <= knownSeq`.

use crate::event::Event;
use crate::EqModule;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// `shared/currentLevel.ts LevelStatement`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelStatement {
    level: i64,
    /// LOG timestamp of the line that stated it (not a wall clock).
    ts: i64,
    #[serde(deserialize_with = "crate::checkpoint::interned")]
    source: crate::checkpoint::Static,
}

/// `laterStatement` — latest wins, `/who` breaks a tie. Total, so the winner is decided by the rule
/// rather than by arrival order.
fn next_wins(held: &LevelStatement, next: &LevelStatement) -> bool {
    if next.ts > held.ts {
        return true;
    }
    if next.ts < held.ts {
        return false;
    }
    next.source == "who"
}

#[derive(Default, Serialize, Deserialize)]
pub struct CharacterModule {
    /// The `CharacterRef` as JSON, or `None` for the null the snapshot publishes.
    character: Option<Value>,
    zone: Option<String>,
    level: Option<LevelStatement>,
    /// Latest `/who`, kept when a later ding replaces `level`. Absent from older checkpoints.
    #[serde(default, rename = "lastWho")]
    last_who: Option<LevelStatement>,
    /// The module's own revision, monotonic for the life of the process. See the header.
    rev: i64,
    /// The ref waiting for the first reset. The double option is the point: the outer is "has
    /// `set_character` been called yet", the inner is the ref it was called with — and the call
    /// itself moves the revision, so a `None` ref and no call at all publish different seqs.
    pending: Option<Option<Value>>,
}

impl CharacterModule {
    pub fn new(character: Option<Value>) -> Self {
        CharacterModule {
            character: None,
            zone: None,
            level: None,
            last_who: None,
            rev: 0,
            pending: Some(character),
        }
    }

    /// `setCharacter` — called by index.ts when the tailed character changes.
    pub fn set_character(&mut self, character: Option<Value>) {
        self.character = character;
        self.rev += 1;
    }

    /// Fold one statement in. A row restating a level you already dinged to still moves the
    /// revision: the age of the statement is part of the fact, and the surfaces hedge on it.
    /// A `/who` is also stored on its own, so a later ding cannot erase it.
    fn state_level(&mut self, next: LevelStatement) {
        let who_changed = if next.source == "who" {
            let changed = self.last_who.as_ref().is_none_or(|held| held.level != next.level || held.ts != next.ts);
            if changed {
                self.last_who = Some(next.clone());
            }
            changed
        } else {
            false
        };
        let level_changes = self.level.as_ref().is_none_or(|held| next_wins(held, &next));
        if level_changes {
            self.level = Some(next);
        }
        if level_changes || who_changed {
            self.rev += 1;
        }
    }
}

impl EqModule for CharacterModule {
    fn checkpoint(&self) -> Option<Vec<u8>> {
        serde_json::to_vec(self).ok()
    }

    fn restore(&mut self, bytes: &[u8]) -> bool {
        let Some(fresh) = crate::checkpoint::parse::<Self>(bytes) else {
            return false;
        };
        *self = fresh;
        true
    }

    fn id(&self) -> &'static str {
        "character"
    }

    fn reset(&mut self) {
        // The ref survives; see the header.
        self.zone = None;
        self.level = None;
        self.last_who = None;
        self.rev += 1;
        // The construction ref lands here, once: `rev` IS the published `seq`, so the ORDER of the
        // two bumps is observable, and the composition root spends them as reset-then-setCharacter.
        // A cluster built before `Fold::new` resets it would spend them the other way round.
        if let Some(character) = self.pending.take() {
            self.set_character(character);
        }
    }

    fn on_event(&mut self, ev: &Event, _live: bool) {
        match ev.kind() {
            "epoch" => {
                // Character rebirth: the wiped character's level and zone say nothing about this
                // one. The ref is pushed in and stays.
                self.zone = None;
                self.level = None;
                self.last_who = None;
                self.rev += 1;
            }
            "zone" => {
                let zone = ev.str("zone").map(str::to_string);
                if zone != self.zone {
                    self.zone = zone;
                    self.rev += 1;
                }
            }
            "level" => self.state_level(LevelStatement {
                level: ev.int("level").unwrap_or(0),
                ts: ev.ts(),
                source: "ding",
            }),
            "selfWho" => self.state_level(LevelStatement {
                level: ev.int("level").unwrap_or(0),
                ts: ev.ts(),
                source: "who",
            }),
            _ => {}
        }
    }

    /// The same cursor `snapshot` publishes, without building the state to read it.
    fn published_seq(&self) -> Option<i64> {
        Some(self.rev)
    }

    fn snapshot(&self) -> Value {
        // Three fields, two different absences: `character` publishes null (the TS field is
        // `CharacterRef | null`) while `zone`/`level` are `undefined` and `JSON.stringify` drops
        // them.
        let mut state = serde_json::Map::new();
        state.insert(
            "character".to_string(),
            self.character.clone().unwrap_or(Value::Null),
        );
        if let Some(zone) = &self.zone {
            state.insert("zone".to_string(), json!(zone));
        }
        if let Some(level) = &self.level {
            state.insert("level".to_string(), serde_json::to_value(level).expect("a"));
        }
        if let Some(who) = &self.last_who {
            state.insert("lastWho".to_string(), serde_json::to_value(who).expect("a"));
        }
        json!({ "seq": self.rev, "state": Value::Object(state) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::Event;
    use crate::EqModule;

    fn ev(line: &str) -> Event<'_> {
        Event::from_json(line).expect("event")
    }

    #[test]
    fn a_later_ding_keeps_the_last_who_and_epoch_reset_clear_it() {
        let mut module = CharacterModule::default();
        module.on_event(&ev(r#"{"kind":"selfWho","seq":1,"ts":1000,"raw":"w","level":11,"classes":["WIZ"]}"#), false);
        module.on_event(&ev(r#"{"kind":"level","seq":2,"ts":2000,"raw":"v","level":12}"#), false);
        let state = module.snapshot()["state"].clone();
        assert_eq!(state["level"], json!({ "level": 12, "ts": 2000, "source": "ding" }));
        assert_eq!(state["lastWho"], json!({ "level": 11, "ts": 1000, "source": "who" }));
        let bytes = module.checkpoint().expect("checkpoint");
        let mut restored = CharacterModule::default();
        assert!(restored.restore(&bytes));
        assert_eq!(restored.snapshot()["state"]["lastWho"], state["lastWho"]);
        let legacy = br#"{"character":null,"zone":null,"level":null,"rev":3,"pending":null}"#;
        assert!(restored.restore(legacy));
        assert!(restored.snapshot()["state"].get("lastWho").is_none());
        module.on_event(&ev(r#"{"kind":"epoch","seq":3,"ts":3000,"raw":"e"}"#), false);
        assert!(module.snapshot()["state"].get("level").is_none());
        assert!(module.snapshot()["state"].get("lastWho").is_none());
        module.on_event(&ev(r#"{"kind":"selfWho","seq":4,"ts":4000,"raw":"w","level":20,"classes":["WIZ"]}"#), false);
        module.reset();
        assert!(module.snapshot()["state"].get("lastWho").is_none());
        assert!(module.snapshot()["state"].get("level").is_none());
    }
}
