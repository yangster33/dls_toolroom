// 页面统计 Mock 数据
const pageStats: Record<string, { view_count: number; comment_count: number }> = {
  coord_convert: { view_count: 1234, comment_count: 45 },
  coords_convert: { view_count: 856, comment_count: 23 },
  distance_sensor: { view_count: 523, comment_count: 18 },
  get_add: { view_count: 2156, comment_count: 67 },
  get_lonlat: { view_count: 1890, comment_count: 54 },
  table2kml_point: { view_count: 678, comment_count: 21 },
  table2kml_basestation: { view_count: 432, comment_count: 15 },
  geo_data: { view_count: 345, comment_count: 12 },
  gis2excel: { view_count: 789, comment_count: 34 },
  shp2excel: { view_count: 456, comment_count: 18 },
  docx_template_export: { view_count: 234, comment_count: 8 },
  about: { view_count: 3456, comment_count: 89 },
  moment: { view_count: 567, comment_count: 12 },
}

// 各工具的地图数据（模拟不同工具的访问分布差异）
const toolMapData: Record<string, Array<{ name: string; sevenDays: number; thirtyDays: number; oneYear: number }>> = {
  coord_convert: [
    { name: '北京市', sevenDays: 12500, thirtyDays: 47800, oneYear: 545000 },
    { name: '上海市', sevenDays: 11800, thirtyDays: 44900, oneYear: 510000 },
    { name: '广东省', sevenDays: 17200, thirtyDays: 65500, oneYear: 745000 },
    { name: '江苏省', sevenDays: 14200, thirtyDays: 54200, oneYear: 615000 },
    { name: '浙江省', sevenDays: 13000, thirtyDays: 49400, oneYear: 564000 },
    { name: '山东省', sevenDays: 11300, thirtyDays: 43000, oneYear: 490000 },
    { name: '四川省', sevenDays: 9800, thirtyDays: 37300, oneYear: 425000 },
    { name: '河南省', sevenDays: 9100, thirtyDays: 34600, oneYear: 394000 },
    { name: '湖北省', sevenDays: 8100, thirtyDays: 30700, oneYear: 350000 },
    { name: '湖南省', sevenDays: 7500, thirtyDays: 28600, oneYear: 325000 },
  ],
  coords_convert: [
    { name: '广东省', sevenDays: 8800, thirtyDays: 33500, oneYear: 380000 },
    { name: '江苏省', sevenDays: 7300, thirtyDays: 27800, oneYear: 316000 },
    { name: '浙江省', sevenDays: 6700, thirtyDays: 25400, oneYear: 290000 },
    { name: '北京市', sevenDays: 6400, thirtyDays: 24400, oneYear: 278000 },
    { name: '上海市', sevenDays: 6100, thirtyDays: 23300, oneYear: 265000 },
    { name: '山东省', sevenDays: 5800, thirtyDays: 22100, oneYear: 252000 },
    { name: '四川省', sevenDays: 5000, thirtyDays: 19100, oneYear: 218000 },
    { name: '河南省', sevenDays: 4600, thirtyDays: 17600, oneYear: 201000 },
    { name: '福建省', sevenDays: 4400, thirtyDays: 16800, oneYear: 191000 },
    { name: '湖北省', sevenDays: 4100, thirtyDays: 15600, oneYear: 178000 },
  ],
  get_add: [
    { name: '广东省', sevenDays: 22500, thirtyDays: 86100, oneYear: 980000 },
    { name: '北京市', sevenDays: 19800, thirtyDays: 75500, oneYear: 865000 },
    { name: '上海市', sevenDays: 19000, thirtyDays: 72500, oneYear: 830000 },
    { name: '江苏省', sevenDays: 16800, thirtyDays: 64100, oneYear: 732000 },
    { name: '浙江省', sevenDays: 15200, thirtyDays: 58000, oneYear: 663000 },
    { name: '四川省', sevenDays: 12800, thirtyDays: 48700, oneYear: 556000 },
    { name: '山东省', sevenDays: 12200, thirtyDays: 46500, oneYear: 530000 },
    { name: '河南省', sevenDays: 11500, thirtyDays: 43800, oneYear: 500000 },
    { name: '湖北省', sevenDays: 10500, thirtyDays: 40100, oneYear: 456000 },
    { name: '湖南省', sevenDays: 9800, thirtyDays: 37400, oneYear: 425000 },
  ],
  get_lonlat: [
    { name: '广东省', sevenDays: 19200, thirtyDays: 73200, oneYear: 836000 },
    { name: '北京市', sevenDays: 16800, thirtyDays: 64100, oneYear: 732000 },
    { name: '上海市', sevenDays: 16100, thirtyDays: 61400, oneYear: 701000 },
    { name: '浙江省', sevenDays: 13800, thirtyDays: 52600, oneYear: 600000 },
    { name: '江苏省', sevenDays: 13200, thirtyDays: 50400, oneYear: 574000 },
    { name: '山东省', sevenDays: 11500, thirtyDays: 43800, oneYear: 500000 },
    { name: '四川省', sevenDays: 10200, thirtyDays: 39000, oneYear: 445000 },
    { name: '河南省', sevenDays: 9500, thirtyDays: 36300, oneYear: 414000 },
    { name: '湖北省', sevenDays: 8700, thirtyDays: 33300, oneYear: 380000 },
    { name: '福建省', sevenDays: 8200, thirtyDays: 31200, oneYear: 356000 },
  ],
  distance_sensor: [
    { name: '内蒙古自治区', sevenDays: 6800, thirtyDays: 26000, oneYear: 296000 },
    { name: '新疆维吾尔自治区', sevenDays: 5200, thirtyDays: 19800, oneYear: 226000 },
    { name: '西藏自治区', sevenDays: 4500, thirtyDays: 17200, oneYear: 196000 },
    { name: '青海省', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '甘肃省', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
    { name: '四川省', sevenDays: 2800, thirtyDays: 10700, oneYear: 122000 },
    { name: '云南省', sevenDays: 2500, thirtyDays: 9500, oneYear: 109000 },
    { name: '黑龙江省', sevenDays: 2200, thirtyDays: 8400, oneYear: 96000 },
    { name: '吉林省', sevenDays: 1800, thirtyDays: 6900, oneYear: 78000 },
    { name: '辽宁省', sevenDays: 1500, thirtyDays: 5700, oneYear: 65000 },
  ],
  table2kml_point: [
    { name: '广东省', sevenDays: 5200, thirtyDays: 19800, oneYear: 226000 },
    { name: '江苏省', sevenDays: 4400, thirtyDays: 16800, oneYear: 191000 },
    { name: '浙江省', sevenDays: 4000, thirtyDays: 15200, oneYear: 174000 },
    { name: '北京市', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '上海市', sevenDays: 3600, thirtyDays: 13800, oneYear: 157000 },
    { name: '山东省', sevenDays: 3400, thirtyDays: 13000, oneYear: 148000 },
    { name: '四川省', sevenDays: 3000, thirtyDays: 11500, oneYear: 131000 },
    { name: '河南省', sevenDays: 2800, thirtyDays: 10700, oneYear: 122000 },
    { name: '湖北省', sevenDays: 2500, thirtyDays: 9500, oneYear: 109000 },
    { name: '湖南省', sevenDays: 2300, thirtyDays: 8800, oneYear: 100000 },
  ],
  table2kml_basestation: [
    { name: '广东省', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '河南省', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
    { name: '山东省', sevenDays: 3000, thirtyDays: 11500, oneYear: 131000 },
    { name: '四川省', sevenDays: 2600, thirtyDays: 10000, oneYear: 114000 },
    { name: '河北省', sevenDays: 2400, thirtyDays: 9200, oneYear: 105000 },
    { name: '江苏省', sevenDays: 2300, thirtyDays: 8800, oneYear: 100000 },
    { name: '湖南省', sevenDays: 2100, thirtyDays: 8000, oneYear: 91000 },
    { name: '湖北省', sevenDays: 1900, thirtyDays: 7300, oneYear: 83000 },
    { name: '安徽省', sevenDays: 1800, thirtyDays: 6900, oneYear: 78000 },
    { name: '浙江省', sevenDays: 1700, thirtyDays: 6500, oneYear: 74000 },
  ],
  geo_data: [
    { name: '西藏自治区', sevenDays: 8200, thirtyDays: 31200, oneYear: 356000 },
    { name: '新疆维吾尔自治区', sevenDays: 6800, thirtyDays: 26000, oneYear: 296000 },
    { name: '内蒙古自治区', sevenDays: 5500, thirtyDays: 21100, oneYear: 241000 },
    { name: '青海省', sevenDays: 4200, thirtyDays: 16100, oneYear: 184000 },
    { name: '四川省', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '甘肃省', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
    { name: '云南省', sevenDays: 2800, thirtyDays: 10700, oneYear: 122000 },
    { name: '黑龙江省', sevenDays: 2200, thirtyDays: 8400, oneYear: 96000 },
    { name: '广西壮族自治区', sevenDays: 1800, thirtyDays: 6900, oneYear: 78000 },
    { name: '贵州省', sevenDays: 1500, thirtyDays: 5700, oneYear: 65000 },
  ],
  gis2excel: [
    { name: '广东省', sevenDays: 6800, thirtyDays: 26000, oneYear: 296000 },
    { name: '江苏省', sevenDays: 5700, thirtyDays: 21800, oneYear: 249000 },
    { name: '浙江省', sevenDays: 5200, thirtyDays: 19800, oneYear: 226000 },
    { name: '北京市', sevenDays: 4900, thirtyDays: 18600, oneYear: 212000 },
    { name: '上海市', sevenDays: 4600, thirtyDays: 17600, oneYear: 201000 },
    { name: '山东省', sevenDays: 4300, thirtyDays: 16400, oneYear: 187000 },
    { name: '四川省', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '河南省', sevenDays: 3500, thirtyDays: 13400, oneYear: 152000 },
    { name: '湖北省', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
    { name: '湖南省', sevenDays: 2900, thirtyDays: 11100, oneYear: 126000 },
  ],
  shp2excel: [
    { name: '广东省', sevenDays: 5200, thirtyDays: 19800, oneYear: 226000 },
    { name: '江苏省', sevenDays: 4500, thirtyDays: 17200, oneYear: 196000 },
    { name: '浙江省', sevenDays: 4100, thirtyDays: 15600, oneYear: 178000 },
    { name: '北京市', sevenDays: 3800, thirtyDays: 14500, oneYear: 165000 },
    { name: '上海市', sevenDays: 3600, thirtyDays: 13800, oneYear: 157000 },
    { name: '山东省', sevenDays: 3400, thirtyDays: 13000, oneYear: 148000 },
    { name: '四川省', sevenDays: 3000, thirtyDays: 11500, oneYear: 131000 },
    { name: '河南省', sevenDays: 2800, thirtyDays: 10700, oneYear: 122000 },
    { name: '湖北省', sevenDays: 2500, thirtyDays: 9500, oneYear: 109000 },
    { name: '湖南省', sevenDays: 2300, thirtyDays: 8800, oneYear: 100000 },
  ],
  docx_template_export: [
    { name: '北京市', sevenDays: 2800, thirtyDays: 10700, oneYear: 122000 },
    { name: '上海市', sevenDays: 2600, thirtyDays: 10000, oneYear: 114000 },
    { name: '广东省', sevenDays: 2400, thirtyDays: 9200, oneYear: 105000 },
    { name: '江苏省', sevenDays: 2100, thirtyDays: 8000, oneYear: 91000 },
    { name: '浙江省', sevenDays: 1900, thirtyDays: 7300, oneYear: 83000 },
    { name: '山东省', sevenDays: 1800, thirtyDays: 6900, oneYear: 78000 },
    { name: '四川省', sevenDays: 1500, thirtyDays: 5700, oneYear: 65000 },
    { name: '河南省', sevenDays: 1400, thirtyDays: 5400, oneYear: 61000 },
    { name: '湖北省', sevenDays: 1200, thirtyDays: 4600, oneYear: 52000 },
    { name: '湖南省', sevenDays: 1100, thirtyDays: 4200, oneYear: 48000 },
  ],
}

// 评论 Mock 数据
const commentsData: Record<string, Array<{
  id: string
  nickname: string
  phone: string
  email: string
  type: 'complaint' | 'bug' | 'praise' | 'other'
  content: string
  created_at: string
}>> = {
  coord_convert: [
    { id: '1', nickname: '用户A', phone: '', email: '', type: 'praise', content: '坐标转换很准确，使用方便！', created_at: '2024-01-15 10:30:00' },
    { id: '2', nickname: '工程师', phone: '138xxx', email: '', type: 'complaint', content: '希望支持更多坐标系', created_at: '2024-01-14 15:20:00' },
    { id: '3', nickname: '小明', phone: '', email: '', type: 'other', content: '如果能保存转换历史就好了', created_at: '2024-01-13 09:45:00' },
  ],
  coords_convert: [
    { id: '1', nickname: '数据分析师', phone: '', email: 'test@xx.com', type: 'praise', content: '批量转换功能太实用了', created_at: '2024-01-13 09:15:00' },
    { id: '2', nickname: 'GIS专家', phone: '', email: '', type: 'bug', content: 'Excel导入有时会出错', created_at: '2024-01-11 11:20:00' },
  ],
  distance_sensor: [
    { id: '1', nickname: '地质学家', phone: '', email: '', type: 'praise', content: '距离测算功能对野外工作帮助很大', created_at: '2024-01-12 14:00:00' },
    { id: '2', nickname: '户外爱好者', phone: '', email: '', type: 'other', content: '希望能添加海拔计算', created_at: '2024-01-10 08:30:00' },
  ],
  get_add: [
    { id: '1', nickname: '快递员', phone: '', email: '', type: 'praise', content: '快速找到地址，节省了很多时间！', created_at: '2024-01-14 16:00:00' },
    { id: '2', nickname: '电商运营', phone: '', email: 'op@shop.com', type: 'praise', content: '批量解析地址功能太赞了', created_at: '2024-01-13 10:00:00' },
  ],
  get_lonlat: [
    { id: '1', nickname: '地图开发者', phone: '', email: '', type: 'praise', content: '多种地图服务商选择很贴心', created_at: '2024-01-15 09:00:00' },
    { id: '2', nickname: '物流调度', phone: '', email: '', type: 'other', content: '希望能保存常用地址', created_at: '2024-01-14 11:30:00' },
  ],
  table2kml_point: [
    { id: '1', nickname: '测绘工程师', phone: '', email: '', type: 'praise', content: '表格转KML点文件功能非常实用', created_at: '2024-01-13 15:00:00' },
    { id: '2', nickname: '规划师', phone: '', email: '', type: 'complaint', content: '希望支持更多格式导出', created_at: '2024-01-11 14:00:00' },
  ],
  table2kml_basestation: [
    { id: '1', nickname: '通信工程师', phone: '', email: '', type: 'praise', content: '基站KML生成功能完美解决了我的需求', created_at: '2024-01-12 10:00:00' },
  ],
  geo_data: [
    { id: '1', nickname: 'GIS研究员', phone: '', email: '', type: 'praise', content: '空间分析工具功能强大！', created_at: '2024-01-15 11:00:00' },
    { id: '2', nickname: '数据科学家', phone: '', email: '', type: 'bug', content: '某些几何计算有精度问题', created_at: '2024-01-13 16:30:00' },
  ],
  gis2excel: [
    { id: '1', nickname: '数据分析师', phone: '', email: '', type: 'praise', content: 'GIS转Excel功能太方便了', created_at: '2024-01-14 09:00:00' },
    { id: '2', nickname: '项目经理', phone: '', email: '', type: 'praise', content: '大大提高了数据处理效率', created_at: '2024-01-12 17:00:00' },
  ],
  shp2excel: [
    { id: '1', nickname: 'GIS工程师', phone: '', email: '', type: 'praise', content: '批量SHP转表格功能很实用！', created_at: '2024-01-15 10:00:00' },
    { id: '2', nickname: '规划设计师', phone: '', email: '', type: 'praise', content: '多文件上传节省了很多时间', created_at: '2024-01-13 14:30:00' },
  ],
  docx_template_export: [
    { id: '1', nickname: '行政专员', phone: '', email: '', type: 'praise', content: 'Word模板导出功能非常实用', created_at: '2024-01-13 11:00:00' },
    { id: '2', nickname: '报告员', phone: '', email: '', type: 'other', content: '希望能支持更多模板功能', created_at: '2024-01-11 10:00:00' },
  ],
  about: [
    { id: '1', nickname: '访客', phone: '', email: '', type: 'other', content: '项目很有价值，继续加油！', created_at: '2024-01-16 14:45:00' },
    { id: '2', nickname: '开发者', phone: '', email: 'dev@xx.com', type: 'bug', content: '页面加载有点慢', created_at: '2024-01-12 11:00:00' },
  ],
  moment: [
    { id: '1', nickname: '用户', phone: '', email: '', type: 'praise', content: '功能很强大！', created_at: '2024-01-10 08:30:00' },
  ],
}

export default [
  {
    url: '/api/page-stats/:pageKey',
    method: 'get',
    response: (req: { url?: string }) => {
      const url = req.url || ''
      const match = url.match(/\/api\/page-stats\/([^/]+)/)
      const pageKey = match ? match[1]! : ''
      const stats = pageStats[pageKey] || { view_count: 0, comment_count: 0 }
      return {
        code: 0,
        data: {
          page_key: pageKey,
          ...stats,
        },
      }
    },
  },

  {
    url: '/api/page-stats/:pageKey/view',
    method: 'post',
    response: (req: { url?: string }) => {
      const url = req.url || ''
      const match = url.match(/\/api\/page-stats\/([^/]+)\/view/)
      const pageKey = match ? match[1]! : ''

      if (!pageStats[pageKey]) {
        pageStats[pageKey] = { view_count: 0, comment_count: 0 }
      }
      pageStats[pageKey]!.view_count++
      return {
        code: 0,
        data: { view_count: pageStats[pageKey]!.view_count },
      }
    },
  },

  {
    url: '/api/comments',
    method: 'get',
    response: (req: { query?: Record<string, string> }) => {
      const pageKey = req.query?.page_key || ''
      const page = parseInt(req.query?.page || '1')
      const size = parseInt(req.query?.size || '10')
      const comments = commentsData[pageKey] || []
      const start = (page - 1) * size
      const end = start + size
      
      return {
        code: 0,
        data: {
          list: comments.slice(start, end),
          total: comments.length,
          page,
          size,
        },
      }
    },
  },

  {
    url: '/api/comments',
    method: 'post',
    response: (req: { body?: { page_key: string; nickname: string; phone: string; email: string; type: string; content: string } }) => {
      const body = req.body || { page_key: '', nickname: '', phone: '', email: '', type: 'other', content: '' }
      
      if (!commentsData[body.page_key]) {
        commentsData[body.page_key] = []
      }
      
      const newComment = {
        id: Date.now().toString(),
        nickname: body.nickname,
        phone: body.phone,
        email: body.email,
        type: body.type as 'complaint' | 'bug' | 'praise' | 'other',
        content: body.content,
        created_at: new Date().toLocaleString('zh-CN'),
      }
      
      commentsData[body.page_key]!.unshift(newComment)
      pageStats[body.page_key] = pageStats[body.page_key] || { view_count: 0, comment_count: 0 }
      pageStats[body.page_key]!.comment_count++
      
      return {
        code: 0,
        data: newComment,
      }
    },
  },

  {
    url: '/api/map-data',
    method: 'get',
    response: (req: { query?: Record<string, string> }) => {
      const toolId = req.query?.tool_id || ''
      const data = toolMapData[toolId] || []
      
      return {
        code: 0,
        data,
      }
    },
  },
]
