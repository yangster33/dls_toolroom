/**
 * 高程查询服务（Open-Meteo Elevation API）
 *
 * 历史 Bug（审计 P0-6）三条独立失效路径：
 *
 * 1. **单 URL 拼全部点位** —— 250 个点的经纬度全塞进一个 query string，
 *    Open-Meteo 对超长 URL 直接返 400，整个请求抛错。
 * 2. **失败被吞** —— 任一批失败后消费方只弹个窗，却把前几批的部分结果留在
 *    可下载状态，用户拿到「缺了后 80% 却看似完整」的文件。
 * 3. **缺失值当 0 米** —— `data.elevation[index] ?? 0`，接口少返一条就变成
 *    「海平面 0 米」，与真实的 0 米海拔无法区分。
 *
 * 现在：分批请求 + 超时 + 逐点标记 error，高程用 NaN 表示"未知"而不是 0。
 */

export interface ElevationResult {
  longitude: number
  latitude: number
  /**
   * 高程（米）。**NaN 表示查询失败或接口未返回该点**，与真实的 0 米海拔
   * 严格区分。调用方必须检查 error 字段或 Number.isFinite，不能直接用。
   */
  elevation: number
  /** 有值表示该点查询失败，elevation 为 NaN */
  error?: string
}

export interface ElevationQueryResponse {
  elevation?: number[]
}

/** Open-Meteo 单次请求的点数上限；超过会因 URL 过长返 400 */
const MAX_BATCH_SIZE = 100

/** 单次请求超时（毫秒） */
const REQUEST_TIMEOUT_MS = 15_000

export class ElevationService {
  private baseUrl = 'https://api.open-meteo.com/v1/elevation'

  async getElevation(longitude: number, latitude: number): Promise<ElevationResult> {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    })
    const response = await fetch(`${this.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ElevationQueryResponse = await response.json()
    const value = data.elevation?.[0]

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('未获取到高程数据')
    }

    return { longitude, latitude, elevation: value }
  }

  /**
   * 批量查询高程。
   *
   * 自动按 MAX_BATCH_SIZE 分批，任一批失败只影响该批的点，
   * 不再让整个请求抛错后丢弃已成功的部分结果。
   */
  async getElevations(
    points: { longitude: number; latitude: number }[],
  ): Promise<ElevationResult[]> {
    if (points.length === 0) {
      return []
    }

    const results: ElevationResult[] = []

    for (let i = 0; i < points.length; i += MAX_BATCH_SIZE) {
      const batch = points.slice(i, i + MAX_BATCH_SIZE)
      const params = new URLSearchParams({
        latitude: batch.map((p) => p.latitude).join(','),
        longitude: batch.map((p) => p.longitude).join(','),
      })

      let data: ElevationQueryResponse
      try {
        const response = await fetch(`${this.baseUrl}?${params}`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        data = (await response.json()) as ElevationQueryResponse
      } catch (err) {
        // 整批失败：该批全部标记 error，不影响其它批次已成功的点
        const reason = err instanceof Error ? err.message : String(err)
        for (const point of batch) {
          results.push({
            longitude: point.longitude,
            latitude: point.latitude,
            elevation: Number.NaN,
            error: `请求失败: ${reason}`,
          })
        }
        continue
      }

      const elevations = Array.isArray(data.elevation) ? data.elevation : []
      batch.forEach((point, index) => {
        const value = elevations[index]
        // 接口少返一条 → NaN + error，绝不静默变成 0 米
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          results.push({
            longitude: point.longitude,
            latitude: point.latitude,
            elevation: Number.NaN,
            error: '接口未返回该点高程',
          })
          return
        }
        results.push({
          longitude: point.longitude,
          latitude: point.latitude,
          elevation: value,
        })
      })
    }

    return results
  }
}

export const elevationService = new ElevationService()
