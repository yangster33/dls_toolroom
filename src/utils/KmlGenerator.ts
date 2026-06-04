/**
 * KML 生成器 - 全功能KML文件生成工具
 */

export interface KmlPoint {
  name: string
  longitude: number
  latitude: number
  folder?: string
  color?: string
  description?: string
  iconUrl?: string
}

export interface KmlPolygon {
  name: string
  coordinates: [number, number][] // [lng, lat] pairs
  folder?: string
  color?: string
  fill?: boolean
  opacity?: number
  description?: string
}

export interface KmlSector {
  name: string
  longitude: number
  latitude: number
  azimuth: number // 方位角 (度) - 扇形对称线
  halfPowerAngle: number // 扇形总角度 (度) - 从方位角向两边各偏移 halfPowerAngle/2
  radius: number // 半径 (米)
  folder?: string
  color?: string
  opacity?: number
  description?: string
  physicalStationName?: string // 物理站名
  isIndoor?: string // 是否室分：'是'或'否'
}

export interface KmlDocumentProperties {
  name?: string
  open?: boolean
}

/**
 * 将角度转换为弧度
 */
function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * 将弧度转换为角度
 */
function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

/**
 * 计算地球表面上点的偏移（简化版，适用于小范围）
 * @param lng 起始经度
 * @param lat 起始纬度
 * @param distance 距离（米）
 * @param bearing 方位角（度）
 */
function calculateDestinationPoint(
  lng: number,
  lat: number,
  distance: number,
  bearing: number,
): [number, number] {
  const R = 6371000 // 地球半径（米）
  const d = distance / R // 距离（弧度）
  const brng = degToRad(bearing)

  const lat1 = degToRad(lat)
  const lng1 = degToRad(lng)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  )

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )

  return [radToDeg(lng2), radToDeg(lat2)]
}

/**
 * 生成扇形多边形坐标
 * @param lng 中心点经度
 * @param lat 中心点纬度
 * @param azimuth 方位角（扇形对称线/中心线）
 * @param totalAngle 扇形总角度
 * @param radius 半径
 * @param numPoints 采样点数
 */
function generateSectorCoordinates(
  lng: number,
  lat: number,
  azimuth: number,
  totalAngle: number,
  radius: number,
  numPoints: number = 30,
): [number, number][] {
  const coordinates: [number, number][] = []

  // 添加中心点
  coordinates.push([lng, lat])

  // 计算扇形的起始和结束角度（方位角作为对称线）
  const halfAngle = totalAngle / 2
  const startAngle = azimuth - halfAngle
  const endAngle = azimuth + halfAngle
  const angleStep = (endAngle - startAngle) / numPoints

  // 生成扇形边缘点
  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + angleStep * i
    const [pointLng, pointLat] = calculateDestinationPoint(lng, lat, radius, angle)
    coordinates.push([pointLng, pointLat])
  }

  // 闭合多边形
  coordinates.push([lng, lat])

  return coordinates
}

/**
 * 生成正方形多边形坐标（以经纬度为中心，2倍半径为边长）
 */
function generateSquareCoordinates(
  lng: number,
  lat: number,
  radius: number,
): [number, number][] {
  const halfSide = radius // 边长为2倍半径，所以从中心向每个方向延伸radius米

  const coordinates: [number, number][] = []

  // 计算正方形四个角
  const northWest = calculateDestinationPoint(lng, lat, Math.sqrt(2) * halfSide, 315) // 西北
  const northEast = calculateDestinationPoint(lng, lat, Math.sqrt(2) * halfSide, 45)  // 东北
  const southEast = calculateDestinationPoint(lng, lat, Math.sqrt(2) * halfSide, 135) // 东南
  const southWest = calculateDestinationPoint(lng, lat, Math.sqrt(2) * halfSide, 225) // 西南

  coordinates.push(northWest, northEast, southEast, southWest, northWest)

  return coordinates
}

/**
 * 将颜色转换为KML颜色格式
 * KML颜色格式: AABBGGRR (十六进制，透明度在前)
 */
function formatColor(color: string, opacity: number = 1): string {
  // 默认蓝色
  if (!color || color.trim() === '') {
    color = '#0000FF'
  }

  // 移除#号
  color = color.replace('#', '')

  // 如果是3位颜色，转换为6位
  if (color.length === 3) {
    color = color
      .split('')
      .map((c) => c + c)
      .join('')
  }

  // 确保是6位
  if (color.length !== 6) {
    color = '0000FF'
  }

  // 计算透明度 (00-FF)
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()

  // KML格式: AABBGGRR
  const rr = color.substring(0, 2).toUpperCase()
  const gg = color.substring(2, 4).toUpperCase()
  const bb = color.substring(4, 6).toUpperCase()

  return `${alpha}${bb}${gg}${rr}`
}

