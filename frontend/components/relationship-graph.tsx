"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Focus, Maximize2, Network } from "lucide-react";
import type { PatternGraph, PatternGraphNode } from "@/lib/types";
import { money, number } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "./foundation";

type NodeType = PatternGraphNode["node_type"] | string;

const nodeStyles: Record<PatternGraphNode["node_type"], string> = {
  pattern: "border-v2-primary bg-v2-primary text-white shadow-v2-dropdown",
  organization: "border-v2-primary/35 bg-v2-primary-soft text-v2-text",
  doctor: "border-v2-cyan/45 bg-v2-cyan-soft text-v2-text",
  patient: "border-v2-border-strong bg-v2-surface text-v2-text",
  service: "border-v2-teal/45 bg-v2-teal-soft text-v2-text",
  signal: "border-v2-warning/45 bg-v2-warning-soft text-v2-text",
};

const nodeDots: Record<PatternGraphNode["node_type"], string> = {
  pattern: "bg-v2-primary",
  organization: "bg-v2-primary-hover",
  doctor: "bg-v2-cyan",
  patient: "bg-v2-text-muted",
  service: "bg-v2-teal",
  signal: "bg-v2-warning",
};

const nodeLabels: Record<PatternGraphNode["node_type"], string> = {
  pattern: "Модель",
  organization: "Организация",
  doctor: "Врач",
  patient: "Пациент",
  service: "Услуга",
  signal: "Сигнал",
};

export function graphNodeLabel(type: NodeType) {
  return nodeLabels[type as PatternGraphNode["node_type"]] ?? "Другой объект";
}

export function graphNodeStyle(type: NodeType) {
  return nodeStyles[type as PatternGraphNode["node_type"]] ?? "border-v2-border-strong bg-v2-surface text-v2-text";
}

export function graphNodeDot(type: NodeType) {
  return nodeDots[type as PatternGraphNode["node_type"]] ?? "bg-v2-text-muted";
}

