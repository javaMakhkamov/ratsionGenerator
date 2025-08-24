import { CategoryKey, Feed, Ratios } from "./types";

// Validierung der Futtermitteldaten
function validateFeed(feed: Feed): boolean {
  return (
    Boolean(feed.feed_name) &&
    feed.energy_me >= 0 &&
    feed.energy_nel_kg >= 0 &&
    feed.protein_kg >= 0 &&
    feed.protein_kg <= 1 &&
    feed.ts_kg > 0 &&
    feed.ts_kg <= 1 &&
    ['roughage', 'energy', 'protein'].includes(feed.class)
  );
}

// Validierung der Kategorieverhältnisse
function validateRatios(ratios: Ratios): boolean {
  const total = ratios.roughage + ratios.energy + ratios.protein;
  return Math.abs(total - 100) < 0.1; // Toleranz von 0.1%
}

export const CLASS_RATIOS: Record<
  | "sut_sigirlar"
  | "tinim_sigirlar"
  | "buqalar_yetuk"
  | "buzoqlar_1_6",
  Ratios
> = {
  sut_sigirlar: { roughage: 50, energy: 30, protein: 20, note: "Ko'p sut bo'lsa energiyani 35% ga chiqaring, pichanni kamaytirmang." },
  tinim_sigirlar: { roughage: 70, energy: 20, protein: 10, note: "Tug'ishga 3–4 hafta qolganda 60/25/15 qiling; tuz va mineralni har kuni bering." },
  buqalar_yetuk: { roughage: 65, energy: 20, protein: 15, note: "Semirib ketsa energiyani 15% ga tushiring, pichanni ko'paytiring." },
  buzoqlar_1_6: { roughage: 25, energy: 55, protein: 20, note: "O'sish uchun mos; doim mineral aralashma qo'shing." },
};

// Validiere alle Verhältnisse
Object.entries(CLASS_RATIOS).forEach(([key, ratios]) => {
  if (!validateRatios(ratios)) {
    console.warn(`Invalid ratios for ${key}: ${ratios.roughage}% + ${ratios.energy}% + ${ratios.protein}% = ${ratios.roughage + ratios.energy + ratios.protein}%`);
  }
});

// Buqalar_yetuk uchun ME/CP jadvali — eng yaqin vazn qatori olinadi
// Bu jadval faqat "buqalar_yetuk" toifasi uchun ishlatiladi
export const BUQALAR_YETUK_TABLE: Array<{ weight_kg: number; energy_me: number; protein_g: number }> = [
  { weight_kg: 125, energy_me: 45, protein_g: 610 },
  { weight_kg: 175, energy_me: 50, protein_g: 750 },
  { weight_kg: 225, energy_me: 60, protein_g: 850 },
  { weight_kg: 275, energy_me: 68, protein_g: 920 },
  { weight_kg: 325, energy_me: 75, protein_g: 980 },
  { weight_kg: 375, energy_me: 83, protein_g: 1050 },
  { weight_kg: 425, energy_me: 87, protein_g: 1050 },
  { weight_kg: 475, energy_me: 91, protein_g: 1050 },
  { weight_kg: 525, energy_me: 95, protein_g: 1070 },
  { weight_kg: 575, energy_me: 101, protein_g: 1100 },
  { weight_kg: 625, energy_me: 105, protein_g: 1150 },
  { weight_kg: 675, energy_me: 110, protein_g: 1200 },
  { weight_kg: 725, energy_me: 115, protein_g: 1200 },
];

// Validiere Buqalar-Yetuk-Tabelle
BUQALAR_YETUK_TABLE.forEach((row, index) => {
  if (row.weight_kg <= 0 || row.energy_me <= 0 || row.protein_g <= 0) {
    console.warn(`Invalid row ${index} in BUQALAR_YETUK_TABLE:`, row);
  }
});

// Validiere, dass Gewichte aufsteigend sortiert sind
for (let i = 1; i < BUQALAR_YETUK_TABLE.length; i++) {
  if (BUQALAR_YETUK_TABLE[i].weight_kg <= BUQALAR_YETUK_TABLE[i-1].weight_kg) {
    console.warn(`BUQALAR_YETUK_TABLE not properly sorted at index ${i}`);
  }
}

