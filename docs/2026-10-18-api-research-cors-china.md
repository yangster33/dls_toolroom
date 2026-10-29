# 无跨域（CORS）且国内可直连的公开 API 调研

> 调研日期：2026-10-18　｜　状态：**仅调研，未实施**
> 目标：沿用 `src/tools/spec.md` 的「模式 B：Form → API → Display」范式（浏览器直接 `fetch`，零后端、零代理），
> 找出**能直接在前端调用**、且**国内网络可直连**的公开 API，作为新增工具的候选数据源。

---

## 一、调研方法

### 1.1 判定标准（三条同时满足才可用）

| 维度 | 判定 | 依据 |
| --- | --- | --- |
| 跨域 | 响应头带 `Access-Control-Allow-Origin`（`*` 或回显 Origin） | 否则浏览器 `fetch` 被 CORS 拦截，前端拿不到数据 |
| 国内可达 | 本机（**纯国内网络**）curl 能在 12s 内拿到响应 | 无需 VPN / 代理 |
| 可用性 | 返回 200；或返回 400/401/403（说明域名通、只是缺 Key/参数） | 400/401/403 一律按「通，需 Key」处理 |

### 1.2 网络环境校准（结论可信度前提）

先测了一批**已知在纯国内网络不可直连**的站点，确认本机没有走代理：

| 站点 | 结果 | 含义 |
| --- | --- | --- |
| google.com / youtube.com / x.com / facebook.com / one.one.one.one | 全部 `curl (28) 连接超时` | ✅ 确认是裸国内网络 |
| baidu.com / taobao.com | 200 | 国内正常 |
| github.com(api) / cdn.jsdelivr.net | 200 | 这两个国内可达（但波动，见 §3.3 备注） |

> 因此下文中标为「✅ 国内可达」的，是本机真实网络实测结果，不是文档推断。

### 1.3 复现命令

```powershell
# 看状态码 + 跨域头（D 输出响应头，o NUL 丢弃 body）
curl.exe -sS -L -D - -o NUL --max-time 12 `
  -A "Mozilla/5.0" -H "Origin: https://dlslab.cn" `
  "https://api.open-meteo.com/v1/elevation?latitude=30&longitude=120"
```

---

## 二、结论速览

图例：`跨域`=是否带 CORS 头；`国内`=国内实测可达；`Key`=是否需申请密钥。

### 🟢 第一梯队：零 Key + 跨域 + 国内可达（可直接做工具）

