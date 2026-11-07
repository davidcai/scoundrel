export const expectedCardFiles = ['club', 'spade'].flatMap((suit) =>
  ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'].map(
    (rank) => `${suit}-${rank}.png`,
  ),
);
expectedCardFiles.push(
  ...['diamond', 'heart'].flatMap((suit) =>
    ['2', '3', '4', '5', '6', '7', '8', '9', '10'].map((rank) => `${suit}-${rank}.png`),
  ),
);