export function RelationshipGraph({ data }: { data: PatternGraph }) {
  const rootId = `pattern-${data.pattern_id}`;
  const [expanded, setExpanded] = useState(false);
  const [focusedId, setFocusedId] = useState(rootId);
  const [mobileGraphOpen, setMobileGraphOpen] = useState(false);
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
  const visibleTypes = Array.from(new Set(data.nodes.map((node) => node.node_type)));

  return <div data-testid="relationship-graph" aria-describedby="relationship-graph-description">
    <p id="relationship-graph-description" className="sr-only">Интерактивное представление связей модели. На мобильных устройствах сначала доступен текстовый список участников; выбор элемента обновляет контекст под графом.</p>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-x-3 gap-y-2" aria-label="Легенда графа">
        {visibleTypes.map((type) => <span key={type} className="inline-flex min-h-8 items-center gap-2 rounded-v2-control border border-v2-border bg-v2-surface px-2.5 text-xs font-semibold text-v2-text-secondary"><span className={cn("h-2.5 w-2.5 rounded-full", graphNodeDot(type))} aria-hidden="true" />{graphNodeLabel(type)}</span>)}
      </div>
      {data.nodes.length > 12 && <Button variant="secondary" size="compact" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><Maximize2 className="h-4 w-4" aria-hidden="true" />{expanded ? "Показать ключевые связи" : "Показать больше связей"}</Button>}
    </div>

    <div className="space-y-2 md:hidden" data-testid="relationship-mobile-list" aria-label="Текстовый список связей">
      {visibleNodes.filter((node) => node.id !== rootId).slice(0, expanded ? 12 : 6).map((node) => <button
        key={node.id}
        type="button"
        aria-pressed={node.id === focusedId}
        onClick={() => setFocusedId(node.id)}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-v2-control border bg-v2-surface px-3 py-2 text-left",
          "transition-[background-color,border-color] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none",
          node.id === focusedId ? "border-v2-primary bg-v2-selected" : "border-v2-border hover:border-v2-primary hover:bg-v2-primary-soft",
        )}
      >
        <span className="flex min-w-0 items-center gap-3"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", graphNodeDot(node.node_type))} aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-v2-text">{node.label}</span><span className="block truncate text-xs text-v2-text-secondary">{graphNodeLabel(node.node_type)} · {node.subtitle}</span></span></span>
        <span className="v2-tabular shrink-0 text-xs font-bold text-v2-text">{number(node.signal_count)}</span>
      </button>)}
    </div>

    <details className="group mt-3 overflow-hidden rounded-v2-card border border-v2-border bg-v2-surface md:hidden" onToggle={(event) => setMobileGraphOpen(event.currentTarget.open)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-v2-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v2-primary">Открыть визуальный граф<Maximize2 className="h-4 w-4 text-v2-primary" aria-hidden="true" /></summary>
      {mobileGraphOpen && <div className="border-t border-v2-border p-2"><GraphCanvas nodes={visibleNodes} edges={edges} positions={positions} rootId={rootId} focusedId={focusedId} onFocus={setFocusedId} /></div>}
    </details>
    <div className="hidden overflow-hidden rounded-v2-card border border-v2-border bg-v2-surface-soft p-3 md:block"><GraphCanvas nodes={visibleNodes} edges={edges} positions={positions} rootId={rootId} focusedId={focusedId} onFocus={setFocusedId} /></div>

    <div className="mt-3 flex flex-col gap-3 rounded-v2-card border border-v2-border bg-v2-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-v2-control bg-v2-primary-soft text-v2-primary"><Focus className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-v2-text">{focusedNode?.label ?? "Центральная модель"}</p>
          {focusedNode ? <div className="mt-1 space-y-0.5 text-xs leading-5 text-v2-text-secondary"><p>{graphNodeLabel(focusedNode.node_type)} · {focusedNode.subtitle}</p><p>{number(focusedNode.signal_count)} сигналов · {money(focusedNode.financial_significance)}</p></div> : <p className="mt-1 text-xs text-v2-text-secondary">Выберите узел для краткого контекста.</p>}
          {focusedNode?.href && <Link href={focusedNode.href} className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-v2-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">Открыть объект</Link>}
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-v2-text-secondary"><Network className="h-4 w-4" aria-hidden="true" />Показано узлов: {visibleNodes.length}</p>
    </div>
  </div>;
}

function GraphCanvas({ nodes, edges, positions, rootId, focusedId, onFocus }: { nodes: PatternGraphNode[]; edges: PatternGraph["edges"]; positions: Map<string, { x: number; y: number }>; rootId: string; focusedId: string; onFocus: (id: string) => void }) {
  const connectedIds = new Set<string>([focusedId]);
  edges.forEach((edge) => {
    if (edge.source === focusedId) connectedIds.add(edge.target);
    if (edge.target === focusedId) connectedIds.add(edge.source);
  });
  const focusActive = focusedId !== rootId;

  return <div className="relative h-[320px] w-full overflow-hidden rounded-v2-control bg-v2-surface-soft bg-[linear-gradient(var(--v2-border)_1px,transparent_1px),linear-gradient(90deg,var(--v2-border)_1px,transparent_1px)] bg-[size:28px_28px] md:h-[460px] xl:h-[520px]">
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      {edges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) return null;
        const selected = edge.source === focusedId || edge.target === focusedId;
        const rootConnection = edge.source === rootId || edge.target === rootId;
        const dimmed = focusActive && !selected;
        return <line
          key={edge.id}
          data-graph-edge-id={edge.id}
          data-dimmed={dimmed || undefined}
          x1={source.x * 10}
          y1={source.y * 6.2}
          x2={target.x * 10}
          y2={target.y * 6.2}
          className={selected || (rootConnection && !focusActive) ? "stroke-v2-primary" : "stroke-v2-border-strong"}
          strokeOpacity={selected ? 0.9 : rootConnection && !focusActive ? 0.5 : dimmed ? 0.12 : 0.25}
          strokeWidth={selected ? 2.2 : rootConnection ? 1.5 : 1}
        />;
      })}
    </svg>
    {nodes.map((node) => {
      const position = positions.get(node.id);
      if (!position) return null;
      const dimmed = focusActive && !connectedIds.has(node.id) && node.id !== rootId;
      const selected = node.id === focusedId;
      return <button
        key={node.id}
        type="button"
        data-graph-node-id={node.id}
        data-node-type={node.node_type}
        data-dimmed={dimmed || undefined}
        aria-pressed={selected}
        aria-label={`${graphNodeLabel(node.node_type)}: ${node.label}. ${node.subtitle}. Связано сигналов: ${node.signal_count}.`}
        title={`${graphNodeLabel(node.node_type)}: ${node.label}. ${node.subtitle}`}
        onClick={() => onFocus(node.id)}
        className={cn(
          "absolute z-10 flex min-h-10 max-w-28 -translate-x-1/2 -translate-y-1/2 items-center rounded-v2-control border px-2 py-1.5 text-left text-[10px] font-semibold",
          "transition-[opacity,box-shadow,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-offset-2 motion-reduce:transition-none",
          graphNodeStyle(node.node_type),
          node.id === rootId && "z-20 min-h-14 min-w-32 border-white/40 sm:min-w-44",
          selected && node.id !== rootId && "z-20 ring-2 ring-v2-primary ring-offset-2",
          dimmed && "opacity-30",
          "sm:max-w-44 sm:px-3 sm:py-2 sm:text-xs",
        )}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
      >
        <span className="min-w-0"><span className="block truncate">{node.label}</span><span className={cn("mt-0.5 block truncate text-[9px] font-normal sm:text-[11px]", node.node_type === "pattern" ? "text-white/75" : "text-v2-text-secondary")}>{node.subtitle}</span></span>
      </button>;
    })}
  </div>;
}
