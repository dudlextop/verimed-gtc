import type { RegionalMonitoringItem } from "./types";

export interface RegionMapDefinition {
  apiRegionCode: string;
  canonicalName: string;
  geometryFeatureId: string | null;
  displayLabel: string;
}

export const KAZAKHSTAN_REGION_MAP: readonly RegionMapDefinition[] = [
  { apiRegionCode: "KZ-AKM", canonicalName: "Акмолинская область", geometryFeatureId: "16772668B69662276924495", displayLabel: "Акмолинская область" },
  { apiRegionCode: "KZ-AKT", canonicalName: "Актюбинская область", geometryFeatureId: "16772668B11242448457004", displayLabel: "Актюбинская область" },
  { apiRegionCode: "KZ-ALA", canonicalName: "Алматы", geometryFeatureId: "16772668B7707561767580", displayLabel: "Алматы" },
  { apiRegionCode: "KZ-ALM", canonicalName: "Алматинская область", geometryFeatureId: "16772668B60014547909303", displayLabel: "Алматинская область" },
  { apiRegionCode: "KZ-AST", canonicalName: "Астана", geometryFeatureId: "16772668B6136604360804", displayLabel: "Астана" },
  { apiRegionCode: "KZ-ATY", canonicalName: "Атырауская область", geometryFeatureId: "16772668B56351958182156", displayLabel: "Атырауская область" },
  { apiRegionCode: "KZ-VOS", canonicalName: "Восточно-Казахстанская область", geometryFeatureId: "16772668B44102628557874", displayLabel: "Восточно-Казахстанская область" },
  { apiRegionCode: "KZ-ZAP", canonicalName: "Западно-Казахстанская область", geometryFeatureId: "16772668B81356436661636", displayLabel: "Западно-Казахстанская область" },
  { apiRegionCode: "KZ-ZHA", canonicalName: "Жамбылская область", geometryFeatureId: "16772668B72218078944844", displayLabel: "Жамбылская область" },
  { apiRegionCode: "KZ-KAR", canonicalName: "Карагандинская область", geometryFeatureId: "16772668B31479154893463", displayLabel: "Карагандинская область" },
  { apiRegionCode: "KZ-KUS", canonicalName: "Костанайская область", geometryFeatureId: "16772668B76678136902236", displayLabel: "Костанайская область" },
  { apiRegionCode: "KZ-KZY", canonicalName: "Кызылординская область", geometryFeatureId: "16772668B75519035879642", displayLabel: "Кызылординская область" },
  { apiRegionCode: "KZ-MAN", canonicalName: "Мангистауская область", geometryFeatureId: "16772668B64618180863447", displayLabel: "Мангистауская область" },
  { apiRegionCode: "KZ-PAV", canonicalName: "Павлодарская область", geometryFeatureId: "16772668B56556955248260", displayLabel: "Павлодарская область" },
  { apiRegionCode: "KZ-SEV", canonicalName: "Северо-Казахстанская область", geometryFeatureId: "16772668B79240574567699", displayLabel: "Северо-Казахстанская область" },
  { apiRegionCode: "KZ-YUZ", canonicalName: "Туркестанская область", geometryFeatureId: "16772668B94173460365652", displayLabel: "Туркестанская область" },
  { apiRegionCode: "KZ-SHY", canonicalName: "Шымкент", geometryFeatureId: null, displayLabel: "Шымкент" },
] as const;

const regionsByApiCode = new Map(
  KAZAKHSTAN_REGION_MAP.map((region) => [region.apiRegionCode, region] as const),
);

export function regionMapDefinition(apiRegionCode: string): RegionMapDefinition | null {
  return regionsByApiCode.get(apiRegionCode) ?? null;
}

export interface RegionMapDatum extends RegionMapDefinition {
  aggregate?: RegionalMonitoringItem;
}

export function mapRegionalMonitoring(
  aggregates: readonly RegionalMonitoringItem[],
): RegionMapDatum[] {
  const aggregatesByCode = new Map(aggregates.map((item) => [item.region_code, item] as const));
  return KAZAKHSTAN_REGION_MAP.map((definition) => ({
    ...definition,
    aggregate: aggregatesByCode.get(definition.apiRegionCode),
  }));
}

export function unmappedRegionalMonitoring(
  aggregates: readonly RegionalMonitoringItem[],
): RegionalMonitoringItem[] {
  return aggregates.filter((item) => !regionsByApiCode.has(item.region_code));
}
