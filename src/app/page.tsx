"use client";

import React, { useState, useCallback } from "react";
import { CATEGORY_LABELS, FEEDS } from "@/lib/ration/data";
import { CategoryKey, FeedClass, UserFeedAmount } from "@/lib/ration/types";
import { dmMetrics, roundFeed } from "@/lib/ration/utils";
import { useRationCalculations } from "@/lib/ration/hooks";

/** =========================================================
 *  KOMPONENT
 * ======================================================= */
export default function RationGeneratorUZ() {
    // --- Holat ---
    const [category, setCategory] = useState<CategoryKey>("sut_sigirlar");
    const [weight, setWeight] = useState<number>(500);
    const [milk, setMilk] = useState<number>(0);
    const [selected, setSelected] = useState<string[]>([]);
    const [userFeedAmounts, setUserFeedAmounts] = useState<UserFeedAmount[]>([]);
    const [previewMode, setPreviewMode] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Validierung der Eingabewerte
    const validateInputs = useCallback(() => {
        const newErrors: string[] = [];
        
        if (weight <= 0 || weight > 10000) {
            newErrors.push("Tirik vazn 0 dan katta va 10000 kg dan kichik bo'lishi kerak");
        }
        
        if (milk < 0 || milk > 100) {
            newErrors.push("Sut miqdori 0 dan katta va 100 l dan kichik bo'lishi kerak");
        }
        
        if (selected.length === 0) {
            newErrors.push("Kamida bitta ozuqa tanlanishi kerak");
        }
        
        // Überprüfe, ob alle benutzerdefinierten Mengen gültig sind
        userFeedAmounts.forEach(ufa => {
            if (ufa.amount < 0 || ufa.amount > 100) {
                newErrors.push(`${ufa.feedName} miqdori noto'g'ri (0-100 kg oralig'ida bo'lishi kerak)`);
            }
        });
        
        setErrors(newErrors);
        return newErrors.length === 0;
    }, [weight, milk, selected, userFeedAmounts]);

    const { selectedFeeds, avg, norms, mass, dmMax, effectiveTotal, coverage, classPercents, distribution, warnings, tips } =
        useRationCalculations(category, weight, milk, selected, userFeedAmounts);

    const toggle = useCallback((name: string) => {
        setSelected(prev => {
            if (prev.includes(name)) {
                // Remove from selected and user amounts
                setUserFeedAmounts(prevAmounts => prevAmounts.filter(ufa => ufa.feedName !== name));
                return prev.filter(x => x !== name);
            } else {
                return [...prev, name];
            }
        });
    }, []);

    const updateUserFeedAmount = useCallback((feedName: string, amount: number) => {
        if (amount < 0 || !Number.isFinite(amount)) return;
        
        setUserFeedAmounts(prev => {
            const existing = prev.find(ufa => ufa.feedName === feedName);
            if (existing) {
                if (amount <= 0) {
                    return prev.filter(ufa => ufa.feedName !== feedName);
                } else {
                    return prev.map(ufa => ufa.feedName === feedName ? { ...ufa, amount } : ufa);
                }
            } else if (amount > 0) {
                return [...prev, { feedName, amount }];
            }
            return prev;
        });
    }, []);

    const getUserFeedAmount = useCallback((feedName: string) => {
        return userFeedAmounts.find(ufa => ufa.feedName === feedName)?.amount || 0;
    }, [userFeedAmounts]);

    const handleWeightChange = useCallback((value: string) => {
        const numValue = Number(value);
        if (numValue > 0 && numValue <= 10000) {
            setWeight(numValue);
        }
    }, []);

    const handleMilkChange = useCallback((value: string) => {
        const numValue = Number(value);
        if (numValue >= 0 && numValue <= 100) {
            setMilk(numValue);
        }
    }, []);

    const canGenerate = selectedFeeds.length > 0 && weight > 0 && errors.length === 0;

    // Validierung bei Änderungen
    React.useEffect(() => {
        validateInputs();
    }, [validateInputs]);

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

                {/* Fehleranzeige */}
                {errors.length > 0 && (
                    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                        <b>Xatoliklar:</b>
                        <ul className="list-disc pl-5 mt-1">
                            {errors.map((error, i) => (<li key={i}>{error}</li>))}
                        </ul>
                    </div>
                )}

                {/* GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                    {/* INPUTS */}
                    <section className="lg:col-span-1">
                        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
                            <h2 className="text-lg font-semibold mb-4">Kirish ma'lumotlari</h2>

                            <label className="block text-sm font-medium mb-1">Hayvon toifasi</label>
                            <select 
                                value={category} 
                                onChange={(e) => setCategory(e.target.value as CategoryKey)} 
                                className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                    <option value={k} key={k}>{v}</option>
                                ))}
                            </select>

                            <label className="block text-sm font-medium mb-1">Tirik vazn (kg)</label>
                            <input 
                                type="number" 
                                min={1} 
                                max={10000}
                                value={weight} 
                                onChange={(e) => handleWeightChange(e.target.value)} 
                                className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" 
                            />

                            {category === "sut_sigirlar" && (
                                <>
                                    <label className="block text-sm font-medium mb-1">Sut (l/kun) — ixtiyoriy</label>
                                    <input 
                                        type="number" 
                                        min={0} 
                                        max={100}
                                        value={milk} 
                                        onChange={(e) => handleMilkChange(e.target.value)} 
                                        className="w-full mb-4 rounded-xl border border-neutral-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400" 
                                        placeholder="Masalan: 18" 
                                    />
                                </>
                            )}

                            <label className="block text-sm font-medium mb-2">Mavjud ozuqalar (bir nechtasini tanlang)</label>
                            <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200 p-3">
                                {FEEDS.map((f) => (
                                    <div key={f.feed_name} className="border-b border-neutral-100 last:border-b-0 py-2">
                                        <label className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={selected.includes(f.feed_name)} 
                                                onChange={() => toggle(f.feed_name)} 
                                                className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500" 
                                            />
                                            <span className="text-sm flex-1">
                                                {f.feed_name}
                                                <span className="text-neutral-500"> — NeL {f.energy_nel_kg} MJ/kg · ME {f.energy_me} MJ/kg · Oqsil {Math.round(f.protein_kg * 1000)} g/kg · <span className="uppercase">{f.class}</span></span>
                                            </span>
                                        </label>
                                        {selected.includes(f.feed_name) && (
                                            <div className="mt-2 ml-7 flex items-center gap-2">
                                                <label className="text-xs text-neutral-600">Miktori (kg/kun):</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.1"
                                                    value={getUserFeedAmount(f.feed_name)}
                                                    onChange={(e) => updateUserFeedAmount(f.feed_name, Number(e.target.value) || 0)}
                                                    className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                                                    placeholder="0.0"
                                                />
                                                <span className="text-xs text-neutral-500">
                                                    {getUserFeedAmount(f.feed_name) > 0 ? 
                                                        `≈ ${(getUserFeedAmount(f.feed_name) * f.ts_kg).toFixed(2)} kg DM` : 
                                                        "Avtomatik"
                                                    }
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-neutral-500 mt-3">
                                * Foizlar toifa bo'yicha avtomatik qo'llanadi. Kerak bo'lsa CLASS_RATIOS ni tahrirlang.
                                <br />
                                * 👤 belgisi bilan ko'rsatilgan ozuqalar siz tomonidan belgilangan miqdorda beriladi.
                                <br />
                                * Miqdori belgilanmagan ozuqalar avtomatik hisoblanadi.
                            </p>
                        </div>
                    </section>

                    {/* OUTPUTS */}
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200 p-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Natija</h2>
                                <button 
                                    disabled={!canGenerate} 
                                    className={`rounded-xl px-4 py-2 text-sm font-medium ${canGenerate ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-neutral-200 text-neutral-500"}`} 
                                    onClick={() => {}}
                                >
                                    Generatsiya qilish
                                </button>
                            </div>

                            {/* Qisqa xulosa */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-xs uppercase text-neutral-500">Normativ talab</div>
                                    <div className="mt-1 text-sm">
                                        {category === "buqalar_yetuk" ? (
                                            <>
                                                ME: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />
                                                Oqsil: <b>{Math.round(norms.protein_g)}</b> g/kun
                                            </>
                                        ) : (
                                            <>
                                                NeL: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />
                                                Oqsil: <b>{Math.round(norms.protein_g)}</b> g/kun
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-xs uppercase text-neutral-500">O'rtacha tarkib (tanlangan)</div>
                                    <div className="mt-1 text-sm">
                                        {(() => {
                                            try {
                                                const dmm = dmMetrics(avg);
                                                return (
                                                    <>
                                                        NeL: <b>{avg.nel.toFixed(2)}</b> · ME: <b>{avg.me.toFixed(2)}</b> MJ/kg<br />
                                                        Oqsil: <b>{Math.round(avg.prot_perkg * 1000)}</b> g/kg · TS: <b>{Math.round(avg.ts_perkg * 100)}%</b><br />
                                                        <span className="text-neutral-600">DM bazada: <b>{dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM</b> · <b>{dmm.cpPctDM.toFixed(1)}% CP</b></span>
                                                    </>
                                                );
                                            } catch (error) {
                                                return <span className="text-red-600">Xatolik yuz berdi</span>;
                                            }
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
                                                ? (category === "buqalar_yetuk" ? "ME" : "NeL")
                                                : mass.limiting === "protein"
                                                    ? "Oqsil"
                                                    : "-"}
                                        </b><br />
                                        {effectiveTotal < mass.total && <span className="text-amber-600 font-medium">Talab qoplanishi: {coverage}% </span>}
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
                                            {cls === "roughage" ? "Dag'al ozuqa" : cls === "energy" ? "Energiya ozuqa" : "Oqsil ozuqa"}
                                        </div>
                                        <div className="text-xs text-neutral-500 mb-2">
                                            Foiz: {classPercents[cls]}% — <b>{effectiveTotal ? (effectiveTotal * (classPercents[cls] / 100)).toFixed(2) : "0.00"} kg as-fed</b>
                                        </div>
                                        <ul className="space-y-1 text-sm">
                                            {distribution.perFeed.filter((p) => p.cls === cls).length === 0 ? (
                                                <li className="text-neutral-400">Tanlovda mos ozuqa yo'q</li>
                                            ) : (
                                                distribution.perFeed
                                                    .filter((p) => p.cls === cls)
                                                    .map((p) => (
                                                        <li key={`${cls}-${p.name}`} className="flex justify-between items-center">
                                                            <span className="flex items-center gap-2">
                                                                {p.name}
                                                                {p.isUserDefined && (
                                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                                        👤
                                                                    </span>
                                                                )}
                                                            </span>
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
                                        Ratsionni 3–5 kun davomida bosqichma-bosqich joriy qiling. Suv erkin bo'lsin.
                                        Konsentratni keskin oshirmang; dag'al ulushi minimal chegaradan past tushmasin.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* PREVIEW / EXPORT VIEW */}
                <section className={`${previewMode ? "" : "hidden"}`}>
                    <div
                        className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow"
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
                                    {category === "sut_sigirlar" && <> · Sut: <b>{milk} l/kun</b></>}
                                </div>
                            </div>
                            <div className="text-right text-xs text-neutral-500">
                                Sana: {new Date().toLocaleDateString()}<br />
                                Cheklovchi: <b>{mass.limiting === "energy" ? (category === "buqalar_yetuk" ? "ME" : "NeL") : mass.limiting === "protein" ? "Oqsil" : "-"}</b>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="rounded-xl border border-neutral-200 p-3">
                                <div className="text-[11px] uppercase text-neutral-500">Normativ</div>
                                <div className="text-sm">
                                    {category === "buqalar_yetuk" ? (
                                        <>ME: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />Oqsil: <b>{Math.round(norms.protein_g)}</b> g/kun</>
                                    ) : (
                                        <>NeL: <b>{norms.energy_MJ.toFixed(1)}</b> MJ/kun<br />Oqsil: <b>{Math.round(norms.protein_g)}</b> g/kun</>
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl border border-neutral-200 p-3">
                                <div className="text-[11px] uppercase text-neutral-500">O'rtacha tarkib</div>
                                <div className="text-sm">
                                    {(() => {
                                        try {
                                            const dmm = dmMetrics(avg);
                                            return (
                                                <>
                                                    NeL: <b>{avg.nel.toFixed(2)}</b> · ME: <b>{avg.me.toFixed(2)}</b> MJ/kg<br />
                                                    Oqsil: <b>{Math.round(avg.prot_perkg * 1000)}</b> g/kg · TS: <b>{Math.round(avg.ts_perkg * 100)}%</b><br />
                                                    DM bazada: <b>{dmm.nelPerKgDM.toFixed(2)} MJ NeL/kg DM</b> · <b>{dmm.cpPctDM.toFixed(1)}% CP</b>
                                                </>
                                            );
                                        } catch (error) {
                                            return <span className="text-red-600">Xatolik yuz berdi</span>;
                                        }
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
                                        {cls === "roughage" ? "Dag'al" : cls === "energy" ? "Energiya" : "Oqsil"} — {classPercents[cls]}%
                                    </div>
                                    <ul className="text-sm space-y-1">
                                        {distribution.perFeed.filter((p) => p.cls === cls).length === 0 ? (
                                            <li className="text-neutral-400">Mos ozuqa yo'q</li>
                                        ) : (
                                            distribution.perFeed
                                                .filter((p) => p.cls === cls)
                                                .map((p) => (
                                                    <li key={`${cls}-${p.name}`} className="flex justify-between">
                                                        <span className="flex items-center gap-1">
                                                            {p.name}
                                                            {p.isUserDefined && <span className="text-blue-600">👤</span>}
                                                        </span>
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
                                Ratsion 3–5 kunda bosqichma-bosqich joriy qilinadi. Suv erkin bo'lsin.
                                DM limiti bo'lsa, energiya zich yem qo'shing (NeL/ME yuqori) yoki foizlarni moslang.
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
        </div>
    );
}