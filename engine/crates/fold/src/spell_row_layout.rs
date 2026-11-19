//! Project 174- and 190-column client rows onto the legacy 173-column indexes.
use super::{field, js_number, js_number_or_zero, js_trim, F_SLOTS};

/// A category or subcategory id — `Number(x) || 0`, then absent-means-nothing.
///
/// A zero is an absence and not an id: the string table's spell-category namespace starts at 1, so
/// nothing names zero. The cast saturates rather than wrapping for an absurd value, which resolves
/// to no word and reads as no category.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "guarded positive; a value past u32 saturates to an id nothing names, which reads as no category"
)]
pub(super) fn category_id(f: &[&str], i: usize) -> Option<u32> {
    let v = js_number_or_zero(field(f, i));
    (v > 0.0).then_some(v as u32)
}

/// A packed effect blob. An empty field does not prove a layout; exact known widths do not need it.
pub(super) fn packed_slots_valid(field: Option<&str>) -> bool {
    let Some(field) = field else {
        return false;
    };
    let trimmed = js_trim(field);
    if trimmed.is_empty() {
        return false;
    }
    let mut any = false;
    for chunk in trimmed.split('$') {
        if chunk.is_empty() {
            continue;
        }
        any = true;
        if !packed_slot_chunk(chunk) {
            return false;
        }
    }
    any
}

fn packed_slot_chunk(chunk: &str) -> bool {
    let parts: Vec<&str> = chunk.split('|').collect();
    parts.len() >= 6
        && parts[..6]
            .iter()
            .all(|part| !js_trim(part).is_empty() && js_number(part).is_finite())
}

fn project_wide<'a>(source: &[&'a str]) -> Vec<&'a str> {
    let mut projected = Vec::with_capacity(source.len().saturating_sub(16));
    projected.extend_from_slice(&source[..74]);
    projected.extend_from_slice(&source[75..173]);
    projected.push(source[189]);
    if source.len() > 190 {
        projected.extend_from_slice(&source[190..]);
    }
    projected
}

fn project_inserted<'a>(source: &[&'a str]) -> Vec<&'a str> {
    let mut projected = Vec::with_capacity(source.len() - 1);
    projected.extend_from_slice(&source[..74]);
    projected.extend_from_slice(&source[75..]);
    projected
}

/// Restore the legacy 173 column map.
///
/// Layout 174 drops the inserted column at 74. Layout 190 does that and also drops the 16 columns
/// immediately before the packed slots at 189. A row of exactly 172 fields is returned unchanged so
/// the slot read stays absent. Anything else needs a validated pack, or it is not a row.
pub(super) fn project_spell_row<'a>(source: &[&'a str]) -> Option<Vec<&'a str>> {
    let width = source.len();
    if width < F_SLOTS {
        return None;
    }
    if width == 190 || (width > 190 && packed_slots_valid(source.get(189).copied())) {
        return Some(project_wide(source));
    }
    if width == 174 || (width > 174 && packed_slots_valid(source.get(173).copied())) {
        return Some(project_inserted(source));
    }
    if width == 172 || width == 173 || packed_slots_valid(source.get(172).copied()) {
        return Some(source.to_vec());
    }
    None
}

/// Captured activation accepts the known layouts, plus a longer row whose pack validates one of them.
/// A 172-field row stays a legacy live-reader case and is not an activatable capture.
#[must_use]
pub fn captured_spell_row_supported(fields: &[&str]) -> bool {
    let width = fields.len();
    if matches!(width, 173 | 174 | 190) {
        return true;
    }
    if width > 190 && packed_slots_valid(fields.get(189).copied()) {
        return true;
    }
    if width > 174 && packed_slots_valid(fields.get(173).copied()) {
        return true;
    }
    width > 173 && packed_slots_valid(fields.get(172).copied())
}
