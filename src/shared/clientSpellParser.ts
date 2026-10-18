/** Complete, ID-preserving interpretation of the three local client files.
 * Pure over already-captured strings; callers publish nothing until this succeeds.
 * The standalone Build-EQLSpellCards.py owns the original verified column map.
 */
import { SPELL_CLASSES, type ClientSpellEffect, type ClientSpellRecord, type SpellSourceFile } from './spellLibrary'

// The standalone tool's EQEmu effect vocabulary, not a game-data snapshot.
const SPA_NAMES: readonly string[] = [
  "CurrentHP", "ArmorClass", "ATK", "MovementSpeed", "STR", "DEX", "AGI", "STA",
  "INT", "WIS", "CHA", "AttackSpeed", "Invisibility", "SeeInvis", "WaterBreathing", "CurrentMana",
  "NPCFrenzy", "NPCAwareness", "Lull", "AddFaction", "Blind", "Stun", "Charm", "Fear",
  "Stamina", "BindAffinity", "Gate", "CancelMagic", "InvisVsUndead", "InvisVsAnimals", "ChangeFrenzyRad", "Mez",
  "SummonItem", "SummonPet", "Confuse", "DiseaseCounter", "PoisonCounter", "DetectHostile", "DetectMagic", "TwinCastBlocker",
  "DivineAura", "Destroy", "ShadowStep", "Berserk", "Lycanthropy", "Vampirism", "ResistFire", "ResistCold",
  "ResistPoison", "ResistDisease", "ResistMagic", "DetectTraps", "SenseDead", "SenseSummoned", "SenseAnimals", "Rune",
  "TrueNorth", "Levitate", "Illusion", "DamageShield", "TransferItem", "Identify", "ItemID", "WipeHateList",
  "SpinTarget", "InfraVision", "UltraVision", "EyeOfZomm", "ReclaimPet", "TotalHP", "CorpseBomb", "NecPet",
  "PreserveCorpse", "BindSight", "FeignDeath", "VoiceGraft", "Sentinel", "LocateCorpse", "AbsorbMagicAtt", "CurrentHPOnce",
  "EnchantLight", "Revive", "SummonPC", "Teleport", "TossUp", "WeaponProc", "Harmony", "MagnifyVision",
  "Succor", "ModelSize", "Cloak", "SummonCorpse", "InstantHate", "StopRain", "NegateIfCombat", "Sacrifice",
  "Silence", "ManaPool", "AttackSpeed2", "Root", "HealOverTime", "CompleteHeal", "Fearless", "CallPet",
  "Translocate", "AntiGate", "SummonBSTPet", "AlterNPCLevel", "Familiar", "SummonItemIntoBag", "IncreaseArchery", "ResistAll",
  "CastingLevel", "SummonHorse", "ChangeAggro", "Hunger", "CurseCounter", "MagicWeapon", "Amplification", "AttackSpeed3",
  "HealRate", "ReverseDS", "ReduceSkill", "Screech", "ImprovedDamage", "ImprovedHeal", "SpellResistReduction", "IncreaseSpellHaste",
  "IncreaseSpellDuration", "IncreaseRange", "SpellHateMod", "ReduceReagentCost", "ReduceManaCost", "FcStunTimeMod", "LimitMaxLevel", "LimitResist",
  "LimitTarget", "LimitEffect", "LimitSpellType", "LimitSpell", "LimitMinDur", "LimitInstant", "LimitMinLevel", "LimitCastTimeMin",
  "LimitCastTimeMax", "Teleport2", "ElectricityResist", "PercentalHeal", "StackingCommand_Block", "StackingCommand_Overwrite", "DeathSave", "SuspendPet",
  "TemporaryPets", "BalanceHP", "DispelDetrimental", "SpellCritDmgIncrease", "IllusionCopy", "SpellDamageShield", "Reflect", "AllStats",
  "MakeDrunk", "MitigateSpellDamage", "MitigateMeleeDamage", "NegateAttacks", "AppraiseLDonChest", "DisarmLDoNTrap", "UnlockLDoNChest", "PetPowerIncrease",
  "MeleeMitigation", "CriticalHitChance", "SpellCritChance", "CrippBlowChance", "AvoidMeleeChance", "RiposteChance", "DodgeChance", "ParryChance",
  "DualWieldChance", "DoubleAttackChance", "MeleeLifetap", "AllInstrumentMod", "ResistSpellChance", "ResistFearChance", "HundredHands", "MeleeSkillCheck",
  "HitChance", "DamageModifier", "MinDamageModifier", "BalanceMana", "IncreaseBlockChance", "CurrentEndurance", "EndurancePool", "Amnesia",
  "Hate", "SkillAttack", "FadingMemories", "StunResist", "StrikeThrough", "SkillDamageTaken", "CurrentEnduranceOnce", "Taunt",
  "ProcChance", "RangedProc", "IllusionOther", "MassGroupBuff", "GroupFearImmunity", "Rampage", "AETaunt", "FleshToBone",
  "PurgePoison", "DispelBeneficial", "PetShield", "AEMelee", "FrenziedDevastation", "PetMaxHP", "MaxHPChange", "PetAvoidance",
  "Accuracy", "HeadShot", "PetCriticalHit", "SlayUndead", "SkillDamageAmount", "Packrat", "BlockBehind", "DoubleRiposte",
  "GiveDoubleRiposte", "GiveDoubleAttack", "TwoHandBash", "ReduceSkillTimer", "ReduceFallDamage", "PersistantCasting", "ExtendedShielding", "StunBashChance",
  "DivineSave", "Metabolism", "ReduceApplyPoisonTime", "ChannelChanceSpells", "FreePet", "GivePetGroupTarget", "IllusionPersistence", "FeignedCastOnChance",
  "StringUnbreakable", "ImprovedReclaimEnergy", "IncreaseChanceMemwipe", "CharmBreakChance", "RootBreakChance", "TrapCircumvention", "SetBreathLevel", "RaiseSkillCap",
  "SecondaryForte", "SecondaryDmgInc", "SpellProcChance", "ConsumeProjectile", "FrontalBackstabChance", "FrontalBackstabMinDmg", "Blank", "ShieldDuration",
  "ShroudofStealth", "PetDiscipline", "TripleBackstab", "CombatStability", "AddSingingMod", "SongModCap", "RaiseStatCap", "TradeSkillMastery",
  "HastenedAASkill", "MasteryofPast", "ExtraAttackChance", "AddPetCommand", "ReduceTradeskillFail", "MaxBindWound", "BardSongRange", "BaseMovementSpeed",
  "CastingLevel2", "CriticalDoTChance", "CriticalHealChance", "CriticalMend", "Ambidexterity", "UnfailingDivinity", "FinishingBlow", "Flurry",
  "PetFlurry", "FeignedMinion", "ImprovedBindWound", "DoubleSpecialAttack", "LoHSetHeal", "NimbleEvasion", "FcDamageAmt", "SpellDurationIncByTic",
  "SkillAttackProc", "CastOnFadeEffect", "IncreaseRunSpeedCap", "Purify", "StrikeThrough2", "FrontalStunResist", "CriticalSpellChance", "ReduceTimerSpecial",
  "FcSpellVulnerability", "FcDamageAmtIncoming", "ChangeHeight", "WakeTheDead", "Doppelganger", "ArcheryDamageModifier", "FcDamagePctCrit", "FcDamageAmtCrit",
  "OffhandRiposteFail", "MitigateDamageShield", "ArmyOfTheDead", "Appraisal", "ZoneSuspendMinion", "GateCastersBindpoint", "ReduceReuseTimer", "LimitCombatSkills",
  "Sanctuary", "ForageAdditionalItems", "Invisibility2", "InvisVsUndead2", "ImprovedInvisAnimals", "ItemHPRegenCapIncrease", "ItemManaRegenCapIncrease", "CriticalHealOverTime",
  "ShieldBlock", "ReduceHate", "GateToHomeCity", "DefensiveProc", "HPToMana", "NoBreakAESneak", "SpellSlotIncrease", "MysticalAttune",
  "DelayDeath", "ManaAbsorbPercentDamage", "CriticalDamageMob", "Salvage", "SummonToCorpse", "CastOnRuneFadeEffect", "BardAEDot", "BlockNextSpellFocus",
  "IllusionaryTarget", "PercentXPIncrease", "SummonAndResAllCorpses", "TriggerOnCast", "SpellTrigger", "ItemAttackCapIncrease", "ImmuneFleeing", "InterruptCasting",
  "ChannelChanceItems", "AssassinateLevel", "HeadShotLevel", "DoubleRangedAttack", "LimitManaMin", "ShieldEquipDmgMod", "ManaBurn", "PersistentEffect",
  "IncreaseTrapCount", "AdditionalAura", "DeactivateAllTraps", "LearnTrap", "ChangeTriggerType", "FcMute", "CurrentManaOnce", "PassiveSenseTrap",
  "ProcOnKillShot", "SpellOnDeath", "PotionBeltSlots", "BandolierSlots", "TripleAttackChance", "ProcOnSpellKillShot", "GroupShielding", "SetBodyType",
  "FactionMod", "CorruptionCounter", "ResistCorruption", "AttackSpeed4", "ForageSkill", "CastOnFadeEffectAlways", "ApplyEffect", "DotCritDmgIncrease",
  "Fling", "CastOnFadeEffectNPC", "SpellEffectResistChance", "ShadowStepDirectional", "Knockdown", "KnockTowardCaster", "NegateSpellEffect", "SympatheticProc",
  "Leap", "LimitSpellGroup", "CastOnCurer", "CastOnCure", "SummonCorpseZone", "FcTimerRefresh", "FcTimerLockout", "LimitManaMax",
  "FcHealAmt", "FcHealPctIncoming", "FcHealAmtIncoming", "FcHealPctCritIncoming", "FcHealAmtCrit", "PetMeleeMitigation", "SwarmPetDuration", "FcTwincast",
  "HealGroupFromMana", "ManaDrainWithDmg", "EndDrainWithDmg", "LimitSpellClass", "LimitSpellSubclass", "TwoHandBluntBlock", "CastonNumHitFade", "CastonFocusEffect",
  "LimitHPPercent", "LimitManaPercent", "LimitEndPercent", "LimitClass", "LimitRace", "FcBaseEffects", "LimitCastingSkill", "FFItemClass",
  "ACv2", "ManaRegen_v2", "SkillDamageAmount2", "AddMeleeProc", "FcLimitUse", "FcIncreaseNumHits", "LimitUseMin", "LimitUseType",
  "GravityEffect", "Display", "IncreaseExtTargetWindow", "SkillProcAttempt", "LimitToSkill", "SkillProcSuccess", "PostEffect", "PostEffectData",
  "ExpandMaxActiveTrophyBen", "CriticalDotDecay", "CriticalHealDecay", "CriticalRegenDecay", "BeneficialCountDownHold", "TeleporttoAnchor", "TranslocatetoAnchor", "Assassinate",
  "FinishingBlowLvl", "DistanceRemoval", "TriggerOnReqTarget", "TriggerOnReqCaster", "ImprovedTaunt", "AddMercSlot", "AStacker", "BStacker",
  "CStacker", "DStacker", "MitigateDotDamage", "MeleeThresholdGuard", "SpellThresholdGuard", "TriggerMeleeThreshold", "TriggerSpellThreshold", "AddHatePct",
  "AddHateOverTimePct", "ResourceTap", "FactionModPct", "DamageModifier2", "Ff_Override_NotFocusable", "ImprovedDamage2", "FcDamageAmt2", "Shield_Target",
  "PC_Pet_Rampage", "PC_Pet_AE_Rampage", "PC_Pet_Flurry_Chance", "DS_Mitigation_Amount", "DS_Mitigation_Percentage", "Chance_Best_in_Spell_Grp", "Trigger_Best_in_Spell_Grp", "Double_Melee_Round",
  "Buy_AA_Rank", "Double_Backstab_Front", "Pet_Crit_Melee_Damage_Pct_Owner", "Trigger_Spell_Non_Item", "Weapon_Stance", "Hatelist_To_Top_Index", "Hatelist_To_Tail_Index", "Ff_Value_Min",
  "Ff_Value_Max", "Fc_Cast_Spell_On_Land", "Skill_Base_Damage_Mod", "Fc_Spell_Damage_Pct_IncomingPC", "Fc_Spell_Damage_Amt_IncomingPC", "Ff_CasterClass", "Ff_Same_Caster", "Extend_Tradeskill_Cap",
  "Defender_Melee_Force_Pct_PC", "Worn_Endurance_Regen_Cap", "Ff_ReuseTimeMin", "Ff_ReuseTimeMax", "Ff_Endurance_Min", "Ff_Endurance_Max", "Pet_Add_Atk", "Ff_DurationMax",
  "Critical_Melee_Damage_Mod_Max", "Ff_FocusCastProcNoBypass", "AddExtraAttackPct_1h_Primary", "AddExtraAttackPct_1h_Secondary", "Fc_CastTimeMod2", "Fc_CastTimeAmt", "Fearstun", "Melee_Damage_Position_Mod",
  "Melee_Damage_Position_Amt", "Damage_Taken_Position_Mod", "Damage_Taken_Position_Amt", "Fc_Amplify_Mod", "Fc_Amplify_Amt", "Health_Transfer", "Fc_ResistIncoming", "Ff_FocusTimerMin",
  "Proc_Timer_Modifier", "Mana_Max_Percent", "Endurance_Max_Percent", "AC_Avoidance_Max_Percent", "AC_Mitigation_Max_Percent", "Attack_Offense_Max_Percent", "Attack_Accuracy_Max_Percent", "Luck_Amount",
  "Luck_Percent", "Endurance_Absorb_Pct_Damage", "Instant_Mana_Pct", "Instant_Endurance_Pct", "Duration_HP_Pct", "Duration_Mana_Pct", "Duration_Endurance_Pct",
]
const SKILL_NAMES = ['1H Blunt', '1H Slashing', '2H Blunt', '2H Slashing', 'Abjuration', 'Alteration', 'Apply Poison', 'Archery', 'Backstab', 'Bind Wound', 'Bash', 'Block', 'Brass Instruments', 'Channeling', 'Conjuration', 'Defense', 'Disarm', 'Disarm Traps', 'Divination', 'Dodge', 'Double Attack', 'Dragon Punch', 'Dual Wield', 'Eagle Strike', 'Evocation', 'Feign Death', 'Flying Kick', 'Forage', 'Hand to Hand', 'Hide', 'Kick', 'Meditate', 'Mend', 'Offense', 'Parry', 'Pick Lock', '1H Piercing', 'Riposte', 'Round Kick', 'Safe Fall', 'Sense Heading', 'Singing', 'Sneak', 'Specialize Abjure', 'Specialize Alteration', 'Specialize Conjuration', 'Specialize Divination', 'Specialize Evocation', 'Pick Pockets', 'Stringed Instruments', 'Swimming', 'Throwing', 'Tiger Claw', 'Tracking', 'Wind Instruments', 'Fishing', 'Make Poison', 'Tinkering', 'Research', 'Alchemy', 'Baking', 'Tailoring', 'Sense Traps', 'Blacksmithing', 'Fletching', 'Brewing', 'Alcohol Tolerance', 'Begging', 'Jewelry Making', 'Pottery', 'Percussion Instruments', 'Intimidation', 'Berserking', 'Taunt', 'Frenzy', 'Remove Trap', 'Triple Attack', '2H Piercing']
const TARGET_NAMES: Record<number, string> = {
  1: 'target optional', 2: 'area around the client (old)', 3: 'group teleport', 4: 'area around the caster', 5: 'single', 6: 'self', 8: 'area around the target',
  9: 'animal', 10: 'undead', 11: 'summoned', 13: 'life tap', 14: 'pet', 15: 'corpse', 16: 'plant', 17: 'giant', 18: 'dragon', 20: 'area life tap',
  24: 'undead area', 25: 'summoned area', 32: 'area on the hate list', 33: 'hate list', 34: 'cursed chest', 35: 'muramite', 36: 'area, clients only',
  37: 'area, NPCs only', 38: 'summoned pet', 39: 'group, no pets', 40: 'bard area', 41: 'group', 42: 'directional area', 43: 'group, clients and pets',
  44: 'beam', 45: 'ring', 46: "target's target", 47: "pet's master", 50: 'target area, no players or pets', 51: 'single friendly or self', 56: 'group member or self'
}
const RESIST_NAMES = ['unresistable', 'magic', 'fire', 'cold', 'poison', 'disease', 'chromatic (lowest resist)', 'prismatic (average resist)', 'physical', 'corruption']
const SPELL_ID_BASE = new Set([85, 139, 201, 289, 323, 333, 361, 373, 377, 386, 387, 406, 407, 419, 427, 429, 442, 443, 475, 476])
const SPELL_ID_LIMIT = new Set([232, 339, 340, 360, 374, 383, 481])
const MESSAGE_KEYS = ['you_cast', 'other_casts', 'on_you', 'on_other', 'fades']
const LATE_FIELDS: Record<string, number> = { resistMod: 78, recourse: 81, descriptionId: 85, categoryId: 86, subcategoryId: 87, aeMaxTargets: 143, displayNameId: 165 }
const EARLY_FIELDS: Record<string, number> = { range: 4, aeRange: 5, castMs: 8, recoveryMs: 9, recastMs: 10, durationFormula: 11, durationCap: 12, aoeDurationMs: 13, mana: 14, beneficialCode: 28, resist: 29, target: 30, skill: 32 }

