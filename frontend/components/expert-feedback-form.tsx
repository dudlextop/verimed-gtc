"use client";

import { useState } from "react";
import type { ExpertFeedback } from "@/lib/types";
import { Button, Select } from "@/components/ui";

export function ExpertFeedbackForm({ pattern = false, saving, onSave }: { pattern?: boolean; saving: boolean; onSave: (feedback: Partial<ExpertFeedback>) => Promise<void> }) {
  const [usefulness, setUsefulness] = useState("");
  const [quality, setQuality] = useState("");
  const [sufficiency, setSufficiency] = useState("");
  const [priority, setPriority] = useState("");
  const [grouping, setGrouping] = useState("");
  const [graph, setGraph] = useState("");
  const hasValue = usefulness || quality || sufficiency || priority || grouping || graph;
  return <div className="rounded-lg bg-violet-50 p-4"><h3 className="font-bold">Обратная связь о качестве анализа</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Оценка сохраняется в истории и не изменяет аналитическую модель автоматически.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Полезность"><Select value={usefulness} onChange={(event) => setUsefulness(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Полезный</option><option>Частично полезный</option><option>Бесполезный</option></Select></Field><Field label="Качество объяснения"><Select value={quality} onChange={(event) => setQuality(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Понятное</option><option>Требует уточнения</option><option>Непонятное</option></Select></Field><Field label="Достаточность данных"><Select value={sufficiency} onChange={(event) => setSufficiency(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Достаточно</option><option>Частично достаточно</option><option>Недостаточно</option></Select></Field><Field label="Корректность приоритета"><Select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Занижен</option><option>Корректен</option><option>Завышен</option></Select></Field>{pattern && <><Field label="Корректность группировки"><Select value={grouping} onChange={(event) => setGrouping(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Корректная</option><option>Частично корректная</option><option>Некорректная</option></Select></Field><Field label="Полезность графа связей"><Select value={graph} onChange={(event) => setGraph(event.target.value)} className="w-full"><option value="">Не выбрано</option><option>Полезный</option><option>Частично полезный</option><option>Бесполезный</option></Select></Field></>}</div><Button className="mt-4" disabled={!hasValue || saving} onClick={() => void onSave({ usefulness: usefulness || null, explanation_quality: quality || null, data_sufficiency: sufficiency || null, priority_correctness: priority || null, grouping_correctness: grouping || null, graph_usefulness: graph || null, comment: "" })}>{saving ? "Сохранение…" : "Сохранить обратную связь"}</Button></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1 block text-xs font-semibold">{label}</span>{children}</label>; }
