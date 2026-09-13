import { create } from 'zustand';
import { cardKind, cardRank, cardSuit, cardValue, type CardId, type CardKind } from './engine';
import {
  loadLanguageSetting,
  resolveLanguage,
  saveLanguage,
  type Language,
  type LanguageSetting,
} from './store/settings';

/**
 * Minimal i18n layer: flat message dictionaries with `{name}` interpolation,
 * a tiny zustand store for the active language, and localized card labels.
 * UI components subscribe via `useT()`; non-React code (announcements) uses `t()`.
 */

const en = {
  // Title screen
  tagline: 'A lone scoundrel. A deck of cards. One way out.',
  mainMenu: 'Main menu',
  continueRun: 'Continue run ({seed})',
  newRun: 'New run',
  enterSeed: 'Enter seed',
  seedFromFriend: 'Seed from a friend',
  seedPlaceholder: 'e.g. 1a2b3c',
  playSeed: 'Play seed',
  stats: 'Stats',
  settings: 'Settings',
  about: 'About',
  backToTitle: '← Title',

  // Play screen
  noRunTitle: 'No run in progress',
  noRunHint: 'Start a new run from the title screen, or open a shared replay link.',
  finalBannerStart: 'The final room — resolve',
  finalBannerEvery: 'every',
  finalBannerEnd: 'card to win.',
  currentRoom: 'Current room',
  carrySingle: 'This card will carry over to the next room.',
  carryNone: 'No card will carry over — clear them all.',
  carryDefault: 'Choose a card, then resolve it. One card will carry over.',
  undoToRoomStart: 'Undo to room start',
  runAway: 'Run away',
  enterNextRoom: 'Enter next room →',
  reallyAbandon: 'Really abandon?',
  abandonRun: 'Abandon run',
  tooltipUndo:
    'Rewind the current room to the moment it was dealt — health, weapon, kill stack and potions reset. The snapshot is cleared once you enter the next room.',
  tooltipRunLegal: 'Send all four cards to the bottom of the dungeon and deal a fresh room.',
  tooltipRunTwice: 'You cannot run from two rooms in a row.',
  tooltipRunFinal: 'This is the final room — fleeing would just re-deal the same cards.',
  tooltipRunEngaged: 'You already engaged this room.',
  tooltipCarry: 'Resolve 3 of the 4 cards, then carry the remaining one into the next room.',

  // Action panel
  actionsFor: 'Actions for {label}',
  carryNote:
    'The other 3 cards of this room are resolved — this card carries over to the next room.',
  cancel: 'Cancel',
  fightWith: 'Fight with {weapon} — take {damage} damage',
  fightBarehanded: 'Fight barehanded — take {damage} damage',
  weaponCannot:
    'Your {weapon} cannot fight the {monster} — it only defeats monsters weaker than its last kill.',
  weaponCannotWith:
    'Your {weapon} cannot fight the {monster} — it only defeats monsters weaker than its last kill (the {last}).',
  noWeapon: 'weapon',
  drinkWasted: 'Drink potion — wasted (one potion per room, restores nothing)',
  drinkHeal: 'Drink potion — restore {heal} health',
  potionWastedNote:
    'You already drank a potion this room; a second one is discarded with no effect.',
  potionNote: 'Only the first potion each room heals you.',
  equip: 'Equip {label}',
  equipFresh: 'Equip {label} as your weapon.',
  equipSwap: 'Equipping {label} discards your {old} and its {kills} slain monsters.',

  // HUD
  gameStatus: 'Game status',
  health: 'Health',
  currentHealth: 'Current health',
  dungeon: 'Dungeon',
  cardsLeft: '{count} cards',
  room: 'Room',
  roomFinal: '{turn} · final',
  roomResolved: '{turn} · {resolved}/{target} resolved',
  potion: 'Potion',
  potionUsed: 'used this room',
  potionAvailable: 'available',
  ready: 'ready',
  blocked: 'blocked',
  seed: 'Seed',
  tooltipRunAwayHud:
    'You may run away once per turn — never from two rooms in a row, never from a room you have engaged, and never from the final room.',
  tooltipSeed:
    'The seed uniquely determines this dungeon. Share it to challenge a friend with the same run.',

  // Weapon zone
  weaponZone: 'Weapon',
  weaponZoneStack: 'Weapon and slain monsters',
  weaponEmpty: 'No weapon equipped — fighting is barehanded and painful.',
  thresholdOff: 'Weapon degradation is off: this weapon can fight any monster.',
  thresholdFresh:
    'This weapon is fresh — it can fight any monster. After each kill it can only fight weaker monsters than the last one it killed.',
  thresholdValue:
    'After a kill, a weapon can only fight monsters weaker than the last monster it killed. This weapon can fight monsters up to {threshold}.',
  fightsAny: 'Fights any monster',
  fightsUpTo: 'Fights monsters up to {threshold} — last kill: {last}',
  slainMonsters: 'Slain monsters',
  slainAria: 'Slain monsters, last kill on top',
  lastKillBadge: 'Last kill',
  noKillsFresh: 'No kills yet — {weapon} is fresh.',
  noKillsNoWeapon: 'No kills yet — no weapon.',

  // Card view
  carriedBadge: 'Carried',
  carriedAria: ', carried from the previous room',

  // Game over
  victory: 'Victory',
  defeat: 'Defeat',
  victorySub: 'You clear every room of the dungeon.',
  defeatSub: 'You fall in the dark. The dungeon claims another scoundrel.',
  score: 'Score',
  finalHealth: 'Final health',
  toggles: 'Toggles',
  monstersKilled: 'Monsters killed',
  potionsWasted: 'Potions wasted',
  roomsExplored: 'Rooms explored',
  copyLink: 'Copy replay link',
  linkCopied: 'Replay link copied!',
  playAgain: 'Play again',
  returnTitle: 'Return to title',
  configRunOnce: 'run away: once',
  configRunUnlimited: 'run away: unlimited',
  configPotionOne: 'potions: 1/room',
  configPotionUnlimited: 'potions: unlimited',
  configDegOn: 'degradation: on',
  configDegOff: 'degradation: off',

  // Stats
  gamesPlayed: 'Games played',
  wins: 'Wins',
  losses: 'Losses',
  winRate: 'Win rate',
  bestScore: 'Best score',
  currentStreak: 'Current streak',
  bestStreak: 'Best streak',
  runHistory: 'Run history',
  runHistoryAria: 'Run history, newest first',
  noRuns: 'No runs yet — go clear a dungeon.',
  win: 'Win',
  loss: 'Loss',
  scoreOf: 'Score {score}',
  roomsCount: '{rooms} rooms',
  replay: 'Replay',

  // Settings
  settingsIntro:
    'House-rule toggles. Defaults follow the official rule set. Changes apply to new runs.',
  languageLabel: 'Language',
  languageAuto: 'Auto (browser language)',
  toggleRunLabel: 'Run-away restriction',
  toggleRunDesc: 'On: you cannot run from two rooms in a row. Off: run away as often as you like.',
  togglePotionLabel: 'One potion per room',
  togglePotionDesc:
    'On: only the first potion each room heals; extras are discarded. Off: every potion heals.',
  toggleDegLabel: 'Weapon degradation',
  toggleDegDesc:
    'On: a weapon can only fight monsters weaker than the last monster it killed. Off: weapons never degrade.',

  // About
  aboutTitle: 'About Scoundrel',
  rulesBrief: 'The rules in brief',
  termMonsters: 'Monsters',
  restMonsters: ' (♣ ♠) hit for their value.',
  termWeapons: 'Weapons',
  restWeapons: " (♦) block damage: you take the monster's value minus the weapon's.",
  termPotions: 'Potions',
  restPotions: ' (♥) restore their value, capped at 20 health.',
  ruleRooms: 'Each room deals 4 cards; you must resolve 3. The 4th carries over to the next room.',
  ruleDegradation:
    'After a weapon kills a monster it can only fight weaker monsters. Picking up a new weapon discards the old one and its kill stack.',
  rulePotion: 'Only the first potion you drink in a room heals you.',
  ruleRunAway:
    'Once per turn you may run away: all four cards sink to the bottom of the dungeon and a fresh room is dealt — but never twice in a row.',
  ruleWin:
    "Clear every room to win. Your score is your remaining health; die and it's zero minus the monsters still lurking in the deck.",
  credits: 'Credits & links',
  creditsText:
    'Scoundrel was designed by Zach Gage and Kurt Bieg. This is a browser implementation of the original one-player roguelike.',
  linkRulebook: 'Original rule book (PDF)',
  linkAnnotated: 'rpdillon.net — annotated rules',

  // Announcements
  announceRunStarted: 'A new run begins. Seed {seed}.',
  announceFinalRoom: 'The final room appears. Resolve every card to win!',
  announceRoomCarried: 'A new room appears. {card} carried over from the last room.',
  announceRoom: 'A new room appears.',
  slainWeaponDamage: 'You slay the {card} with your {weapon}, taking {damage} damage.',
  slainBareDamage: 'You slay the {card} barehanded, taking {damage} damage.',
  slainWeaponClean: 'You slay the {card} with your {weapon} without a scratch.',
  slainBareClean: 'You slay the {card} barehanded without a scratch.',
  announceEquipDiscard: 'Your old weapon and {count} slain monsters are discarded.',
  announceEquip: 'You equip the {card}.',
  announcePotionWasted: 'You drink the {card}, but it restores nothing.',
  announcePotionHeal: 'You drink the {card} and recover {healed} health.',
  announceRanAway: 'You flee the room. The cards sink to the bottom of the dungeon.',
  announceRunBlocked: 'You cannot run away: {reason}.',
  announceUndo: 'The room rewinds to its start.',
  announceInvalid: 'That action is not allowed: {reason}.',
  announceGameWon: 'Victory! You clear the dungeon with {score} health remaining.',
  announceGameLost: 'You are defeated. Final score {score}.',
  blockTwice: 'you cannot run from two rooms in a row',
  blockFinalRoom: 'this is the final room',
  blockEngaged: 'you have already engaged this room',
  invalidGameOver: 'the run is over',
  invalidNotInRoom: 'that card is not in the room',
  invalidNotMonster: 'that card is not a monster',
  invalidNotWeapon: 'that card is not a weapon',
  invalidNotPotion: 'that card is not a health potion',
  invalidRoomComplete: 'enough cards are resolved — enter the next room',
  invalidWeaponTooWeak: 'your weapon can only fight weaker monsters',
  invalidNoSnapshot: 'there is nothing to undo',
  invalidNotDealt: 'no room has been dealt',
  invalidRoomActive: 'a room is already in progress',
  invalidRoomNotResolved: 'resolve 3 of the 4 cards first',
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  // Title screen
  tagline: '孤身一人的恶棍。一副纸牌。唯一的生路。',
  mainMenu: '主菜单',
  continueRun: '继续对局（{seed}）',
  newRun: '新开一局',
  enterSeed: '输入种子',
  seedFromFriend: '好友分享的种子',
  seedPlaceholder: '例如 1a2b3c',
  playSeed: '以此种子开始',
  stats: '统计',
  settings: '设置',
  about: '关于',
  backToTitle: '← 返回标题',

  // Play screen
  noRunTitle: '没有进行中的对局',
  noRunHint: '请从标题界面开始新对局，或打开分享的回放链接。',
  finalBannerStart: '最终房间——解决',
  finalBannerEvery: '所有',
  finalBannerEnd: '卡牌即可获胜。',
  currentRoom: '当前房间',
  carrySingle: '这张牌将带入下一个房间。',
  carryNone: '没有牌会带入下一个房间——把所有牌都解决掉。',
  carryDefault: '选择一张牌并解决它。有一张牌将带入下一个房间。',
  undoToRoomStart: '撤销至房间开始',
  runAway: '逃跑',
  enterNextRoom: '进入下一个房间 →',
  reallyAbandon: '确定要放弃吗？',
  abandonRun: '放弃对局',
  tooltipUndo:
    '把当前房间倒回发牌那一刻——生命、武器、击杀牌堆和药水全部重置。一旦进入下一个房间，快照即被清除。',
  tooltipRunLegal: '把四张牌都沉到地城底部，重新发一手新房间。',
  tooltipRunTwice: '不能连续两个房间逃跑。',
  tooltipRunFinal: '这是最终房间——逃跑只会重新发出同样的牌。',
  tooltipRunEngaged: '你已经与这个房间交手过了。',
  tooltipCarry: '解决4张牌中的3张，剩下的那张带入下一个房间。',

  // Action panel
  actionsFor: '{label}的可选操作',
  carryNote: '本房间的另外三张牌已解决——这张牌将带入下一个房间。',
  cancel: '取消',
  fightWith: '用{weapon}战斗——受到{damage}点伤害',
  fightBarehanded: '赤手空拳战斗——受到{damage}点伤害',
  weaponCannot: '你的{weapon}无法与{monster}战斗——它只能击败比上次击杀更弱的怪物。',
  weaponCannotWith: '你的{weapon}无法与{monster}战斗——它只能击败比上次击杀（{last}）更弱的怪物。',
  noWeapon: '武器',
  drinkWasted: '喝下药水——浪费了（每房间限一瓶，毫无效果）',
  drinkHeal: '喝下药水——恢复{heal}点生命',
  potionWastedNote: '本房间你已经喝过一瓶药水；第二瓶会被弃掉，毫无效果。',
  potionNote: '每个房间只有第一瓶药水能为你恢复生命。',
  equip: '装备{label}',
  equipFresh: '将{label}装备为你的武器。',
  equipSwap: '装备{label}会丢弃你的{old}及其击杀的{kills}只怪物。',

  // HUD
  gameStatus: '游戏状态',
  health: '生命',
  currentHealth: '当前生命',
  dungeon: '地城',
  cardsLeft: '剩余{count}张牌',
  room: '房间',
  roomFinal: '第{turn}手 · 最终',
  roomResolved: '第{turn}手 · 已解决 {resolved}/{target}',
  potion: '药水',
  potionUsed: '本房间已用',
  potionAvailable: '可用',
  ready: '可用',
  blocked: '受阻',
  seed: '种子',
  tooltipRunAwayHud: '每手可逃跑一次——不能连续两次、不能在已交手的房间、也不能在最终房间逃跑。',
  tooltipSeed: '种子唯一决定了这个地城。把它分享给朋友，即可挑战完全相同的对局。',

  // Weapon zone
  weaponZone: '武器',
  weaponZoneStack: '武器与已击杀的怪物',
  weaponEmpty: '未装备武器——只能赤手空拳战斗，且代价惨重。',
  thresholdOff: '武器磨损已关闭：这把武器可以对抗任何怪物。',
  thresholdFresh:
    '这把武器是全新的——可以对抗任何怪物。每次击杀后，它只能对抗比上次击杀的怪物更弱的怪物。',
  thresholdValue:
    '击杀后，武器只能对抗比上次击杀更弱的怪物。这把武器最多可对抗数值为{threshold}的怪物。',
  fightsAny: '可对抗任何怪物',
  fightsUpTo: '最多可对抗数值{threshold}的怪物——上次击杀：{last}',
  slainMonsters: '已击杀的怪物',
  slainAria: '已击杀的怪物，最近击杀在最上',
  lastKillBadge: '最近击杀',
  noKillsFresh: '还没有击杀——{weapon}状态完好。',
  noKillsNoWeapon: '还没有击杀——也没有武器。',

  // Card view
  carriedBadge: '带入',
  carriedAria: '，从上一个房间带入',

  // Game over
  victory: '胜利',
  defeat: '失败',
  victorySub: '你清空了地城的每一个房间。',
  defeatSub: '你倒在了黑暗中。地城又吞噬了一个恶棍。',
  score: '得分',
  finalHealth: '最终生命',
  toggles: '规则开关',
  monstersKilled: '击杀怪物',
  potionsWasted: '浪费的药水',
  roomsExplored: '探索的房间',
  copyLink: '复制回放链接',
  linkCopied: '回放链接已复制！',
  playAgain: '再来一局',
  returnTitle: '返回标题',
  configRunOnce: '逃跑：一次',
  configRunUnlimited: '逃跑：不限',
  configPotionOne: '药水：每房间1瓶',
  configPotionUnlimited: '药水：不限',
  configDegOn: '磨损：开',
  configDegOff: '磨损：关',

  // Stats
  gamesPlayed: '已玩局数',
  wins: '胜场',
  losses: '败场',
  winRate: '胜率',
  bestScore: '最佳得分',
  currentStreak: '当前连胜',
  bestStreak: '最长连胜',
  runHistory: '对局历史',
  runHistoryAria: '对局历史（最新在前）',
  noRuns: '还没有对局——去清空一座地城吧。',
  win: '胜',
  loss: '负',
  scoreOf: '得分 {score}',
  roomsCount: '{rooms}个房间',
  replay: '回放',

  // Settings
  settingsIntro: '房规开关。默认遵循官方规则。更改只对新对局生效。',
  languageLabel: '语言 Language',
  languageAuto: '自动（跟随浏览器）',
  toggleRunLabel: '逃跑限制',
  toggleRunDesc: '开：不能连续两个房间逃跑。关：想逃就逃。',
  togglePotionLabel: '每房间一瓶药水',
  togglePotionDesc: '开：每房间只有第一瓶药水有效，其余弃掉。关：每瓶都有效。',
  toggleDegLabel: '武器磨损',
  toggleDegDesc: '开：武器只能对抗比上次击杀更弱的怪物。关：武器永不磨损。',

  // About
  aboutTitle: '关于 Scoundrel',
  rulesBrief: '规则简介',
  termMonsters: '怪物',
  restMonsters: '（♣ ♠）造成等于其数值的伤害。',
  termWeapons: '武器',
  restWeapons: '（♦）抵消伤害：你受到的伤害为怪物数值减去武器数值。',
  termPotions: '药水',
  restPotions: '（♥）恢复等于其数值的生命，上限为20点。',
  ruleRooms: '每个房间发4张牌；必须解决其中3张。第4张带入下一个房间。',
  ruleDegradation: '武器击杀怪物后，只能对抗更弱的怪物。拾起新武器会丢弃旧武器及其击杀牌堆。',
  rulePotion: '每个房间喝下的第一瓶药水才会生效。',
  ruleRunAway: '每手可逃跑一次：四张牌沉到地城底部，重新发一手房间——但不能连续逃跑。',
  ruleWin: '清空所有房间即获胜。得分为剩余生命；死亡时得分为零减去牌堆中仍在潜伏的怪物总和。',
  credits: '制作与链接',
  creditsText: 'Scoundrel 由 Zach Gage 和 Kurt Bieg 设计。这是原版单人 Roguelike 的浏览器实现。',
  linkRulebook: '原版规则书（PDF）',
  linkAnnotated: 'rpdillon.net——注释版规则',

  // Announcements
  announceRunStarted: '新对局开始。种子 {seed}。',
  announceFinalRoom: '最终房间出现。解决所有牌即可获胜！',
  announceRoomCarried: '新房间出现。{card}从上一个房间带入。',
  announceRoom: '新房间出现。',
  slainWeaponDamage: '你用{weapon}击杀了{card}，受到{damage}点伤害。',
  slainBareDamage: '你赤手空拳击杀了{card}，受到{damage}点伤害。',
  slainWeaponClean: '你用{weapon}毫发无伤地击杀了{card}。',
  slainBareClean: '你赤手空拳毫发无伤地击杀了{card}。',
  announceEquipDiscard: '旧武器及其击杀的{count}只怪物被弃置。',
  announceEquip: '你装备了{card}。',
  announcePotionWasted: '你喝下了{card}，但它毫无效果。',
  announcePotionHeal: '你喝下了{card}，恢复了{healed}点生命。',
  announceRanAway: '你逃离了房间。这些牌沉到了地城底部。',
  announceRunBlocked: '你不能逃跑：{reason}。',
  announceUndo: '房间已倒回开始状态。',
  announceInvalid: '该操作不被允许：{reason}。',
  announceGameWon: '胜利！你以{score}点生命清空了地城。',
  announceGameLost: '你被击败了。最终得分{score}。',
  blockTwice: '不能连续两个房间逃跑',
  blockFinalRoom: '这是最终房间',
  blockEngaged: '你已经与这个房间交手',
  invalidGameOver: '对局已结束',
  invalidNotInRoom: '那张牌不在房间里',
  invalidNotMonster: '那张牌不是怪物',
  invalidNotWeapon: '那张牌不是武器',
  invalidNotPotion: '那张牌不是生命药水',
  invalidRoomComplete: '已解决足够的牌——进入下一个房间',
  invalidWeaponTooWeak: '你的武器只能对抗更弱的怪物',
  invalidNoSnapshot: '没有可撤销的操作',
  invalidNotDealt: '尚未发出房间',
  invalidRoomActive: '一个房间已在进行中',
  invalidRoomNotResolved: '请先解决4张牌中的3张',
};

