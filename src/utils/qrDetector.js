/**
 * 二维码检测工具模块
 * 使用 OpenCV.js 的 QRCodeDetector.detect() 方法检测二维码位置
 */

/* global cv */

// OpenCV.js 加载状态
let cvReady = false
let cvLoadPromise = null
const DETECTION_STRATEGIES = [
  { name: '原图直接检测', steps: [] },
  { name: '对比度增强+Otsu', steps: ['contrast', 'otsu'] },
  { name: 'Otsu二值化', steps: ['otsu'] },
  { name: '自适应二值化(高斯)', steps: ['adaptive'] },
  { name: '去噪+自适应二值化', steps: ['blur', 'adaptive'] },
  { name: '放大2倍+对比度+Otsu', steps: ['scale_2', 'contrast', 'otsu'] },
  { name: '放大3倍', steps: ['scale_3'] }
]

/**
 * 动态加载 OpenCV.js
 * @returns {Promise<void>}
 */
function loadOpenCV() {
  if (cvReady) {
    return Promise.resolve()
  }
  
  if (cvLoadPromise) {
    return cvLoadPromise
  }
  
  cvLoadPromise = new Promise((resolve, reject) => {
    // 检查是否已经加载
    if (typeof cv !== 'undefined' && cv.Mat) {
      cvReady = true
      resolve()
      return
    }
    
    // 创建 script 标签加载 OpenCV.js
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
    script.async = true
    
    // OpenCV.js 加载完成后会调用 onRuntimeInitialized
    window.Module = {
      onRuntimeInitialized() {
        console.log('OpenCV.js 已加载')
        cvReady = true
        resolve()
      }
    }
    
    script.onerror = () => {
      reject(new Error('OpenCV.js 加载失败'))
    }
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!cvReady) {
        reject(new Error('OpenCV.js 加载超时'))
      }
    }, 30000)
    
    // 监听 cv 对象就绪
    const checkReady = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkReady)
        clearTimeout(timeout)
        cvReady = true
        resolve()
      }
    }, 100)
    
    document.head.appendChild(script)
  })
  
  return cvLoadPromise
}



/**
 * 图像预处理:自适应二值化 (高斯)
 */
function adaptiveThreshold(gray) {
  const result = new cv.Mat()
  cv.adaptiveThreshold(gray, result, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2)
  return result
}

/**
 * 图像预处理:自适应二值化 (均值)
 */
function adaptiveThresholdMean(gray) {
  const result = new cv.Mat()
  cv.adaptiveThreshold(gray, result, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 11, 2)
  return result
}

/**
 * 图像预处理:Otsu二值化
 */
function otsuThreshold(gray) {
  const result = new cv.Mat()
  cv.threshold(gray, result, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
  return result
}

/**
 * 图像预处理:对比度增强 (CLAHE)
 */
function enhanceContrast(gray) {
  const result = new cv.Mat()
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))
  clahe.apply(gray, result)
  clahe.delete()
  return result
}

/**
 * 图像预处理:直方图均衡化
 */
function equalizeHistogram(gray) {
  const result = new cv.Mat()
  cv.equalizeHist(gray, result)
  return result
}

/**
 * 图像预处理:高斯模糊去噪
 */
function gaussianBlur(gray) {
  const result = new cv.Mat()
  cv.GaussianBlur(gray, result, new cv.Size(5, 5), 0)
  return result
}

/**
 * 图像预处理:形态学闭运算 (填补小孔)
 */
function morphologyClose(gray) {
  const result = new cv.Mat()
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
  cv.morphologyEx(gray, result, cv.MORPH_CLOSE, kernel)
  kernel.delete()
  return result
}

/**
 * 图像预处理:形态学开运算 (去除噪点)
 */
function morphologyOpen(gray) {
  const result = new cv.Mat()
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
  cv.morphologyEx(gray, result, cv.MORPH_OPEN, kernel)
  kernel.delete()
  return result
}

/**
 * 图像预处理:放大
 */
function resizeByScale(gray, factor) {
  const result = new cv.Mat()
  const width = Math.max(1, Math.round(gray.cols * factor))
  const height = Math.max(1, Math.round(gray.rows * factor))
  const interpolation = factor >= 1 ? cv.INTER_CUBIC : cv.INTER_AREA
  cv.resize(gray, result, new cv.Size(width, height), 0, 0, interpolation)
  return result
}

