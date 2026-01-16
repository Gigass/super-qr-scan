/**
 * 二维码检测工具模块
 * 使用 OpenCV.js 的 QRCodeDetector.detect() 方法检测二维码位置
 */

/* global cv */

// OpenCV.js 加载状态
let cvReady = false
let cvLoadPromise = null

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
 * 图像预处理：对比度增强
 */
function enhanceContrast(gray) {
  const result = new cv.Mat()
  // CLAHE 对比度受限的自适应直方图均衡化
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))
  clahe.apply(gray, result)
  clahe.delete()
  return result
}

/**
 * 图像预处理：自适应二值化
 */
function adaptiveThreshold(gray) {
  const result = new cv.Mat()
  cv.adaptiveThreshold(gray, result, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2)
  return result
}

/**
 * 图像预处理：放大
 */
function scaleUp(gray, factor) {
  const result = new cv.Mat()
  const newSize = new cv.Size(gray.cols * factor, gray.rows * factor)
  cv.resize(gray, result, newSize, 0, 0, cv.INTER_CUBIC)
  return result
}

/**
 * 图像预处理：锐化
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
 * 检测图像中的二维码位置
 * @param {ImageData} imageData - Canvas 的 ImageData 对象
 * @returns {Promise<Object|null>} 检测结果，包含位置信息
 */
export async function detectQRCode(imageData) {
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
    
    // 定义多种检测策略
    const strategies = [
      { name: '原图直接检测', scale: 1, process: null },
      { name: '锐化', scale: 1, process: 'sharpen' },
      { name: '自适应二值化', scale: 1, process: 'threshold' },
      { name: '放大2倍', scale: 2, process: null },
      { name: '放大2倍+锐化', scale: 2, process: 'sharpen' },
      { name: '放大3倍', scale: 3, process: null },
      { name: '放大4倍', scale: 4, process: null },
    ]
    
    let result = null
    
    for (const strategy of strategies) {
      console.log(`[QR检测] 尝试策略: ${strategy.name}`)
      
      let processed = gray
      
      // 放大处理
      if (strategy.scale > 1) {
        processed = scaleUp(processed, strategy.scale)
        matsToDelete.push(processed)
      }
      
      // 额外处理
      if (strategy.process === 'sharpen') {
        const sharpened = sharpen(processed)
        matsToDelete.push(sharpened)
        processed = sharpened
      } else if (strategy.process === 'threshold') {
        const thresholded = adaptiveThreshold(processed)
        matsToDelete.push(thresholded)
        processed = thresholded
      }
      
      const points = new cv.Mat()
      matsToDelete.push(points)
      
      const found = detector.detect(processed, points)
      console.log(`[QR检测] ${strategy.name} - found:`, found, ', points:', points.rows, 'x', points.cols)
      
      if (found && points.rows > 0 && points.data32F && points.data32F.length >= 8) {
        const data = points.data32F
        console.log('[QR检测] ✓ 检测到二维码!')
        console.log('[QR检测] 点数据:', Array.from(data).map(v => Math.round(v)))
        
        // 根据缩放因子调整坐标
        const scale = strategy.scale
        
        // 四个角点：左上、右上、右下、左下（顺时针）
        const topLeft = { x: data[0] / scale, y: data[1] / scale }
        const topRight = { x: data[2] / scale, y: data[3] / scale }
        const bottomRight = { x: data[4] / scale, y: data[5] / scale }
        const bottomLeft = { x: data[6] / scale, y: data[7] / scale }
        
        const corners = { topLeft, topRight, bottomRight, bottomLeft }
        
        result = {
          topLeft,
          topRight,
          bottomRight,
          bottomLeft,
          boundingBox: calculateBoundingBox(corners),
          center: calculateCenter(corners),
          strategy: strategy.name,
          allDetections: [{
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            boundingBox: calculateBoundingBox(corners),
            center: calculateCenter(corners)
          }]
        }
        
        // 找到就退出循环
        break
      }
    }
    
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
