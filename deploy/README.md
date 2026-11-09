# 部署配置

## nginx

- `nginx/conf.d/dls_api_proxy.conf`：`/api` 反代到 Django。
- `nginx/snippets/dls_proxy_common.conf` / `dls_proxy_locations.conf`：境外 API 同源反代。
- `nginx/snippets/dls_security_headers.conf`：站点 CSP（**F1**）。

### F1：CSP 与 Worker

文件解析 Worker 是从同源 `/assets/filePipeline.worker-*.js` 加载的。如果站点启用了
`Content-Security-Policy`，必须包含：

```text
worker-src 'self'
```

否则浏览器会拦截 Worker，`filePipelineClient` 会自动降级到主线程 —— 功能不坏，
但大文件导入会重新阻塞主线程，C4 的 Worker 化等于白做。

在 443 `server {}` 内引入：

```nginx
include /etc/nginx/snippets/dls_security_headers.conf;
```

`index.html` 含首屏主题脚本与 JSON-LD，因此 `script-src` 需要保留
`'unsafe-inline'`；百度统计需要放行 `https://hm.baidu.com`。