function scaleUp(gray, factor) {
  return resizeByScale(gray, factor)
}

/**
 * 图像预处理:锐化
 */
function sharpen(gray) {
  const result = new cv.Mat()
  const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ])
  cv.filter2D(gray, result, -1, kernel)
  kernel.delete()
  return result
}

/**
 * 图像预处理:强锐化
 */
function sharpenStrong(gray) {
  const result = new cv.Mat()
  const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
    -1, -1, -1,
    -1, 9, -1,
    -1, -1, -1
  ])
  cv.filter2D(gray, result, -1, kernel)
  kernel.delete()
  return result
}

/**
 * 检测图像中的二维码位置
 * @param {ImageData} imageData - Canvas 的 ImageData 对象
 * @returns {Promise<Object|null>} 检测结果，包含位置信息
 */
export async function detectQRCode(imageData, sourceCanvas = null) {
  const matsToDelete = [] // 统一管理需要释放的 Mat
  
  try {
    console.log('[QR检测] 开始检测...')
    console.log('[QR检测] 图像尺寸:', imageData.width, 'x', imageData.height)
    
    // 确保 OpenCV.js 已加载
    await loadOpenCV()
    console.log('[QR检测] OpenCV.js 已就绪')
    
    // 将 ImageData 转换为 OpenCV Mat
    const src = cv.matFromImageData(imageData)
    matsToDelete.push(src)
    console.log('[QR检测] 原始图像 Mat 创建成功')
    
    // 转换为灰度图
    const gray = new cv.Mat()
    matsToDelete.push(gray)
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    console.log('[QR检测] 灰度图转换完成')
    
    // 创建 QR 码检测器
    const detector = new cv.QRCodeDetector()
    
    let validationCanvas = sourceCanvas
    const ensureValidationCanvas = () => {
      if (validationCanvas) return validationCanvas
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height
      const ctx = canvas.getContext('2d')
      ctx.putImageData(imageData, 0, 0)
      validationCanvas = canvas
      return validationCanvas
    }
    
    const detectWithStrategies = async (label, baseGray, baseScale, strategyList) => {
      let currentScale = 1
      const logPrefix = label ? `${label} ` : ''
      
      for (const strategy of strategyList) {
        console.log(`[QR检测] ${logPrefix}尝试策略: ${strategy.name}`)
        
        let processed = baseGray
        currentScale = 1
        
        for (const step of strategy.steps) {
          let temp = null
          
          switch (step) {
            case 'blur':
              temp = gaussianBlur(processed)
              break
            case 'equalize':
              temp = equalizeHistogram(processed)
              break
            case 'contrast':
              temp = enhanceContrast(processed)
              break
            case 'sharpen':
              temp = sharpen(processed)
              break
            case 'sharpen_strong':
              temp = sharpenStrong(processed)
              break
            case 'otsu':
              temp = otsuThreshold(processed)
              break
            case 'adaptive':
              temp = adaptiveThreshold(processed)
              break
            case 'adaptive_mean':
              temp = adaptiveThresholdMean(processed)
              break
            case 'morph_close':
              temp = morphologyClose(processed)
              break
            case 'morph_open':
              temp = morphologyOpen(processed)
              break
            case 'scale_2':
              temp = scaleUp(processed, 2)
              currentScale = 2
              break
            case 'scale_3':
              temp = scaleUp(processed, 3)
              currentScale = 3
              break
            case 'scale_4':
              temp = scaleUp(processed, 4)
              currentScale = 4
              break
          }
          
          if (temp) {
            matsToDelete.push(temp)
            processed = temp
          }
        }
        
        const points = new cv.Mat()
        matsToDelete.push(points)
        
        const found = detector.detect(processed, points)
        console.log(`[QR检测] ${logPrefix}${strategy.name} - found:`, found, ', points:', points.rows, 'x', points.cols)
        
        if (found && points.rows > 0 && points.data32F && points.data32F.length >= 8) {
          const data = points.data32F
          console.log('[QR检测] ✓ 检测到二维码!')
          console.log('[QR检测] 点数据:', Array.from(data).map(v => Math.round(v)))
          
          const scale = baseScale * currentScale
          const denom = scale > 0 ? scale : 1
          
          const topLeft = { x: data[0] / denom, y: data[1] / denom }
          const topRight = { x: data[2] / denom, y: data[3] / denom }
          const bottomRight = { x: data[4] / denom, y: data[5] / denom }
          const bottomLeft = { x: data[6] / denom, y: data[7] / denom }
          
          const corners = { topLeft, topRight, bottomRight, bottomLeft }
          const strategyName = label ? `${label}-${strategy.name}` : strategy.name
          
          const candidate = {
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            boundingBox: calculateBoundingBox(corners),
            center: calculateCenter(corners),
            strategy: strategyName,
            allDetections: [{
              topLeft,
              topRight,
              bottomRight,
              bottomLeft,
              boundingBox: calculateBoundingBox(corners),
              center: calculateCenter(corners)
            }]
          }
          
          const decodedText = await decodeQRCodeFromCanvas(ensureValidationCanvas(), candidate, {
            paddingRatio: 0.35,
            targetSize: 960,
            backgroundColor: '#ffffff'
          })
          
          if (!decodedText) {
            console.log('[QR检测] ✗ 检测结果未通过解码校验，继续尝试')
            continue
          }
          
          return {
            ...candidate,
            decodedText
          }
        }
      }
      
      return null
    }
    
    const result = await detectWithStrategies('', gray, 1, DETECTION_STRATEGIES)
    
    detector.delete()
    
    if (!result) {
      console.log('[QR检测] ✗ 所有策略都未检测到二维码')
    } else {
      console.log('[QR检测] 检测完成, 使用策略:', result.strategy)
    }
    
    return result
  } catch (error) {
    console.error('[QR检测] OpenCV 检测错误:', error)
    console.error('[QR检测] 错误堆栈:', error.stack)
    return null
  } finally {
    // 清理所有 Mat 对象
    matsToDelete.forEach(mat => {
      try {
        if (mat && !mat.isDeleted()) {
          mat.delete()
        }
      } catch (e) {
        // 忽略删除错误
      }
    })
  }
}

