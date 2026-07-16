export interface GeoJsonFeatureProperties {
  shapeID?: string;
  shapeName?: string;
  shapeISO?: string;
}

type Position = [number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

export interface GeoJsonFeature {
  type: "Feature";
  properties: GeoJsonFeatureProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface ProjectedRegionFeature {
  geometryFeatureId: string;
  sourceName: string;
  path: string;
}

function polygonList(feature: GeoJsonFeature): PolygonCoordinates[] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as PolygonCoordinates]
    : feature.geometry.coordinates as MultiPolygonCoordinates;
}

export function projectKazakhstanGeometry(
  collection: GeoJsonFeatureCollection,
  width = 920,
  height = 500,
  padding = 20,
): ProjectedRegionFeature[] {
  const positions = collection.features.flatMap((feature) =>
    polygonList(feature).flatMap((polygon) => polygon.flat()),
  );
  if (!positions.length) return [];

  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 1);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 1);
  const scale = Math.min(
    (width - padding * 2) / longitudeRange,
    (height - padding * 2) / latitudeRange,
  );
  const projectedWidth = longitudeRange * scale;
  const projectedHeight = latitudeRange * scale;
  const offsetX = (width - projectedWidth) / 2;
  const offsetY = (height - projectedHeight) / 2;

  const project = ([longitude, latitude]: Position) => [
    offsetX + (longitude - minLongitude) * scale,
    height - offsetY - (latitude - minLatitude) * scale,
  ] as const;

  return collection.features.flatMap((feature) => {
    const geometryFeatureId = feature.properties.shapeID;
    if (!geometryFeatureId) return [];
    const path = polygonList(feature)
      .flatMap((polygon) => polygon.map((ring) => ring.map((position, index) => {
        const [x, y] = project(position);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ") + " Z"))
      .join(" ");
    return [{
      geometryFeatureId,
      sourceName: feature.properties.shapeName ?? geometryFeatureId,
      path,
    }];
  });
}

export function isGeoJsonFeatureCollection(value: unknown): value is GeoJsonFeatureCollection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeoJsonFeatureCollection>;
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features);
}
