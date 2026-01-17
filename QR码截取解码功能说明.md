# QR 码截取和解码功能说明

## 新增功能

### 1. **QR 码截取**

- 检测到 QR 码后,自动截取 QR 码区域
- 边距扩大 15%,确保完整截取
- 截图以 Base64 格式存储,方便显示和下载

### 2. **QR 码解码**

- 使用 OpenCV.js 的`detectAndDecode`方法解码 QR 码内容
- 支持各种 QR 码格式(URL、文本、vCard 等)
- 解码失败时会显示友好提示

### 3. **UI 显示**

- **二维码截图区域**:

  - 显示截取的 QR 码图片
  - 图片可悬停放大
  - 最大尺寸 200x200px(移动端 150x150px)

- **解码内容区域**:
  - 使用等宽字体显示解码内容
  - 支持长文本滚动
  - 一键复制按钮,点击后显示复制成功反馈

### 4. **复制功能**

- 点击复制按钮可将解码内容复制到剪贴板
- 复制成功后按钮图标变为对勾,1.5 秒后恢复

## 使用方法

1. **摄像头模式**:

   - 启动摄像头
   - 拍照
   - 自动检测、截取和解码

2. **上传模式**:
   - 上传包含 QR 码的图片
   - 自动检测、截取和解码

## 技术实现

### 核心函数

#### `extractQRCodeImage(sourceCanvas, detection, margin)`

截取 QR 码区域图像

- `sourceCanvas`: 源 canvas 元素
- `detection`: 检测结果对象
- `margin`: 边距扩展比例(默认 0.1)
- 返回: Base64 图像数据

#### `decodeQRCode(imageData)`

解码 QR 码内容

- `imageData`: 图像数据
- 返回: Promise<string|null> 解码后的文本

### 数据流程

```
图像输入
  ↓
检测QR码位置 (detectQRCode)
  ↓
绘制检测结果 (drawDetectionResult)
  ↓
截取QR码图像 (extractQRCodeImage)
  ↓
解码QR码内容 (decodeQRCode)
  ↓
显示截图和内容
```

## 样式特点

- 使用玻璃态设计(glassmorphism)
- 响应式布局,移动端友好
- 平滑的悬停和点击动画
- 高对比度的解码内容显示
- 视觉反馈清晰

## 注意事项

1. 解码功能依赖 OpenCV.js,需要网络加载
2. 某些损坏或特殊格式的 QR 码可能无法解码
3. 复制功能需要 HTTPS 环境或 localhost
4. 截图质量取决于原始图像质量
