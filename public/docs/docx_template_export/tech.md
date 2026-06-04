# 技术说明

## 技术栈

| 技术 | 说明 |
|------|------|
| **docxtemplater** | 核心模板渲染引擎 |
| **pizzip** | DOCX 文件（ZIP格式）解析 |
| **papaparse** | CSV 文件解析 |
| **xlsx** | Excel 文件解析 |
| **file-saver** | 文件下载触发 |

## 工作原理

```
用户数据 (CSV/Excel)
       ↓
  数据解析层 (papaparse / xlsx)
       ↓
  JSON 数据对象
       ↓
  模板渲染层 (docxtemplater)
       ↓
  DOCX 文件生成 (pizzip)
       ↓
  文件下载 (file-saver)
```

## docxtemplater 核心概念

### 标签类型

1. **替换标签**：`{{field}}` → 替换为对应字段值
2. **循环标签**：`{#array}{item}{/array}` → 遍历数组
3. **条件标签**：`{?condition}content{/?condition}` → 条件渲染
4. **raw 标签**：`{@rawHtml}` → 原始 HTML 内容（需启用模块）

### 渲染流程

```javascript
// 1. 加载 DOCX 文件（本质是 ZIP）
const zip = new PizZip(templateContent)

// 2. 创建渲染实例
const doc = new Docxtemplater(zip)

// 3. 设置数据
doc.render({
  name: '张三',
  items: [{ name: '项目A', value: 100 }]
})

// 4. 生成文件
const blob = doc.getZip().generate({
  type: 'blob',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
})
```

## 浏览器兼容性

- 现代浏览器（Chrome、Firefox、Edge、Safari）
- 不支持 IE 浏览器

## 文件大小限制

- 数据文件：建议不超过 10MB
- 模板文件：建议不超过 5MB

## 已知限制

1. **单文档模式**：当前版本每次生成一份文档（使用第一条数据）
2. **不支持图片占位符**：需要额外配置图片模块
3. **不支持复杂表格合并单元格**：需使用 docxtemplater 表格模块
