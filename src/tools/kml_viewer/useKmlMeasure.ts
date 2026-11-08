/**
 * KML 查看器的地图测量 / 采点工具。
 *
 * 从 KmlViewerPage.vue 抽出的有状态交互层：地图实例由页面注入，
 * 本 composable 只负责测量点、图层、监听器和结果展示。
 */
import { computed, ref, watch } from 'vue'
import L from 'leaflet'
import { calculateAngle, formatArea, formatLength, polygonAreaM2 } from './kmlMeasureMath'
import type { MeasureMode, PickedCoord } from './types'

export interface UseKmlMeasureOptions {
  getMap: () => L.Map | null
  getContainer: () => HTMLElement | null
  getMarkerIcon: (color?: string) => L.DivIcon
}

export function useKmlMeasure(options: UseKmlMeasureOptions) {
  const measureMode = ref<MeasureMode>(null)
  const pickerActive = ref(false)
  const isMeasuring = computed(() => measureMode.value !== null || pickerActive.value)

  // 测量状态变化时切换 Leaflet 容器的 crosshair 光标
  watch(isMeasuring, (val) => {
    const map = options.getMap()
    if (map) {
      map.getContainer().style.cursor = val ? 'crosshair' : ''
    } else {
      const container = options.getContainer()
      if (container) container.style.cursor = val ? 'crosshair' : ''
    }
  })

  const measureResult = ref('')
  let measurePoints: L.LatLng[] = []
  let measureLayer: L.Polyline | L.Polygon | null = null
  let measureMarkers: L.Marker[] = []
  let angleLines: L.Polyline[] = []
  let angleLineMarkers: L.Marker[] = []
  let drawHandler: (() => void) | null = null
  const anglePoints = ref<L.LatLng[]>([])

  const pickedCoords = ref<PickedCoord[]>([])
  let pickerMarkers: L.Marker[] = []

  function cleanupDrawListeners() {
    if (drawHandler) {
      drawHandler()
      drawHandler = null
    }
  }

  function addMeasureMarker(latlng: L.LatLng, label?: string): L.Marker | null {
    const map = options.getMap()
    if (!map) return null
    const m = L.marker(latlng, {
      icon: L.divIcon({
        className: 'measure-marker',
        html: `<div style="width:10px;height:10px;background:#ff6600;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>${label ? `<span style="position:absolute;top:-18px;left:6px;font-size:10px;font-weight:bold;color:#ff6600;text-shadow:0 0 2px #fff;">${label}</span>` : ''}`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      }),
    }).addTo(map)
    measureMarkers.push(m)
    return m
  }

  function turfLength(points: L.LatLng[]): number {
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += points[i - 1]!.distanceTo(points[i]!)
    }
    return total
  }

  function updateMeasureDrawing() {
    const map = options.getMap()
    if (!map) return

    if (measureLayer) {
      map.removeLayer(measureLayer)
      measureLayer = null
    }

    if (measurePoints.length < 2) return

    if (measureMode.value === 'area') {
      measureLayer = L.polygon(measurePoints, {
        color: '#ff6600',
        fillColor: '#ff6600',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map)
      measureResult.value = `面积: ${formatArea(polygonAreaM2(measurePoints))}`
    } else if (measureMode.value === 'length') {
      measureLayer = L.polyline(measurePoints, {
        color: '#ff6600',
        weight: 3,
      }).addTo(map)
      measureResult.value = `长度: ${formatLength(turfLength(measurePoints))}`
    }
  }

  function finishMeasure() {
    cleanupDrawListeners()
    // Keep result visible, clear mode
    measureMode.value = null
  }

  function setupDrawMeasure(): () => void {
    const map = options.getMap()
    if (!map) return () => {}

    const clickHandler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      measurePoints.push(e.latlng)
      addMeasureMarker(e.latlng)
      updateMeasureDrawing()
    }

    const dblClickHandler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      if (measurePoints.length > 0) {
        measurePoints.push(e.latlng)
        addMeasureMarker(e.latlng)
        updateMeasureDrawing()
        finishMeasure()
      }
    }

    map.on('click', clickHandler)
    map.on('dblclick', dblClickHandler)

    return () => {
      map.off('click', clickHandler)
      map.off('dblclick', dblClickHandler)
    }
  }

  function setupAngleMeasure(): () => void {
    const map = options.getMap()
    if (!map) return () => {}

    const clickHandler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      anglePoints.value = [...anglePoints.value, e.latlng]
      const marker = addMeasureMarker(e.latlng, 'A' + anglePoints.value.length)
      if (marker) angleLineMarkers.push(marker)

      if (anglePoints.value.length === 3) {
        const line1 = L.polyline([anglePoints.value[0]!, anglePoints.value[1]!], {
          color: '#ff4444',
          weight: 2,
          dashArray: '5,5',
        }).addTo(map)
        angleLines.push(line1)

        const line2 = L.polyline([anglePoints.value[1]!, anglePoints.value[2]!], {
          color: '#4444ff',
          weight: 2,
          dashArray: '5,5',
        }).addTo(map)
        angleLines.push(line2)

        const angle = calculateAngle(
          anglePoints.value[0]!,
          anglePoints.value[1]!,
          anglePoints.value[2]!,
        )
        measureResult.value = `角度: ${angle.toFixed(2)}°`
        finishMeasure()
      }
    }

    map.on('click', clickHandler)
    return () => map.off('click', clickHandler)
  }

  function clearMeasure() {
    const map = options.getMap()
    if (measureLayer) {
      map?.removeLayer(measureLayer)
      measureLayer = null
    }
    measureMarkers.forEach((m) => map?.removeLayer(m))
    measureMarkers = []
    angleLines.forEach((l) => map?.removeLayer(l))
    angleLines = []
    angleLineMarkers.forEach((m) => map?.removeLayer(m))
    angleLineMarkers = []
    measurePoints = []
    anglePoints.value = []
    measureResult.value = ''
    measureMode.value = null
    cleanupDrawListeners()
  }

  function clearPicker() {
    const map = options.getMap()
    pickerActive.value = false
    pickedCoords.value = []
    pickerMarkers.forEach((m) => map?.removeLayer(m))
    pickerMarkers = []
    cleanupDrawListeners()
  }

  function toggleMeasureMode(mode: MeasureMode) {
    if (measureMode.value === mode) {
      clearMeasure()
      return
    }
    clearPicker()
    clearMeasure()
    measureMode.value = mode
    measurePoints = []
    anglePoints.value = []
    cleanupDrawListeners()

    drawHandler = mode === 'angle' ? setupAngleMeasure() : setupDrawMeasure()
  }

  function togglePicker() {
    clearMeasure()
    cleanupDrawListeners()

    pickerActive.value = !pickerActive.value

    if (pickerActive.value) {
      const map = options.getMap()
      if (!map) return
      const handler = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e)
        const { lat, lng } = e.latlng
        pickedCoords.value = [...pickedCoords.value, { lat, lng }]
        const m = L.marker([lat, lng], {
          icon: options.getMarkerIcon('#e74c3c'),
        })
          .bindPopup(`<span class="font-mono text-xs">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`)
          .addTo(map)
          .openPopup()
        pickerMarkers.push(m)
      }
      map.on('click', handler)
      drawHandler = () => {
        map.off('click', handler)
        map.off('dblclick')
      }
    }
  }

  function clearPickedCoords() {
    const map = options.getMap()
    pickedCoords.value = []
    pickerMarkers.forEach((m) => map?.removeLayer(m))
    pickerMarkers = []
  }

  async function copyCoord(coord: PickedCoord) {
    await navigator.clipboard.writeText(`${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`)
  }

  async function copyAllCoords() {
    const text = pickedCoords.value
      .map((c) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
  }

  return {
    measureMode,
    pickerActive,
    isMeasuring,
    measureResult,
    anglePoints,
    pickedCoords,
    toggleMeasureMode,
    togglePicker,
    clearMeasure,
    clearPicker,
    clearPickedCoords,
    copyCoord,
    copyAllCoords,
    cleanupDrawListeners,
  }
}