const DICTS: Record<Language, Record<MessageKey, string>> = { en, zh };

/** Exposed for tests: per-language message tables. */
export const MESSAGES = DICTS;

interface LanguageStore {
  /** Resolved language actually rendered ('auto' resolves via detection). */
  lang: Language;
  /** Stored preference: 'auto' or the player's explicit choice. */
  setting: LanguageSetting;
  setLang: (setting: LanguageSetting) => void;
}

function htmlLang(lang: Language): string {
  return lang === 'zh' ? 'zh-CN' : 'en';
}

const initialSetting = loadLanguageSetting();
const initialLang = resolveLanguage(initialSetting);

export const useLanguage = create<LanguageStore>((set) => ({
  lang: initialLang,
  setting: initialSetting,
  setLang: (setting) => {
    saveLanguage(setting);
    const lang = resolveLanguage(setting);
    document.documentElement.lang = htmlLang(lang);
    set({ lang, setting });
  },
}));

// Keep <html lang> in sync on first load too.
document.documentElement.lang = htmlLang(initialLang);

export function currentLang(): Language {
  return useLanguage.getState().lang;
}

export function translate(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let message = DICTS[lang][key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}

export type TFunc = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Reactive hook: re-renders on language change. */
export function useT(): TFunc {
  const lang = useLanguage((s) => s.lang);
  return (key, params) => translate(lang, key, params);
}

/** Non-React accessor for store-layer code (announcements). */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(currentLang(), key, params);
}