/**
 * 计算边界框
 * @param {Object} corners - 四个角点坐标
 * @returns {Object} 边界框 { x, y, width, height }
 */
function calculateBoundingBox(corners) {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners
  const points = [topLeft, topRight, bottomRight, bottomLeft]
  
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * 计算二维码中心点
 * @param {Object} corners - 四个角点坐标
 * @returns {Object} 中心点坐标 { x, y }
 */
function calculateCenter(corners) {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners
  
  return {
    x: (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4,
    y: (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4
  }
}

/**
 * 在 Canvas 上绘制检测结果
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {Object} detection - 检测结果
 * @param {Object} options - 绘制选项
 */
export function drawDetectionResult(ctx, detection, options = {}) {
  const {
    fillColor = 'rgba(0, 245, 160, 0.15)',
    lineWidth = 3,
    cornerRadius = 8,
    showCenter = true,
    showCorners = true
  } = options
  
  // 绘制所有检测到的二维码
  const detections = detection.allDetections || [detection]
  
  detections.forEach((det, index) => {
    const { topLeft, topRight, bottomRight, bottomLeft, center } = det
    
    // 不同二维码用不同颜色
    const colors = ['#00f5a0', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a855f7']
    const color = colors[index % colors.length]
    
    ctx.save()
    
    // 绘制填充区域
    ctx.fillStyle = fillColor
    ctx.beginPath()
    ctx.moveTo(topLeft.x, topLeft.y)
    ctx.lineTo(topRight.x, topRight.y)
    ctx.lineTo(bottomRight.x, bottomRight.y)
    ctx.lineTo(bottomLeft.x, bottomLeft.y)
    ctx.closePath()
    ctx.fill()
    
    // 绘制边框
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // 绘制四边形边框
    ctx.beginPath()
    ctx.moveTo(topLeft.x, topLeft.y)
    ctx.lineTo(topRight.x, topRight.y)
    ctx.lineTo(bottomRight.x, bottomRight.y)
    ctx.lineTo(bottomLeft.x, bottomLeft.y)
    ctx.closePath()
    ctx.stroke()
    
    // 绘制角点标记
    if (showCorners) {
      const corners = [topLeft, topRight, bottomRight, bottomLeft]
      ctx.fillStyle = color
      
      corners.forEach(corner => {
        ctx.beginPath()
        ctx.arc(corner.x, corner.y, cornerRadius, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    
    // 绘制中心点
    if (showCenter) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(center.x, center.y, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // 绘制十字线
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      const crossSize = 15
      
      ctx.beginPath()
      ctx.moveTo(center.x - crossSize, center.y)
      ctx.lineTo(center.x + crossSize, center.y)
      ctx.moveTo(center.x, center.y - crossSize)
      ctx.lineTo(center.x, center.y + crossSize)
      ctx.stroke()
    }
    
    ctx.restore()
  })
}

/**
 * 从视频帧获取 ImageData
 * @param {HTMLVideoElement} video - 视频元素
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @returns {ImageData|null} ImageData 对象
 */
export function getImageDataFromVideo(video, canvas) {
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    return null
  }
  
  const ctx = canvas.getContext('2d')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * 从图片文件获取 ImageData
 * @param {File} file - 图片文件
 * @returns {Promise<{imageData: ImageData, width: number, height: number}>}
 */
export function getImageDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        
        resolve({
          imageData,
          width: img.width,
          height: img.height,
          imageSrc: e.target.result
        })
      }
      
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target.result
    }
    
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 预加载 OpenCV.js（可在应用启动时调用）
 * @returns {Promise<void>}
 */
export async function preloadOpenCV() {
  return loadOpenCV()
}

/**
 * 检查 OpenCV.js 是否已加载
 * @returns {boolean}
 */
export function isOpenCVReady() {
  return cvReady
}

/**
 * 截取QR码区域图像 (带边距扩展)
 * @param {HTMLCanvasElement} sourceCanvas - 源canvas
 * @param {Object} detection - 检测结果
 * @param {number} margin - 边距扩展比例 (默认0.1,即10%)
 * @returns {string} Base64图像数据
 */
export function extractQRCodeImage(sourceCanvas, detection, margin = 0.1) {
  const { boundingBox } = detection
  const { x, y, width, height } = boundingBox
  
  // 计算边距
  const marginX = width * margin
  const marginY = height * margin
  
  // 计算扩展后的区域 (确保不超出画布边界)
  const expandedX = Math.max(0, Math.floor(x - marginX))
  const expandedY = Math.max(0, Math.floor(y - marginY))
  const expandedWidth = Math.min(
    sourceCanvas.width - expandedX,
    Math.ceil(width + marginX * 2)
  )
  const expandedHeight = Math.min(
    sourceCanvas.height - expandedY,
    Math.ceil(height + marginY * 2)
  )
  
  // 创建临时canvas用于截取
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.max(1, expandedWidth)
  tempCanvas.height = Math.max(1, expandedHeight)
  
  const ctx = tempCanvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  
  // 截取扩展后的区域
  ctx.drawImage(
    sourceCanvas,
    expandedX, expandedY, expandedWidth, expandedHeight,
    0, 0, expandedWidth, expandedHeight
  )
  
  // 返回Base64图像
  return tempCanvas.toDataURL('image/png')
}

/**
 * 组合页面展示效果的二维码图像（用于解码）
 * @param {string} base64Image - Base64图像字符串
 * @param {Object} options - 组合选项
 * @returns {Promise<string>} Base64图像数据
 */
export async function composeQRCodeForDecode(base64Image, options = {}) {
  const {
    padding = 0,
    backgroundColor = '#ffffff',
    targetWidth,
    targetHeight,
    smoothing = true,
    smoothingQuality = 'high'
  } = options
  
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = () => reject(new Error('图像加载失败'))
    img.src = base64Image
  })
  
  const pad = Math.max(0, Math.round(padding))
  const width = Math.max(1, Math.round(targetWidth || img.width))
  const height = Math.max(1, Math.round(targetHeight || img.height))
  
  const canvas = document.createElement('canvas')
  canvas.width = width + pad * 2
  canvas.height = height + pad * 2
  
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = Boolean(smoothing)
  if (ctx.imageSmoothingEnabled && smoothingQuality) {
    ctx.imageSmoothingQuality = smoothingQuality
  }
  
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  
  ctx.drawImage(img, pad, pad, width, height)
  
  return canvas.toDataURL('image/png')
}

function createScaledCanvas(img, scale, smoothing) {
  const canvas = document.createElement('canvas')
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = smoothing
  if (smoothing) {
    ctx.imageSmoothingQuality = 'high'
  }
  ctx.drawImage(img, 0, 0, width, height)
  return { canvas, ctx }
}

function getImageDataAtScale(img, scale, smoothing) {
  const { canvas, ctx } = createScaledCanvas(img, scale, smoothing)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { canvas, imageData }
}

function otsuThresholdArray(gray) {
  const hist = new Array(256).fill(0)
  const total = gray.length
  for (let i = 0; i < total; i++) {
    hist[gray[i]] += 1
  }
  
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += i * hist[i]
  }
  
  let sumB = 0
  let wB = 0
  let wF = 0
  let varMax = 0
  let threshold = 0
  
  for (let i = 0; i < 256; i++) {
    wB += hist[i]
    if (wB === 0) continue
    wF = total - wB
    if (wF === 0) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > varMax) {
      varMax = between
      threshold = i
    }
  }
  
  return threshold
}

function binarizeImageData(imageData) {
  const { data, width, height } = imageData
  const gray = new Uint8Array(width * height)
  let gi = 0
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    const lum = alpha < 128
      ? 255
      : Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    gray[gi] = lum
    gi += 1
  }
  
  const threshold = otsuThresholdArray(gray)
  const out = new Uint8ClampedArray(data.length)
  gi = 0
  for (let i = 0; i < out.length; i += 4) {
    const v = gray[gi] > threshold ? 255 : 0
    out[i] = v
    out[i + 1] = v
    out[i + 2] = v
    out[i + 3] = 255
    gi += 1
  }
  
  return new ImageData(out, width, height)
}

async function tryOpenCVDecodeFromImageData(imageData, label) {
  if (typeof cv === 'undefined' || !cv.QRCodeDetector) return null
  
  await loadOpenCV()
  
  const matsToDelete = []
  let detector = null
  
  try {
    detector = new cv.QRCodeDetector()
    const src = cv.matFromImageData(imageData)
    matsToDelete.push(src)
    
    const variants = []
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    matsToDelete.push(gray)
    variants.push({ name: 'gray', mat: gray })
    
    const grayBinary = new cv.Mat()
    cv.threshold(gray, grayBinary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    matsToDelete.push(grayBinary)
    variants.push({ name: 'gray-otsu', mat: grayBinary })
    
    const grayBinaryInv = new cv.Mat()
    cv.bitwise_not(grayBinary, grayBinaryInv)
    matsToDelete.push(grayBinaryInv)
    variants.push({ name: 'gray-otsu-inv', mat: grayBinaryInv })
    
    const red = new cv.Mat()
    cv.extractChannel(src, red, 0)
    matsToDelete.push(red)
    variants.push({ name: 'red', mat: red })
    
    const hsv = new cv.Mat()
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2HSV)
    matsToDelete.push(hsv)
    
    const sat = new cv.Mat()
    cv.extractChannel(hsv, sat, 1)
    matsToDelete.push(sat)
    variants.push({ name: 'sat', mat: sat })
    
    const satBinary = new cv.Mat()
    cv.threshold(sat, satBinary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
    matsToDelete.push(satBinary)
    variants.push({ name: 'sat-otsu', mat: satBinary })
    
    const satBinaryInv = new cv.Mat()
    cv.bitwise_not(satBinary, satBinaryInv)
    matsToDelete.push(satBinaryInv)
    variants.push({ name: 'sat-otsu-inv', mat: satBinaryInv })
    
    for (const variant of variants) {
      console.log(`[QR解码] OpenCV 尝试 ${label}:${variant.name}`)
      const points = new cv.Mat()
      const straight = new cv.Mat()
      matsToDelete.push(points, straight)
      
      let text = ''
      try {
        if (typeof detector.detectAndDecode === 'function') {
          text = detector.detectAndDecode(variant.mat, points, straight)
        } else if (typeof detector.detect === 'function' && typeof detector.decode === 'function') {
          const found = detector.detect(variant.mat, points)
          if (found) {
            text = detector.decode(variant.mat, points, straight)
          }
        }
      } catch (error) {
        text = ''
      }
      
      if (text && text.length) {
        console.log(`[QR解码] ✓ OpenCV 解码成功 (${label}:${variant.name})`)
        return text
      }
    }
    
    return null
  } catch (error) {
    return null
  } finally {
    matsToDelete.forEach(mat => {
      try {
        if (mat && !mat.isDeleted()) {
          mat.delete()
        }
      } catch (e) {
        // ignore delete errors
      }
    })
    if (detector && typeof detector.delete === 'function') {
      detector.delete()
    }
  }
}

/**
 * 解码QR码内容 (OpenCV + jsQR)
 * @param {string} base64Image - Base64图像字符串
 * @returns {Promise<string|null>} 解码后的文本内容
 */
export async function decodeQRCode(base64Image) {
  try {
    console.log('[QR解码] 开始解码...')
    
    // 从 Base64 创建 Image 对象
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('图像加载失败'))
      img.src = base64Image
    })
    
    console.log('[QR解码] 原始图像尺寸:', img.width, 'x', img.height)
    
    // 在控制台显示截取的图像(用于调试)
    console.log('[QR解码] 截取的图像预览:')
    console.log('%c ', `
      font-size: 1px;
      padding: ${Math.min(img.height / 2, 100)}px ${Math.min(img.width / 2, 100)}px;
      background-image: url(${base64Image});
      background-size: contain;
      background-repeat: no-repeat;
    `)
    
    // ============ 方法0: 使用 OpenCV 解码 (颜色/低对比更鲁棒) ============
    const { imageData: baseImageData } = getImageDataAtScale(img, 1, false)
    let openCVText = await tryOpenCVDecodeFromImageData(baseImageData, '1x')
    if (openCVText) {
      console.log('[QR解码] 内容:', openCVText)
      return openCVText
    }
    
    const { imageData: scaledImageData } = getImageDataAtScale(img, 2, false)
    openCVText = await tryOpenCVDecodeFromImageData(scaledImageData, '2x')
    if (openCVText) {
      console.log('[QR解码] 内容:', openCVText)
      return openCVText
    }
    
    // ============ 方法1: 使用 jsQR (更简单可靠) ============
    console.log('[QR解码] 尝试使用 jsQR 库...')
    const jsQR = (await import('jsqr')).default
    
    // 尝试不同的放大倍数
    const scales = [1, 2, 3, 4]
    
    for (const scale of scales) {
      console.log(`[QR解码] jsQR 尝试 ${scale}x 放大(无插值)...`)
      const { imageData, canvas } = getImageDataAtScale(img, scale, false)
      console.log(`[QR解码] 处理后尺寸: ${canvas.width} x ${canvas.height}`)
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      })
      
      if (code && code.data) {
        console.log(`[QR解码] ✓ jsQR 解码成功! (${scale}x 放大)`)
        console.log('[QR解码] 内容:', code.data)
        return code.data
      }
    }
    
    for (const scale of scales) {
      console.log(`[QR解码] jsQR 尝试 ${scale}x 放大(二值化)...`)
      const { imageData, canvas } = getImageDataAtScale(img, scale, false)
      const binarized = binarizeImageData(imageData)
      console.log(`[QR解码] 处理后尺寸: ${canvas.width} x ${canvas.height}`)
      
      const code = jsQR(binarized.data, binarized.width, binarized.height, {
        inversionAttempts: 'attemptBoth'
      })
      
      if (code && code.data) {
        console.log(`[QR解码] ✓ jsQR 解码成功! (${scale}x 放大, 二值化)`)
        console.log('[QR解码] 内容:', code.data)
        return code.data
      }
    }
    
    console.log('[QR解码] ✗ 所有方法都无法解码')
    console.log('[QR解码] 提示: 请检查截取的图像是否包含完整、清晰的二维码')
    return null
  } catch (error) {
    console.error('[QR解码] 解码过程出错:', error)
    return null
  }
}