| API | 领域 | 跨域 | 国内 | Key |
| --- | --- | --- | --- | --- |
| USGS Earthquake（已在用） | 地震 | ✅ `*` | ✅ | 无 |
| GDACS（已在用） | 灾害 | ✅ `*` | ✅ | 无 |
| Open-Meteo 高程/历史天气（已在用） | 高程/气象 | ✅ `*` | ✅ | 无 |
| **Open-Meteo forecast** | 实时/预报天气 | ✅ `*` | ✅ | 无 |
| **Open-Meteo air-quality** | 空气质量/花粉/紫外线 | ✅ `*` | ✅ | 无 |
| **Open-Meteo flood** | 洪水/河流径流 | ✅ `*` | ✅ | 无 |
| **Open-Meteo marine** | 海洋/海浪 | ✅ `*` | ✅ | 无 |
| **Open-Meteo climate** | 气候模式 | ✅ `*` | ✅ | 无 |
| **Open-Meteo geocoding** | 地名→坐标 | ✅ `*` | ✅ | 无 |
| **Open-Meteo historical-forecast** | 近实时历史 | ✅ `*` | ✅ | 无 |
| **阿里云 DataV 行政区划边界** | 行政区划 GeoJSON | ✅ `*` | ✅ | 无 |
| **geojson.cn** | 行政区划 GeoJSON | ✅ `*` | ✅ | 无 |
| **中国天气网 nmc.cn** | 国内气象实况 | ✅ `*` | ✅ | 无（非公开接口） |
| **中国海洋预报 nmdis.org.cn** | 海洋/潮汐 | ✅ `*` | ✅ | 无（非公开接口） |
| **EMSC** | 欧洲-地中海地震 | ✅ `*` | ✅ | 无 |
| **OpenSky Network** | 航班实时位置 | ✅ 回显 | ✅ | 无（匿名限流） |
| **Celestrak** | 卫星 TLE 轨道 | ✅ `*` | ✅ | 无 |
| **Landsat STAC (usgs)** | 遥感影像目录 | ✅ 回显 | ✅ | 无 |
| **AWS Earth Search STAC** | 遥感影像目录 | ✅ `*` | ✅ | 无 |
| **Copernicus STAC** | Sentinel 影像目录 | ✅ `*` | ✅ | 无 |
| **api.met.no** | 挪威气象预报 | ✅ `*` | ✅ | 无 |
| **wttr.in** | 快速天气文本 | ✅ `*` | ✅ | 无 |
| **api.sunrise-sunset.org** | 日月升落 | ✅ `*` | ✅ | 无 |
| **RainViewer** | 天气雷达瓦片 | ✅ `*` | ✅ | 无 |
| **wheretheiss.at** | ISS 实时位置 | ✅ `*` | ✅ | 无 |
| **Photon (komoot)** | 地理编码 | ✅ `*` | ✅ | 无 |
| **OSRM demo** | 路径规划 | ✅ `*` | ✅ | 无 |
| **USGS Water Services** | 水文（仅美国） | ✅ `*` | ✅ | 无 |
| **timor.tech holiday-cn** | 中国节假日/调休 | ✅ 回显 | ✅ | 无 |
| **Nager.Date** | 多国公共假日 | ✅ `*` | ✅ | 无 |
| **World Bank** | 经济社会发展指标 | ✅ `*` | ✅ | 无 |
| **Frankfurter / exchangerate.host / exchangerate.fun** | 汇率 | ✅ `*` | ✅ | 无 |
| **ip.sb / ipinfo.io** | IP 定位 | ✅ `*` | ✅ | 无 |
| **CrossRef** | 学术文献元数据 | ✅ `*` | ✅ | 无 |
| **jsDelivr / GitHub API** | 数据托管/CDN | ✅ `*` | ✅（波动） | 无 |

### 🟡 第二梯队：跨域 + 国内可达，但**需申请 Key**

| API | 领域 | 跨域 | Key 获取 | 备注 |
| --- | --- | --- | --- | --- |
| 高德 restapi.amap.com（已在用） | 地理编码/POI/天气/静态图/瓦片 | ✅ `*` | 免费，日配额 | 项目已集成 `amapService.ts` |
| 天地图 api.tianditu.gov.cn | 地理编码/瓦片 | ✅ `*` | 免费 tk | 官方测绘源 |
| 和风天气 devapi.qweather.com | 国内气象 | ✅ `*` | 免费额度 | 国内速度快 |
| NASA api.nasa.gov | 天文/地球影像 | ✅ 回显 | 免费 | APOD 实测 500（DEMO_KEY 限流），正式 Key 可用 |
| WAQI api.waqi.info | 全球空气质量 | ✅ `*` | 免费 token | demo token 可用 |
| OpenWeatherMap | 全球气象 | ✅ `*` | 免费额度 | 国内可达 |
| MapTiler / Cesium ion | 底图 / 3D 地球 | ✅ `*` | 免费额度 | 仅作备选 |

### 🔴 第三梯队：数据很好但**不能**直接前端调用

| API | 原因 | 结论 |
| --- | --- | --- |
| 百度地图 api.map.baidu.com | 200 但**无 CORS 头** | 需服务端代理 / JSONP |
| 腾讯地图 apis.map.qq.com | 200 但**无 CORS 头** | 需服务端代理 |
| 中国地震台网 news.ceic.ac.cn | HTTPS **证书已过期**，HTTP 仅 POST 且 CORS `*` | 混合内容 + 证书问题，暂不可用 |
| 中国地震局 data.earthquake.cn | 无 CORS | 不可直接用 |
| Nominatim（OSM） | **连接超时** | 国内不可达 |
| Overpass API（OSM） | **连接超时** | 国内不可达 |
| OSM 官方瓦片 tile.openstreetmap.org | **连接超时** | 国内不可达 |
| OpenRouteService | 连接超时 | 不可达 |
| Wikipedia / Wikidata / Wikimedia Commons | 连接超时 | 不可达 |
| CoinGecko / ip-api.com | 连接超时 | 不可达 |
| gadm.org / NASA GIBS / SoilGrids(ISRIC) | 连接超时 | 不可达 |
| OpenLibrary / arxiv（无 CORS）/ Zenodo（403） | 不可达或不可用 | 不可用 |
| REST Countries | 200 但**无 CORS 头** | 不可直接用 |
| 民政部 / 国家统计局 / 中国环境监测总站 / 真气网 | 无 CORS | 需代理 |
| 微博 / B站 / 知乎 / 今日头条热榜 | 403 / 401，反爬 | 不稳定，不建议 |

