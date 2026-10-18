//! Immutable client references and installation lookup, separate from the live fold lifecycle.
use super::*;

impl World {
    /// The client's spell table for the install this world is attached to. `None` when nothing has
    /// been attached, which is the only state in which there is no install to speak of.
    ///
    /// It does not go through the ingest door, unlike every other reader on this type. The table is
    /// not fold state — the resist fold never reads it, which is what lets a ledger be replayed and
    /// re-estimated without one — so there is nothing to ask the ingest thread about, and reading a
    /// file on the thread that tails the log would be a stall for nothing.
    ///
    /// The handle leaves the lock and the parse happens outside it, which is why this returns an
    /// `Arc` rather than an answer: `ClientSpells::table` blocks its caller for a few hundred
    /// milliseconds on the first ask, and doing that under this mutex would stall every other
    /// connection and deadlock against the ingest's own `report_*` calls.
    #[must_use]
    pub fn client_spells(&self) -> Option<Arc<crate::spells::ClientSpells>> {
        self.lock().client_spells.clone()
    }

    /// Preload a captured spell reference without holding the world lock, then swap only its Arc.
    /// The profile boundary and current install are checked before reading; attach and concurrent
    /// activation guards are checked again at publication. No live ingest state is touched.
    pub fn activate_client_spells(
        &self,
        root: &str,
        snapshot_id: &str,
        spells_path: &str,
        dbstr_path: &str,
    ) -> Result<bool, String> {
        let canonical = |path: &Path| std::fs::canonicalize(path).map_err(|e| e.to_string());
        let root = canonical(Path::new(root))?;
        let (epoch, activation, profile) = {
            let mut state = self.lock();
            let attached = state
                .fold
                .log
                .as_ref()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .ok_or("no log is attached")?;
            if canonical(attached)? != root {
                return Err("captured spell install does not match the attached log".into());
            }
            let profile = state
                .client_spells_state_dir
                .clone()
                .ok_or("the attached session has no profile state directory")?;
            state.client_spells_activation += 1;
            (state.epoch, state.client_spells_activation, profile)
        };
        if snapshot_id.is_empty() || snapshot_id.len() > 256 {
            return Err("invalid captured spell snapshot identity".into());
        }
        let boundary = canonical(&profile.join("spells").join("materialized"))?;
        let spells = canonical(Path::new(spells_path))?;
        let dbstr = canonical(Path::new(dbstr_path))?;
        let generation = spells
            .parent()
            .ok_or("captured spell directory is missing")?;
        if generation.parent() != Some(boundary.as_path())
            || dbstr.parent() != Some(generation)
            || spells.file_name().and_then(|s| s.to_str()) != Some("spells_us.txt")
            || dbstr.file_name().and_then(|s| s.to_str()) != Some("dbstr_us.txt")
        {
            return Err("captured spell files must share a generation beneath the profile spells/materialized directory".into());
        }
        let replacement = Arc::new(crate::spells::ClientSpells::captured(
            spells,
            dbstr,
            snapshot_id.to_owned(),
        )?);
        Ok(self.publish_client_spells(epoch, activation, replacement))
    }

    pub(super) fn publish_client_spells(
        &self,
        epoch: i64,
        activation: u64,
        replacement: Arc<crate::spells::ClientSpells>,
    ) -> bool {
        let mut state = self.lock();
        if state.epoch != epoch || state.client_spells_activation != activation {
            return false;
        }
        state.client_spells = Some(replacement);
        true
    }

    /// Where the character logs live, as the app just said.
    ///
    /// An idempotent full-set replace of one value: the latest push is the whole of what the app
    /// has said, the same command law the five defines are under.
    ///
    /// Nothing is handed to a fold, which is the whole difference from [`World::define`]. A define
    /// changes what folding a log produces and therefore has to reach the running ingest and be
    /// re-applied at the next attach's construction; a directory changes nothing about any fold, so
    /// the write ends here — and this call therefore cannot block on the ingest thread.
    pub fn set_log_dir(&self, dir: &str) {
        self.lock().log_dir.set(dir);
    }

    /// The character logs in the directory the app named, or `Err` when it has named none.
    ///
    /// The scan happens with the lock released, as [`World::module_snapshot`]'s wait does: it is a
    /// readdir plus one stat per file, fast on a warm directory and unbounded on a disconnected
    /// network share, and this mutex is taken by the ingest thread in every `report_*` it makes.
    ///
    /// The path is copied out and echoed back by the caller, so the answer names the directory it
    /// is about — see `LogsListResult`, where that echo is the client's own staleness test.
    ///
    /// It needs no fold and no attach: a fresh install has characters to choose between before
    /// there is anything to attach to.
    pub fn list_logs(&self) -> Result<(String, crate::logs::LogScan), String> {
        let dir = self.lock().log_dir.get().map(std::path::Path::to_path_buf);
        let Some(dir) = dir else {
            return Err(
                "no log directory has been pushed, so there is nothing to enumerate; the app names \
                 it with logs.setDir"
                    .to_owned(),
            );
        };
        let scan = crate::logs::scan(&dir);
        Ok((dir.to_string_lossy().into_owned(), scan))
    }
}
