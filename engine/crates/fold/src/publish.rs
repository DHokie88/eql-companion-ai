//! Cursor and snapshot lookup for the module registry.
//!
//! These reads sit beside the fold so the registry file can keep its size budget. A module may
//! publish one extra lightweight cursor, which is how Bazaar watch alerts avoid the full history.

use serde_json::Value;

use super::Registry;

impl Registry {
    /// Every registered module's published cursor, in delivery order. See
    /// [`EqModule::published_seq`] for why it is not `snapshot()["seq"]`.
    ///
    /// A module answering `None` is absent from this list rather than present with a zero: the
    /// serve loop announces a change, and a module that states no cursor has said nothing that
    /// could have changed. An alias cursor is announced beside its module.
    pub fn published_seqs(&self) -> Vec<(&'static str, i64)> {
        self.mods
            .iter()
            .flat_map(|m| {
                m.published_seq()
                    .map(|seq| (m.id(), seq))
                    .into_iter()
                    .chain(m.alias_cursor())
            })
            .collect()
    }

    /// One module's published snapshot, by the id it answers to — `{ "seq": …, "state": … }`, the
    /// pair the goldens join on.
    ///
    /// `None` for a name nothing registered, and that is the answer rather than an absence to paper
    /// over: an empty state would be a lie about a module that does not exist. A `WIRING_ORDER`
    /// name this build did not register answers `None` too. A module may also answer an alias id.
    ///
    /// A linear scan over at most twenty entries, made once per request rather than once per event.
    pub fn snapshot_of(&self, id: &str) -> Option<Value> {
        self.mods.iter().find_map(|m| {
            if m.id() == id {
                Some(m.snapshot())
            } else {
                m.alias_snapshot(id)
            }
        })
    }
}
