# 外网 API 可达性核实 + 同源反向代理

> 日期：2026-10-29　｜　状态：**已实施**（nginx 代理层 + 前端切换）
> 服务器：`root@8.137.195.0`（阿里云杭州，Ubuntu 24.04，2C/1.6G）
> 站点：`https://dlslab.cn`（nginx 静态 + Django `/api`）

---

## 一、核实结论：问题确实存在，但不全是「运营商策略」

用两个独立出口实测：**本机（家宽）** 与 **阿里云服务器**。

| 上游 | 本机 | 服务器 | 判断 |
| --- | --- | --- | --- |
| `api.open-meteo.com` | 200 / 1.0s | 200 / 1.1–3.5s | ✅ 可达，跨境有抖动 |
| `archive-api.open-meteo.com` | 200 / 1.7s | 200 / 0.9s | ✅ 可达 |
| `earthquake.usgs.gov` | 200 / 1.1s | 200 / 0.6–1.1s | ✅ 可达 |
| `www.gdacs.org` | 连接后 **0 字节**，25s 超时 | 同样 0 字节，60s 超时 | ⚠️ **上游自身故障** |
| `tile.openstreetmap.org` | TCP 连接超时 | TCP 连接超时 | ❌ 两处都不通 |
| `mt0.google.com` | TCP 连接超时 | TCP 连接超时 | ❌ 两处都不通 |
| `restapi.amap.com` | 200 / 0.2s | 200 / 0.19s | ✅ 国内直连 |
| `webrd01.is.autonavi.com` | 200 | 200 / 0.03s | ✅ 国内直连 |

### 1.1 关键证据

**GDACS 不是被墙，是上游挂了。** 用 check-host.net 的 12 个海外节点（奥地利/德国/美国/越南等）同时请求 GDACS API，**全部 25s 超时**；而同一台服务器请求 `https://www.gdacs.org/` 首页是 200。上游返回过一条 400：

```
{"message":"Timeout expired. The timeout period elapsed prior to obtaining
a connection from the pool. ... max pool size was reached"}
```

→ 这是 GDACS 自己的数据库连接池耗尽，**换代理、换服务器都没用**。

**OSM / Google 是全网阻断，不是某家运营商。** 两个完全不同的出口都在 TCP 阶段超时；且 `tile.openstreetmap.org` 在不同 DNS 下解析到不同 Anycast/Fastly 节点（`59.188.250.54` / `202.160.128.205` / `199.96.62.21`），不同运营商拿到的节点不同，**表现会有差异，但结果都是不可用**。

**运营商差异确实存在，但只影响「速度/抖动」，不影响「能否访问」这一类被墙域名。** 跨境链路高峰期丢包、DNS 调度到不同边缘节点、部分省份对特定 IP 段的 QoS，都会造成「同一功能有人快有人慢」。把请求收敛到服务器一个出口 + 缓存，能把这种差异变成可控的。

### 1.2 结论表

| 类型 | 例子 | 服务器反代能否解决 |
| --- | --- | --- |
| 国内源缺 CORS | 百度/腾讯地图、民政部 | ✅ 能 |
| 跨境慢/抖动 | Open-Meteo、USGS | ✅ 能缓解（统一出口 + 缓存 + 超时兜底） |
| 上游自身故障 | GDACS 当前 | ❌ 不能，只能缓存/降级 |
| 全网阻断 | Google 瓦片、OSM 瓦片 | ❌ 不能（服务器也在墙内） |
| 前端 Key 暴露 | 高德 Key | ✅ 可改为服务端注入（本次未做） |

> **重要认知**：服务器在杭州阿里云，同样受跨境链路影响。它不是「翻墙代理」，价值在于**收敛出口、缓存、隐藏 Key、补 CORS、统一超时**，而不是让被墙的域名变得可访问。

---

## 二、已实施的反向代理

### 2.1 路由

