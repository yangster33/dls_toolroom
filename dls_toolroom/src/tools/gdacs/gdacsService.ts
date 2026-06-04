export interface GdacsEvent {
  id: string
  title: string
  type: string
  country: string
  countrycode: string
  fromdate: string
  todate: string
  alertlevel: string
  severity: string
  population: number
  latitude: number
  longitude: number
  description: string
  url: string
}

export interface GdacsFeature {
  type: string
  properties: {
    eventid: string
    episodeid: string
    eventtype: string
    name: string
    title: string
    description: string
    htmldescription: string
    alertlevel: string
    severity: string
    fromdate: string
    todate: string
    country: string
    countrycode: string
    population: number
    url: string
    geometry: {
      type: string
      coordinates: number[]
    }
  }
  geometry: {
    type: string
    coordinates: number[]
  }
}

export interface GdacsApiResponse {
  type: string
  metadata: {
    description: string
    name: string
    htmldescription: string
  }
  features: GdacsFeature[]
}

export interface GdacsFormData {
  eventType: string
  alertLevel: string
  startDate: string
  endDate: string
  pageNumber: number
  pageSize: number
}

export interface QueryResult {
  success: boolean
  data?: GdacsEvent[]
  total?: number
  error?: string
}

export const eventTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'EQ', label: '地震' },
  { value: 'TC', label: '热带气旋' },
  { value: 'FL', label: '洪水' },
  { value: 'VO', label: '火山' },
  { value: 'DR', label: '干旱' },
  { value: 'WF', label: '野火' },
]

export const alertLevelOptions = [
  { value: '', label: '全部级别' },
  { value: 'Green', label: '绿色' },
  { value: 'Orange', label: '橙色' },
  { value: 'Red', label: '红色' },
]

export interface GdacsApiResponse {
  type: string
  features: GdacsFeature[]
  total?: number
}

export async function fetchGdacsData(formData: GdacsFormData): Promise<QueryResult> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const startDate = formData.startDate || thirtyDaysAgo
    const endDate = formData.endDate || today

    const params = new URLSearchParams()

    if (formData.eventType) {
      params.set('eventlist', formData.eventType)
    } else {
      params.set('eventlist', 'EQ;TC;FL;VO;DR;WF')
    }

    params.set('fromdate', startDate!)
    params.set('todate', endDate!)

    if (formData.alertLevel) {
      params.set('alertlevel', formData.alertLevel.toLowerCase())
    }

    params.set('pagenumber', formData.pageNumber.toString())
    params.set('pagesize', formData.pageSize.toString())

    const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `请求失败: HTTP ${response.status}${errorText ? ' - ' + errorText : ''}`,
      }
    }

    const jsonData: GdacsApiResponse = await response.json()

    let events: GdacsEvent[] = []
    let total = 0

    if (jsonData.type === 'FeatureCollection' && jsonData.features) {
      total = jsonData.features.length
      events = jsonData.features.map((feature: any) => {
        const props = feature.properties || {}
        const coords = feature.geometry?.coordinates || []

        const propsUrl = typeof props.url === 'string' ? props.url : ''
        const eventUrl = propsUrl || `https://www.gdacs.org/report.aspx?eventid=${props.eventid}&eventtype=${props.eventtype}`
        
        return {
          id: props.eventid || props.id || '',
          title: props.title || props.name || '',
          type: props.eventtype || props.type || '',
          country: props.country || '',
          countrycode: props.countrycode || '',
          fromdate: props.fromdate || '',
          todate: props.todate || '',
          alertlevel: props.alertlevel || '',
          severity: props.severity || '',
          population: props.population || 0,
          latitude: parseFloat(props.latitude) || parseFloat(coords[1]) || 0,
          longitude: parseFloat(props.longitude) || parseFloat(coords[0]) || 0,
          description: props.description || props.htmldescription || '',
          url: eventUrl,
        }
      })
    } else if (Array.isArray(jsonData)) {
      total = jsonData.length
      events = jsonData.map((item: any) => {
        const itemUrl = typeof item.url === 'string' ? item.url : ''
        const eventUrl = itemUrl || `https://www.gdacs.org/report.aspx?eventid=${item.eventid}&eventtype=${item.eventtype}`
        
        return {
          id: item.eventid || '',
          title: item.title || item.name || '',
          type: item.eventtype || '',
          country: item.country || '',
          countrycode: item.countrycode || '',
          fromdate: item.fromdate || '',
          todate: item.todate || '',
          alertlevel: item.alertlevel || '',
          severity: item.severity || '',
          population: item.population || 0,
          latitude: parseFloat(item.latitude) || parseFloat(item.lat) || 0,
          longitude: parseFloat(item.longitude) || parseFloat(item.lon) || 0,
          description: item.description || '',
          url: eventUrl,
        }
      })
    }

    return {
      success: true,
      data: events,
      total: total,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    }
  }
}

function parseGdacsXml(xmlText: string): GdacsEvent[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const items = xmlDoc.querySelectorAll('item')
  const events: GdacsEvent[] = []
  const gdacsNamespace = 'http://www.gdacs.org'

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || ''
    const description = item.querySelector('description')?.textContent || ''
    const link = item.querySelector('link')?.textContent || ''

    const gdacsAlertLevel = getGdacsElementContent(item, gdacsNamespace, 'alertlevel')
    const gdacsEventId = getGdacsElementContent(item, gdacsNamespace, 'eventid')
    const gdacsEventType = getGdacsElementContent(item, gdacsNamespace, 'eventtype')
    const gdacsCountry = getGdacsElementContent(item, gdacsNamespace, 'country')
    const gdacsSeverity = getGdacsElementContent(item, gdacsNamespace, 'severity')
    const gdacsFromDate = getGdacsElementContent(item, gdacsNamespace, 'fromdate')
    const gdacsToDate = getGdacsElementContent(item, gdacsNamespace, 'todate')
    const gdacsLat = parseFloat(getGdacsElementContent(item, gdacsNamespace, 'lat') || '0')
    const gdacsLon = parseFloat(getGdacsElementContent(item, gdacsNamespace, 'lon') || '0')

    events.push({
      id: gdacsEventId!,
      title: title!,
      type: gdacsEventType!,
      country: gdacsCountry!,
      countrycode: gdacsCountry!,
      fromdate: gdacsFromDate!,
      todate: gdacsToDate!,
      alertlevel: gdacsAlertLevel!,
      severity: gdacsSeverity!,
      population: 0,
      latitude: gdacsLat,
      longitude: gdacsLon,
      description: description,
      url: link,
    })
  })

  return events
}

function getGdacsElementContent(
  parent: Element,
  namespace: string,
  tagName: string,
): string | null {
  const elements = parent.getElementsByTagNameNS(namespace, tagName)
  return elements.length > 0 ? elements[0]!.textContent : null
}

export function downloadJson(data: GdacsEvent[], filename: string = 'gdacs_events.json'): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getAlertLevelColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'red':
      return '#dc2626'
    case 'orange':
      return '#f97316'
    case 'green':
      return '#22c55e'
    default:
      return '#6b7280'
  }
}

export function getEventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    EQ: '地震',
    TC: '热带气旋',
    FL: '洪水',
    VO: '火山',
    DR: '干旱',
    WF: '野火',
  }
  return map[type] || type
}
