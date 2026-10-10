declare module 'shpjs' {
  interface ShpObject {
    shp: ArrayBuffer | Uint8Array | DataView
    dbf?: ArrayBuffer | Uint8Array | DataView
    cpg?: ArrayBuffer | Uint8Array | DataView
    prj?: string | ArrayBuffer | Uint8Array | DataView
  }

  type ShpInput = string | ArrayBuffer | ArrayBufferView | DataView | ShpObject

  /**
   * shpjs 的返回类型官方没声明。实际运行时返回 GeoJSON FeatureCollection，
   * 单文件模式下也可能返回 { [filename]: FeatureCollection } 的对象。
   * 项目只消费 FeatureCollection 分支，故这样标注。
   */
  function getShapefile(base: ShpInput, whiteList?: string[]): Promise<GeoJSON.FeatureCollection>

  export default getShapefile
}
