use super::*;

#[test]
fn shared_client_layout_fixtures_preserve_shifted_fields() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../../tests/fixtures/spell-parity.json")).unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let text = fixture["row"].as_str().unwrap();
        assert_eq!(
            text.split('^').count(),
            fixture["layout"].as_u64().unwrap() as usize
        );
        let table = parse_spells_us(text);
        let info = &table[fixture["key"].as_str().unwrap()];
        let expected = &fixture["projection"];
        assert_eq!(
            info.axis.unwrap().word(),
            expected["axis"].as_str().unwrap()
        );
        assert_eq!(info.resist_adj, expected["resistAdj"].as_f64().unwrap());
        assert_eq!(info.cast_ms, expected["castMs"].as_f64().unwrap());
        assert_eq!(
            info.recast_ms.unwrap(),
            expected["recastMs"].as_f64().unwrap()
        );
        assert_eq!(
            info.ae_max_targets.unwrap(),
            expected["aeMaxTargets"].as_f64().unwrap()
        );
        assert_eq!(info.mana.unwrap(), expected["mana"].as_f64().unwrap());
        assert_eq!(info.target_type, expected["targetType"].as_f64().unwrap());
        assert_eq!(
            info.category.unwrap(),
            fixture["category"].as_u64().unwrap() as u32
        );
        assert_eq!(
            info.subcategory.unwrap(),
            fixture["subcategory"].as_u64().unwrap() as u32
        );
        let damage = info.damage_slot.unwrap();
        assert_eq!(damage.base, expected["hpSlot"]["base"].as_f64().unwrap());
        assert_eq!(damage.calc, expected["hpSlot"]["calc"].as_f64().unwrap());
        assert_eq!(damage.max, expected["hpSlot"]["max"].as_f64().unwrap());
        assert_eq!(info.hp.len(), 1);
        assert!(info.hp[0].per_tick);
        assert_eq!(
            info.hp_duration.unwrap(),
            HpDuration {
                formula: 7.0,
                value: 5.0
            }
        );
        assert_eq!(
            info.debuff_slots[0],
            DebuffSlot {
                axis: Axis::Magic,
                base: -10.0,
                calc: 101.0,
                max: 23.0
            }
        );
        assert_eq!(info.class_levels[11], 20);
    }
}

#[test]
fn js_number_is_javascripts_number_and_not_rusts_parser() {
    // The four differences the app's shipped behaviour depends on.
    assert_eq!(
        js_number(""),
        0.0,
        "the empty string is zero, never an error"
    );
    assert_eq!(
        js_number("   "),
        0.0,
        "…and so is whitespace, trimmed first"
    );
    assert_eq!(js_number("  12  "), 12.0);
    assert_eq!(js_number("0x1f"), 31.0, "a radix prefix is a number");
    assert!(js_number("-0x10").is_nan(), "…and takes no sign");
    assert_eq!(js_number("1e3"), 1000.0);
    assert_eq!(js_number("+7"), 7.0);
    assert_eq!(js_number("-1.5"), -1.5);
    assert_eq!(js_number("Infinity"), f64::INFINITY);
    assert_eq!(js_number("-Infinity"), f64::NEG_INFINITY);
    // …and the spellings Rust accepts and JavaScript does not: delegating to `f64::from_str`
    // without the spelling guard would make every one of these a number.
    for spelled in [
        "inf", "infinity", "INFINITY", "NaN", "nan", "abc", "1.2.3", "1e", ".",
    ] {
        assert!(js_number(spelled).is_nan(), "Number({spelled:?}) is NaN");
    }
}

fn synthetic_row(fields: &[(usize, &str)]) -> String {
    let mut row = vec!["0".to_string(); 173];
    for index in 0..F_CLASS_COUNT {
        row[F_CLASS_FIRST + index] = "255".to_string();
    }
    for (index, value) in fields {
        row[*index] = (*value).to_string();
    }
    row.join("^")
}

fn widen(text: &str, layout: usize) -> String {
    let mut fields: Vec<String> = text.split('^').map(str::to_string).collect();
    if layout == 174 || layout == 190 {
        fields.insert(74, "6789".to_string());
    }
    if layout == 190 {
        let slots = fields.pop().expect("packed slots");
        fields.extend(std::iter::repeat_n("0".to_string(), 16));
        fields.push(slots);
    }
    fields.join("^")
}

#[test]
fn a_190_column_row_keeps_the_174_shift_and_reads_slots_at_189() {
    let base = synthetic_row(&[
        (F_ID, "7"),
        (F_NAME, "Wide Synthetic"),
        (F_RESIST_ADJ, "-17"),
        (F_AE_MAX_TARGETS, "4"),
        (F_CATEGORY, "114"),
        (F_SUBCATEGORY, "43"),
        (F_SLOTS, "1|0|-20|0|102|100"),
        (F_CLASS_FIRST + 11, "20"),
    ]);
    let wide = widen(&base, 190);
    assert_eq!(wide.split('^').count(), 190);
    let info = parse_spells_us(&wide).into_values().next().expect("one");
    assert_eq!(info.resist_adj, -17.0);
    assert_eq!(info.ae_max_targets, Some(4.0));
    assert_eq!(info.category, Some(114));
    assert_eq!(info.subcategory, Some(43));
    assert_eq!(info.class_levels[11], 20);
    assert_eq!(info.damage_slot.expect("damage").base, -20.0);
    assert_eq!(info.damage_slot.expect("damage").calc, 102.0);
    assert_eq!(info.damage_slot.expect("damage").max, 100.0);
}

#[test]
fn a_validated_trailing_column_is_kept_and_an_unrecognized_width_is_dropped() {
    let base = synthetic_row(&[
        (F_ID, "8"),
        (F_NAME, "Tail Synthetic"),
        (F_RESIST_ADJ, "3"),
        (F_SLOTS, "1|0|-5|0|100|5"),
    ]);
    let trailed = format!("{}^tail", widen(&base, 190));
    assert_eq!(trailed.split('^').count(), 191);
    let info = parse_spells_us(&trailed).into_values().next().expect("one");
    assert_eq!(info.resist_adj, 3.0);
    assert_eq!(info.damage_slot.expect("damage").base, -5.0);
    let mut short: Vec<String> = widen(&base, 190).split('^').map(str::to_string).collect();
    short.pop();
    assert_eq!(short.len(), 189);
    assert!(parse_spells_us(&short.join("^")).is_empty());
    assert!(parse_spells_us(&vec!["0"; 200].join("^")).is_empty());
}
