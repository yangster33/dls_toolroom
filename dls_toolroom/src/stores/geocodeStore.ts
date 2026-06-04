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

    const updateApiKey = (mode: 'add' | 'lonlat', index: number, keyInfo: Partial<Omit<ApiKeyInfo, 'id'>>) => {
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
    persist: true,
  }
)
