import { describe, it, expect } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCoordinateInputStore } from '../coordinateInputStore'
import { DEFAULT_CGCS2000_PARAMS } from '../coordConversion.ts'

describe('coordinateInputStore', () => {
  it('初始状态包含一行 WGS84 空坐标', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    expect(store.coordinates).toHaveLength(1)
    expect(store.coordinates[0]).toMatchObject({
      coordinateSystem: 'wgs84',
      x: '',
      y: '',
    })
    expect(typeof store.coordinates[0]!.id).toBe('number')
    expect(store.cgcs2000Params).toEqual(DEFAULT_CGCS2000_PARAMS)
  })

  it('addRow 追加行', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    store.addRow({ id: 1, coordinateSystem: 'gcj02', x: '116.4', y: '39.9' })
    expect(store.coordinates).toHaveLength(2)
    expect(store.coordinates[1]).toEqual({
      id: 1,
      coordinateSystem: 'gcj02',
      x: '116.4',
      y: '39.9',
    })
  })

  it('removeRowById 移除存在的行', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    store.addRow({ id: 42, coordinateSystem: 'wgs84', x: '1', y: '2' })
    store.removeRowById(42)
    expect(store.coordinates).toHaveLength(1)
  })

  it('removeRowById 对不存在的 id 不做任何事', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    store.removeRowById(999)
    expect(store.coordinates).toHaveLength(1)
  })

  it('setCoordinates 整体替换', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    const rows = [
      { id: 1, coordinateSystem: 'wgs84', x: '1', y: '2' },
      { id: 2, coordinateSystem: 'gcj02', x: '3', y: '4' },
    ]
    store.setCoordinates(rows)
    expect(store.coordinates).toEqual(rows)
  })

  it('setCgcs2000Params 更新参数', () => {
    setActivePinia(createPinia())
    const store = useCoordinateInputStore()
    const params = { ...DEFAULT_CGCS2000_PARAMS, centralMeridian: 111, zoneWidth: 6 as const }
    store.setCgcs2000Params(params)
    expect(store.cgcs2000Params).toEqual(params)
  })
})