function distancePoint(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

async function warpQRCodeFromCanvas(sourceCanvas, detection, options = {}) {
  const { targetSize, paddingRatio } = options
  
  if (!sourceCanvas || !detection) return null
  const { topLeft, topRight, bottomRight, bottomLeft } = detection

  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null
  await loadOpenCV()
  if (typeof cv === 'undefined' || !cv.getPerspectiveTransform) return null
  
  const matsToDelete = []
  
  try {
    const src = cv.imread(sourceCanvas)
    matsToDelete.push(src)
    
    const widthA = distancePoint(topLeft, topRight)
    const widthB = distancePoint(bottomLeft, bottomRight)
    const heightA = distancePoint(topLeft, bottomLeft)
    const heightB = distancePoint(topRight, bottomRight)
    const maxSide = Math.max(widthA, widthB, heightA, heightB)
    
    if (!Number.isFinite(maxSide) || maxSide <= 0) return null
    
    const sizeCandidate = Number.isFinite(targetSize) && targetSize > 0 ? targetSize : maxSide
    const outputSize = Math.max(64, Math.round(sizeCandidate))
    const ratio = Number.isFinite(paddingRatio) ? Math.max(0, Math.min(0.5, paddingRatio)) : 0
    const pad = ratio > 0 ? Math.round(outputSize * ratio / (1 + ratio * 2)) : 0
    const innerSize = outputSize - pad * 2
    
    if (innerSize <= 0) return null
    
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      topLeft.x, topLeft.y,
      topRight.x, topRight.y,
      bottomRight.x, bottomRight.y,
      bottomLeft.x, bottomLeft.y
    ])
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      pad, pad,
      pad + innerSize, pad,
      pad + innerSize, pad + innerSize,
      pad, pad + innerSize
    ])
    matsToDelete.push(srcTri, dstTri)
    
    const transform = cv.getPerspectiveTransform(srcTri, dstTri)
    matsToDelete.push(transform)
    
    const dst = new cv.Mat()
    matsToDelete.push(dst)
    
    const border = new cv.Scalar(255, 255, 255, 255)
    cv.warpPerspective(
      src,
      dst,
      transform,
      new cv.Size(outputSize, outputSize),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      border
    )
    
    const outCanvas = document.createElement('canvas')
    outCanvas.width = dst.cols
    outCanvas.height = dst.rows
    cv.imshow(outCanvas, dst)
    
    return outCanvas.toDataURL('image/png')
  } catch (error) {
    return null
  } finally {
    matsToDelete.forEach(mat => {
      try {
        if (mat && !mat.isDeleted()) {
          mat.delete()
        }
      } catch (e) {
        // ignore delete errors
      }
    })
  }
}