---

## 三、分组详解

### 3.1 Open-Meteo 全家桶 —— 增量最大、成本最低

同一家、**全部零 Key、全部 `ACAO: *`、全部国内可达**，是本次调研里性价比最高的一块。

| 子域名 | 能力 |
| --- | --- |
| `api.open-meteo.com/v1/forecast` | 实时 + 未来 16 天预报 |
| `api.open-meteo.com/v1/elevation` | 高程（已在用） |
| `archive-api.open-meteo.com/v1/archive` | 1940 至今历史再分析（已在用） |
| `historical-forecast-api.open-meteo.com` | 近实时历史（预报存档） |
| `air-quality-api.open-meteo.com` | PM10/PM2.5、花粉（桤木/桦树/禾草/艾蒿）、紫外线、臭氧 |
| `flood-api.open-meteo.com` | GloFAS 河流径流/洪峰 |
| `marine-api.open-meteo.com` | 浪高/浪向/海温/洋流 |
| `climate-api.open-meteo.com` | CMIP6 气候情景数据 |
| `geocoding-api.open-meteo.com` | 地名 → 经纬度 → 行政区（**可替代被墙的 Nominatim**） |

> 可直接把现有 `elevation_query` / `weather_history` 的 UI 模式复制过去，边际成本极低。

### 3.2 国内源（速度最快、合规最稳）

| 源 | 端点 | 跨域 | 说明 |
| --- | --- | --- | --- |
| 阿里云 DataV | `geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json` | ✅ `*` | 全国/省/市/县**简化边界 GeoJSON**，国内 CDN 极快 |
| geojson.cn | `geojson.cn/api/china/{adcode}.json` | ✅ `*` | 行政区划边界 GeoJSON |
| 高德 Web 服务 | `restapi.amap.com/v3/*` | ✅ `*` | 地理编码/逆地理/天气/静态图/IP 定位；项目已有封装 |
| 高德瓦片 | `webrd0{1-4}.is.autonavi.com/appmaptile?...` | ✅ `*` | Leaflet 底图（现有 KML 查看器已在用同类） |
| 天地图 | `api.tianditu.gov.cn/*?tk=` | ✅ `*` | 需免费 tk；官方测绘成果，坐标系 CGCS2000 |
| 中国天气网 | `www.nmc.cn/rest/weather?stationid=`、`/rest/province/all` | ✅ `*` | **非公开接口**，无 SLA，字段可能变更 |
| 中国海洋预报 | `www.nmdis.org.cn` | ✅ `*` | 海洋/潮汐，非公开接口 |
| 和风天气 | `devapi.qweather.com/v7/*?key=` | ✅ `*` | 需 Key；国内 CDN |

### 3.3 国际源中「国内实测可达」的

`USGS`（地震/水情/Landsat STAC）、`EMSC`、`GDACS`、`OpenSky`、`Celestrak`、
`AWS Earth Search STAC`、`Copernicus STAC`、`met.no`、`wttr.in`、`sunrise-sunset`、
`RainViewer`、`wheretheiss.at`、`Photon`、`OSRM`、`World Bank`、`CrossRef`、
`Frankfurter`、`ip.sb`、`ipinfo.io`、`jsDelivr`、`holiday-cn`、`hitokoto`、`jinrishici`。

⚠️ 注意点：

