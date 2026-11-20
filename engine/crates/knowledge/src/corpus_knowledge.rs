//! Fold-facing queries over the committed corpus and runtime overlay.
use super::*;

impl Knowledge for Corpus {
    fn item_names(&self) -> Vec<String> {
        items::item_names(self.items())
    }

    /// The committed DB, then the overlay, then a miss. Local sources are merged into whichever
    /// answers, because they say something about the item's USES that no item page states.
    fn item(&self, name: &str) -> Answer {
        let display = display_of(name);
        let local = self.local_quests().for_item(name);
        let key = item_key(name);
        // Primary: the committed database. Answered here, an item costs no overlay read and no
        // announcement, so a miss describes only names the corpus lacks.
        if let Some(entry) = self.items().get(&key) {
            let mut record = merge_local(knowledge_from_db(entry, &display), &local);
            // `cached: true` because this is knowledge we already had, not a fresh lookup.
            record["cached"] = json!(true);
            return Answer {
                record,
                found: true,
            };
        }
        if let Some(entry) = self.overlay_entry("item", &key) {
            let found = overlay_found(&entry);
            let mut record = merge_local(knowledge_from_db(&entry, &display), &local);
            record["cached"] = json!(true);
            return Answer { record, found };
        }
        // Asked with the DISPLAY name: that is what the app's fetch will search the wiki for, and a
        // folded key is not a name.
        self.note_miss("item", &display);
        Answer {
            record: items::unanswered(&display, &local),
            found: false,
        }
    }

    fn identity_keys(&self, mob: &str) -> Vec<String> {
        self.mob_index().identity(mob.trim()).keys
    }

    /// The catalog, then the overlay, then a miss; the local half merged on top of whichever
    /// answered, and the era evidence attached at the one confluence all exits pass through.
    fn mob(&self, name: &str, loot: &dyn OwnLoot) -> Answer {
        let display = name.trim();
        let id = self.mob_index().identity(display);
        // What the catalog and the overlay are asked. Identical to `display` for every mob the
        // roster does not spell two ways, which is nearly all of them.
        let ask = id.canonical.clone();
        let (base, found) = if let Some(entry) = self.mob_index().entry(&ask) {
            (knowledge_from_catalog(display, entry), true)
        } else if let Some(entry) = self.overlay_entry("mob", &mob_key(&ask)) {
            let found = overlay_found(&entry);
            let mut record = entry;
            record["name"] = json!(display);
            record["cached"] = json!(true);
            (record, found)
        } else {
            // Asked with the CANONICAL name: the roster's spelling is the one the wiki and the
            // catalog use.
            self.note_miss("mob", &ask);
            (mobs::unanswered(display), false)
        };
        let merged = merge_local_knowledge(base, &id, self.mob_quests(), loot);
        Answer {
            record: annotate_drop_eras(merged, self.items()),
            found,
        }
    }

    /// The committed catalog, and NOTHING ELSE: no overlay read, no alias resolution, and — the
    /// load-bearing half — no miss. See [`Knowledge::known_mob`].
    fn known_mob(&self, name: &str) -> bool {
        self.mob_index().entry(name.trim()).is_some()
    }

    fn take_misses(&self) -> Vec<Miss> {
        self.pending
            .lock()
            .map(|mut pending| std::mem::take(&mut *pending))
            .unwrap_or_default()
    }
}
