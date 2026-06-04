// stores/coordinateInputStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
} from './coordConversion.ts'

interface PersistedStateConfig {
  persist: {
    key: string
    storage: typeof localStorage
  }
}

interface CoordinateRow {
  id: number
  coordinateSystem: string
  x: string
  y: string
}

export const useCoordinateInputStore = defineStore(
  'coordinateInput',
  () => {
    const coordinates = ref<CoordinateRow[]>([
      { id: Date.now(), coordinateSystem: 'wgs84', x: '', y: '' },
    ])

    const cgcs2000Params = ref<CGCS2000Params>({ ...DEFAULT_CGCS2000_PARAMS })

    const setCoordinates = (newCoords: CoordinateRow[]) => {
      coordinates.value = newCoords
    }

    const addRow = (row: CoordinateRow) => {
      coordinates.value.push(row)
    }

    const removeRowById = (id: number) => {
      const index = coordinates.value.findIndex((row) => row.id === id)
      if (index > -1) {
        coordinates.value.splice(index, 1)
      }
    }

    const setCgcs2000Params = (params: CGCS2000Params) => {
      cgcs2000Params.value = params
    }

    return {
      coordinates,
      cgcs2000Params,
      setCoordinates,
      addRow,
      removeRowById,
      setCgcs2000Params,
    }
  },
  {
    persist: {
      key: 'coordinate-input-store',
      storage: localStorage,
    },
  } as PersistedStateConfig,
)
