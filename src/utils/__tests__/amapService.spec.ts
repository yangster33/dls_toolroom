import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import {
  PROVIDER_CONFIGS,
  getRandomDelay,
  buildApiUrl,
  maskSensitiveUrl,
  isInBounds,
  parseLocation,
  validateApiKey,
  getProviderOptions,
  exportResultsToRows,
} from '../amapService'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockGet = vi.mocked(axios.get)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getRandomDelay', () => {
  it('randomDelay 关闭时返回固定延迟', () => {
    expect(getRandomDelay(500, false, 100, 500)).toBe(500)
  })

  it('randomDelay 开启但未提供范围时返回固定延迟', () => {
    expect(getRandomDelay(500, true)).toBe(500)
  })

  it('randomDelay 开启时落在 [delay+min, delay+max] 区间', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(getRandomDelay(500, true, 100, 500)).toBe(600)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(getRandomDelay(500, true, 100, 500)).toBe(800)
  })
})

describe('buildApiUrl', () => {
  it('追加查询参数', () => {
    const url = buildApiUrl('https://example.com/api', { key: 'k1', output: 'json' })
    expect(url).toBe('https://example.com/api?key=k1&output=json')
  })

  it('保留已有参数并覆盖同名参数', () => {
    const url = buildApiUrl('https://example.com/api?a=1', { a: '2', b: '3' })
    expect(url).toBe('https://example.com/api?a=2&b=3')
  })
})

describe('isInBounds', () => {
  const bounds = {
    southwest: { lng: 116, lat: 39 },
    northeast: { lng: 117, lat: 40 },
  }

  it('区域内返回 true', () => {
    expect(isInBounds(116.5, 39.5, bounds)).toBe(true)
  })

  it('边界上返回 true', () => {
    expect(isInBounds(116, 39, bounds)).toBe(true)
    expect(isInBounds(117, 40, bounds)).toBe(true)
  })

  it('区域外返回 false', () => {
    expect(isInBounds(115.9, 39.5, bounds)).toBe(false)
    expect(isInBounds(116.5, 40.1, bounds)).toBe(false)
    expect(isInBounds(117.1, 39.5, bounds)).toBe(false)
  })
})

describe('parseLocation', () => {
  it('合法坐标返回数值', () => {
    expect(parseLocation('116.4,39.9')).toEqual({ lng: 116.4, lat: 39.9 })
  })

  it('非法输入返回 null', () => {
    expect(parseLocation('')).toBeNull()
    expect(parseLocation('abc')).toBeNull()
    expect(parseLocation('116.4')).toBeNull()
    expect(parseLocation('1,2,3')).toBeNull()
    expect(parseLocation('a,b')).toBeNull()
  })
})

describe('PROVIDER_CONFIGS', () => {
  it('仅包含 gaode 且配置正确', () => {
    expect(Object.keys(PROVIDER_CONFIGS)).toEqual(['gaode'])
    const config = PROVIDER_CONFIGS.gaode
    expect(config.url).toBe('https://restapi.amap.com/v3/geocode/geo')
    expect(config.keyParam).toBe('key')
    expect(config.validateParam).toBe('address')
    expect(config.validateValue).toBe('北京市天安门')
    expect(config.responseParser({ status: '1', info: 'OK' })).toEqual({ status: '1', info: 'OK' })
  })
})

describe('validateApiKey', () => {
  it('状态 1 判定有效', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: '1' } })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(true)
    // 审计 P2-13：对外返回的 url 必须脱敏，不得再含明文 Key。
    // 旧断言是 toContain('key=k1')，即固化了 Key 外泄的行为。
    expect(result.url).not.toContain('k1')
    expect(result.url).toContain('key=****')
    expect(mockGet).toHaveBeenCalledWith(
      'https://restapi.amap.com/v3/geocode/geo',
      expect.objectContaining({
        params: expect.objectContaining({ address: '北京市天安门' }),
        timeout: 5000,
      }),
    )
  })

  it('数字状态 1 也判定有效', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: 1 } })
    expect((await validateApiKey('k1', 'gaode')).isValid).toBe(true)
  })

  it('状态非 1 返回错误信息', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: '0' } })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('高德API返回状态: 0')
  })

  it('HTTP 状态非 200 报错', async () => {
    mockGet.mockResolvedValue({ status: 403, data: {} })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('HTTP状态码不为200')
  })

  it('网络异常返回请求失败', async () => {
    mockGet.mockRejectedValue(new Error('timeout of 5000ms exceeded'))
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('请求失败: timeout of 5000ms exceeded')
  })
})