function sourceLines(text: string, file: SpellSourceFile): string[] {
  if (!text.trim()) throw new Error(`${file}: empty source file`)
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0)
}

function numeric(text: string, where: string): number {
  const value = text.trim()
  if (value === '') return 0
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new Error(`${where}: invalid number`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) throw new Error(`${where}: unsafe number`)
  return parsed
}

function integer(text: string, where: string): number {
  const value = numeric(text, where)
  if (!Number.isSafeInteger(value)) throw new Error(`${where}: expected an integer`)
  return value
}

function parseEffects(blob: string, id: number): ClientSpellEffect[] {
  const seen = new Set<number>()
  return blob.split('$').filter(Boolean).map((piece) => {
    const parts = piece.split('|')
    if (parts.length !== 6 || parts.some((p) => p.trim() === '')) throw new Error(`Spell ${id}: malformed effect slot`)
    const [slot, spa, base, limit, calc, max] = parts.map((p, index) =>
      [0, 1, 4].includes(index) ? integer(p, `Spell ${id} effect`) : numeric(p, `Spell ${id} effect`))
    if (slot < 1 || spa < 0 || seen.has(slot)) throw new Error(`Spell ${id}: invalid or duplicate effect slot ${slot}`)
    seen.add(slot)
    // Preserve empty spacers too: every client slot remains inspectable and diffable.
    return { slot, spa, base, limit, calc, max }
  })
}

