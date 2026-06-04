export interface ElevationResult {
  longitude: number
  latitude: number
  elevation: number
}

export interface ElevationQueryResponse {
  elevation: number[]
}

export class ElevationService {
  private baseUrl = 'https://api.open-meteo.com/v1/elevation'

  async getElevation(longitude: number, latitude: number): Promise<ElevationResult> {
    const response = await fetch(
      `${this.baseUrl}?latitude=${latitude}&longitude=${longitude}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ElevationQueryResponse = await response.json()

    if (!data.elevation || data.elevation.length === 0) {
      throw new Error('未获取到高程数据')
    }

    return {
      longitude,
      latitude,
      elevation: data.elevation[0]!
    }
  }

  async getElevations(points: { longitude: number; latitude: number }[]): Promise<ElevationResult[]> {
    if (points.length === 0) {
      return []
    }

    const latitudes = points.map(p => p.latitude).join(',')
    const longitudes = points.map(p => p.longitude).join(',')

    const response = await fetch(
      `${this.baseUrl}?latitude=${latitudes}&longitude=${longitudes}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ElevationQueryResponse = await response.json()

    if (!data.elevation || data.elevation.length === 0) {
      throw new Error('未获取到高程数据')
    }

    return points.map((point, index) => ({
      longitude: point.longitude,
      latitude: point.latitude,
      elevation: data.elevation[index] ?? 0
    }))
  }
}

export const elevationService = new ElevationService()