describe('getProviderOptions / exportResultsToRows', () => {
  it('提供商选项仅高德', () => {
    expect(getProviderOptions()).toEqual([{ value: 'gaode', label: '高德地图' }])
  })

  it('按表头与字段配置导出行', () => {
    const rows = exportResultsToRows(['名称', '来源', '原始'], [{ 名称: '甲', 原始: 'raw1' }], {
      来源: (r) => `来源:${String(r.名称)}`,
    })
    expect(rows).toEqual([
      ['名称', '来源', '原始'],
      ['甲', '来源:甲', 'raw1'],
    ])
  })

  it('无配置的缺失字段输出空字符串', () => {
    const rows = exportResultsToRows(['a', 'b'], [{ a: 'x' }], {})
    expect(rows).toEqual([
      ['a', 'b'],
      ['x', ''],
    ])
  })
})

// ============================================================
// 审计 P2-13：URL 中的 Key 必须脱敏后再对外暴露
// ============================================================
//
// API Key 会被 buildApiUrl 拼进 URL query。Key 校验失败时这个 URL 会被
// ErrorDialog 渲染到 DOM，且旧弹窗还提示用户"复制上面的URL到浏览器中直接
// 访问"——Key 由此进入可见 DOM，易被录屏、Session Replay、浏览器扩展捕获。
//
// 现在 maskSensitiveUrl 把 key 类参数值替换为 ****，并移除了那条复制提示。

const REAL_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('maskSensitiveUrl（P2-13）', () => {
  it('key 参数值被替换为 ****', () => {
    const masked = maskSensitiveUrl(
      `https://restapi.amap.com/v3/geocode/regeo?key=${REAL_KEY}&output=json`,
    )
    expect(masked).not.toContain(REAL_KEY)
    expect(masked).toContain('key=****')
  })

  it('保留 host / path / 其它参数，便于排查', () => {
    const masked = maskSensitiveUrl(
      `https://restapi.amap.com/v3/geocode/regeo?key=${REAL_KEY}&location=116.4,39.9&output=json`,
    )
    expect(masked).toContain('restapi.amap.com')
    expect(masked).toContain('/v3/geocode/regeo')
    expect(masked).toContain('location=116.4%2C39.9')
    expect(masked).toContain('output=json')
  })

  it('覆盖常见密钥参数名', () => {
    for (const name of ['key', 'ak', 'apikey', 'api_key', 'access_token', 'token']) {
      const masked = maskSensitiveUrl(`https://example.com/api?${name}=${REAL_KEY}`)
      expect(masked).not.toContain(REAL_KEY)
      expect(masked).toContain(`${name}=****`)
    }
  })

  it('可指定自定义参数名', () => {
    expect(maskSensitiveUrl('https://example.com/api?secret=xyz', ['secret'])).toBe(
      'https://example.com/api?secret=****',
    )
  })

  it('非 URL 输入返回占位符，不原样吐出内容', () => {
    const masked = maskSensitiveUrl(`not-a-url key=${REAL_KEY}`)
    expect(masked).toBe('(无效 URL)')
    expect(masked).not.toContain(REAL_KEY)
  })

  it('与 buildApiUrl 组合：原始 URL 含 Key（请求需要），脱敏后不含', () => {
    const url = buildApiUrl('https://restapi.amap.com/v3/geocode/regeo', {
      key: REAL_KEY,
      location: '116.4,39.9',
      output: 'json',
    })
    expect(url).toContain(REAL_KEY)
    expect(maskSensitiveUrl(url)).not.toContain(REAL_KEY)
  })
})
