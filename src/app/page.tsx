"use client";

import React, { useMemo, useRef, useState } from "react";

/** =========================================================
 *  TURLAR
 * ======================================================= */
type FeedClass = "roughage" | "energy" | "protein";

type Feed = {
    feed_name: string;
    energy_me: number;      // MJ/kg (ME)
    energy_nel_kg: number;  // MJ/kg (NeL)
    protein_kg: number;     // kg/kg (CP), masalan 0.10 = 100 g/kg
    ts_kg: number;          // kg/kg (TS/DM ulushi)
    class: FeedClass;       // deterministik sinf
};

type CategoryKey =
    | "beef_bull_12_18"
    | "beef_bull_mature"
    | "dairy_cow"
    | "dry_period_cow"
    | "calf_1_3"
    | "calf_3_6"
    | "calf_6_12";

type Ratios = { roughage: number; energy: number; protein: number; note?: string };
type NormPoint = { w: number; nel: number; prot_g: number };

/** =========================================================
 *  MA'LUMOTLAR (hardcoded)
 * ======================================================= */

// foizlar.json mazmuni (UZ)
const CLASS_RATIOS: Record<
    | "sut_sigirlar"
    | "tinim_sigirlar"
    | "buqalar_12_18"
    | "buqalar_yetuk"
    | "buzoqlar_1_3"
    | "buzoqlar_3_6"
    | "buzoqlar_6_12",
    Ratios
> = {
    sut_sigirlar: { roughage: 50, energy: 30, protein: 20, note: "Konsentrat (energiya+oqsil) ~50%, 55–60% dan oshirmang." },
    tinim_sigirlar: { roughage: 70, energy: 20, protein: 10, note: "Tug‘ruqqa yaqin konsentrat oshirilishi mumkin, ammo dag‘al >60% bo‘lsin." },
    buqalar_12_18: { roughage: 50, energy: 35, protein: 15, note: "Jami konsentrat ~50%, semirish xavfisiz." },
    buqalar_yetuk: { roughage: 65, energy: 20, protein: 15, note: "" },
    buzoqlar_1_3: { roughage: 15, energy: 60, protein: 25, note: "" },
    buzoqlar_3_6: { roughage: 30, energy: 50, protein: 20, note: "" },
    buzoqlar_6_12: { roughage: 50, energy: 35, protein: 15, note: "" },
};

