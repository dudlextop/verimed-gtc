"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, MapPinned } from "lucide-react";
import type { RegionalMonitoringItem } from "@/lib/types";
import {
  KAZAKHSTAN_REGION_MAP,
  mapRegionalMonitoring,
  regionMapDefinition,
  unmappedRegionalMonitoring,
  type RegionMapDatum,
} from "@/lib/region-map";
import {
  isGeoJsonFeatureCollection,
  projectKazakhstanGeometry,
  type ProjectedRegionFeature,
} from "@/lib/kazakhstan-geometry";
import { money, number } from "@/lib/utils";
import { EmptyState, SectionHeader, Skeleton } from "@/components/foundation";

export type RegionalMapLayer = "signals" | "financial" | "priority";

const layerOptions: { value: RegionalMapLayer; label: string; mobileLabel?: string }[] = [
  { value: "signals", label: "Сигналы" },
  { value: "financial", label: "Финансовая значимость", mobileLabel: "Финансы" },
  { value: "priority", label: "Приоритет" },
];

function metricValue(region: RegionalMonitoringItem, layer: RegionalMapLayer): number {
  if (layer === "financial") return Number(region.financial_significance) || 0;
  if (layer === "priority") return region.maximum_priority;
  return region.signal_count;
}

function metricLabel(region: RegionalMonitoringItem, layer: RegionalMapLayer): string {
  if (layer === "financial") return money(region.financial_significance, true);
  if (layer === "priority") return `${number(region.maximum_priority)} из 100`;
  return `${number(region.signal_count)} сигналов`;
}

function regionHref(name: string): string {
  return `/organizations?region=${encodeURIComponent(name)}`;
}

function intensityLevel(value: number, maximum: number): number {
  if (maximum <= 0 || value <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil((value / maximum) * 5)));
}