export const FEEDS: Feed[] = [
  { feed_name: "Bug'doy somoni", energy_me: 6.13, energy_nel_kg: 3.5, protein_kg: 0.04, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Arpa somoni", energy_me: 6.13, energy_nel_kg: 3.5, protein_kg: 0.04, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Sholi somoni", energy_me: 5.25, energy_nel_kg: 3.0, protein_kg: 0.035, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Makka poyasi", energy_me: 7.00, energy_nel_kg: 4.0, protein_kg: 0.06, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Beda", energy_me: 8.75, energy_nel_kg: 5.0, protein_kg: 0.15, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Yantoq", energy_me: 8.75, energy_nel_kg: 5.0, protein_kg: 0.10, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Suv chiqadi va donli", energy_me: 9.60, energy_nel_kg: 6.0, protein_kg: 0.08, ts_kg: 0.30, class: "roughage" },
  { feed_name: "Suv chiqadi va donsiz", energy_me: 7.20, energy_nel_kg: 4.5, protein_kg: 0.08, ts_kg: 0.30, class: "roughage" },
  { feed_name: "Kaftim nam bo'ladi va donli", energy_me: 10.08, energy_nel_kg: 6.3, protein_kg: 0.075, ts_kg: 0.36, class: "roughage" },
  { feed_name: "Kaftim nam bo'ladi va donsiz", energy_me: 7.20, energy_nel_kg: 4.5, protein_kg: 0.075, ts_kg: 0.36, class: "roughage" },
  { feed_name: "Quruq va donli", energy_me: 10.08, energy_nel_kg: 6.3, protein_kg: 0.07, ts_kg: 0.4, class: "roughage" },
  { feed_name: "Quruq va donsiz", energy_me: 7.2, energy_nel_kg: 4.5, protein_kg: 0.07, ts_kg: 0.4, class: "roughage" },
  { feed_name: "Loviya poyasi", energy_me: 7.00, energy_nel_kg: 4.0, protein_kg: 0.12, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Mosh poyasi", energy_me: 7.00, energy_nel_kg: 4.0, protein_kg: 0.12, ts_kg: 0.90, class: "roughage" },
  { feed_name: "G'o'za chanog'i", energy_me: 5.25, energy_nel_kg: 3.0, protein_kg: 0.10, ts_kg: 0.90, class: "roughage" },
  { feed_name: "Makkajo'xori doni", energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
  { feed_name: "Arpa doni", energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.11, ts_kg: 0.90, class: "energy" },
  { feed_name: "Bug'doy doni", energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.12, ts_kg: 0.90, class: "energy" },
  { feed_name: "Tritikali doni", energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
  { feed_name: "Jo'xori doni", energy_me: 11.13, energy_nel_kg: 7.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
  { feed_name: "Tariq doni", energy_me: 10.34, energy_nel_kg: 6.5, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
  { feed_name: "Sholi", energy_me: 12.402, energy_nel_kg: 7.8, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
  { feed_name: "Soya shroti", energy_me: 13.43, energy_nel_kg: 8.5, protein_kg: 0.45, ts_kg: 0.90, class: "protein" },
  { feed_name: "Raps shroti", energy_me: 11.376, energy_nel_kg: 7.2, protein_kg: 0.38, ts_kg: 0.90, class: "protein" },
  { feed_name: "Paxta shroti", energy_me: 10.27, energy_nel_kg: 6.5, protein_kg: 0.32, ts_kg: 0.90, class: "protein" },
  { feed_name: "Paxta kunjarasi", energy_me: 10.744, energy_nel_kg: 6.8, protein_kg: 0.25, ts_kg: 0.90, class: "protein" },
  { feed_name: "Zig'ir kunjarasi", energy_me: 10.744, energy_nel_kg: 6.8, protein_kg: 0.22, ts_kg: 0.90, class: "protein" },
  { feed_name: "Chigit", energy_me: 15.8, energy_nel_kg: 10.0, protein_kg: 0.20, ts_kg: 0.90, class: "protein" },
  { feed_name: "Bug'doy kepak", energy_me: 9.48, energy_nel_kg: 6.0, protein_kg: 0.16, ts_kg: 0.90, class: "protein" },
  { feed_name: "Soya kepak", energy_me: 9.48, energy_nel_kg: 6.0, protein_kg: 0.15, ts_kg: 0.90, class: "protein" },
  { feed_name: "Makkajo'xori kepak", energy_me: 10.27, energy_nel_kg: 6.5, protein_kg: 0.15, ts_kg: 0.90, class: "protein" },
];

// Validiere alle Futtermittel
FEEDS.forEach((feed, index) => {
  if (!validateFeed(feed)) {
    console.warn(`Invalid feed at index ${index}:`, feed);
  }
});

// Überprüfe Eindeutigkeit der Futtermittelnamen
const feedNames = FEEDS.map(f => f.feed_name);
const uniqueNames = new Set(feedNames);
if (feedNames.length !== uniqueNames.size) {
  console.warn("Duplicate feed names detected in FEEDS array");
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  sut_sigirlar: "Sut Sigiri",
  tinim_sigirlar: "Tinim davridagi Sigir",
  buqalar_yetuk: "Yetuk Buqa",
  buzoqlar_1_6: "Buzoq (1–6 oy)",
};

export const EXAMPLE_NORMS = {
  sut_sigirlar: [
    { w: 350, nel: 35, prot_g: 1100 },
    { w: 450, nel: 45, prot_g: 1300 },
    { w: 550, nel: 55, prot_g: 1500 },
    { w: 650, nel: 62, prot_g: 1650 },
  ],
  tinim_sigirlar: [
    { w: 150, nel: 62, prot_g: 900 },
    { w: 200, nel: 75, prot_g: 1050 },
    { w: 250, nel: 83, prot_g: 1110 },
    { w: 300, nel: 92, prot_g: 1200 },
    { w: 350, nel: 100, prot_g: 1250 },
    { w: 400, nel: 105, prot_g: 1260 },
    { w: 450, nel: 110, prot_g: 1260 },
    { w: 500, nel: 115, prot_g: 1280 },
    { w: 550, nel: 122, prot_g: 1300 },
    { w: 600, nel: 125, prot_g: 1310 },
    { w: 650, nel: 125, prot_g: 1310 },
    { w: 700, nel: 130, prot_g: 1350 },
  ],
  buzoqlar_1_6: [
    { w: 50, nel: 9, prot_g: 400 },
    { w: 100, nel: 14, prot_g: 600 },
    { w: 150, nel: 20, prot_g: 800 },
    { w: 200, nel: 26, prot_g: 1000 },
  ],
};

// Validiere alle Normtabellen
Object.entries(EXAMPLE_NORMS).forEach(([category, table]) => {
  if (!table || table.length === 0) {
    console.warn(`Empty norms table for category: ${category}`);
    return;
  }
  
  // Überprüfe, dass Gewichte aufsteigend sortiert sind
  for (let i = 1; i < table.length; i++) {
    if (table[i].w <= table[i-1].w) {
      console.warn(`Norms table for ${category} not properly sorted at index ${i}`);
    }
  }
  
  // Überprüfe, dass alle Werte positiv sind
  table.forEach((row, index) => {
    if (row.w <= 0 || row.nel <= 0 || row.prot_g <= 0) {
      console.warn(`Invalid row ${index} in ${category} norms:`, row);
    }
  });
});

// Hilfsfunktionen für bessere Datenvalidierung
export function getFeedsByClass(feedClass: string): Feed[] {
  return FEEDS.filter(f => f.class === feedClass);
}

export function getFeedByName(feedName: string): Feed | undefined {
  return FEEDS.find(f => f.feed_name === feedName);
}

export function validateCategory(category: string): category is CategoryKey {
  return Object.keys(CATEGORY_LABELS).includes(category);
}