const RANK_NAMES: Record<Language, Record<string, string>> = {
  en: { j: 'Jack', q: 'Queen', k: 'King', a: 'Ace' },
  zh: { j: 'J', q: 'Q', k: 'K', a: 'A' },
};

const SUIT_NAMES: Record<Language, Record<string, string>> = {
  en: { club: 'Clubs', diamond: 'Diamonds', heart: 'Hearts', spade: 'Spades' },
  zh: { club: '梅花', diamond: '方块', heart: '红心', spade: '黑桃' },
};

const KIND_NAMES: Record<Language, Record<CardKind, string>> = {
  en: { monster: 'monster', weapon: 'weapon', potion: 'potion' },
  zh: { monster: '怪物', weapon: '武器', potion: '药水' },
};

/** Localized card label, e.g. "8 of Clubs" / "梅花8". */
export function cardLabel(cardId: CardId): string {
  const lang = currentLang();
  const rank = RANK_NAMES[lang][cardRank(cardId)] ?? cardRank(cardId);
  const suit = SUIT_NAMES[lang][cardSuit(cardId)];
  return lang === 'zh' ? `${suit}${rank}` : `${rank} of ${suit}`;
}

/** Localized ARIA label, e.g. "8 of Clubs, monster, value 8" / "梅花8，怪物，数值8"。 */
export function cardAriaLabel(cardId: CardId): string {
  const lang = currentLang();
  if (lang === 'zh') {
    return `${cardLabel(cardId)}，${KIND_NAMES.zh[cardKind(cardId)]}，数值${cardValue(cardId)}`;
  }
  return `${cardLabel(cardId)}, ${cardKind(cardId)}, value ${cardValue(cardId)}`;
}