export function RegionalMonitoringMap({
  regions,
  initialLayer = "signals",
}: {
  regions: RegionalMonitoringItem[];
  initialLayer?: RegionalMapLayer;
}) {
  const [layer, setLayer] = useState<RegionalMapLayer>(initialLayer);
  const [geometry, setGeometry] = useState<ProjectedRegionFeature[] | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const layerButtons = useRef<Array<HTMLButtonElement | null>>([]);

  const mapped = useMemo(() => mapRegionalMonitoring(regions), [regions]);
  const unknown = useMemo(() => unmappedRegionalMonitoring(regions), [regions]);
  const actualRegions = useMemo(
    () => [...mapped.filter((region) => region.aggregate).map((region) => region.aggregate as RegionalMonitoringItem), ...unknown],
    [mapped, unknown],
  );
  const maximum = Math.max(0, ...actualRegions.map((region) => metricValue(region, layer)));
  const ranked = [...actualRegions].sort((left, right) => {
    const difference = metricValue(right, layer) - metricValue(left, layer);
    return difference || left.region_name.localeCompare(right.region_name, "ru");
  });
  const selected = selectedCode
    ? mapped.find((region) => region.apiRegionCode === selectedCode)
      ?? unknownRegionDatum(unknown.find((region) => region.region_code === selectedCode))
    : mapped.find((region) => region.aggregate?.region_code === ranked[0]?.region_code)
      ?? unknownRegionDatum(ranked[0]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/maps/kazakhstan-adm1.geojson", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Геометрия карты недоступна");
        const payload: unknown = await response.json();
        if (!isGeoJsonFeatureCollection(payload)) throw new Error("Формат геометрии карты не поддерживается");
        if (active) setGeometry(projectKazakhstanGeometry(payload));
      })
      .catch((error) => {
        if (active && error instanceof Error && error.name !== "AbortError") {
          setGeometryError("Не удалось загрузить геометрию карты. Региональный список остаётся доступен.");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const changeLayer = (next: RegionalMapLayer, focus = false) => {
    setLayer(next);
    if (focus) {
      const index = layerOptions.findIndex((option) => option.value === next);
      layerButtons.current[index]?.focus();
    }
  };

  const onLayerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = layerOptions.findIndex((option) => option.value === layer);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? layerOptions.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + layerOptions.length) % layerOptions.length;
    changeLayer(layerOptions[nextIndex].value, true);
  };

  return (
    <section className="rounded-v2-section border border-v2-border bg-v2-surface" aria-labelledby="regional-monitoring-title" data-testid="regional-monitoring">
      <div className="flex flex-col gap-4 border-b border-v2-border px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
        <SectionHeader
          id="regional-monitoring-title"
          title="Региональная концентрация"
          description="Где сосредоточены сигналы, финансовая значимость и организации повышенного приоритета."
        />
        <div
          role="radiogroup"
          aria-label="Показатель региональной карты"
          className="grid min-w-0 grid-cols-3 rounded-v2-control border border-v2-border-strong bg-v2-surface-soft p-1"
          onKeyDown={onLayerKeyDown}
        >
          {layerOptions.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => { layerButtons.current[index] = node; }}
              type="button"
              role="radio"
              aria-label={option.label}
              aria-checked={layer === option.value}
              tabIndex={layer === option.value ? 0 : -1}
              onClick={() => changeLayer(option.value)}
              className="min-h-11 min-w-0 rounded-[0.5rem] px-3 text-xs font-semibold text-v2-text-secondary transition-colors duration-100 hover:text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary aria-checked:bg-v2-surface aria-checked:text-v2-primary aria-checked:shadow-sm motion-reduce:transition-none max-sm:px-1"
            >
              <span className={option.mobileLabel ? "max-sm:hidden" : undefined}>{option.label}</span>
              {option.mobileLabel && <span className="sm:hidden">{option.mobileLabel}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.55fr)]">
        <div className="hidden min-w-0 border-b border-v2-border p-5 md:block lg:border-b-0 lg:border-r md:p-6 print:block" data-testid="regional-map-canvas">
          <MapCanvas
            regions={mapped}
            geometry={geometry}
            geometryError={geometryError}
            layer={layer}
            maximum={maximum}
            selected={selected}
            onSelect={setSelectedCode}
          />
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-v2-text-muted">Рейтинг регионов</p>
          {ranked.length ? (
            <ol className="mt-3 space-y-1" aria-label={`Регионы: ${layerOptions.find((item) => item.value === layer)?.label}`}>
              {ranked.slice(0, 8).map((region, index) => (
                <li key={region.region_code}>
                  <Link
                    href={regionHref(region.region_name)}
                    onFocus={() => setSelectedCode(region.region_code)}
                    onMouseEnter={() => setSelectedCode(region.region_code)}
                    className="group flex min-h-12 items-center gap-3 rounded-v2-control px-2 py-2 transition-colors duration-100 hover:bg-v2-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary motion-reduce:transition-none"
                  >
                    <span className="v2-tabular w-6 shrink-0 text-xs font-bold text-v2-text-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm font-semibold leading-5 text-v2-text">{region.region_name}</span>
                      <span className="mt-0.5 block text-xs text-v2-text-secondary">{number(region.organization_count)} организаций</span>
                    </span>
                    <strong className={layer === "financial" ? "v2-tabular text-sm text-v2-teal-text" : "v2-tabular text-sm text-v2-primary"}>
                      {metricLabel(region, layer)}
                    </strong>
                    <ArrowRight className="h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState className="mt-4 min-h-44" title="Региональные данные пока отсутствуют" description="Карта не получает нулевые значения для регионов без фактических агрегатов." />
          )}

          <details className="group mt-4 md:hidden print:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-v2-control border border-v2-border-strong px-3 text-sm font-semibold text-v2-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary">
              <span className="inline-flex items-center gap-2"><MapIcon className="h-4 w-4" aria-hidden="true" />Показать карту</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="mt-4" data-testid="regional-map-mobile">
              <MapCanvas
                regions={mapped}
                geometry={geometry}
                geometryError={geometryError}
                layer={layer}
                maximum={maximum}
                selected={selected}
                onSelect={setSelectedCode}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function MapCanvas({
  regions,
  geometry,
  geometryError,
  layer,
  maximum,
  selected,
  onSelect,
}: {
  regions: RegionMapDatum[];
  geometry: ProjectedRegionFeature[] | null;
  geometryError: string | null;
  layer: RegionalMapLayer;
  maximum: number;
  selected: RegionMapDatum | null;
  onSelect: (code: string) => void;
}) {
  const accessibleId = useId();
  const titleId = `${accessibleId}-title`;
  const descriptionId = `${accessibleId}-description`;

  if (geometryError) {
    return <EmptyState variant="error" title="Карта временно недоступна" description={geometryError} />;
  }
  if (!geometry) return <Skeleton className="h-[24rem] w-full" />;

  const definitionsByFeature = new Map(
    regions.filter((region) => region.geometryFeatureId).map((region) => [region.geometryFeatureId, region] as const),
  );

  return (
    <div className="relative min-w-0 overflow-hidden rounded-v2-card bg-v2-surface-soft p-3 regional-map" data-map-layer={layer}>
      <svg viewBox="0 0 920 500" className="block h-auto w-full" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>Карта регионального мониторинга Казахстана</title>
        <desc id={descriptionId}>Интенсивность регионов соответствует выбранному показателю. Регионы без агрегатов отмечены как «Нет данных».</desc>
        {geometry.map((feature) => {
          const region = definitionsByFeature.get(feature.geometryFeatureId);
          if (!region) return null;
          const aggregate = region.aggregate;
          const intensity = aggregate ? intensityLevel(metricValue(aggregate, layer), maximum) : 0;
          const href = regionHref(region.canonicalName);
          const label = aggregate
            ? `${region.displayLabel}. ${metricLabel(aggregate, layer)}. Открыть организации региона.`
            : `${region.displayLabel}. Нет данных. Открыть организации региона.`;
          return (
            <a
              key={feature.geometryFeatureId}
              href={href}
              aria-label={label}
              onFocus={() => onSelect(region.apiRegionCode)}
              onMouseEnter={() => onSelect(region.apiRegionCode)}
            >
              <path
                d={feature.path}
                fillRule="evenodd"
                data-region-code={region.apiRegionCode}
                data-state={aggregate ? "data" : "no-data"}
                data-intensity={intensity}
                data-selected={selected?.apiRegionCode === region.apiRegionCode || undefined}
                className="regional-map-region"
              />
            </a>
          );
        })}
      </svg>

      {selected && (
        <div className="mt-3 rounded-v2-card border border-v2-border bg-v2-surface p-4 md:absolute md:right-4 md:top-4 md:mt-0 md:w-64 md:shadow-v2-dropdown" role="tooltip" data-testid="region-tooltip">
          <div className="flex items-start gap-2">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold text-v2-text">{selected.displayLabel}</p>
              {selected.aggregate ? (
                <dl className="mt-2 space-y-1.5 text-xs text-v2-text-secondary">
                  <TooltipRow label="Сигналы" value={number(selected.aggregate.signal_count)} />
                  <TooltipRow label="Уникальные записи" value={number(selected.aggregate.unique_record_count)} />
                  <TooltipRow label="Финансовая значимость" value={money(selected.aggregate.financial_significance, true)} />
                  <TooltipRow label="Организации" value={number(selected.aggregate.organization_count)} />
                  <TooltipRow label="Максимальный приоритет" value={`${number(selected.aggregate.maximum_priority)} из 100`} />
                  {selected.aggregate.leading_organization && <TooltipRow label="Ведущая организация" value={selected.aggregate.leading_organization.name} />}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-v2-text-secondary">Нет данных</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><dt>{label}</dt><dd className="v2-tabular text-right font-semibold text-v2-text">{value}</dd></div>;
}

function unknownRegionDatum(region?: RegionalMonitoringItem): RegionMapDatum | null {
  if (!region) return null;
  return {
    apiRegionCode: region.region_code,
    canonicalName: region.region_name,
    geometryFeatureId: null,
    displayLabel: region.region_name,
    aggregate: region,
  };
}

export function regionalDataCoverage(regions: readonly RegionalMonitoringItem[]): {
  regionsWithData: number;
  mappedRegionsWithData: number;
  regionsWithoutData: number;
  unknownRegions: number;
} {
  const mappedCodes = new Set(regions.filter((region) => regionMapDefinition(region.region_code)?.geometryFeatureId).map((region) => region.region_code));
  return {
    regionsWithData: regions.length,
    mappedRegionsWithData: mappedCodes.size,
    regionsWithoutData: KAZAKHSTAN_REGION_MAP.filter((region) => region.geometryFeatureId && !mappedCodes.has(region.apiRegionCode)).length,
    unknownRegions: unmappedRegionalMonitoring(regions).length,
  };
}
