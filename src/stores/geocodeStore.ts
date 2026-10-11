import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ApiKeyInfo {
  id: string
  provider: string | null
  key: string
  isValid: boolean
  validating: boolean
}

export interface Bounds {
  southwest: { lng: number; lat: number }
  northeast: { lng: number; lat: number }
}

export interface QueryOptions {
  delay: number
  randomDelay: boolean
  minRandomDelay: number
  maxRandomDelay: number
  mixedMode: boolean
}

export interface GeocodeConfig {
  apiKeys: ApiKeyInfo[]
  queryOptions: QueryOptions
  enableBounds: boolean
  bounds: Bounds
  selectedFields: string[]
}

export const useGeocodeStore = defineStore(
  'geocode',
  () => {
    const addConfig = ref<GeocodeConfig>({
      apiKeys: [
        {
          id: '1',
          provider: null,
          key: '',
          isValid: false,
          validating: false,
        },
      ],
      queryOptions: {
        delay: 1000,
        randomDelay: false,
        minRandomDelay: 500,
        maxRandomDelay: 2000,
        mixedMode: false,
      },
      enableBounds: false,
      bounds: {
        southwest: { lng: 116.0, lat: 39.6 },
        northeast: { lng: 116.8, lat: 40.2 },
      },
      selectedFields: ['address', 'province', 'city', 'district'],
    })

    const lonlatConfig = ref<GeocodeConfig>({
      apiKeys: [
        {
          id: '1',
          provider: null,
          key: '',
          isValid: false,
          validating: false,
        },
      ],
      queryOptions: {
        delay: 1000,
        randomDelay: false,
        minRandomDelay: 500,
        maxRandomDelay: 2000,
        mixedMode: false,
      },
      enableBounds: false,
      bounds: {
        southwest: { lng: 116.0, lat: 39.6 },
        northeast: { lng: 116.8, lat: 40.2 },
      },
      selectedFields: ['formattedAddress', 'inBounds'],
    })

    const addApiKey = (mode: 'add' | 'lonlat') => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.apiKeys.push({
        id: Date.now().toString(),
        provider: null,
        key: '',
        isValid: false,
        validating: false,
      })
    }

    const removeApiKey = (mode: 'add' | 'lonlat', index: number) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      if (config.value.apiKeys.length > 1) {
        config.value.apiKeys.splice(index, 1)
      }
    }

    const updateApiKey = (
      mode: 'add' | 'lonlat',
      index: number,
      keyInfo: Partial<Omit<ApiKeyInfo, 'id'>>,
    ) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      const currentKey = config.value.apiKeys[index]
      if (!currentKey) return
      config.value.apiKeys[index] = {
        id: currentKey.id,
        provider: currentKey.provider,
        key: currentKey.key,
        isValid: currentKey.isValid,
        validating: currentKey.validating,
        ...keyInfo,
      }
    }

    const updateQueryOptions = (mode: 'add' | 'lonlat', options: Partial<QueryOptions>) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.queryOptions = { ...config.value.queryOptions, ...options }
    }

    const updateEnableBounds = (mode: 'add' | 'lonlat', enable: boolean) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.enableBounds = enable
    }

    const updateBounds = (mode: 'add' | 'lonlat', bounds: Bounds) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.bounds = bounds
    }

    const updateSelectedFields = (mode: 'add' | 'lonlat', fields: string[]) => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.selectedFields = fields
    }

    const clearApiKeys = (mode: 'add' | 'lonlat') => {
      const config = mode === 'add' ? addConfig : lonlatConfig
      config.value.apiKeys = [
        {
          id: '1',
          provider: null,
          key: '',
          isValid: false,
          validating: false,
        },
      ]
    }

    return {
      addConfig,
      lonlatConfig,
      addApiKey,
      removeApiKey,
      updateApiKey,
      updateQueryOptions,
      updateEnableBounds,
      updateBounds,
      updateSelectedFields,
      clearApiKeys,
    }
  },
  {
    /**
     * 只持久化非敏感字段（审计 P2-12）。
     *
     * 原来是 persist: true，即把整个 state（含 apiKeys[].key 明文高德 API Key）
     * 以 JSON 写进 localStorage（key 为 `geocode`）。任何 XSS、恶意浏览器扩展
     * 或本地脚本都能读取，且跨会话长期留存。
     *
     * 现在改为白名单：只保留查询参数、边界与字段选择等非敏感项，
     * apiKeys 留在内存，用户每次会话自行输入。
     *
     * 注：pinia-plugin-persistedstate v4 用 `pick`（旧版叫 `paths`）。
     */
    persist: {
      pick: [
        'addConfig.queryOptions',
        'addConfig.enableBounds',
        'addConfig.bounds',
        'addConfig.selectedFields',
        'lonlatConfig.queryOptions',
        'lonlatConfig.enableBounds',
        'lonlatConfig.bounds',
        'lonlatConfig.selectedFields',
      ],
    },
  },
)
