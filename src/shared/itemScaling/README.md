# EQL Wiki item scaling

The rules in `rules.json` come from [EQLWiki revision 4](https://github.com/Maergoth/EQLWiki/tree/9ec24e99c0d28673b2e3ba046436db5ce76a57f1/extensions/ItemLevelSlider), SHA-256 `f0fd75b83e5be88abb8d48da93c0d31c38d11963a0b754afa7fb352be11ad1f3`. The source engine and rules are MIT licensed by Maergoth. See [LICENSE](LICENSE). Oracle's TypeScript adapter ports the rules that its item parser and gear index support. Updating them requires a new build.

The wiki's published fixtures include observed values for Thornstinger, Lustrous Russet Boots and Cloak of Flames. Backstab is a screenshot-derived model. The shared engine describes negative penalties, but the documented revision 2 screenshots do not establish a new rule for them. The wiki's Lustrous Russet Vambraces observation records tier 3 AC 16. Oracle's corrected base AC of 13 reproduces that observation. See the [Ruby cross-check](../../../docs/research/eqo-gear-data-20261121.md) for the review and the linked wiki revision for scaling caveats.

Weapon Accuracy needs explicit versus generated and percent versus unitless context that Oracle does not yet retain. Range scales here only when the source provides a single number. Multi-value range strings remain as written.