| 前端路径 | 上游 |
| --- | --- |
| `/proxy/openmeteo/*` | `https://api.open-meteo.com/*` |
| `/proxy/openmeteo-archive/*` | `https://archive-api.open-meteo.com/*` |
| `/proxy/usgs/*` | `https://earthquake.usgs.gov/*` |
| `/proxy/gdacs/*` | `https://www.gdacs.org/*` |

前端映射在 `src/utils/apiProxy.ts`，只在 **生产 + `dlslab.cn` 域名** 下自动启用；开发、单测、Vercel 预览域名仍直连。可用 `VITE_API_PROXY=true/false` 强制开关。

国内源（高德、天地图、腾讯）**不代理**：它们本来就快，且批量地理编码会把 2C 小服务器的带宽打满。

### 2.2 安全与稳定性设计

- **固定上游白名单**：路径前缀决定上游，不能传任意 URL，不是开放代理；未列出的 `/proxy/*` 直接 404。
- **只允许 GET/HEAD/OPTIONS**，其余 405。
- **限速**：`20 r/s` / IP，burst 40。
- **缓存**：200 响应 5 分钟；`proxy_cache_use_stale` 在上游超时/5xx 时回旧数据；`proxy_cache_lock` 防止缓存击穿。
- **CORS**：先 `proxy_hide_header` 掉上游的 `Access-Control-Allow-Origin`，只回显 `dlslab.cn` 与 localhost；其他来源拿不到 ACAO。
- **Cookie 隔离**：上游的 `Set-Cookie` 一并 `proxy_hide_header`，避免 GDACS 之类的会话 Cookie 落到 `dlslab.cn` 域下。
- **超时**：连接 6s、读写 30s，配合前端 15s 超时，快速失败而不是一直转圈。
- **DNS**：显式 `resolver 223.5.5.5 119.29.29.29`，避免系统 DNS 被污染/漂移。

### 2.3 实测（2026-10-29）

```
/proxy/openmeteo/v1/elevation?...            200  1.09s   20 B
/proxy/openmeteo-archive/v1/archive?...      200  0.93s  304 B
/proxy/usgs/fdsnws/event/1/query?...         200  0.65s  953 B
/proxy/gdacs/.../SEARCH?...                  200 13.67s 4115 B   ← 上游慢，已缓存
/proxy/not-allowed/x                         404
第二次请求 openmeteo                          X-DLS-Cache: HIT
浏览器端实测（/tools/elevation_query）        首查 5.6s (MISS) → 复测 164ms (HIT)
OPTIONS 预检                                  204 + ACAO: https://dlslab.cn
Origin: https://evil.example                  无 ACAO 头
GDACS 响应                                    已剥离上游 Set-Cookie
```

### 2.4 部署位置

```
/etc/nginx/conf.d/dls_api_proxy.conf            # 缓存区、限速区、CORS map
/etc/nginx/snippets/dls_proxy_common.conf       # 公共代理参数
/etc/nginx/snippets/dls_proxy_locations.conf    # 四个上游 location
/etc/nginx/sites-enabled/dls_site.conf          # 443 server 块内 include locations
```

仓库内同名副本在 `deploy/nginx/`，改动请两边同步。

---

## 三、后续建议

1. **GDACS 加降级**：上游恢复前，前端应显示「数据源暂时不可用」而不是 30s 转圈；可考虑加 EMSC 作为地震备用源（已有调研）。
2. **Google / OSM 瓦片**：服务器也访问不了，建议在 `tileProviders.ts` 中默认隐藏或标注「需自备网络」，主推高德/腾讯/天地图。
3. **高德 Key 服务端化**：目前 `VITE_AMAP_KEY` 会打进前端包。若要藏 Key，可加 `/proxy/amap/*` 由 nginx 注入 `key` 参数；代价是所有地理编码流量走服务器，需先评估配额与带宽。
4. **监控**：给四个上游加一个定时探测（服务器 cron + curl），失败时写入日志/告警，比等用户反馈快。
5. **不要代理瓦片**：2C/1.6G + 轻量带宽扛不住地图瓦片流量，瓦片必须走 CDN 或国内图源。
