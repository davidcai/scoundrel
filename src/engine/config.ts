/**
 * House-rule configuration for the Scoundrel rules engine.
 *
 * The three REQ-011 options are stored as a 3-bit mask written as one lowercase
 * hexadecimal digit (`config=0` through `config=7`), per the Phase 1 foundation
 * decisions recorded in docs/implementation-plan.md.
 */

/** Bit assignments for the rule-option mask. */
export const RULE_OPTION_BITS = {
  /** Bit 0: running away from consecutive rooms is allowed. */
  consecutiveEscapesAllowed: 1,
  /** Bit 1: healing potions per room are unlimited. */
  unlimitedPotions: 2,
  /** Bit 2: weapon degradation is off. */
  degradationOff: 4,
} as const;

export type RuleOptionName = keyof typeof RULE_OPTION_BITS;

/** A valid rule-option mask: an integer 0–7. */
export type RuleConfig = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Default play uses the rules.md rules: no optional rules are enabled. */
export const DEFAULT_RULE_CONFIG: RuleConfig = 0;

export interface RuleOptions {
  readonly consecutiveEscapesAllowed: boolean;
  readonly unlimitedPotions: boolean;
  readonly degradationOff: boolean;
}

export function isRuleConfig(value: number): value is RuleConfig {
  return Number.isInteger(value) && value >= 0 && value <= 7;
}

export function ruleOptions(config: RuleConfig): RuleOptions {
  return {
    consecutiveEscapesAllowed: (config & RULE_OPTION_BITS.consecutiveEscapesAllowed) !== 0,
    unlimitedPotions: (config & RULE_OPTION_BITS.unlimitedPotions) !== 0,
    degradationOff: (config & RULE_OPTION_BITS.degradationOff) !== 0,
  };
}

/** Parse a replay-link `config` value. Only one lowercase hex digit 0–7 is valid. */
export function parseRuleConfig(value: string): RuleConfig | null {
  if (!/^[0-7]$/.test(value)) return null;
  return Number(value) as RuleConfig;
}

/** Format a mask for a replay link: one lowercase hexadecimal digit. */
export function formatRuleConfig(config: RuleConfig): string {
  return config.toString(16);
}
