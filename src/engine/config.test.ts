import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  RULE_OPTION_BITS,
  formatRuleConfig,
  isRuleConfig,
  parseRuleConfig,
  ruleOptions,
  type RuleConfig,
} from './index';

describe('rule-option mask', () => {
  it('uses the documented bit assignments', () => {
    expect(RULE_OPTION_BITS.consecutiveEscapesAllowed).toBe(1);
    expect(RULE_OPTION_BITS.unlimitedPotions).toBe(2);
    expect(RULE_OPTION_BITS.degradationOff).toBe(4);
  });

  it('defaults to rules.md gameplay with no optional rules', () => {
    expect(DEFAULT_RULE_CONFIG).toBe(0);
    expect(ruleOptions(0)).toEqual({
      consecutiveEscapesAllowed: false,
      unlimitedPotions: false,
      degradationOff: false,
    });
  });

  it('decodes each option independently and together', () => {
    expect(ruleOptions(1)).toEqual({
      consecutiveEscapesAllowed: true,
      unlimitedPotions: false,
      degradationOff: false,
    });
    expect(ruleOptions(2)).toEqual({
      consecutiveEscapesAllowed: false,
      unlimitedPotions: true,
      degradationOff: false,
    });
    expect(ruleOptions(4)).toEqual({
      consecutiveEscapesAllowed: false,
      unlimitedPotions: false,
      degradationOff: true,
    });
    expect(ruleOptions(7)).toEqual({
      consecutiveEscapesAllowed: true,
      unlimitedPotions: true,
      degradationOff: true,
    });
    expect(ruleOptions(5)).toEqual({
      consecutiveEscapesAllowed: true,
      unlimitedPotions: false,
      degradationOff: true,
    });
  });

  it('round-trips every valid mask through the one-digit hex replay format', () => {
    for (let mask = 0; mask <= 7; mask += 1) {
      const config = mask as RuleConfig;
      expect(formatRuleConfig(config)).toBe(mask.toString(16));
      expect(parseRuleConfig(formatRuleConfig(config))).toBe(config);
    }
  });

  it('rejects invalid replay-link masks', () => {
    for (const value of ['', '8', '9', 'a', 'f', '00', ' 1', '1 ', '-1', '0x1', '10']) {
      expect(parseRuleConfig(value)).toBeNull();
    }
    for (const value of [-1, 1.5, 8, 16, NaN]) {
      expect(isRuleConfig(value)).toBe(false);
    }
  });
});
