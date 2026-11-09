// Spoken-set vocabulary. English for v0.1; add a language by adding entries here, the parser has no words of its own.

/** Load units: word -> kilograms per unit. */
export const LOAD_UNITS: Record<string, number> = {
  kg: 1,
  kgs: 1,
  kilo: 1,
  kilos: 1,
  kilogram: 1,
  kilograms: 1,
  lb: 0.45359237,
  lbs: 0.45359237,
  pound: 0.45359237,
  pounds: 0.45359237,
};

export const KEYWORDS = {
  reps: ["rep", "reps", "repetition", "repetitions", "time", "times"],
  rpe: ["rpe", "effort"],
  same: ["same", "again", "repeat"],
} as const;

export const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
export const DECIMAL_WORDS = ["point", "dot"];
export const HUNDRED_WORDS = ["hundred"];
