import { parseShpFile, type GisFeature, type GisValidationResult } from '../gis2excel/GisFileReader'

export interface ShpMultiFileResult {
  isValid: boolean
  errors: string[]
  fileResults: ShpSingleFileResult[]
  totalFeatures: number
  pointCount: number
  lineCount: number
  polygonCount: number
  allFeatures: GisFeature[]
}

export interface ShpSingleFileResult {
  fileName: string
  isValid: boolean
  errors: string[]
  features: GisFeature[]
  totalFeatures: number
  pointCount: number
  lineCount: number
  polygonCount: number
}

export async function readAndValidateShpFiles(files: File[]): Promise<ShpMultiFileResult> {
  const errors: string[] = []
  const fileResults: ShpSingleFileResult[] = []

  for (const file of files) {
    fileResults.push(await validateSingleShpFile(file))
  }

  // Check for errors
  for (const result of fileResults) {
    if (!result.isValid) {
      errors.push(...result.errors)
    }
  }

  // Collect all features and counts
  const allFeatures: GisFeature[] = []
  for (const result of fileResults) {
    allFeatures.push(...result.features)
  }

  const pointCount = allFeatures.filter(f => f.type === 'Point').length
  const lineCount = allFeatures.filter(f => f.type === 'LineString').length
  const polygonCount = allFeatures.filter(f => f.type === 'Polygon').length

  const isValid = errors.length === 0 && allFeatures.length > 0

  if (!isValid && errors.length === 0 && allFeatures.length === 0) {
    errors.push('所有SHP文件中均未找到任何地理要素')
  }

  return {
    isValid,
    errors,
    fileResults,
    totalFeatures: allFeatures.length,
    pointCount,
    lineCount,
    polygonCount,
    allFeatures,
  }
}

export async function validateSingleShpFile(file: File): Promise<ShpSingleFileResult> {
  const errors: string[] = []
  const fileName = file.name

  if (!fileName.toLowerCase().endsWith('.shp')) {
    errors.push(`"${fileName}" 不是SHP文件，请上传.shp格式的文件`)
    return {
      fileName,
      isValid: false,
      errors,
      features: [],
      totalFeatures: 0,
      pointCount: 0,
      lineCount: 0,
      polygonCount: 0,
    }
  }

  try {
    const features = await parseShpFile(file)

    if (features.length === 0) {
      errors.push(`"${fileName}" 中未找到任何地理要素`)
      return {
        fileName,
        isValid: false,
        errors,
        features: [],
        totalFeatures: 0,
        pointCount: 0,
        lineCount: 0,
        polygonCount: 0,
      }
    }

    const pointCount = features.filter(f => f.type === 'Point').length
    const lineCount = features.filter(f => f.type === 'LineString').length
    const polygonCount = features.filter(f => f.type === 'Polygon').length

    return {
      fileName,
      isValid: true,
      errors: [],
      features,
      totalFeatures: features.length,
      pointCount,
      lineCount,
      polygonCount,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`"${fileName}" 解析失败: ${msg}`)
    return {
      fileName,
      isValid: false,
      errors,
      features: [],
      totalFeatures: 0,
      pointCount: 0,
      lineCount: 0,
      polygonCount: 0,
    }
  }
}
