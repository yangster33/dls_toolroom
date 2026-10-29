import { describe, expect, it } from 'vitest'

import { PROXY_HOSTS, shouldUseApiProxy, toProxyUrl } from '@/utils/apiProxy'

describe('apiProxy', () => {
  describe('shouldUseApiProxy', () => {
    it('生产环境 + 站点域名时启用', () => {
      expect(shouldUseApiProxy({ PROD: true }, 'dlslab.cn')).toBe(true)
      expect(shouldUseApiProxy({ PROD: true }, 'www.dlslab.cn')).toBe(true)
    })

    it('开发环境默认不启用', () => {
      expect(shouldUseApiProxy({ PROD: false }, 'localhost')).toBe(false)
    })

    it('Vercel 等非站点域名不启用（那边没有代理）', () => {
      expect(shouldUseApiProxy({ PROD: true }, 'dls-toolroom.vercel.app')).toBe(false)
    })

    it('显式开关优先于域名判断', () => {
      expect(shouldUseApiProxy({ PROD: false, VITE_API_PROXY: 'true' }, 'localhost')).toBe(true)
      expect(shouldUseApiProxy({ PROD: true, VITE_API_PROXY: 'false' }, 'dlslab.cn')).toBe(false)
    })
  })

  describe('toProxyUrl', () => {
    it('已知上游改写到对应前缀，并保留 path/query', () => {
      expect(
        toProxyUrl(
          'https://api.open-meteo.com/v1/elevation?latitude=30&longitude=120',
          true,
        ),
      ).toBe('/proxy/openmeteo/v1/elevation?latitude=30&longitude=120')

      expect(
        toProxyUrl('https://archive-api.open-meteo.com/v1/archive?a=1', true),
      ).toBe('/proxy/openmeteo-archive/v1/archive?a=1')

      expect(
        toProxyUrl('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson', true),
      ).toBe('/proxy/usgs/fdsnws/event/1/query?format=geojson')

      expect(toProxyUrl('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH', true)).toBe(
        '/proxy/gdacs/gdacsapi/api/events/geteventlist/SEARCH',
      )
    })

    it('未启用时原样返回', () => {
      const url = 'https://api.open-meteo.com/v1/elevation?latitude=30'
      expect(toProxyUrl(url, false)).toBe(url)
    })

    it('未知 host 不改写（国内源保持直连）', () => {
      for (const url of [
        'https://restapi.amap.com/v3/geocode/geo?address=x',
        'https://tile.openstreetmap.org/0/0/0.png',
      ]) {
        expect(toProxyUrl(url, true)).toBe(url)
      }
    })

    it('相对路径与非法 URL 原样返回', () => {
      expect(toProxyUrl('/api/comments', true)).toBe('/api/comments')
      expect(toProxyUrl('not a url', true)).toBe('not a url')
    })

    it('映射表里的 host 都有唯一前缀', () => {
      const prefixes = Object.values(PROXY_HOSTS)
      expect(new Set(prefixes).size).toBe(prefixes.length)
      for (const prefix of prefixes) expect(prefix.startsWith('/proxy/')).toBe(true)
    })
  })
})