function parseMessages(text: string): Map<number, Record<string, string>> {
  const result = new Map<number, Record<string, string>>()
  for (const line of sourceLines(text, 'spells_us_str.txt')) {
    if (line.startsWith('#')) continue
    const fields = line.split('^')
    if (fields.length < 6 || !fields[0].trim()) throw new Error('spells_us_str.txt: malformed message row')
    const id = integer(fields[0], 'spells_us_str.txt ID')
    if (id < 0 || result.has(id)) throw new Error(`spells_us_str.txt: invalid or duplicate ID ${id}`)
    result.set(id, Object.fromEntries(MESSAGE_KEYS.map((key, index) => [key, fields[index + 1]])))
  }
  if (!result.size) throw new Error('spells_us_str.txt: no message records')
  return result
}

function parseStrings(text: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of sourceLines(text, 'dbstr_us.txt')) {
    const fields = line.split('^')
    if (fields.length < 3 || !fields[0].trim() || !fields[1].trim()) throw new Error('dbstr_us.txt: malformed string row')
    const id = integer(fields[0], 'dbstr_us.txt ID')
    const type = integer(fields[1], 'dbstr_us.txt type')
    if (id < 0 || type < 0) throw new Error('dbstr_us.txt: negative string key')
    if (![5, 6, 27].includes(type)) continue
    const key = `${id}:${type}`
    if (result.has(key)) throw new Error(`dbstr_us.txt: duplicate key ${key}`)
    result.set(key, fields[2])
  }
  if (!result.size) throw new Error('dbstr_us.txt: no spell string records')
  return result
}