/**
 * 生成HTML表格描述
 */
function generateHtmlTable(data: Record<string, string | number | undefined>): string {
  const rows: string[] = []

  for (const [key, value] of Object.entries(data)) {
    rows.push(
      `<tr><td style="padding: 4px;">${key}</td><td style="padding: 4px;">${value || ''}</td></tr>`,
    )
  }

  return `<table width="300" border="1" style="border-collapse: collapse;">${rows.join('')}</table>`
}

/**
 * 生成KML文件内容
 */
export function generateKml(sectors: KmlSector[], properties: KmlDocumentProperties = {}): string {
  const { name = '基站扇区图', open = true } = properties

  // 生成扇区或正方形多边形元素
  const sectorPlacemarks = sectors.map((sector) => {
    let coordinates: [number, number][]
    if (sector.isIndoor === '是') {
      // 室分：生成正方形
      coordinates = generateSquareCoordinates(
        sector.longitude,
        sector.latitude,
        sector.radius,
      )
    } else {
      // 宏站：生成扇形
      coordinates = generateSectorCoordinates(
        sector.longitude,
        sector.latitude,
        sector.azimuth,
        sector.halfPowerAngle,
        sector.radius,
      )
    }

    const color = formatColor(sector.color || '', sector.opacity || 0.5)
    const coordString = coordinates.map((c) => `${c[0]},${c[1]},0`).join('\n          ')

    // 生成描述表格
    const description = generateHtmlTable({
      区域: sector.description?.split('|')[0] || '',
      网管基站名: sector.description?.split('|')[1] || '',
      物理站名: sector.description?.split('|')[2] || sector.physicalStationName || '',
      小区名称: sector.name,
      经度: sector.longitude,
      纬度: sector.latitude,
      小区覆盖类型: sector.description?.split('|')[3] || '',
      厂家: sector.description?.split('|')[4] || '',
      方位角: sector.azimuth,
      天线挂高: sector.description?.split('|')[5] || '',
      带宽: sector.description?.split('|')[6] || '',
      收发模式: sector.description?.split('|')[7] || '',
    })

    return `
        <Placemark>
          <name><![CDATA[${sector.name}]]></name>
          <description><![CDATA[${description}]]></description>
          <Style>
            <PolyStyle>
              <color>${color}</color>
              <fill>1</fill>
              <outline>1</outline>
            </PolyStyle>
          </Style>
          <Polygon>
            <extrude>0</extrude>
            <altitudeMode>clampToGround</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>
                  ${coordString}
                </coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>`
  })

  // 生成基站名称点标注元素（沿方位角向外半径距离加10米）
  const stationNamePlacemarks = sectors.map((sector) => {
    // 计算标注点位置：沿方位角方向，在半径基础上增加10米
    const labelRadius = sector.radius + 10
    const [labelLng, labelLat] = calculateDestinationPoint(
      sector.longitude,
      sector.latitude,
      labelRadius,
      sector.azimuth,
    )

    // 使用物理站名作为显示名称
    const stationName =
      sector.physicalStationName || sector.description?.split('|')[2] || sector.name

    return `
        <Placemark>
          <name><![CDATA[${stationName}]]></name>
          <Style>
            <IconStyle>
              <Icon>
              </Icon>
            </IconStyle>
            <LabelStyle>
              <scale>0.6</scale>
              <color>FF000000</color>
            </LabelStyle>
          </Style>
          <Point>
            <coordinates>${labelLng},${labelLat},0</coordinates>
          </Point>
        </Placemark>`
  })

  // 构建最终KML内容，包含两个文件夹
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name><![CDATA[${name}]]></name>
    <open>${open ? 1 : 0}</open>

    <!-- 基站扇区文件夹 -->
    <Folder>
      <name><![CDATA[基站扇区]]></name>
      ${sectorPlacemarks.join('\n')}
    </Folder>

    <!-- 基站名称文件夹 -->
    <Folder>
      <name><![CDATA[基站名称]]></name>
      ${stationNamePlacemarks.join('\n')}
    </Folder>
  </Document>
</kml>`

  return kmlContent
}

/**
 * 下载KML文件
 */
export function downloadKml(content: string, filename: string = 'basestation.kml'): void {
  const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
