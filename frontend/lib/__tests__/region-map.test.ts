import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  KAZAKHSTAN_REGION_MAP,
  mapRegionalMonitoring,
  regionMapDefinition,
  unmappedRegionalMonitoring,
} from "@/lib/region-map";
import type { RegionalMonitoringItem } from "@/lib/types";

const aggregate: RegionalMonitoringItem = {
  region_name: "Алматы",
  region_code: "KZ-ALA",
  signal_count: 12,
  unique_record_count: 10,
  financial_significance: "150000",
  organization_count: 2,
  maximum_priority: 91,
  leading_organization: { id: 1, name: "Организация", priority_score: 90 },
};

describe("сопоставление регионов и геометрии", () => {
  it("не сопоставляет один API code нескольким геометриям", () => {
    expect(new Set(KAZAKHSTAN_REGION_MAP.map((item) => item.apiRegionCode)).size).toBe(KAZAKHSTAN_REGION_MAP.length);
    const featureIds = KAZAKHSTAN_REGION_MAP.flatMap((item) => item.geometryFeatureId ? [item.geometryFeatureId] : []);
    expect(new Set(featureIds).size).toBe(featureIds.length);
  });

  it("не превращает отсутствие агрегата в нулевые значения", () => {
    const mapped = mapRegionalMonitoring([aggregate]);
    expect(mapped.find((item) => item.apiRegionCode === "KZ-ALA")?.aggregate).toEqual(aggregate);
    expect(mapped.find((item) => item.apiRegionCode === "KZ-KAR")?.aggregate).toBeUndefined();
  });

  it("не окрашивает неизвестный регион случайной геометрией", () => {
    const unknown = { ...aggregate, region_code: "unknown-123", region_name: "Неизвестный" };
    expect(regionMapDefinition(unknown.region_code)).toBeNull();
    expect(unmappedRegionalMonitoring([unknown])).toEqual([unknown]);
  });

  it("содержит доступное имя для каждой статической feature", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public/maps/kazakhstan-adm1.geojson"), "utf8");
    const geojson = JSON.parse(source) as { features: { properties: { shapeID: string } }[] };
    const definitions = new Map(KAZAKHSTAN_REGION_MAP.map((item) => [item.geometryFeatureId, item]));
    for (const feature of geojson.features) {
      const definition = definitions.get(feature.properties.shapeID);
      expect(definition?.displayLabel).toBeTruthy();
    }
  });
});
