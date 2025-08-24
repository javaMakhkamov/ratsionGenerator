"use client";

import { useMemo } from "react";
import { CATEGORY_LABELS, EXAMPLE_NORMS, FEEDS } from "./data";
import { buildDistribution, dmMaxByCategory, dmMetrics, interpolate, nearestBullRow, percentsByCategory } from "./utils";
import { CategoryKey, Feed, Ratios, UserFeedAmount } from "./types";

// Sichere Division mit Fallback
function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

// Validierung der Eingabeparameter
function validateInputs(category: CategoryKey, weight: number, milk: number): boolean {
  if (!category || weight <= 0 || !Number.isFinite(weight) || milk < 0 || !Number.isFinite(milk)) {
    return false;
  }
  return true;
}

export function useRationCalculations(
  category: CategoryKey,
  weight: number,
  milk: number,
  selected: string[],
  userFeedAmounts: UserFeedAmount[] = []
) {
  // Validierung der Eingabeparameter
  const isValid = validateInputs(category, weight, milk);
  
  const selectedFeeds = useMemo<Feed[]>(() => {
    if (!isValid || !selected || selected.length === 0) return [];
    return FEEDS.filter(f => selected.includes(f.feed_name));
  }, [isValid, selected]);

  // Verbesserte Durchschnittsberechnung mit Validierung
  const avg = useMemo(() => {
    if (selectedFeeds.length === 0) {
      return { me: 0, nel: 0, prot_perkg: 0, ts_perkg: 0 };
    }
    
    const n = selectedFeeds.length;
    const sum = selectedFeeds.reduce((acc, f) => ({
      me: acc.me + (Number.isFinite(f.energy_me) ? f.energy_me : 0),
      nel: acc.nel + (Number.isFinite(f.energy_nel_kg) ? f.energy_nel_kg : 0),
      prot_perkg: acc.prot_perkg + (Number.isFinite(f.protein_kg) ? f.protein_kg : 0),
      ts_perkg: acc.ts_perkg + (Number.isFinite(f.ts_kg) ? f.ts_kg : 0),
    }), { me: 0, nel: 0, prot_perkg: 0, ts_perkg: 0 });
    
    return {
      me: safeDivide(sum.me, n, 0),
      nel: safeDivide(sum.nel, n, 0),
      prot_perkg: safeDivide(sum.prot_perkg, n, 0),
      ts_perkg: safeDivide(sum.ts_perkg, n, 0)
    };
  }, [selectedFeeds]);

  // Verbesserte Normberechnung mit Fehlerbehandlung
  const norms = useMemo(() => {
    if (!isValid) {
      return { basis: "NeL" as const, energy_MJ: 0, protein_g: 0, note: "" };
    }
    
    try {
      if (category === "buqalar_yetuk") {
        const nearest = nearestBullRow(weight);
        return { 
          basis: "ME" as const, 
          energy_MJ: nearest.energy_me, 
          protein_g: nearest.protein_g, 
          note: percentsByCategory(category).note 
        };
      } else {
        const key = category as Exclude<CategoryKey, "buqalar_yetuk">;
        const table = EXAMPLE_NORMS[key];
        
        if (!table || table.length === 0) {
          throw new Error(`No norms table for category: ${category}`);
        }
        
        const row = interpolate(table, weight);
        const milkNeL = category === "sut_sigirlar" && milk > 0 ? milk * 3.2 : 0;
        
        return { 
          basis: "NeL" as const, 
          energy_MJ: row.nel + milkNeL, 
          protein_g: row.prot_g, 
          note: percentsByCategory(category).note 
        };
      }
    } catch (error) {
      console.error("Error calculating norms:", error);
      return { basis: "NeL" as const, energy_MJ: 0, protein_g: 0, note: "Xatolik yuz berdi" };
    }
  }, [isValid, category, weight, milk]);

  // Verbesserte Massenberechnung mit robusterer Logik
  const mass = useMemo(() => {
    if (!isValid || selectedFeeds.length === 0) {
      return { total: 0, limiting: "none" as const };
    }
    
    try {
      const energyPerKg = norms.basis === "ME" ? avg.me : avg.nel;
      const proteinPerKg = avg.prot_perkg;
      
      // Sichere Berechnung der Massen
      const mEnergy = energyPerKg > 0 
        ? safeDivide(norms.energy_MJ, energyPerKg, Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;
        
      const mProtein = proteinPerKg > 0 
        ? safeDivide(norms.protein_g / 1000, proteinPerKg, Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;
      
      // Bestimme den begrenzenden Faktor
      if (!Number.isFinite(mEnergy) && !Number.isFinite(mProtein)) {
        return { total: 0, limiting: "none" as const };
      }
      
      if (mEnergy >= mProtein) {
        return { total: mEnergy, limiting: "energy" as const };
      } else {
        return { total: mProtein, limiting: "protein" as const };
      }
    } catch (error) {
      console.error("Error calculating mass:", error);
      return { total: 0, limiting: "none" as const };
    }
  }, [isValid, selectedFeeds.length, norms, avg]);

  // Verbesserte DM-Berechnungen
  const dmMax = useMemo(() => {
    if (!isValid) return 0;
    try {
      return dmMaxByCategory(category, weight);
    } catch (error) {
      console.error("Error calculating DM max:", error);
      return 0;
    }
  }, [isValid, category, weight]);
  
  const asFedMax = useMemo(() => {
    if (dmMax <= 0 || avg.ts_perkg <= 0) return Number.POSITIVE_INFINITY;
    return safeDivide(dmMax, avg.ts_perkg, Number.POSITIVE_INFINITY);
  }, [dmMax, avg.ts_perkg]);
  
  const effectiveTotal = useMemo(() => {
    if (!mass.total || mass.total <= 0) return 0;
    
    // Berechne die Summe der benutzerdefinierten Mengen
    const userDefinedTotal = userFeedAmounts.reduce((sum, ufa) => sum + ufa.amount, 0);
    
    // Wenn benutzerdefinierte Mengen vorhanden sind, verwende diese als Basis
    if (userDefinedTotal > 0) {
      // Verwende den größeren Wert: benutzerdefinierte Mengen oder berechnete Masse
      const baseTotal = Math.max(userDefinedTotal, mass.total);
      return Math.min(baseTotal, asFedMax);
    }
    
    // Standardfall: verwende die berechnete Masse
    return Math.min(mass.total, asFedMax);
  }, [mass.total, asFedMax, userFeedAmounts]);
  
  const coverage = useMemo(() => {
    if (!mass.total || mass.total <= 0) return 0;
    return Math.min(100, Math.round((effectiveTotal / mass.total) * 100));
  }, [mass.total, effectiveTotal]);

  // Sichere Prozentberechnung
  const classPercents = useMemo<Ratios>(() => {
    try {
      return percentsByCategory(category);
    } catch (error) {
      console.error("Error getting class percentages:", error);
      return { roughage: 60, energy: 25, protein: 15, note: "Standart foizlar" };
    }
  }, [category]);

  // Verbesserte Verteilungsberechnung
  const distribution = useMemo(() => {
    try {
      return buildDistribution(selectedFeeds, classPercents, norms.basis, effectiveTotal, userFeedAmounts);
    } catch (error) {
      console.error("Error building distribution:", error);
      return {
        perClassKg: { roughage: 0, energy: 0, protein: 0 },
        perFeed: [],
        dmTotal: 0
      };
    }
  }, [effectiveTotal, selectedFeeds, classPercents, norms.basis, userFeedAmounts]);

  // Verbesserte Versorgungsberechnung
  const supply = useMemo(() => {
    try {
      const energyPerKg = norms.basis === "ME" ? avg.me : avg.nel;
      const energySupply = energyPerKg * effectiveTotal;
      const proteinSupply_g = avg.prot_perkg * 1000 * effectiveTotal;
      
      const energyDeficit = Math.max(0, norms.energy_MJ - energySupply);
      const proteinDeficit = Math.max(0, norms.protein_g - proteinSupply_g);
      
      const proteinDeficitPct = norms.protein_g > 0 
        ? safeDivide(proteinDeficit, norms.protein_g, 0) * 100 
        : 0;
      
      return { 
        energySupply, 
        proteinSupply_g, 
        energyDeficit, 
        proteinDeficit, 
        proteinDeficitPct 
      };
    } catch (error) {
      console.error("Error calculating supply:", error);
      return { 
        energySupply: 0, 
        proteinSupply_g: 0, 
        energyDeficit: 0, 
        proteinDeficit: 0, 
        proteinDeficitPct: 0 
      };
    }
  }, [norms, avg, effectiveTotal]);

  // Verbesserte Warnungen mit robusterer Logik
  const warnings = useMemo(() => {
    if (!isValid || selectedFeeds.length === 0) return [];
    
    const arr: string[] = [];
    
    try {
      // Minimale Dag'al-Ozuqa-Anforderungen
      const minRoughage =
        category === "tinim_sigirlar" ? 60 :
        category === "sut_sigirlar" ? 50 :
        category === "buqalar_yetuk" ? 60 :
        category === "buzoqlar_1_6" ? 30 : 40;

      if (classPercents.roughage < minRoughage) {
        arr.push(`Dag'al ozuqa ulushi ${classPercents.roughage}% — tavsiya etilgan minimal ${minRoughage}% dan past.`);
      }

      // Konsentrat-Überprüfung
      const concPct = classPercents.energy + classPercents.protein;
      if (concPct > 60) {
        arr.push(`Konsentrat ulushi ${concPct}% — 60% dan yuqori (kislotalanish xavfi).`);
      }

      // Abdeckung und DM-Überprüfung
      if (effectiveTotal < mass.total) {
        arr.push("DM cheklovi sabab energiya/oqsil talabi to'liq yopilmadi. Energiya zich yem qo'shing yoki foizlarni moslang.");
      }
      
      if (distribution.dmTotal > dmMax + 0.1) {
        arr.push(`Hisoblangan DM ${distribution.dmTotal.toFixed(1)} kg — DM limiti ${dmMax.toFixed(1)} kg dan yuqori.`);
      }

      // Fehlende Futtermittelklassen
      const hasR = selectedFeeds.some(f => f.class === "roughage");
      const hasE = selectedFeeds.some(f => f.class === "energy");
      const hasP = selectedFeeds.some(f => f.class === "protein");
      
      const emptyClasses: string[] = [];
      if (!hasR) emptyClasses.push("Dag'al");
      if (!hasE) emptyClasses.push("Energiya");
      if (!hasP) emptyClasses.push("Oqsil");
      
      if (emptyClasses.length > 0) {
        arr.push(`Quyidagi sinflarda ozuqa tanlanmagan: ${emptyClasses.join(", ")}.`);
      }
    } catch (error) {
      console.error("Error generating warnings:", error);
      arr.push("Ogohlantirishlar yaratishda xatolik yuz berdi.");
    }

    return arr;
  }, [isValid, category, classPercents, effectiveTotal, mass.total, distribution.dmTotal, dmMax, selectedFeeds]);

  // Verbesserte Tipps mit robusterer Logik
  const tips = useMemo(() => {
    if (!isValid || effectiveTotal <= 0 || selectedFeeds.length === 0) return [];
    
    const list: string[] = [];
    
    try {
      const total = effectiveTotal;

      // Dag'al-Ozuqa-Optimierung
      const roughageItems = distribution.perFeed.filter(x => x.cls === "roughage");
      const avgRoughNeL = roughageItems.length > 0 
        ? roughageItems.reduce((s, x) => s + x.f.energy_nel_kg, 0) / roughageItems.length 
        : 0;

      const minRough =
        category === "tinim_sigirlar" ? 60 :
        category === "sut_sigirlar" ? 50 :
        category === "buqalar_yetuk" ? 60 :
        category === "buzoqlar_1_6" ? 30 : 40;

      if (classPercents.roughage < minRough) {
        const needKg = total * ((minRough - classPercents.roughage) / 100);
        list.push(`Dag'al ulushini oshiring: kamida ${minRough}% bo'lsin — ~${(Math.max(0.1, Math.round(needKg * 10) / 10)).toFixed(1)} kg as-fed dag'al qo'shing.`);
        
        const betterRough = FEEDS.filter(f => f.class === "roughage" && f.energy_nel_kg >= 5)
          .slice(0, 3)
          .map(f => f.feed_name);
          
        if (betterRough.length > 0) {
          list.push(`Sifatli dag'al variantlari: ${betterRough.join(", ")}.`);
        }
      }
      
      if (roughageItems.length > 0 && avgRoughNeL < 5) {
        list.push(`Dag'al sifati past (o'rtacha NeL ${avgRoughNeL.toFixed(1)}). Somon/poyani sifatli dag'al bilan ≥30% almashtiring (masalan, Beda).`);
      }

      // Protein-Optimierung
      const proteinDef = Math.max(0, norms.protein_g - avg.prot_perkg * 1000 * total);
      if (proteinDef > 0) {
        const proteinCandidates = FEEDS.filter(f => f.class === "protein")
          .sort((a, b) => b.protein_kg - a.protein_kg);
        const best = proteinCandidates[0];
        
        if (best) {
          const needKg = safeDivide(proteinDef, best.protein_kg * 1000, 0);
          list.push(`Oqsilni boyiting: ~${(Math.max(0.1, Math.round(needKg * 10) / 10)).toFixed(1)} kg ${best.feed_name} qo'shsangiz CP talabi yopiladi.`);
        }
      }

      // Energien-Optimierung
      const energyDef = Math.max(0, norms.energy_MJ - (norms.basis === "ME" ? avg.me : avg.nel) * total);
      if (energyDef > 0 && coverage === 100) {
        const energyCandidates = FEEDS.filter(f => f.class === "energy")
          .sort((a, b) => b.energy_nel_kg - a.energy_nel_kg);
        const bestE = energyCandidates[0];
        
        if (bestE) {
          const ePerKg = norms.basis === "ME" ? bestE.energy_me : bestE.energy_nel_kg;
          const needKg = safeDivide(energyDef, ePerKg, 0);
          list.push(`Energiya yetishmayapti: ~${(Math.max(0.1, Math.round(needKg * 10) / 10)).toFixed(1)} kg ${bestE.feed_name} qo'shing yoki dag'al sifatini oshiring.`);
        }
      }

      // Kategorie-spezifische Tipps
      if (category === "buzoqlar_1_6") {
        list.push("Buzoqlar (1–6 oy): sut/sut-o'rnini bosuvchi asosiy; dag'al 25–30% doirasida, mayda bo'lakli bo'lsin.");
      }

      // Mineral- und Vitaminempfehlungen
      const salt_g = Math.round((weight / 100) * 35);
      const premix_g = Math.round((weight / 100) * 90);
      const dmm = dmMetrics(avg);
      
      list.push(`Mineral/Vitamin: Tuz ${salt_g} g/kun, mineral premiks ${premix_g} g/kun. Ca:P ≈ 2:1, suv erkin.`);
      list.push(`DM bazada zichlik: ${dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM, ${dmm.cpPctDM.toFixed(1)}% CP.`);

    } catch (error) {
      console.error("Error generating tips:", error);
      list.push("Tavsiyalar yaratishda xatolik yuz berdi.");
    }

    return list;
  }, [isValid, distribution.perFeed, avg, effectiveTotal, classPercents, coverage, norms, weight, category, selectedFeeds.length]);

  return {
    CATEGORY_LABELS,
    FEEDS,
    selectedFeeds,
    avg,
    norms,
    mass,
    dmMax,
    asFedMax,
    effectiveTotal,
    coverage,
    classPercents,
    distribution,
    supply,
    warnings,
    tips,
  };
}