- **可达 ≠ 稳定**：跨境链路会在高峰期抖动，务必给所有请求加超时与降级提示（项目已有 `fetchWithTimeout`）。
- `s3.amazonaws.com/elevation-tiles-prod`（SRTM 高程瓦片）实测**能连但很慢**（12s 下到 678KB/5.7MB），不适合做批量下载。
- `GitHub API / jsDelivr` 本机实测可达，但在国内属「时好时坏」，不建议作为核心依赖。

---

## 四、可落地的新工具候选（模式 B）

按「性价比 / 与现有工具链的贴合度」排序。

| # | 工具设想 | 数据源 | 跨域 | Key | 工作量 | 推荐度 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **行政区划边界下载**：选省/市/县 → 导出 GeoJSON/KML/Excel | DataV + geojson.cn | ✅ | 无 | 低 | ⭐⭐⭐⭐⭐ |
| 2 | **实时天气预报**：经纬度/地名 → 逐小时 + 逐日 | Open-Meteo forecast + geocoding | ✅ | 无 | 低 | ⭐⭐⭐⭐⭐ |
| 3 | **空气质量/花粉/紫外线查询** | Open-Meteo air-quality | ✅ | 无 | 低 | ⭐⭐⭐⭐ |
| 4 | **卫星过境预报**：TLE → 前端算过境时间/轨迹 → 落到 KML | Celestrak + satellite.js | ✅ | 无 | 中 | ⭐⭐⭐⭐ |
| 5 | **节假日/调休 + 工期排布**：与现有甘特图工具联动 | holiday-cn | ✅ | 无 | 低 | ⭐⭐⭐⭐ |
| 6 | **天气雷达动图**：Leaflet 叠加 RainViewer 瓦片 | RainViewer | ✅ | 无 | 低 | ⭐⭐⭐⭐ |
| 7 | **洪水/河流径流查询** | Open-Meteo flood | ✅ | 无 | 低 | ⭐⭐⭐ |
| 8 | **海洋/海浪/海温查询** | Open-Meteo marine | ✅ | 无 | 低 | ⭐⭐⭐ |
| 9 | **遥感影像检索**：按范围/时间搜 Sentinel/Landsat，出图 + 导出 | Earth Search / Copernicus / Landsat STAC | ✅ | 无 | 中 | ⭐⭐⭐ |
| 10 | **航班实时位置**：按范围查飞行器 | OpenSky | ✅ | 无 | 中 | ⭐⭐⭐ |
| 11 | **日月升落/日照时长**：并入 GIS 工具或独立小工具 | sunrise-sunset.org | ✅ | 无 | 低 | ⭐⭐⭐ |
| 12 | **地名/地址 → 坐标（多源）**：Photon + Open-Meteo geocoding 补 OSM 被墙的缺口 | Photon / Open-Meteo | ✅ | 无 | 中 | ⭐⭐⭐ |
| 13 | **路径规划/等时圈**：前端 OSRM 出线 → 导出 KML | OSRM demo | ✅ | 无 | 中 | ⭐⭐ |
| 14 | **汇率/经济指标查询** | Frankfurter / World Bank | ✅ | 无 | 低 | ⭐⭐ |
| 15 | **地震多源对比**：USGS + EMSC 双源 | USGS / EMSC | ✅ | 无 | 低 | ⭐⭐ |
| 16 | **IP 定位/网络信息** | ip.sb / ipinfo.io | ✅ | 无 | 低 | ⭐⭐ |
| 17 | **天文/星图 / ISS 追踪** | wheretheiss.at | ✅ | 无 | 低 | ⭐⭐ |
| 18 | **国内气象实况**（站点/城市） | 中国天气网 nmc.cn | ✅ | 无 | 中 | ⭐⭐（接口非公开，谨慎） |
| 19 | **地球 3D / 倾斜摄影底图** | Cesium ion | ✅ | token | 高 | ⭐（备选） |
| 20 | **每日诗词/一言**（可做「势」tab 内容源） | jinrishici / hitokoto | ✅ | 无 | 极低 | ⭐ |

---

## 五、Key、配额与合规注意事项

### 5.1 Key 类

- **高德**：项目已用；Web 服务 Key 有日调用上限，批量工具要限速（现有 `GeocodeBatchService` 已处理延迟/重试）。
- **天地图**、**和风**、**NASA**、**WAQI**：均为免费申请。
- 纯静态站**不能**把 Key 藏起来——所有 Key 都会暴露在前端。免费额度型服务需接受这一点（或走已有 `/api` 代理 + 服务端持 Key）。

