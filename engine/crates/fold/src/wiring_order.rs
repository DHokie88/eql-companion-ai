/// Registration order is bus delivery order — `src/main/modules/wiring.ts` `ordered`, verbatim.
///
/// Spelled in full rather than as "the ones we have ported", so an unimplemented module is a fact
/// the code states. The parity harness reads `missing()` off it and names every absent module,
/// rather than comparing a subset and reporting green.
pub const WIRING_ORDER: &[&str] = &[
    "combo",
    "roster",
    "loot",
    "turnins",
    "classUnlocks",
    "kills",
    "respawn",
    "progression",
    "leveling",
    "character",
    "outputFiles",
    "spellSets",
    "itemTiers",
    "observedSpellRanks",
    "alerts",
    "buffs",
    "buffTimers",
    "consider",
    "resist",
    "bazaar",
    // The five surfaces the log could always have answered and nothing published (Z Engine,
    // 2026-09-08). Appended rather than slotted beside their kin: registration order is bus
    // delivery order, and none of these is read by any module that folds after it, so the end of
    // the list is where a new module belongs until something needs it earlier.
    "hails",
    "faction",
    "coin",
    "skills",
    "deaths",
    "eventFeed",
];
