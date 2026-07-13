"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Focus, Maximize2, Network } from "lucide-react";
import type { PatternGraph, PatternGraphNode } from "@/lib/types";
import { money } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

const nodeStyles: Record<PatternGraphNode["node_type"], string> = {
  pattern: "border-importance bg-importance text-white shadow-[0_12px_32px_-16px_hsl(var(--importance)/.8)]",
  organization: "border-indigo-200 bg-indigo-50 text-indigo-950",
  doctor: "border-cyan-200 bg-cyan-50 text-cyan-950",
  patient: "border-border-strong bg-card text-foreground",
  service: "border-emerald-200 bg-emerald-50 text-emerald-950",
  signal: "border-amber-200 bg-amber-50 text-amber-950",
};

const nodeDot: Record<PatternGraphNode["node_type"], string> = {
  pattern: "bg-importance", organization: "bg-indigo-500", doctor: "bg-cyan-600", patient: "bg-slate-500", service: "bg-emerald-600", signal: "bg-amber-500",
};

const nodeLabels: Record<PatternGraphNode["node_type"], string> = {
  pattern: "Модель", organization: "Организация", doctor: "Врач", patient: "Пациент", service: "Услуга", signal: "Сигнал",
};

export function RelationshipGraph({ data }: { data: PatternGraph }) {
  const rootId = `pattern-${data.pattern_id}`;
  const [expanded, setExpanded] = useState(false);
  const [focusedId, setFocusedId] = useState(rootId);
  const visibleNodes = useMemo(() => {
    const root = data.nodes.find((node) => node.id === rootId);
    const primary = data.nodes.filter((node) => node.id !== rootId && node.is_primary);
    const remaining = data.nodes.filter((node) => node.id !== rootId && !node.is_primary);
    return [...(root ? [root] : []), ...primary, ...remaining].slice(0, expanded ? 30 : 12);
  }, [data.nodes, expanded, rootId]);
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    const root = visibleNodes.find((node) => node.id === rootId) ?? visibleNodes[0];
    if (root) result.set(root.id, { x: 50, y: 50 });
    const others = visibleNodes.filter((node) => node.id !== root?.id);
    others.forEach((node, index) => {
      const firstRing = index < 8;
      const ringIndex = firstRing ? index : index - 8;
      const ringCount = firstRing ? Math.min(8, others.length) : Math.max(1, others.length - 8);
      const angle = (Math.PI * 2 * ringIndex) / ringCount - Math.PI / 2;
      result.set(node.id, { x: 50 + Math.cos(angle) * (firstRing ? 34 : 43), y: 50 + Math.sin(angle) * (firstRing ? 34 : 43) });
    });
    return result;
  }, [rootId, visibleNodes]);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const focusedNode = data.nodes.find((node) => node.id === focusedId) ?? data.nodes.find((node) => node.id === rootId);
  const visibleTypes = (Object.keys(nodeLabels) as PatternGraphNode["node_type"][]).filter((type) => data.nodes.some((node) => node.node_type === type));

  return <div data-testid="relationship-graph">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-x-3 gap-y-2" aria-label="Легенда графа">{visibleTypes.map((type) => <span key={type} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 text-xs font-semibold text-muted-foreground"><span className={cn("h-2.5 w-2.5 rounded-full", nodeDot[type])} aria-hidden="true"/>{nodeLabels[type]}</span>)}</div>{data.nodes.length > 12 && <Button variant="outline" onClick={() => setExpanded((value) => !value)}><Maximize2 className="h-4 w-4" aria-hidden="true"/>{expanded ? "Показать ключевые связи" : "Показать больше связей"}</Button>}</div>
    <div className="space-y-2 md:hidden" data-testid="relationship-mobile-list">{visibleNodes.filter((node) => node.id !== rootId).slice(0, expanded ? 12 : 6).map((node) => <button key={node.id} type="button" onClick={() => setFocusedId(node.id)} className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring", node.id === focusedId ? "border-importance/35 bg-importance-soft ring-1 ring-importance/20" : "border-border/75")}><span className="flex min-w-0 items-center gap-3"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", nodeDot[node.node_type])} aria-hidden="true"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{node.label}</span><span className="block truncate text-xs text-muted-foreground">{nodeLabels[node.node_type]} · {node.subtitle}</span></span></span><span className="shrink-0 font-mono text-xs font-bold tabular-nums">{node.signal_count}</span></button>)}</div>
    <details className="disclosure mt-3 md:hidden"><summary>Открыть граф связей</summary><div className="border-t border-border/70 p-2"><GraphCanvas nodes={visibleNodes} edges={edges} positions={positions} rootId={rootId} focusedId={focusedId} onFocus={setFocusedId}/></div></details>
    <div className="hidden overflow-hidden rounded-lg border border-importance/10 bg-surface-soft p-3 md:block"><GraphCanvas nodes={visibleNodes} edges={edges} positions={positions} rootId={rootId} focusedId={focusedId} onFocus={setFocusedId}/></div>
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/75 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-importance-soft text-importance"><Focus className="h-4 w-4" aria-hidden="true"/></span><div><p className="text-sm font-semibold">{focusedNode?.label ?? "Центральная модель"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{focusedNode ? `${nodeLabels[focusedNode.node_type]} · ${focusedNode.subtitle} · ${money(focusedNode.financial_significance)}` : "Выберите узел для краткого контекста."}</p>{focusedNode?.href && <Link href={focusedNode.href} className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">Открыть объект</Link>}</div></div><p className="flex items-center gap-2 text-xs text-muted-foreground"><Network className="h-4 w-4" aria-hidden="true"/>Показано узлов: {visibleNodes.length}</p></div>
  </div>;
}

