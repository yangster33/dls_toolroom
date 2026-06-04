declare module 'togeojson' {
  interface toGeoJSON {
    kml(doc: Document): GeoJSON.FeatureCollection
  }
  const toGeoJSON: toGeoJSON
  export = toGeoJSON
}