// Buqa (ME/CP) jadvali — eng yaqin vazn qatori olinadi
const BULLS_TABLE: Array<{ weight_kg: number; energy_me: number; protein_g: number }> = [
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

// Ozuqalar (as-fed, 1 kg uchun) — class deterministik!
const FEEDS: Feed[] = [
    // Yashil/yem-xashak (silaj/poya/somon)
    { feed_name: "Bug'doy somoni",  energy_me: 6.13,  energy_nel_kg: 3.5, protein_kg: 0.04,  ts_kg: 0.90, class: "roughage" },
    { feed_name: "Arpa somoni",     energy_me: 6.13,  energy_nel_kg: 3.5, protein_kg: 0.04,  ts_kg: 0.90, class: "roughage" },
    { feed_name: "Sholi somoni",    energy_me: 5.25,  energy_nel_kg: 3.0, protein_kg: 0.035, ts_kg: 0.90, class: "roughage" },
    { feed_name: "Makka poyasi",    energy_me: 7.00,  energy_nel_kg: 4.0, protein_kg: 0.06,  ts_kg: 0.90, class: "roughage" },
    { feed_name: "Beda",            energy_me: 8.75,  energy_nel_kg: 5.0, protein_kg: 0.15,  ts_kg: 0.90, class: "protein"  },
    { feed_name: "Yantoq",          energy_me: 8.75,  energy_nel_kg: 5.0, protein_kg: 0.10,  ts_kg: 0.90, class: "protein"  },

    // Donlar (energiya)
    { feed_name: "Makkajo'xori doni", energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
    { feed_name: "Arpa doni",         energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.11, ts_kg: 0.90, class: "energy" },
    { feed_name: "Bug'doy doni",      energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.12, ts_kg: 0.90, class: "energy" },
    { feed_name: "Tritikali doni",    energy_me: 12.72, energy_nel_kg: 8.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
    { feed_name: "Jo'xori doni",      energy_me: 11.13, energy_nel_kg: 7.0, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },
    { feed_name: "Tariq doni",        energy_me: 10.34, energy_nel_kg: 6.5, protein_kg: 0.10, ts_kg: 0.90, class: "energy" },

    // Suyuq/yarmi nam omuxta (asosan energiya)
    { feed_name: "Suv chiqadi va donli",        energy_me:  9.60, energy_nel_kg: 6.0, protein_kg: 0.08,  ts_kg: 0.30, class: "energy"  },
    { feed_name: "Suv chiqadi va donsiz",       energy_me:  7.20, energy_nel_kg: 4.5, protein_kg: 0.08,  ts_kg: 0.30, class: "energy"  },
    { feed_name: "Kaftim nam bo'ladi va donli", energy_me: 10.08, energy_nel_kg: 6.3, protein_kg: 0.075, ts_kg: 0.36, class: "energy"  },
    { feed_name: "Kaftim nam bo'ladi va donsiz",energy_me:  7.20, energy_nel_kg: 4.5, protein_kg: 0.075, ts_kg: 0.36, class: "energy"  },

    // Oqsilga boy maxsus (kengaytirish uchun)
    { feed_name: "Loviya poyasi",  energy_me: 7.00,  energy_nel_kg: 4.0, protein_kg: 0.12, ts_kg: 0.90, class: "protein" },
    { feed_name: "Mosh poyasi",    energy_me: 7.00,  energy_nel_kg: 4.0, protein_kg: 0.12, ts_kg: 0.90, class: "protein" },
    { feed_name: "G'o'za chanog'i",energy_me: 5.25,  energy_nel_kg: 3.0, protein_kg: 0.10, ts_kg: 0.90, class: "protein" },
];

// Kategoriyalar — UI label
const CATEGORY_LABELS: Record<CategoryKey, string> = {
    beef_bull_12_18: "Buqa (12–18 oy)",
    beef_bull_mature: "Yetuk Buqa",
    dairy_cow: "Sut Sigiri",
    dry_period_cow: "Tinim davridagi Sigir",
    calf_1_3: "Buzoq (1–3 oy)",
    calf_3_6: "Buzoq (3–6 oy)",
    calf_6_12: "Buzoq (6–12 oy)",
};

// Sigir/buzoq uchun NeL/CP me'yorlari (interpolatsiya qilinadi)
const EXAMPLE_NORMS: Record<Exclude<CategoryKey, "beef_bull_12_18" | "beef_bull_mature">, NormPoint[]> = {
    dairy_cow: [
        { w: 350, nel: 35, prot_g: 1100 },
        { w: 450, nel: 45, prot_g: 1300 },
        { w: 550, nel: 55, prot_g: 1500 },
        { w: 650, nel: 62, prot_g: 1650 },
    ],
    dry_period_cow: [
        { w: 400, nel: 25, prot_g: 900 },
        { w: 500, nel: 30, prot_g: 1000 },
        { w: 600, nel: 35, prot_g: 1100 },
    ],
    calf_1_3: [
        { w: 50, nel: 9, prot_g: 350 },
        { w: 100, nel: 14, prot_g: 500 },
    ],
    calf_3_6: [
        { w: 80, nel: 16, prot_g: 520 },
        { w: 150, nel: 24, prot_g: 700 },
    ],
    calf_6_12: [
        { w: 120, nel: 26, prot_g: 750 },
        { w: 250, nel: 40, prot_g: 1000 },
    ],
};

/** =========================================================
 *  YORDAMCHI FUNKSIYALAR
 * ======================================================= */

function interpolate(table: NormPoint[], w: number): NormPoint {
    if (w <= table[0].w) return table[0];
    if (w >= table[table.length - 1].w) return table[table.length - 1];

    // binary search for the bounding interval
    let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (w < table[mid].w) hi = mid;
        else lo = mid;
    }
    const a = table[lo], b = table[hi];
    const t = (w - a.w) / (b.w - a.w);
    return { w, nel: a.nel + t * (b.nel - a.nel), prot_g: a.prot_g + t * (b.prot_g - a.prot_g) };
}

function nearestBullRow(w: number) {
    let lo = 0, hi = BULLS_TABLE.length - 1;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midW = BULLS_TABLE[mid].weight_kg;
        if (midW === w) return BULLS_TABLE[mid];
        if (midW < w) lo = mid + 1; else hi = mid - 1;
    }
    // lo is the first heavier index, hi is the last lighter index
    if (lo >= BULLS_TABLE.length) return BULLS_TABLE[BULLS_TABLE.length - 1];
    if (hi < 0) return BULLS_TABLE[0];
    const lower = BULLS_TABLE[hi];
    const upper = BULLS_TABLE[lo];
    return Math.abs(lower.weight_kg - w) <= Math.abs(upper.weight_kg - w) ? lower : upper;
}

// DM limiti (kg/kun)
function dmMaxByCategory(cat: CategoryKey, bw: number) {
    const pct =
        cat === "dairy_cow" ? 0.028 :
            cat === "dry_period_cow" ? 0.020 :
                cat === "beef_bull_12_18" || cat === "beef_bull_mature" ? 0.022 :
                    cat === "calf_1_3" ? 0.025 :
                        cat === "calf_3_6" ? 0.027 :
                            0.028; // calf_6_12
    return bw * pct;
}

// DM-baza metrikalar
const dmMetrics = (avg: { nel: number; prot_perkg: number; ts_perkg: number }) => {
    const nelPerKgDM = avg.ts_perkg > 0 ? avg.nel / avg.ts_perkg : 0;           // MJ/kg DM
    const cpFracDM   = avg.ts_perkg > 0 ? avg.prot_perkg / avg.ts_perkg : 0;    // kg CP / kg DM
    return { nelPerKgDM, cpPctDM: cpFracDM * 100 };
};

// Oziqlantirish uchun minimal 0.1 kg ga yaxlitlash
const roundFeed = (kg: number) => (kg <= 0 ? 0 : Math.max(0.1, Math.round(kg * 10) / 10));

// Sinf foizlari
const percentsByCategory = (cat: CategoryKey): Ratios => {
    switch (cat) {
        case "beef_bull_12_18": return CLASS_RATIOS.buqalar_12_18;
        case "beef_bull_mature": return CLASS_RATIOS.buqalar_yetuk;
        case "dairy_cow":        return CLASS_RATIOS.sut_sigirlar;
        case "dry_period_cow":   return CLASS_RATIOS.tinim_sigirlar;
        case "calf_1_3":         return CLASS_RATIOS.buzoqlar_1_3;
        case "calf_3_6":         return CLASS_RATIOS.buzoqlar_3_6;
        case "calf_6_12":        return CLASS_RATIOS.buzoqlar_6_12;
    }
};

/** =========================================================
 *  KOMPONENT
 * ======================================================= */
export default function RationGeneratorUZ() {
    // --- Holat ---
    const [category, setCategory] = useState<CategoryKey>("dairy_cow");
    const [weight, setWeight] = useState<number>(500);
    const [milk, setMilk] = useState<number>(0); // faqat sut sigiri uchun
    const [selected, setSelected] = useState<string[]>([]);
    const [previewMode, setPreviewMode] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    // --- Tanlangan ozuqalar ---
    const selectedFeeds = useMemo(() => FEEDS.filter(f => selected.includes(f.feed_name)), [selected]);

    // --- Tanlangan ozuqalarning o'rtacha tarkibi (as-fed) ---
    const avg = useMemo(() => {
        if (selectedFeeds.length === 0) return { me: 0, nel: 0, prot_perkg: 0, ts_perkg: 0 };
        const n = selectedFeeds.length;
        const sum = selectedFeeds.reduce((acc, f) => {
            return {
                me: acc.me + f.energy_me,
                nel: acc.nel + f.energy_nel_kg,
                prot_perkg: acc.prot_perkg + f.protein_kg,
                ts_perkg: acc.ts_perkg + f.ts_kg,
            };
        }, { me: 0, nel: 0, prot_perkg: 0, ts_perkg: 0 });
        return { me: sum.me / n, nel: sum.nel / n, prot_perkg: sum.prot_perkg / n, ts_perkg: sum.ts_perkg / n };
    }, [selectedFeeds]);

    // --- Normativ talab (kunlik) ---
    const norms = useMemo(() => {
        if (category === "beef_bull_12_18" || category === "beef_bull_mature") {
            const nearest = nearestBullRow(weight);
            return { basis: "ME" as const, energy_MJ: nearest.energy_me, protein_g: nearest.protein_g,
                note: percentsByCategory(category).note };
        } else {
            const key = category as Exclude<CategoryKey, "beef_bull_12_18" | "beef_bull_mature">;
            const row = interpolate(EXAMPLE_NORMS[key], weight);
            const milkNeL = category === "dairy_cow" && milk > 0 ? milk * 3.2 : 0; // NeL ≈ 3.2 MJ/kg sut
            return { basis: "NeL" as const, energy_MJ: row.nel + milkNeL, protein_g: row.prot_g, note: percentsByCategory(category).note };
        }
    }, [category, weight, milk]);

    // --- Umumiy massa (as-fed, kg/kun) — energiya yoki oqsil talabi bo'yicha ---
    const mass = useMemo(() => {
        if (selectedFeeds.length === 0) return { total: 0, limiting: "none" as "energy" | "protein" | "none" };
        const mEnergy = (norms.basis === "ME" ? avg.me : avg.nel) > 0
            ? norms.energy_MJ / (norms.basis === "ME" ? avg.me : avg.nel)
            : Number.POSITIVE_INFINITY;
        const mProtein = avg.prot_perkg > 0 ? (norms.protein_g / 1000) / avg.prot_perkg : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(mEnergy) && !Number.isFinite(mProtein)) return { total: 0, limiting: "none" };
        if (mEnergy >= mProtein) return { total: mEnergy, limiting: "energy" as const };
        return { total: mProtein, limiting: "protein" as const };
    }, [selectedFeeds.length, norms, avg]);

    // --- DM limiti va qamrov ---
    const dmMax = useMemo(() => dmMaxByCategory(category, weight), [category, weight]); // kg DM/kun
    const asFedMax = useMemo(() => (avg.ts_perkg > 0 ? dmMax / avg.ts_perkg : Number.POSITIVE_INFINITY), [dmMax, avg.ts_perkg]);
    const effectiveTotal = useMemo(() => (mass.total ? Math.min(mass.total, asFedMax) : 0), [mass.total, asFedMax]);
    const coverage = useMemo(() => (mass.total ? Math.min(100, Math.round((effectiveTotal / mass.total) * 100)) : 0), [mass.total, effectiveTotal]);

    // --- Sinf foizlari ---
    const classPercents = useMemo(() => percentsByCategory(category), [category]);

    // --- Taqsimot (har feed uchun as-fed kg va DM kg) ---
    const distribution = useMemo(() => {
        const total = effectiveTotal;
        if (!total || selectedFeeds.length === 0) {
            return { perClassKg: { roughage: 0, energy: 0, protein: 0 }, perFeed: [] as Array<{ name: string; cls: FeedClass; kg: number; dm: number; f: Feed }>, dmTotal: 0 };
        }

        const perClassKg = {
            roughage: (classPercents.roughage / 100) * total,
            energy:   (classPercents.energy   / 100) * total,
            protein:  (classPercents.protein  / 100) * total,
        };

        const groups: Record<FeedClass, Feed[]> = { roughage: [], energy: [], protein: [] };
        selectedFeeds.forEach((f) => groups[f.class].push(f));

        const weightByClass: Record<FeedClass, (f: Feed) => number> = {
            roughage: (f) => f.ts_kg,                                  // dag'al — TS zichlik
            energy:   (f) => norms.basis === "ME" ? f.energy_me : f.energy_nel_kg, // energiya — mos birlik
            protein:  (f) => f.protein_kg,                             // oqsil — CP
        };

        const perFeed: Array<{ name: string; cls: FeedClass; kg: number; dm: number; f: Feed }> = [];

        (["roughage", "energy", "protein"] as FeedClass[]).forEach((cls) => {
            const arr = groups[cls];
            if (arr.length === 0 || perClassKg[cls] === 0) return;
            const weights = arr.map(weightByClass[cls]);
            const sumW = weights.reduce((a, b) => a + b, 0) || arr.length;
            arr.forEach((f, i) => {
                const shareAsFed = (weights[i] / sumW) * perClassKg[cls];
                const dm = shareAsFed * f.ts_kg;
                perFeed.push({
                    name: f.feed_name,
                    cls,
                    kg: Math.round(shareAsFed * 100) / 100,
                    dm: Math.round(dm * 100) / 100,
                    f,
                });
            });
        });

        const dmTotal = Math.round(perFeed.reduce((s, x) => s + x.dm, 0) * 100) / 100;
        return { perClassKg, perFeed: perFeed.sort((a, b) => a.name.localeCompare(b.name)), dmTotal };
    }, [effectiveTotal, selectedFeeds, classPercents, norms.basis]);

    // --- Hisoblangan ta'minot (supply) va defitsit ---
    const supply = useMemo(() => {
        const energyPerKg = norms.basis === "ME" ? avg.me : avg.nel;
        const energySupply = energyPerKg * effectiveTotal; // MJ/kun
        const proteinSupply_g = avg.prot_perkg * 1000 * effectiveTotal; // g/kun
        const energyDeficit = Math.max(0, norms.energy_MJ - energySupply);
        const proteinDeficit = Math.max(0, norms.protein_g - proteinSupply_g);
        return { energySupply, proteinSupply_g, energyDeficit, proteinDeficit, proteinDeficitPct: norms.protein_g > 0 ? (proteinDeficit / norms.protein_g) * 100 : 0 };
    }, [norms, avg, effectiveTotal]);

    // --- Ogohlantirishlar ---
    const warnings = useMemo(() => {
        const arr: string[] = [];

        // dag'al minimal ulushi
        const minRoughage =
            category === "dry_period_cow" ? 60 :
                category === "dairy_cow" ? 50 :
                    category === "beef_bull_mature" ? 60 :
                        category === "beef_bull_12_18" ? 50 :
                            category === "calf_1_3" ? 30 :
                                category === "calf_3_6" ? 35 : 40;

        if (classPercents.roughage < minRoughage) {
            arr.push(`Dag‘al ozuqa ulushi ${classPercents.roughage}% — tavsiya etilgan minimal ${minRoughage}% dan past.`);
        }

        // konsentrat (energiya+oqsil) yuqoriligi
        const concPct = classPercents.energy + classPercents.protein;
        if (concPct > 60) arr.push(`Konsentrat ulushi ${concPct}% — 60% dan yuqori (kislotalanish xavfi).`);

        // DM limitlari
        if (effectiveTotal < mass.total) arr.push("DM cheklovi sabab energiya/oqsil talabi to‘liq yopilmadi. Energiya zich yem qo‘shing yoki foizlarni moslang.");
        if (distribution.dmTotal > dmMax + 0.1) arr.push(`Hisoblangan DM ${distribution.dmTotal} kg — DM limiti ${dmMax.toFixed(1)} kg dan yuqori.`);

        // sinflar bo'sh
        const hasR = selectedFeeds.some(f => f.class === "roughage");
        const hasE = selectedFeeds.some(f => f.class === "energy");
        const hasP = selectedFeeds.some(f => f.class === "protein");
        const emptyClasses: string[] = [];
        if (!hasR) emptyClasses.push("Dag‘al");
        if (!hasE) emptyClasses.push("Energiya");
        if (!hasP) emptyClasses.push("Oqsil (CP)");
        if (emptyClasses.length) arr.push(`Quyidagi sinflarda ozuqa tanlanmagan: ${emptyClasses.join(", ")}.`);

        return arr;
    }, [category, classPercents, effectiveTotal, mass.total, distribution.dmTotal, dmMax, selectedFeeds]);

    // --- Tavsiyalar (AI) ---
    const tips = useMemo(() => {
        const list: string[] = [];
        const total = effectiveTotal;
        if (total <= 0 || selectedFeeds.length === 0) {
            return list;
        }

        // 1) Dag'al sifati va minimal ulush
        const roughageItems = distribution.perFeed.filter(x => x.cls === "roughage");
        const avgRoughNeL = roughageItems.length > 0 ? roughageItems.reduce((s, x) => s + x.f.energy_nel_kg, 0) / roughageItems.length : 0;

        const minRough =
            category === "dry_period_cow" ? 60 :
                category === "dairy_cow" ? 50 :
                    category === "beef_bull_mature" ? 60 :
                        category === "beef_bull_12_18" ? 50 :
                            category === "calf_1_3" ? 30 :
                                category === "calf_3_6" ? 35 : 40;

        if (classPercents.roughage < minRough) {
            const needKg = total * ((minRough - classPercents.roughage) / 100);
            list.push(`Dag‘al ulushini oshiring: kamida ${minRough}% bo‘lsin — ~${roundFeed(needKg).toFixed(1)} kg as-fed dag‘al qo‘shing.`);
            const betterRough = FEEDS.filter(f => f.class === "roughage" && f.energy_nel_kg >= 5).slice(0,3).map(f => f.feed_name);
            if (betterRough.length) list.push(`Sifatli dag‘al variantlari: ${betterRough.join(", ")}.`);
        }
        if (roughageItems.length > 0 && avgRoughNeL < 5) {
            list.push(`Dag‘al sifati past (o‘rtacha NeL ${avgRoughNeL.toFixed(1)}). Somon/poyani sifatli dag‘al bilan ≥30% almashtiring (masalan, Beda).`);
        }

        // 2) Protein defitsiti bo'lsa – eng yuqori CP nomzoddan aniq kg
        const proteinDef = Math.max(0, norms.protein_g - avg.prot_perkg * 1000 * total);
        if (proteinDef > 0) {
            const proteinCandidates = FEEDS.filter(f => f.class === "protein").sort((a: Feed, b: Feed) => b.protein_kg - a.protein_kg);
            const best = proteinCandidates[0];
            if (best) {
                const needKg = proteinDef / (best.protein_kg * 1000);
                list.push(`Oqsilni boyiting: ~${roundFeed(needKg).toFixed(1)} kg ${best.feed_name} qo‘shsangiz CP talabi yopiladi.`);
            }
        }

        // 3) Energiya defitsiti (DM limiti yo‘q bo‘lsa)
        const energyDef = Math.max(0, norms.energy_MJ - (norms.basis === "ME" ? avg.me : avg.nel) * total);
        if (energyDef > 0 && coverage === 100) {
            const energyCandidates = FEEDS.filter(f => f.class === "energy").sort((a: Feed, b: Feed) => b.energy_nel_kg - a.energy_nel_kg);
            const bestE = energyCandidates[0];
            if (bestE) {
                const ePerKg = norms.basis === "ME" ? bestE.energy_me : bestE.energy_nel_kg;
                const needKg = energyDef / ePerKg;
                list.push(`Energiya yetishmayapti: ~${roundFeed(needKg).toFixed(1)} kg ${bestE.feed_name} qo‘shing yoki dag‘al sifatini oshiring.`);
            }
        }

        // 4) Buzoqlar uchun maxsus eslatma
        if (category === "calf_1_3") {
            list.push("Buzoqlar (1–3 oy): sut/sut-o‘rnini bosuvchi asosiy; dag‘al 30–40% doirasida, mayda bo‘lakli bo‘lsin.");
        }

        // 5) Mineral/Vitamin umumiy tavsiya (BW bo'yicha)
        const salt_g = Math.round((weight / 100) * 35);
        const premix_g = Math.round((weight / 100) * 90);
        list.push(`Mineral/Vitamin: Tuz ${salt_g} g/kun, mineral premiks ${premix_g} g/kun. Ca:P ≈ 2:1, suv erkin.`);

        // 6) DM-baza ma'lumot
        const dmm = dmMetrics(avg);
        list.push(`DM bazada zichlik: ${dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM, ${dmm.cpPctDM.toFixed(1)}% CP.`);

        return list;
    }, [distribution.perFeed, avg, effectiveTotal, classPercents, coverage, norms, weight, category, selectedFeeds.length]);

    // --- Export funksiyalari (html-to-image dinamik import) ---
    const exportPNG = async () => {
        if (!exportRef.current) return;
        try {
            // "html-to-image" CommonJS modulini dinamik import qilish
            const { toPng } = await import("html-to-image");
            const dataUrl = await toPng(exportRef.current, {
                cacheBust: true,
                backgroundColor: "#ffffff",
                pixelRatio: 2,
            });
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `ratsion_${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            alert("PNG eksport uchun 'html-to-image' paketini o‘rnating: npm i html-to-image");
        }
    };

    const exportPDF = async () => {
        if (!exportRef.current) return;
        try {
            const { toPng } = await import("html-to-image");
            const { jsPDF } = await import("jspdf");
            const dataUrl = await toPng(exportRef.current, {
                cacheBust: true,
                backgroundColor: "#ffffff",
                pixelRatio: 2,
            });
            const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
            const img = new Image();
            img.src = dataUrl;
            await new Promise(res => (img.onload = res));
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pw / img.width, ph / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const x = (pw - w) / 2;
            const y = 40;
            pdf.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST");
            pdf.save(`ratsion_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch {
            alert("PDF eksport uchun 'html-to-image' va 'jspdf' paketlarini o‘rnating: npm i html-to-image jspdf");
        }
    };

    const doPrint = () => window.print();
    const toggle = (name: string) => setSelected(prev => (prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]));
    const canGenerate = selectedFeeds.length > 0 && weight > 0;

    /** ======================= UI ======================= */
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900">
            <div className="mx-auto max-w-7xl px-4 py-6">
                {/* HEADER */}
                <header className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Kundalik Ozuqa Ratsioni Generatori</h1>
                    <button onClick={() => setPreviewMode(v => !v)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-100">
                        {previewMode ? "⬅️ Tahrirlash rejimi" : "👁️ Preview / Export"}
                    </button>
                </header>

                {/* GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                    {/* INPUTS */}
                    <section className="lg:col-span-1">
                        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
                            <h2 className="text-lg font-semibold mb-4">Kirish ma'lumotlari</h2>

                            <label className="block text-sm font-medium mb-1">Hayvon toifasi</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)} className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400">
                                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                    <option value={k} key={k}>{v}</option>
                                ))}
                            </select>

                            <label className="block text-sm font-medium mb-1">Tirik vazn (kg)</label>
                            <input type="number" min={1} value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" />

                            {category === "dairy_cow" && (
                                <>
                                    <label className="block text-sm font-medium mb-1">Sut (l/kun) — ixtiyoriy</label>
                                    <input type="number" min={0} value={milk} onChange={(e) => setMilk(Number(e.target.value) || 0)} className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" placeholder="Masalan: 18" />
                                </>
                            )}

                            <label className="block text-sm font-medium mb-2">Mavjud ozuqalar (bir nechtasini tanlang)</label>
                            <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200 p-3">
                                {FEEDS.map((f) => (
                                    <label key={f.feed_name} className="flex items-center gap-3 py-1">
                                        <input type="checkbox" checked={selected.includes(f.feed_name)} onChange={() => toggle(f.feed_name)} className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500" />
                                        <span className="text-sm">
                      {f.feed_name}
                                            <span className="text-neutral-500"> — NeL {f.energy_nel_kg} MJ/kg · ME {f.energy_me} MJ/kg · Oqsil (CP) {Math.round(f.protein_kg * 1000)} g/kg · <span className="uppercase">{f.class}</span></span>
                    </span>
                                    </label>
                                ))}
                            </div>

                            <p className="text-xs text-neutral-500 mt-3">
                                * Foizlar toifa bo‘yicha avtomatik qo‘llanadi. Kerak bo‘lsa CLASS_RATIOS ni tahrirlang.
                            </p>
                        </div>
                    </section>

                    {/* OUTPUTS */}
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Natija</h2>
                                <button disabled={!canGenerate} className={`rounded-xl px-4 py-2 text-sm font-medium ${canGenerate ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-neutral-200 text-neutral-500"}`} onClick={() => {}}>
                                    Generatsiya qilish
                                </button>
                            </div>

                            {/* Qisqa xulosa */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-xs uppercase text-neutral-500">Normativ talab</div>
                                    <div className="mt-1 text-sm">
                                        {category.startsWith("beef_bull") ? (
                                            <>
                                                ME: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />
                                                Oqsil (CP): <b>{Math.round(norms.protein_g)}</b> g/kun
                                            </>
                                        ) : (
                                            <>
                                                NeL: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />
                                                Oqsil (CP): <b>{Math.round(norms.protein_g)}</b> g/kun
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-xs uppercase text-neutral-500">O‘rtacha tarkib (tanlangan)</div>
                                    <div className="mt-1 text-sm">
                                        {(() => {
                                            const dmm = dmMetrics(avg);
                                            return (
                                                <>
                                                    NeL: <b>{avg.nel.toFixed(2)}</b> · ME: <b>{avg.me.toFixed(2)}</b> MJ/kg<br />
                                                    Oqsil (CP): <b>{Math.round(avg.prot_perkg * 1000)}</b> g/kg · TS: <b>{Math.round(avg.ts_perkg * 100)}%</b><br />
                                                    <span className="text-neutral-600">DM bazada: <b>{dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM</b> · <b>{dmm.cpPctDM.toFixed(1)}% CP</b></span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-xs uppercase text-neutral-500">Umumiy massa</div>
                                    <div className="mt-1 text-sm">
                                        <b>{effectiveTotal ? `${effectiveTotal.toFixed(2)} kg/kun as-fed` : "-"}</b><br />
                                        ≈ {(effectiveTotal * (avg.ts_perkg || 0)).toFixed(2)} kg DM/kun<br />
                                        Cheklovchi omil:{" "}
                                        <b>
                                            {mass.limiting === "energy"
                                                ? (category.startsWith("beef_bull") ? "ME" : "NeL")
                                                : mass.limiting === "protein"
                                                    ? "Oqsil (CP)"
                                                    : "-"}
                                        </b><br />
                                        {effectiveTotal < mass.total && <span className="text-amber-600 font-medium">Talab qoplanishi: {coverage}% (DM limiti)</span>}
                                        {coverage < 80 && (
                                            <div className="mt-1 inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200">
                                                ⚠️ Ratsion yaroqsiz (kamida 80% qoplanishi kerak)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sinf bo'yicha taqsimot */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(["roughage", "energy", "protein"] as FeedClass[]).map((cls) => (
                                    <div key={cls} className="rounded-xl border border-neutral-200 p-4">
                                        <div className="text-sm font-medium mb-1">
                                            {cls === "roughage" ? "Dag‘al ozuqa" : cls === "energy" ? "Energiya ozuqa" : "Oqsil (CP) ozuqa"}
                                        </div>
                                        <div className="text-xs text-neutral-500 mb-2">
                                            Foiz: {classPercents[cls]}% — <b>{effectiveTotal ? (effectiveTotal * (classPercents[cls] / 100)).toFixed(2) : "0.00"} kg as-fed</b>
                                        </div>
                                        <ul className="space-y-1 text-sm">
                                            {distribution.perFeed.filter((p) => p.cls === cls).length === 0 ? (
                                                <li className="text-neutral-400">Tanlovda mos ozuqa yo‘q</li>
                                            ) : (
                                                distribution.perFeed
                                                    .filter((p) => p.cls === cls)
                                                    .map((p) => (
                                                        <li key={`${cls}-${p.name}`} className="flex justify-between">
                                                            <span>{p.name}</span>
                                                            <span className="font-medium">
                                {roundFeed(p.kg).toFixed(1)} kg as-fed <span className="text-neutral-500">| {roundFeed(p.dm).toFixed(1)} kg DM</span>
                              </span>
                                                        </li>
                                                    ))
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            {/* Ogohlantirishlar */}
                            {warnings.length > 0 && (
                                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                                    <b>Ogohlantirishlar:</b>
                                    <ul className="list-disc pl-5 mt-1">
                                        {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                                    </ul>
                                </div>
                            )}

                            {/* Tavsiyalar (AI) */}
                            {tips.length > 0 && (
                                <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                                    <b>Tavsiyalar (AI):</b>
                                    <ul className="list-disc pl-5 mt-1">
                                        {tips.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Ro'yxatlar */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-sm font-medium mb-2">Tanlangan ozuqalar</div>
                                    <ul className="list-disc pl-5 text-sm text-neutral-700">
                                        {selectedFeeds.length ? selectedFeeds.map((f) => <li key={f.feed_name}>{f.feed_name}</li>) : <li className="text-neutral-400">Hali tanlanmagan</li>}
                                    </ul>
                                </div>
                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-sm font-medium mb-2">Izoh / Cheklovlar</div>
                                    <p className="text-sm text-neutral-700">
                                        Ratsionni 3–5 kun davomida bosqichma-bosqich joriy qiling. Suv erkin bo‘lsin.
                                        Konsentratni keskin oshirmang; dag‘al ulushi minimal chegaradan past tushmasin.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Export tugmalari */}
                        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                            <button onClick={exportPNG} disabled={!canGenerate} className={`rounded-xl px-4 py-2 text-sm font-medium ${canGenerate ? "bg-neutral-900 text-white hover:bg-black" : "bg-neutral-200 text-neutral-500"}`}>PNG eksport</button>
                            <button onClick={exportPDF} disabled={!canGenerate} className={`rounded-xl px-4 py-2 text-sm font-medium ${canGenerate ? "bg-neutral-900 text-white hover:bg-black" : "bg-neutral-200 text-neutral-500"}`}>PDF eksport</button>
                            <button onClick={doPrint} disabled={!canGenerate} className={`rounded-xl px-4 py-2 text-sm font-medium ${canGenerate ? "bg-white border border-neutral-300 hover:bg-neutral-100" : "bg-neutral-200 text-neutral-500"}`}>Print</button>
                        </div>
                    </section>
                </div>

                {/* PREVIEW / EXPORT VIEW */}
                <section className={`${previewMode ? "" : "hidden"} print:block`}>
                    <div
                        ref={exportRef}
                        className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow print:shadow-none print:rounded-none"
                        style={{
                            backgroundImage:
                                "radial-gradient(at 20% 0%, rgba(77,208,225,0.10), transparent 50%), radial-gradient(at 80% 100%, rgba(255,165,0,0.10), transparent 50%)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold">Kundalik ozuqa ratsioni — {CATEGORY_LABELS[category]}</h2>
                                <div className="text-sm text-neutral-600">
                                    Tirik vazn: <b>{weight} kg</b>
                                    {category === "dairy_cow" && <> · Sut: <b>{milk} l/kun</b></>}
                                </div>
                            </div>
                            <div className="text-right text-xs text-neutral-500">
                                Sana: {new Date().toLocaleDateString()}<br />
                                Cheklovchi: <b>{mass.limiting === "energy" ? (category.startsWith("beef_bull") ? "ME" : "NeL") : mass.limiting === "protein" ? "Oqsil (CP)" : "-"}</b>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="rounded-xl border border-neutral-200 p-3">
                                <div className="text-[11px] uppercase text-neutral-500">Normativ</div>
                                <div className="text-sm">
                                    {category.startsWith("beef_bull") ? (
                                        <>ME: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />Oqsil (CP): <b>{Math.round(norms.protein_g)}</b> g/kun</>
                                    ) : (
                                        <>NeL: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />Oqsil (CP): <b>{Math.round(norms.protein_g)}</b> g/kun</>
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl border border-neutral-200 p-3">
                                <div className="text-[11px] uppercase text-neutral-500">O‘rtacha tarkib</div>
                                <div className="text-sm">
                                    {(() => {
                                        const dmm = dmMetrics(avg);
                                        return (
                                            <>
                                                NeL: <b>{avg.nel.toFixed(2)}</b> · ME: <b>{avg.me.toFixed(2)}</b> MJ/kg<br />
                                                Oqsil (CP): <b>{Math.round(avg.prot_perkg * 1000)}</b> g/kg · TS: <b>{Math.round(avg.ts_perkg * 100)}%</b><br />
                                                DM bazada: <b>{dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM</b> · <b>{dmm.cpPctDM.toFixed(1)}% CP</b>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="rounded-xl border border-neutral-200 p-3">
                                <div className="text-[11px] uppercase text-neutral-500">Umumiy massa</div>
                                <div className="text-sm">
                                    <b>{effectiveTotal ? `${effectiveTotal.toFixed(2)} kg/kun as-fed` : "-"}</b><br />
                                    ≈ {(effectiveTotal * (avg.ts_perkg || 0)).toFixed(2)} kg DM/kun
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            {(["roughage", "energy", "protein"] as FeedClass[]).map((cls) => (
                                <div key={cls} className="rounded-xl border border-neutral-200 p-3">
                                    <div className="text-sm font-medium mb-1">
                                        {cls === "roughage" ? "Dag‘al" : cls === "energy" ? "Energiya" : "Oqsil (CP)"} — {classPercents[cls]}%
                                    </div>
                                    <ul className="text-sm space-y-1">
                                        {distribution.perFeed.filter((p) => p.cls === cls).length === 0 ? (
                                            <li className="text-neutral-400">Mos ozuqa yo‘q</li>
                                        ) : (
                                            distribution.perFeed
                                                .filter((p) => p.cls === cls)
                                                .map((p) => (
                                                    <li key={`${cls}-${p.name}`} className="flex justify-between">
                                                        <span>{p.name}</span>
                                                        <span className="font-medium">{roundFeed(p.kg).toFixed(1)} kg as-fed <span className="text-neutral-500">| {roundFeed(p.dm).toFixed(1)} kg DM</span></span>
                                                    </li>
                                                ))
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-xl border border-neutral-200 p-3">
                            <div className="text-sm font-medium mb-1">Eslatma</div>
                            <div className="text-sm text-neutral-700">
                                Ratsion 3–5 kunda bosqichma-bosqich joriy qilinadi. Suv erkin bo‘lsin.
                                DM limiti bo‘lsa, energiya zich yem qo‘shing (NeL/ME yuqori) yoki foizlarni moslang.
                            </div>
                        </div>

                        <div className="mt-3 text-[11px] text-neutral-500">* Bu varaq faqat natijalar uchun. Interaktiv UI yashirilgan.</div>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="mt-8 print:hidden">
                    <p className="text-xs text-neutral-500">© {new Date().getFullYear()} RationGen UZ — amaliy hisob-kitob namoyishi. Veterinar/zootehnik bilan maslahatlashib foydalaning.</p>
                </footer>
            </div>

            {/* PRINT CSS */}
            <style>{`
        @media print {
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
        </div>
    );
}