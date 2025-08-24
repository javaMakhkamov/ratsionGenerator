import { BUQALAR_YETUK_TABLE, CLASS_RATIOS } from "./data";
import { CategoryKey, DistributionItem, Feed, FeedClass, NormPoint, Ratios, UserFeedAmount } from "./types";

// Sichere Division mit Fallback
function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

// Verbesserte Interpolation mit Validierung
export function interpolate(table: NormPoint[], w: number): NormPoint {
  if (!table || table.length === 0) {
    throw new Error("Interpolation table is empty");
  }
  
  // Sortiere Tabelle nach Gewicht
  const sortedTable = [...table].sort((a, b) => a.w - b.w);
  
  // Grenzfälle
  if (w <= sortedTable[0].w) return { ...sortedTable[0] };
  if (w >= sortedTable[sortedTable.length - 1].w) {
    return { ...sortedTable[sortedTable.length - 1] };
  }
  
  // Binäre Suche für Intervall
  let lo = 0, hi = sortedTable.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (w < sortedTable[mid].w) hi = mid; 
    else lo = mid;
  }
  
  const a = sortedTable[lo], b = sortedTable[hi];
  if (a.w === b.w) return { ...a };
  
  // Lineare Interpolation
  const t = (w - a.w) / (b.w - a.w);
  const t_clamped = Math.max(0, Math.min(1, t)); // Sicherheitsgrenzen
  
  return {
    w,
    nel: a.nel + t_clamped * (b.nel - a.nel),
    prot_g: a.prot_g + t_clamped * (b.prot_g - a.prot_g)
  };
}

// Verbesserte Buqalar-Yetuk-Tabelle-Suche
export function nearestBullRow(w: number) {
  if (!BUQALAR_YETUK_TABLE || BUQALAR_YETUK_TABLE.length === 0) {
    throw new Error("Buqalar yetuk table is empty");
  }
  
  // Grenzfälle
  if (w <= BUQALAR_YETUK_TABLE[0].weight_kg) {
    return { ...BUQALAR_YETUK_TABLE[0] };
  }
  if (w >= BUQALAR_YETUK_TABLE[BUQALAR_YETUK_TABLE.length - 1].weight_kg) {
    return { ...BUQALAR_YETUK_TABLE[BUQALAR_YETUK_TABLE.length - 1] };
  }
  
  // Binäre Suche
  let lo = 0, hi = BUQALAR_YETUK_TABLE.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midW = BUQALAR_YETUK_TABLE[mid].weight_kg;
    if (midW === w) return { ...BUQALAR_YETUK_TABLE[mid] };
    if (midW < w) lo = mid + 1; 
    else hi = mid - 1;
  }
  
  // Nächste Zeile finden
  if (lo >= BUQALAR_YETUK_TABLE.length) {
    return { ...BUQALAR_YETUK_TABLE[BUQALAR_YETUK_TABLE.length - 1] };
  }
  if (hi < 0) {
    return { ...BUQALAR_YETUK_TABLE[0] };
  }
  
  const lower = BUQALAR_YETUK_TABLE[hi];
  const upper = BUQALAR_YETUK_TABLE[lo];
  
  // Nächste Zeile basierend auf Gewichtsdifferenz
  return Math.abs(lower.weight_kg - w) <= Math.abs(upper.weight_kg - w) 
    ? { ...lower } 
    : { ...upper };
}

// Verbesserte DM-Berechnung pro Kategorie
export function dmMaxByCategory(cat: CategoryKey, bw: number): number {
  if (bw <= 0 || !Number.isFinite(bw)) return 0;
  
  const pct =
    cat === "sut_sigirlar" ? 0.028 :
    cat === "tinim_sigirlar" ? 0.020 :
    cat === "buqalar_yetuk" ? 0.022 :
    0.025; // buzoqlar_1_6
  
  const result = bw * pct;
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}

// Verbesserte DM-Metriken mit Validierung
export const dmMetrics = (avg: { nel: number; prot_perkg: number; ts_perkg: number }) => {
  const nelPerKgDM = safeDivide(avg.nel, avg.ts_perkg, 0);
  const cpFracDM = safeDivide(avg.prot_perkg, avg.ts_perkg, 0);
  
  return { 
    nelPerKgDM: Math.max(0, nelPerKgDM), 
    cpPctDM: Math.max(0, cpFracDM * 100) 
  };
};

// Verbesserte Rundung mit Validierung
export const roundFeed = (kg: number): number => {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.max(0.1, Math.round(kg * 10) / 10);
};

// Sichere Prozentberechnung pro Kategorie
export const percentsByCategory = (cat: CategoryKey): Ratios => {
  const ratios = CLASS_RATIOS[cat];
  if (!ratios) {
    throw new Error(`Unknown category: ${cat}`);
  }
  
  // Validiere, dass Summe = 100%
  const total = ratios.roughage + ratios.energy + ratios.protein;
  if (Math.abs(total - 100) > 0.1) {
    console.warn(`Category ${cat} percentages don't sum to 100%: ${total}%`);
  }
  
  return { ...ratios };
};

// Verbesserte Gruppierung mit Validierung
export function groupFeedsByClass(selectedFeeds: Feed[]): Record<FeedClass, Feed[]> {
  if (!selectedFeeds || selectedFeeds.length === 0) {
    return { roughage: [], energy: [], protein: [] };
  }
  
  const groups: Record<FeedClass, Feed[]> = { 
    roughage: [], 
    energy: [], 
    protein: [] 
  };
  
  selectedFeeds.forEach(f => {
    if (f && f.class && groups[f.class]) {
      groups[f.class].push(f);
    }
  });
  
  return groups;
}