const DURATION_LABELS: Record<number, string> = {
  1: 'level / 2', 2: 'level / 2 + 5', 3: 'level * 30', 4: '50', 5: '2', 6: 'level / 2 + 2', 7: 'level',
  8: 'level + 10', 9: 'level * 2 + 10', 10: 'level * 3 + 10', 11: 'level * 30 + 90', 12: 'level / 4',
  13: 'level * 4 + 10', 14: '5 * (level + 2)', 15: '10 * (level + 10)'
}

function ticksText(ticks: number): string {
  const seconds = ticks * 6
  if (seconds < 60) return `${ticks} ticks (${seconds}s)`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${ticks} ticks (${minutes}m${seconds % 60 ? ` ${seconds % 60}s` : ''})`
  return `${ticks} ticks (${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''})`
}

function durationText(formula: number, cap: number): string {
  if (formula === 0) return 'instant'
  if (formula === 50) return 'does not fade on a timer'
  if (formula === 51) return 'does not fade on a timer (aura)'
  if (formula >= 200) return ticksText(cap > 0 ? Math.min(formula, cap) : formula)
  const label = DURATION_LABELS[formula]
  if (!label) return `formula ${formula}${cap > 0 ? `, cap ${ticksText(cap)}` : ''}`
  return cap > 0 ? `up to ${ticksText(cap)} (${label}, capped)` : `scales with caster level (${label})`
}

function resolveDescription(raw: string, record: ClientSpellRecord): string {
  const slots = new Map(record.effects.map((effect) => [effect.slot, effect]))
  return raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').trim().replace(/([#$@])(\d{1,2})|%z/g, (token: string, kind: string | undefined, number: string | undefined) => {
      if (token === '%z') return durationText(record.durationFormula, record.durationCap)
      const slot = slots.get(Number(number))
      if (!slot) return token
      const values: Record<string, number> = { '#': slot.base, '$': slot.limit, '@': slot.max }
      return String(Math.abs(values[kind ?? '']))
    })
}

function spellReference(effect: ClientSpellEffect): number | null {
  if (SPELL_ID_BASE.has(effect.spa) && effect.base) return effect.base
  if (SPELL_ID_LIMIT.has(effect.spa) && effect.limit) return effect.limit
  if (effect.spa === 288 && effect.max) return effect.max
  return null
}

function effectValue(base: number, calc: number, max: number): string {
  return calc === 0 || calc === 100 || max === 0 || max === base ? String(base) : `${base} scaling toward ${max} (calc ${calc})`
}

function specialEffect(effect: ClientSpellEffect, timed: boolean): string | null {
  const { spa, base, calc, max, limit } = effect
  const fixed: Record<number, string> = {
    101: 'Complete Heal', 11: `Melee speed ${effectValue(base, calc, max)}% of normal`,
    3: `Movement modifier ${effectValue(base, calc, max)}`, 91: `Summon a corpse up to level ${base}`
  }
  if (fixed[spa]) return fixed[spa]
  if (spa === 0 || spa === 79) return describeHp(effect, timed)
  if (spa === 148 || spa === 149) {
    const threshold = max >= 1000 ? max - 1000 : max
    return `Stacking ${spa === 148 ? 'block: reject a new' : 'overwrite: replace a'} spell whose slot ${limit} is ${SPA_NAMES[base] ?? `effect ${base}`} below ${threshold}`
  }
  return null
}

function describeHp(effect: ClientSpellEffect, timed: boolean): string {
  const timing = effect.spa === 79 ? ' once' : timed ? ' every tick' : ''
  return `${effect.base < 0 ? 'Damage' : 'Heal'} ${effectValue(Math.abs(effect.base), effect.calc, Math.abs(effect.max))} hit points${timing}`
}

function effectExtras(effect: ClientSpellEffect, value: string): string[] {
  const { spa, limit, calc, max, base } = effect
  const extra: string[] = []
  if (limit && !SPELL_ID_LIMIT.has(spa)) extra.push(`limit ${limit}`)
  if (!value.includes('scaling toward')) {
    if (max && max !== base) extra.push(`max ${max}`)
    if (calc !== 0 && calc !== 100) extra.push(`calc ${calc}`)
  }
  return extra
}

function describeEffect(effect: ClientSpellEffect, record: ClientSpellRecord, names: Map<number, string>): string {
  const special = specialEffect(effect, record.durationFormula !== 0)
  if (special) return special
  const { spa, base, calc, max } = effect
  const label = SPA_NAMES[spa] ?? `effect ${spa}`
  const reference = spellReference(effect)
  if (reference !== null) return `${label}: spell ${reference}${names.has(Math.abs(reference)) ? ` ${names.get(Math.abs(reference)) ?? ''}` : ''}`
  const value = effectValue(base, calc, max)
  const extra = effectExtras(effect, value)
  const tick = record.durationFormula !== 0 && (spa === 15 || spa === 189) ? ' every tick' : ''
  return `${label} ${value}${tick}${extra.length ? ` (${extra.join(', ')})` : ''}`
}

function namedFields(raw: string[], shift: number, id: number): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = { extra: raw[3] }
  for (const [name, index] of Object.entries(EARLY_FIELDS)) {
    const parse = name === 'range' || name === 'aeRange' ? numeric : integer
    fields[name] = parse(raw[index], `Spell ${id} ${name}`)
  }
  for (const [name, index] of Object.entries(LATE_FIELDS)) fields[name] = integer(raw[index + shift], `Spell ${id} ${name}`)
  for (let index = 0; index < 4; index++) {
    fields[`reagent${index + 1}Id`] = integer(raw[15 + index], `Spell ${id} reagent`)
    fields[`reagent${index + 1}Count`] = integer(raw[19 + index], `Spell ${id} reagent count`)
    fields[`focus${index + 1}Id`] = integer(raw[23 + index], `Spell ${id} focus`)
  }
  return fields
}

function parseRecord(line: string): ClientSpellRecord {
  const rawFields = line.split('^')
  const layout = rawFields.length
  if (layout !== 173 && layout !== 174) throw new Error(`spells_us.txt: unsupported row layout (${layout} fields)`)
  const id = integer(rawFields[0], 'spells_us.txt ID')
  const name = rawFields[1]
  if (!rawFields[0].trim() || id < 0 || !name.trim()) throw new Error('spells_us.txt: missing or invalid spell ID/name')
  const shift = layout === 174 ? 1 : 0
  const fields = namedFields(rawFields, shift, id)
  const n = (key: string): number => Number(fields[key])
  const rank = /\s+(?:Rk\.?\s*)?([IVXLC]+|\d+)\s*$/i.exec(name)
  fields.baseName = rank ? name.slice(0, rank.index).trim() : name
  const classes = SPELL_CLASSES.flatMap((code, index) => {
    const level = integer(rawFields[36 + index], `Spell ${id} ${code} level`)
    if (level < 0 || level > 255) throw new Error(`Spell ${id}: invalid class level`)
    return level >= 1 && level <= 254 ? [{ code, level }] : []
  })
  return {
    id, name, rank: rank?.[1] ?? null, layout, rawFields, fields, classes,
    effects: parseEffects(rawFields[172 + shift], id), messages: {}, description: '', rawDescription: '', category: '', subcategory: '',
    mana: n('mana'), beneficial: n('beneficialCode') !== 0, target: n('target'), range: n('range'), aeRange: n('aeRange'),
    castMs: n('castMs'), recoveryMs: n('recoveryMs'), recastMs: n('recastMs'), durationFormula: n('durationFormula'), durationCap: n('durationCap'), aoeDurationMs: n('aoeDurationMs')
  }
}

function enrichRecord(record: ClientSpellRecord, strings: Map<string, string>, names: Map<number, string>): void {
  const fields = record.fields
  record.category = strings.get(`${String(fields.categoryId)}:5`) ?? ''
  record.subcategory = strings.get(`${String(fields.subcategoryId)}:5`) ?? ''
  const preferred = strings.get(`${String(fields.descriptionId)}:6`)
  record.rawDescription = preferred?.length ? preferred : strings.get(`${record.id}:6`) ?? ''
  record.description = resolveDescription(record.rawDescription, record)
  enrichNames(record, strings)
  for (const effect of record.effects) fields[`effect${effect.slot}`] = describeEffect(effect, record, names)
  const recourse = Number(fields.recourse)
  fields.recourseName = recourse > 0 ? names.get(recourse) ?? '' : ''
}

function enrichNames(record: ClientSpellRecord, strings: Map<string, string>): void {
  const fields = record.fields
  fields.displayName = strings.get(`${String(fields.displayNameId)}:27`) ?? ''
  fields.skillName = SKILL_NAMES[Number(fields.skill)] ?? `skill ${String(fields.skill)}`
  fields.resistName = RESIST_NAMES[Number(fields.resist)] ?? `resist ${String(fields.resist)}`
  fields.targetName = TARGET_NAMES[record.target] ?? `target type ${record.target}`
  fields.typeName = ['detrimental', 'beneficial', 'beneficial, group only'][Number(fields.beneficialCode)] ?? String(fields.beneficialCode)
  fields.durationText = durationText(record.durationFormula, record.durationCap)
}

export function parseClientSpellBundle(sources: Record<SpellSourceFile, string>): ClientSpellRecord[] {
  const messages = parseMessages(sources['spells_us_str.txt'])
  const strings = parseStrings(sources['dbstr_us.txt'])
  const records = sourceLines(sources['spells_us.txt'], 'spells_us.txt').map(parseRecord)
  const names = new Map<number, string>()
  for (const record of records) {
    if (names.has(record.id)) throw new Error(`spells_us.txt: duplicate spell ID ${record.id}`)
    names.set(record.id, record.name)
  }
  for (const record of records) {
    record.messages = messages.get(record.id) ?? {}
    enrichRecord(record, strings, names)
  }
  return records
}
