declare module 'shpjs' {
  interface ShpObject {
    shp: ArrayBuffer | Uint8Array | DataView
    dbf?: ArrayBuffer | Uint8Array | DataView
    cpg?: ArrayBuffer | Uint8Array | DataView
    prj?: string | ArrayBuffer | Uint8Array | DataView
  }

  type ShpInput = string | ArrayBuffer | ArrayBufferView | DataView | ShpObject

  function getShapefile(base: ShpInput, whiteList?: string[]): Promise<any>

  export default getShapefile
}