// Vollständig überarbeitete Verteilungsfunktion
export function buildDistribution(
  selectedFeeds: Feed[],
  classPercents: Ratios,
  normsBasis: "ME" | "NeL",
  effectiveTotal: number,
  userFeedAmounts: UserFeedAmount[] = []
): {
  perClassKg: Record<FeedClass, number>;
  perFeed: DistributionItem[];
  dmTotal: number;
} {
  // Validierung der Eingabeparameter
  if (!effectiveTotal || effectiveTotal <= 0 || !selectedFeeds || selectedFeeds.length === 0) {
    return {
      perClassKg: { roughage: 0, energy: 0, protein: 0 },
      perFeed: [],
      dmTotal: 0,
    };
  }

  const perFeed: DistributionItem[] = [];
  
  // 1. Benutzerdefinierte Mengen verarbeiten
  let userDefinedTotal = 0;
  const userDefinedByClass: Record<FeedClass, number> = { 
    roughage: 0, 
    energy: 0, 
    protein: 0 
  };
  
  userFeedAmounts.forEach(userAmount => {
    if (!userAmount || userAmount.amount <= 0) return;
    
    const feed = selectedFeeds.find(f => f.feed_name === userAmount.feedName);
    if (feed && feed.ts_kg > 0) {
      const dm = userAmount.amount * feed.ts_kg;
      perFeed.push({
        name: feed.feed_name,
        cls: feed.class,
        kg: Math.round(userAmount.amount * 100) / 100,
        dm: Math.round(dm * 100) / 100,
        f: feed,
        isUserDefined: true
      });
      userDefinedTotal += userAmount.amount;
      userDefinedByClass[feed.class] += userAmount.amount;
    }
  });

  // 2. Wenn nur benutzerdefinierte Mengen vorhanden sind, verwende diese direkt
  if (userDefinedTotal >= effectiveTotal) {
    // Benutzerdefinierte Mengen decken den Bedarf vollständig ab
    const perClassKg = {
      roughage: perFeed.filter(p => p.cls === "roughage").reduce((sum, p) => sum + p.kg, 0),
      energy: perFeed.filter(p => p.cls === "energy").reduce((sum, p) => sum + p.kg, 0),
      protein: perFeed.filter(p => p.cls === "protein").reduce((sum, p) => sum + p.kg, 0),
    };
    
    const dmTotal = Math.round(perFeed.reduce((s, x) => s + x.dm, 0) * 100) / 100;
    
    return { 
      perClassKg, 
      perFeed: perFeed.sort((a, b) => a.name.localeCompare(b.name)), 
      dmTotal 
    };
  }

  // 3. Verbleibende Mengen basierend auf Klassenprozenten berechnen
  const remainingTotal = effectiveTotal - userDefinedTotal;
  
  if (remainingTotal > 0) {
    const remainingByClass = {
      roughage: Math.max(0, (classPercents.roughage / 100) * effectiveTotal - userDefinedByClass.roughage),
      energy: Math.max(0, (classPercents.energy / 100) * effectiveTotal - userDefinedByClass.energy),
      protein: Math.max(0, (classPercents.protein / 100) * effectiveTotal - userDefinedByClass.protein),
    };

    const groups = groupFeedsByClass(selectedFeeds);
    
    // Gewichtungsfunktionen für jede Klasse
    const weightByClass: Record<FeedClass, (f: Feed) => number> = {
      roughage: (f) => Math.max(0.1, f.ts_kg), // Mindestgewicht für Stabilität
      energy: (f) => Math.max(0.1, normsBasis === "ME" ? f.energy_me : f.energy_nel_kg),
      protein: (f) => Math.max(0.1, f.protein_kg),
    };

    // Verteilung der verbleibenden Mengen
    (Object.keys(groups) as FeedClass[]).forEach((cls) => {
      const arr = groups[cls];
      if (arr.length === 0 || remainingByClass[cls] <= 0) return;
      
      // Verfügbare Futtermittel (ohne benutzerdefinierte Mengen)
      const availableFeeds = arr.filter(f => 
        !userFeedAmounts.some(ufa => ufa.feedName === f.feed_name)
      );
      if (availableFeeds.length === 0) return;
      
      // Gewichte berechnen
      const weights = availableFeeds.map(weightByClass[cls]);
      const sumW = weights.reduce((a, b) => a + b, 0);
      
      if (sumW <= 0) return;
      
      // Anteile berechnen und verteilen
      availableFeeds.forEach((f, i) => {
        const shareAsFed = safeDivide(
          (weights[i] / sumW) * remainingByClass[cls], 
          1, 
          0
        );
        
        if (shareAsFed > 0) {
          const dm = shareAsFed * f.ts_kg;
          perFeed.push({
            name: f.feed_name,
            cls,
            kg: Math.round(shareAsFed * 100) / 100,
            dm: Math.round(dm * 100) / 100,
            f,
            isUserDefined: false
          });
        }
      });
    });
  }

  // 4. Zusammenfassung berechnen
  const perClassKg = {
    roughage: perFeed.filter(p => p.cls === "roughage").reduce((sum, p) => sum + p.kg, 0),
    energy: perFeed.filter(p => p.cls === "energy").reduce((sum, p) => sum + p.kg, 0),
    protein: perFeed.filter(p => p.cls === "protein").reduce((sum, p) => sum + p.kg, 0),
  };

  const dmTotal = Math.round(perFeed.reduce((s, x) => s + x.dm, 0) * 100) / 100;
  
  return { 
    perClassKg, 
    perFeed: perFeed.sort((a, b) => a.name.localeCompare(b.name)), 
    dmTotal 
  };
}