### 5.2 坐标系合规（最容易踩的坑）

| 源 | 坐标系 |
| --- | --- |
| 高德 / 腾讯 | GCJ-02（火星坐标） |
| 天地图 / DataV / OpenStreetMap / USGS | CGCS2000 / WGS-84 |

跨源混用会产生 **50–500m 偏移**。好在本项目已有 `coordinateConverter.ts`（gcoord + proj4），任何「国内图源 + 国际数据源」的工具都必须显式转换并提示用户。

### 5.3 其它

- **别用公共 CORS 代理**（如 `r.jina.ai`、`corsproxy.io`）：不稳定、有隐私与合规风险，且与项目「数据不经第三方服务器」的承诺冲突。
- 无 CORS 的国内源（百度/腾讯/民政部/统计局）若确要接入，走**已有 Vercel rewrite**（`vercel.json` 里 `/api/(.*) → http://8.137.195.0/api/$1`）加代理，但要接受「不再是纯静态」的代价。
- **非公开接口**（`www.nmc.cn/rest/*`、`nmdis.org.cn`）无文档、无 SLA，随时可能改字段或封 IP；建议只做「锦上添花」类工具，不做核心依赖。
- 跨境源一律配 `fetchWithTimeout` + 友好降级文案（区分「超时 / 断网 / 被阻断」），避免用户看到 `TypeError: Failed to fetch`。
- 遵守各数据源的 ToS；OSM 系（Photon/OSRM demo）属共享资源，务必限并发。

---

## 六、待决策（本次未实施，等你拍板）

1. 优先做哪几个？我的建议：**#1 行政区划边界下载**、**#2 实时天气**、**#3 空气质量**三个先上（零 Key、零风险、工作量低）。
2. 是否接受「需用户自备 Key」的工具（高德/天地图/和风）？还是尽量只做零 Key 的？
3. 对百度/腾讯/民政部这类**无 CORS 但数据必需**的源，是否允许加服务端代理？
4. 是否要为被墙的国际源保留「用户自备代理」的可选项？

---

## 附录：本次实测原始结果

### A. 第一轮（连通性 + 跨域头，部分失败项已注原因）

