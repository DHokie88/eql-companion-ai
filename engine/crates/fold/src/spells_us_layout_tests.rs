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