function GraphCanvas({nodes, edges, positions, rootId, focusedId, onFocus}: {nodes: PatternGraphNode[]; edges: PatternGraph["edges"]; positions: Map<string, {x: number; y: number}>; rootId: string; focusedId: string; onFocus: (id: string) => void}) {
  const connectedIds = new Set<string>([focusedId]);
  edges.forEach((edge) => { if (edge.source === focusedId) connectedIds.add(edge.target); if (edge.target === focusedId) connectedIds.add(edge.source); });
  const focusActive = focusedId !== rootId;
  return <div className="relative h-[320px] w-full overflow-hidden rounded-md bg-[radial-gradient(circle_at_center,hsl(var(--importance)/.10),transparent_42%),linear-gradient(hsl(var(--border)/.28)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/.28)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px] md:h-[460px] xl:h-[520px]">
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">{edges.map((edge) => { const source = positions.get(edge.source); const target = positions.get(edge.target); if (!source || !target) return null; const selected = edge.source === focusedId || edge.target === focusedId; const rootConnection = edge.source === rootId || edge.target === rootId; return <line key={edge.id} x1={source.x * 10} y1={source.y * 6.2} x2={target.x * 10} y2={target.y * 6.2} className={selected ? "stroke-importance" : rootConnection && !focusActive ? "stroke-indigo-300" : "stroke-slate-300"} strokeOpacity={selected ? 0.9 : rootConnection && !focusActive ? 0.62 : 0.28} strokeWidth={selected ? 2.2 : rootConnection ? 1.5 : 1}/>; })}</svg>
    {nodes.map((node) => { const position = positions.get(node.id); if (!position) return null; const dimmed = focusActive && !connectedIds.has(node.id) && node.id !== rootId; const className = cn("absolute z-10 flex min-h-10 max-w-28 -translate-x-1/2 -translate-y-1/2 items-center rounded-md border px-2 py-1.5 text-left text-[10px] font-semibold shadow-sm transition-[opacity,transform,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:max-w-40 sm:px-3 sm:py-2 sm:text-xs", nodeStyles[node.node_type], node.id === rootId && "z-20 min-h-14 min-w-32 border-white/30 shadow-raised sm:min-w-40", node.id === focusedId && node.id !== rootId && "z-20 ring-2 ring-importance ring-offset-2", dimmed && "opacity-35"); return <button key={node.id} type="button" title={`${nodeLabels[node.node_type]}: ${node.label}. ${node.subtitle}`} onClick={() => onFocus(node.id)} className={className} style={{left: `${position.x}%`, top: `${position.y}%`}}><span className="min-w-0"><span className="block truncate">{node.label}</span><span className={cn("mt-0.5 block truncate text-[9px] font-normal sm:text-[11px]", node.node_type === "pattern" ? "text-blue-100" : "opacity-70")}>{node.subtitle}</span></span></button>; })}
  </div>;
}