/**
 * 从源画布按检测结果裁剪并放大后解码
 * @param {HTMLCanvasElement} sourceCanvas - 源canvas
 * @param {Object} detection - 检测结果
 * @param {Object} options - 配置
 * @returns {Promise<string|null>} 解码后的文本内容
 */
export async function decodeQRCodeFromCanvas(sourceCanvas, detection, options = {}) {
  const {
    paddingRatio = 0.3,
    targetSize = 960,
    backgroundColor = '#ffffff'
  } = options
  
  if (!sourceCanvas || !detection || !detection.boundingBox) {
    return null
  }

  const { x, y, width, height } = detection.boundingBox
  const padX = width * paddingRatio
  const padY = height * paddingRatio
  
  const roiX = Math.max(0, Math.floor(x - padX))
  const roiY = Math.max(0, Math.floor(y - padY))
  const roiWidth = Math.min(
    sourceCanvas.width - roiX,
    Math.ceil(width + padX * 2)
  )
  const roiHeight = Math.min(
    sourceCanvas.height - roiY,
    Math.ceil(height + padY * 2)
  )
  
  if (roiWidth <= 0 || roiHeight <= 0) {
    return null
  }
  
  const maxSide = Math.max(roiWidth, roiHeight)
  const scale = maxSide > 0 ? Math.max(1, targetSize / maxSide) : 1
  const outWidth = Math.max(1, Math.round(roiWidth * scale))
  const outHeight = Math.max(1, Math.round(roiHeight * scale))
  
  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, outWidth, outHeight)
  }
  
  ctx.drawImage(
    sourceCanvas,
    roiX, roiY, roiWidth, roiHeight,
    0, 0, outWidth, outHeight
  )
  
  const roiDecoded = await decodeQRCode(canvas.toDataURL('image/png'))
  if (roiDecoded) return roiDecoded
  
  const warped = await warpQRCodeFromCanvas(sourceCanvas, detection, {
    paddingRatio,
    targetSize,
    backgroundColor
  })
  
  if (warped) {
    const decoded = await decodeQRCode(warped)
    if (decoded) return decoded
  }
  
  return null
}
