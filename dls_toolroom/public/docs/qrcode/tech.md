# 术

本工具的数据编码与解码能力依赖于两个核心 npm 包，所有计算均在浏览器主线程中完成。

---

## 1. qrcode — 二维码生成

**用途**：将文本或 URL 编码为 QR 码 Data URL 图像，支持自定义尺寸、纠错级别和颜色。

**npm**：[https://www.npmjs.com/package/qrcode](https://www.npmjs.com/package/qrcode)

**GitHub**：[https://github.com/soldair/node-qrcode](https://github.com/soldair/node-qrcode)

**在本项目中的角色**：接收用户输入的文本内容，根据设定的尺寸、纠错级别和颜色参数，生成可嵌入 `<img>` 标签的 Base64 Image Data URL。

**核心调用代码**（摘自 `QrcodePage.vue`）：

```typescript
qrCodeUrl.value = await QRCode.toDataURL(inputText.value, {
  width: qrSize.value,
  margin: 2,
  errorCorrectionLevel: errorLevel.value,
  color: {
    dark: foregroundColor.value,
    light: backgroundColor.value,
  },
})
```

**设计说明**：`toDataURL` 方法异步执行编码运算，返回的 Data URL 可直接用于页面渲染或触发下载。`margin` 参数设为 2 个模块宽度，为码图四周保留必要的静区，确保识读设备能正确界定码图边界。`errorCorrectionLevel` 支持四级选项：`L`（约 7% 容损）、`M`（约 15%）、`Q`（约 25%）、`H`（约 30%）。`color` 参数允许独立设置码点色和背景色，但两者之间必须保持足够的对比度。

为提高响应性能，生成调用前加入了防抖控制（200ms 延迟），避免用户连续输入或快速拖动滑块时频繁触发编码运算：

```typescript
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

const debouncedGenerate = debounce(generateQrCode, 200)

watch([inputText, qrSize, errorLevel, foregroundColor, backgroundColor], () => {
  debouncedGenerate()
})
```

---

## 2. jsQR — 二维码识别

**用途**：从图像像素数据中检测并解码 QR 码，返回其中包含的文本内容。纯 JavaScript 实现，无需任何后端服务或浏览器扩展。

**npm**：[https://www.npmjs.com/package/jsqr](https://www.npmjs.com/package/jsqr)

**GitHub**：[https://github.com/cozmo/jsQR](https://github.com/cozmo/jsQR)

**在本项目中的角色**：接收从用户上传图片中提取的 `Uint8ClampedArray` 像素数据及图像宽高，通过定位图案检测和数据模块解析，还原出原始编码文本。

**核心调用代码**（摘自 `QrcodePage.vue`）：

```typescript
const img = new Image()
img.crossOrigin = 'Anonymous'

await new Promise<void>((resolve, reject) => {
  img.onload = () => resolve()
  img.onerror = () => reject(new Error('图片加载失败'))
  img.src = imageUrl
})

const canvas = document.createElement('canvas')
canvas.width = img.width
canvas.height = img.height
const ctx = canvas.getContext('2d')

if (!ctx) {
  throw new Error('无法创建画布上下文')
}

ctx.drawImage(img, 0, 0)
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
const code = jsQR(imageData.data, imageData.width, imageData.height)

if (code) {
  scanResult.value = code.data
} else {
  scanError.value = '未能识别到二维码，请确保图片清晰且包含有效的二维码。'
}
```

**设计说明**：识别流程在主线程同步执行。首先通过 `Image` 对象加载图片文件，设置 `crossOrigin = 'Anonymous'` 属性以防止跨域资源导致的画布污染问题。图片加载完成后，将其按原始尺寸绘制到一个离屏 Canvas 上，调用 `getImageData` 获取 RGBA 四通道像素数组。`jsQR` 接收三个参数：像素数据（`Uint8ClampedArray`，按行排列，每像素 4 字节依次为 R、G、B、A）、图像宽度（像素）和图像高度（像素）。内部流程为：先在像素阵列中搜索三个角的定位图案（Finder Pattern），确定码图边界与透视变换，再按模块网格读取明暗判定值，经过纠错和字符集解码后输出文本。识别成功时 `code.data` 为解码后的字符串；未检测到二维码时返回 `null`。

**重要说明**：识别过程并未使用 Web Worker，所有图像处理和解码运算均在浏览器主线程同步执行。对于大尺寸图片，识别过程可能短暂阻塞用户界面。

---

## 数据流

**生成方向：**

```
用户输入文本
  -> 防抖 (200ms)
  -> QRCode.toDataURL()  [参数: width, margin, errorCorrectionLevel, color]
  -> Base64 Data URL
  -> <img> 元素渲染 / 下载为 PNG
```

**识别方向：**

```
用户选取图片文件
  -> FileReader.readAsDataURL()
  -> new Image() 加载
  -> Canvas 绘制 (drawImage)
  -> getImageData() 提取像素阵列 (Uint8ClampedArray + width + height)
  -> jsQR() 解码
  -> 文本结果 或 错误提示
```
