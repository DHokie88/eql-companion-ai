//! Select the countdown estimate from user choice and recorded evidence.

/// `resolveRespawn` — the estimate ladder. Rung 2 is FLOORED by rung 3 rather than averaged with it
/// (the smallest gap you measured is an upper bound, so the wiki lifting it is a correction); rung
/// 1 is never floored, because the user is looking at the spawn and the wiki describes another
/// server.
pub(super) fn resolve_respawn(
    custom_ms: Option<i64>,
    observed_ms: Option<i64>,
    samples: i64,
    wiki_ms: Option<i64>,
    auto_adjust: bool,
) -> (Option<i64>, &'static str) {
    if let Some(c) = custom_ms.filter(|_| !auto_adjust) {
        if c > 0 {
            return (Some(c), "custom");
        }
    }
    if let Some(o) = observed_ms {
        if o > 0 && samples > 0 {
            let floored = match wiki_ms.filter(|_| !auto_adjust) {
                Some(w) => o.max(w),
                None => o,
            };
            return (Some(floored), "observed");
        }
    }
    if let Some(w) = wiki_ms {
        if w > 0 {
            return (Some(w), "wiki");
        }
    }
    (None, "none")
}

