# Ruby gear cross-check, November 21, 2026

Reviewed Ruby's base item records against the Eye of Zomm export
`20261120T063320Z-253ad599a524`. Ruby reports that its item catalog comes from
values received by game clients during play. Its item pages also calculate a
tier table. The table below compares only the +0 records. Ruby lists which
tiers it saw for each item, so a base record is not a claim that a player
inspected a +0 copy. [Ruby's sources](https://eqlegendsruby.org/about.html) ·
[Eye of Zomm manifest](https://raw.githubusercontent.com/Maergoth/EQL-EOZ/dataset/manifest.json)

| Checked item | Wiki base AC | Ruby base AC | Other matching base values |
| --- | ---: | ---: | --- |
| [Lustrous Russet Vambraces](https://eqlegendsruby.org/item/4833-lustrous-russet-vambraces.html) | 15 | **13** | STR 9, DEX 5, weight 4.9 |
| [Lustrous Russet Greaves](https://eqlegendsruby.org/item/4836-lustrous-russet-greaves.html) | 15 | **14** | STR 5, STA 5, AGI 5, weight 5.6 |
| [Lustrous Russet Helm](https://eqlegendsruby.org/item/4831-lustrous-russet-helm.html) | 15 | **14** | CHA 5, INT 5, weight 4.5 |
| [Lustrous Russet Breastplate](https://eqlegendsruby.org/item/4832-lustrous-russet-breastplate.html) | 26 | 26 | STR 15, STA 15, DEX 15, weight 7.5 |
| [Lustrous Russet Bracer](https://eqlegendsruby.org/item/4834-lustrous-russet-bracer.html) | 9 | 9 | STR 3, DEX 3, fire/cold/magic saves 7, weight 3 |
| [Lustrous Russet Gauntlets](https://eqlegendsruby.org/item/4835-lustrous-russet-gauntlets.html) | 11 | 11 | HP 50, STA 5, DEX 5, weight 3.8 |
| [Lustrous Russet Boots](https://eqlegendsruby.org/item/4837-lustrous-russet-boots.html) | 14 | 14 | AGI 5, INT 5, WIS 5, disease/poison saves 15, weight 4.9 |
| [Golden Efreeti Greaves](https://eqlegendsruby.org/item/4346-golden-efreeti-greaves.html) | 15 | 15 | AGI 9, DEX 10, weight 5.6 |
| [Efreeti Magi Staff](https://eqlegendsruby.org/item/20870-efreeti-magi-staff.html) | 5 | 5 | DMG 12, delay 36, STA 2, CHA 2, INT 5, weight 2 |

The Vambraces also have an independent in-game observation in EQLWiki's
scaling notes. At +3, the observed AC is 16. A base of 13 gives 16 at +3
and a base of 15 gives 19. [Scaling evidence](../../src/shared/itemScaling/README.md) ·
[Wiki Vambraces revision 177316](https://eqlwiki.com/index.php?title=Lustrous_Russet_Vambraces&oldid=177316) ·
[Wiki Greaves revision 177315](https://eqlwiki.com/index.php?title=Lustrous_Russet_Greaves&oldid=177315) ·
[Wiki Helm revision 177314](https://eqlwiki.com/index.php?title=Lustrous_Russet_Helm&oldid=177314)

Oracle applies the three AC corrections at item lookup, including when Gear
reads the downloaded wiki pack. Corrections target the named wiki pages and
the reviewed stale AC of 15. A future wiki value other than 15 passes through
and only receives a check mark if it matches the cross-check. The original wiki
stat text stays available as provenance.

In Gear, **✓ Ruby verified** marks the individual checked values. **~ Estimated**
marks numbers calculated for an owned or simulated upgrade. The owned estimate
starts at the exported tier because inventory exports omit partial mote
progress. Effects, eligibility, drop sources, and other base values retain
their wiki sourcing. Augmentor's Mask is still pending a Ruby cross-check.