```
USGS-earthquake    | 200 | OK-CORS      | *
GDACS              | 200 | OK-CORS      | *
OpenMeteo-elevation| 200 | OK-CORS      | *
OpenMeteo-archive  | 200 | OK-CORS      | *
OpenMeteo-air      | 200 | OK-CORS      | *
OpenMeteo-geocode  | 200 | OK-CORS      | *
OpenMeteo-flood    | 200 | OK-CORS      | *
OpenMeteo-marine   | 200 | OK-CORS      | *
OpenMeteo-forecast | 200 | OK-CORS      | *
OpenMeteo-climate  | 200 | OK-CORS      | *
OpenMeteo-histfcst | 200 | OK-CORS      | *
OpenTopoData       | 200 | 无CORS        |
open-elevation     | 200 | OK-CORS      | *
OpenTopography     | 401 | OK(need-key) | *
Nominatim          | 超时 | BLOCKED      |
Photon             | 200 | OK-CORS      | *
Overpass           | 超时 | BLOCKED      |
OSRM-route         | 200 | OK-CORS      | *
OpenRouteService   | 超时 | BLOCKED      |
OSM-tile           | 超时 | BLOCKED      |
sunrise-sunset     | 200 | OK-CORS      | *
RainViewer         | 200 | OK-CORS      | *
ISS-wheretheiss    | 200 | OK-CORS      | *
EMSC               | 200 | OK-CORS      | *
CENC-news.ceic     | HTTPS证书过期 / HTTP 405 + CORS * |
ChinaEQ-data       | 200 | 无CORS        |
QWeather-devapi    | 403 | OK(need-key) | *
NMC-central-weather| 200 | OK-CORS      | *
WAQI               | 200 | OK-CORS      | *
WorldBank          | 200 | OK-CORS      | *
RestCountries      | 200 | 无CORS        |
er-api-FX          | 200 | OK-CORS      | *
Frankfurter        | 200 | OK-CORS      | *
holiday-cn         | 200 | OK-CORS      | 回显Origin
ipapi.co           | 403 | OK(need-key) |
ip.sb              | 200 | OK-CORS      | *
hitokoto           | 200 | OK-CORS      | *
jinrishici         | 200 | OK-CORS      | 回显Origin
uapis.cn           | 403/404 | 需参数    |
vvhan/pearktrue    | DNS解析失败   |
oioweb             | TLS异常       |
52vmy              | 522           |
NASA-APOD          | 500 | 有CORS      | 可达(DEMO_KEY限流)
NMC-typhoon        | 404 | REACHABLE   |
OpenSky            | 200 | OK-CORS      | 回显Origin
USGS-water         | 200 | OK-CORS      | *
OpenAQ-v3          | 401 | OK(need-key)|
elevation-tiles(s3)| 200 | OK-CORS      | *  (但慢)
tdt-tianditu       | 400 | OK(need-key) | *
amap-restapi       | 200 | OK-CORS      | *
gadm.org           | 超时 | BLOCKED      |
geoBoundaries      | 200 | OK-CORS      | *
NaturalEarth       | 200 | 无CORS       |
WorldPop           | 301 | REACHABLE   |
GFW-tiles          | 307 | 有CORS      |
OpenWeatherMap     | 401 | OK(need-key) | *
Meteoblue          | 403 | OK(need-key) | *
TimeAPI(worldtime) | TLS重置 | BLOCKED    |
TimezoneDB         | 400 | REACHABLE   |
Calendarific       | 401 | OK(need-key) | *
Nager-holiday      | 200 | OK-CORS      | *
jsDelivr           | 200 | OK-CORS      | *
unpkg              | 302 | REACHABLE   | *
github-api         | 200 | OK-CORS      | *  (波动)
```

### B. 第二轮（国内源 + 社交/科研）

```
aliyun-datav-行政边界 | 200 | OK-CORS | *
geojson.cn           | 200 | OK-CORS | *
baidu-map            | 200 | 无CORS  |
tencent-map          | 200 | 无CORS  |
amap-weather         | 200 | OK-CORS | *
amap-tile            | 200 | OK-CORS | *
nmc-中国天气          | 200 | OK-CORS | *
nmc-城市列表          | 200 | OK-CORS | *
air.cnemc.cn         | 200 | 无CORS  |
aqistudy             | 200 | 无CORS  |
wttr.in              | 200 | OK-CORS | *
met.no               | 200 | OK-CORS | *
ipinfo.io            | 200 | OK-CORS | *
ip-api.com(http)     | 超时 | BLOCKED |
coingecko            | 超时 | BLOCKED |
exchangerate.host    | 200 | OK-CORS | *
exchangerate.fun     | 200 | OK-CORS | *
landsat-STAC         | 200 | OK-CORS | 回显Origin
NASA-GIBS            | 超时 | BLOCKED |
soilgrids(ISRIC)     | 超时 | BLOCKED |
zh.wikipedia/wikidata| 超时 | BLOCKED |
weibo/bilibili/zhihu/toutiao | 403/401 反爬 |
taobao-IP            | 200 | 无CORS |
```

### C. 第三轮（澄清模糊项）

```
celestrak.org        | 200 | OK-CORS | *     （celestrak.com 证书过期）
timeapi.io           | 200 | OK-CORS | *
tdt-geocoder         | 400 | OK(need-key) | *
amap-staticmap       | 200 | OK-CORS | *
amap-ip              | 200 | OK-CORS | *
nmdis-海洋预报        | 200 | OK-CORS | *
open-meteo-uv        | 200 | OK-CORS | *
stac-earthsearch(AWS)| 200 | OK-CORS | *
copernicus-STAC      | 200 | OK-CORS | *
crossref             | 200 | OK-CORS | *
s3-aws-elevation     | 超时（下到678KB/5.7MB，太慢）|
openlibrary/wikimedia| 超时 | BLOCKED |
arxiv                | 200 | 无CORS |
zenodo               | 403 |
baidu/腾讯/mca/stats | 无CORS |
```
