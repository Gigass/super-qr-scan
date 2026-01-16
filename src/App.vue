<template>
  <div class="app-container">
    <!-- 顶部标题栏 -->
    <header class="app-header glass">
      <div class="header-content">
        <div class="logo">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="4" height="4"/>
            <rect x="18" y="18" width="3" height="3"/>
          </svg>
          <h1 class="logo-text">QR Locator</h1>
        </div>
        <p class="header-subtitle">精准定位图像中的二维码位置</p>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 模式切换 -->
      <div class="mode-switcher">
        <button 
          :class="['mode-btn', { active: mode === 'camera' }]"
          @click="switchMode('camera')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>摄像头</span>
        </button>
        <button 
          :class="['mode-btn', { active: mode === 'upload' }]"
          @click="switchMode('upload')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>上传图片</span>
        </button>
      </div>

      <!-- 摄像头模式 -->
      <div v-show="mode === 'camera'" class="camera-section">
        <div class="video-container">
          <!-- 视频预览 -->
          <video 
            ref="videoRef"
            class="video-preview"
            autoplay
            playsinline
            muted
          ></video>
          
          <!-- 扫描框叠加层 -->
          <div v-if="cameraActive && !capturedImage" class="scan-overlay">
            <div class="scan-frame">
              <div class="scan-corner top-left"></div>
              <div class="scan-corner top-right"></div>
              <div class="scan-corner bottom-left"></div>
              <div class="scan-corner bottom-right"></div>
              <div class="scan-line"></div>
            </div>
          </div>

          <!-- 拍照结果预览 -->
          <canvas 
            ref="canvasRef"
            v-show="capturedImage"
            class="result-canvas"
          ></canvas>

          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>正在检测...</p>
          </div>
        </div>

        <!-- 摄像头控制按钮 -->
        <div class="camera-controls">
          <button 
            v-if="!cameraActive"
            class="btn-primary"
            @click="startCamera"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            启动摄像头
          </button>

          <template v-else>
            <button 
              v-if="!capturedImage"
              class="btn-primary capture-btn"
              @click="capturePhoto"
            >
              <div class="capture-icon"></div>
            </button>

            <div v-else class="result-controls">
              <button class="btn-secondary" @click="retake">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                重拍
              </button>
              <button class="btn-secondary" @click="stopCamera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                关闭
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 上传模式 -->
      <div v-show="mode === 'upload'" class="upload-section">
        <div 
          class="upload-area"
          :class="{ 'drag-over': isDragOver, 'has-image': uploadedImage }"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input 
            ref="fileInputRef"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            hidden
          />

          <!-- 上传提示 -->
          <div v-if="!uploadedImage" class="upload-hint">
            <div class="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="upload-text">拖拽图片到此处</p>
            <p class="upload-subtext">或点击选择文件</p>
          </div>

          <!-- 上传后的图片预览 -->
          <canvas 
            ref="uploadCanvasRef"
            v-show="uploadedImage"
            class="upload-canvas"
          ></canvas>

          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>正在检测...</p>
          </div>
        </div>

        <!-- 上传控制按钮 -->
        <div v-if="uploadedImage" class="upload-controls">
          <button class="btn-secondary" @click="clearUpload">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            清除
          </button>
          <button class="btn-primary" @click="triggerFileInput">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            更换图片
          </button>
        </div>
      </div>

      <!-- 检测结果信息 -->
      <div v-if="detectionResult" class="result-info glass animate-fadeIn">
        <div class="result-header">
          <div class="result-status success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>检测成功</span>
          </div>
        </div>
        
        <div class="result-details">
          <div class="detail-item">
            <span class="detail-label">中心坐标</span>
            <span class="detail-value">
              ({{ Math.round(detectionResult.center.x) }}, {{ Math.round(detectionResult.center.y) }})
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">尺寸</span>
            <span class="detail-value">
              {{ Math.round(detectionResult.boundingBox.width) }} × {{ Math.round(detectionResult.boundingBox.height) }} px
            </span>
          </div>
        </div>

        <div class="corner-coords">
          <h4>角点坐标</h4>
          <div class="coords-grid">
            <div class="coord-item">
              <span class="coord-label">左上</span>
              <span class="coord-value">({{ Math.round(detectionResult.topLeft.x) }}, {{ Math.round(detectionResult.topLeft.y) }})</span>
            </div>
            <div class="coord-item">
              <span class="coord-label">右上</span>
              <span class="coord-value">({{ Math.round(detectionResult.topRight.x) }}, {{ Math.round(detectionResult.topRight.y) }})</span>
            </div>
            <div class="coord-item">
              <span class="coord-label">左下</span>
              <span class="coord-value">({{ Math.round(detectionResult.bottomLeft.x) }}, {{ Math.round(detectionResult.bottomLeft.y) }})</span>
            </div>
            <div class="coord-item">
              <span class="coord-label">右下</span>
              <span class="coord-value">({{ Math.round(detectionResult.bottomRight.x) }}, {{ Math.round(detectionResult.bottomRight.y) }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 未检测到二维码 -->
      <div v-if="noQRFound" class="result-info glass animate-fadeIn">
        <div class="result-header">
          <div class="result-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>未检测到二维码</span>
          </div>
        </div>
        <p class="no-result-hint">请确保图像中包含清晰可见的二维码</p>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMessage" class="error-message glass animate-fadeIn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>
    </main>

    <!-- 底部信息 -->
    <footer class="app-footer">
      <p>使用 OpenCV.js 进行二维码定位 | 仅检测位置，不解码内容</p>
    </footer>
  </div>
</template>

<script>
import { detectQRCode, drawDetectionResult, getImageDataFromFile, preloadOpenCV } from './utils/qrDetector'

export default {
  name: 'App',
  
  data() {
    return {
      // 模式：camera | upload
      mode: 'camera',
      
      // 摄像头状态
      cameraActive: false,
      mediaStream: null,
      
      // 拍照
      capturedImage: false,
      
      // 上传
      uploadedImage: false,
      isDragOver: false,
      
      // 检测结果
      detectionResult: null,
      noQRFound: false,
      
      // 状态
      isLoading: false,
      errorMessage: ''
    }
  },

  methods: {
    /**
     * 切换模式
     */
    switchMode(newMode) {
      if (this.mode === newMode) return
      
      // 清理当前状态
      if (this.mode === 'camera') {
        this.stopCamera()
      }
      
      this.mode = newMode
      this.clearResults()
      
      if (newMode === 'upload') {
        this.clearUpload()
      }
    },

    /**
     * 启动摄像头
     */
    async startCamera() {
      this.clearResults()
      this.errorMessage = ''
      
      try {
        const constraints = {
          video: {
            facingMode: 'environment', // 优先使用后置摄像头
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        }
        
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        
        const video = this.$refs.videoRef
        video.srcObject = this.mediaStream
        
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play()
            resolve()
          }
        })
        
        this.cameraActive = true
      } catch (error) {
        console.error('摄像头启动失败:', error)
        
        if (error.name === 'NotAllowedError') {
          this.errorMessage = '摄像头访问被拒绝，请在浏览器设置中允许访问摄像头'
        } else if (error.name === 'NotFoundError') {
          this.errorMessage = '未找到可用的摄像头设备'
        } else if (error.name === 'NotReadableError') {
          this.errorMessage = '摄像头正被其他应用占用'
        } else {
          this.errorMessage = `摄像头启动失败: ${error.message}`
        }
      }
    },

    /**
     * 停止摄像头
     */
    stopCamera() {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop())
        this.mediaStream = null
      }
      
      const video = this.$refs.videoRef
      if (video) {
        video.srcObject = null
      }
      
      this.cameraActive = false
      this.capturedImage = false
      this.clearResults()
    },

    /**
     * 拍照并检测
     */
    async capturePhoto() {
      const video = this.$refs.videoRef
      const canvas = this.$refs.canvasRef
      
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        this.errorMessage = '视频流未就绪，请稍后重试'
        return
      }
      
      this.isLoading = true
      this.clearResults()
      
      try {
        // 设置 canvas 尺寸
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')
        
        // 绘制视频帧到 canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        
        // 检测二维码（异步）
        const result = await detectQRCode(imageData)
        
        if (result) {
          this.detectionResult = result
          // 绘制检测结果
          drawDetectionResult(ctx, result)
        } else {
          this.noQRFound = true
        }
        
        this.capturedImage = true
      } catch (error) {
        console.error('检测失败:', error)
        this.errorMessage = '检测过程中发生错误'
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 重拍
     */
    retake() {
      this.capturedImage = false
      this.clearResults()
    },

    /**
     * 触发文件选择
     */
    triggerFileInput() {
      this.$refs.fileInputRef?.click()
    },

    /**
     * 处理文件选择
     */
    async handleFileSelect(event) {
      const file = event.target.files?.[0]
      if (file) {
        await this.processImageFile(file)
      }
      // 清空 input 以便重复选择同一文件
      event.target.value = ''
    },

    /**
     * 处理拖拽放下
     */
    async handleDrop(event) {
      this.isDragOver = false
      
      const file = event.dataTransfer.files?.[0]
      if (file && file.type.startsWith('image/')) {
        await this.processImageFile(file)
      } else {
        this.errorMessage = '请上传有效的图片文件'
      }
    },

    /**
     * 处理图片文件
     */
    async processImageFile(file) {
      this.isLoading = true
      this.clearResults()
      
      try {
        const { imageData, width, height, imageSrc } = await getImageDataFromFile(file)
        
        const canvas = this.$refs.uploadCanvasRef
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        
        // 先绘制原图
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageSrc
        })
        ctx.drawImage(img, 0, 0)
        
        // 检测二维码（异步）
        const result = await detectQRCode(imageData)
        
        if (result) {
          this.detectionResult = result
          // 绘制检测结果
          drawDetectionResult(ctx, result)
        } else {
          this.noQRFound = true
        }
        
        this.uploadedImage = true
      } catch (error) {
        console.error('图片处理失败:', error)
        this.errorMessage = '图片处理失败，请尝试其他图片'
      } finally {
        this.isLoading = false
      }
    },

    /**
     * 清除上传
     */
    clearUpload() {
      this.uploadedImage = false
      this.clearResults()
      
      const canvas = this.$refs.uploadCanvasRef
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    },

    /**
     * 清除检测结果
     */
    clearResults() {
      this.detectionResult = null
      this.noQRFound = false
      this.errorMessage = ''
    }
  },

  mounted() {
    // 预加载 OpenCV.js
    preloadOpenCV().catch(err => {
      console.warn('OpenCV.js 预加载失败:', err)
    })
  },

  beforeDestroy() {
    this.stopCamera()
  }
}
</script>

<style src="./styles/index.css"></style>

<style scoped>
/* ========================================
   App 容器布局
   ======================================== */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
  background-image: 
    radial-gradient(ellipse at top, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(118, 75, 162, 0.1) 0%, transparent 50%);
}

/* ========================================
   顶部标题栏
   ======================================== */
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.header-content {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 4px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  color: var(--accent-color);
}

.logo-text {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-color) 0%, var(--primary-color) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

/* ========================================
   主内容区
   ======================================== */
.app-main {
  flex: 1;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

/* ========================================
   模式切换
   ======================================== */
.mode-switcher {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  background: var(--bg-glass);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
  backdrop-filter: blur(10px);
}

.mode-btn svg {
  width: 20px;
  height: 20px;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: var(--text-primary);
  box-shadow: var(--shadow-glow);
}

/* ========================================
   摄像头区域
   ======================================== */
.camera-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.video-preview,
.result-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 扫描框叠加层 */
.scan-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.scan-frame {
  position: relative;
  width: 70%;
  max-width: 280px;
  aspect-ratio: 1;
  border: 2px solid rgba(0, 245, 160, 0.5);
  border-radius: var(--radius-md);
  animation: breathGlow 2s ease-in-out infinite;
}

.scan-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid var(--accent-color);
}

.scan-corner.top-left {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 8px;
}

.scan-corner.top-right {
  top: -2px;
  right: -2px;
  border-left: none;
  border-bottom: none;
  border-top-right-radius: 8px;
}

.scan-corner.bottom-left {
  bottom: -2px;
  left: -2px;
  border-right: none;
  border-top: none;
  border-bottom-left-radius: 8px;
}

.scan-corner.bottom-right {
  bottom: -2px;
  right: -2px;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 8px;
}

.scan-line {
  position: absolute;
  left: 10%;
  width: 80%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
  animation: scanLine 2s linear infinite;
}

/* 摄像头控制 */
.camera-controls {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.capture-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.capture-icon {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.capture-btn:hover .capture-icon {
  transform: scale(0.9);
}

.result-controls {
  display: flex;
  gap: 12px;
}

/* ========================================
   上传区域
   ======================================== */
.upload-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-area {
  position: relative;
  width: 100%;
  min-height: 300px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-normal);
  overflow: hidden;
}

.upload-area:hover {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.05);
}

.upload-area.drag-over {
  border-color: var(--accent-color);
  background: rgba(0, 245, 160, 0.05);
  box-shadow: inset 0 0 30px rgba(0, 245, 160, 0.1);
}

.upload-area.has-image {
  border-style: solid;
  cursor: default;
}

.upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
}

.upload-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass);
  border-radius: 50%;
  color: var(--primary-color);
}

.upload-icon svg {
  width: 32px;
  height: 32px;
}

.upload-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.upload-subtext {
  font-size: 14px;
  color: var(--text-muted);
}

.upload-canvas {
  width: 100%;
  height: auto;
  display: block;
}

.upload-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* ========================================
   加载状态
   ======================================== */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 15, 35, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* ========================================
   检测结果信息
   ======================================== */
.result-info {
  margin-top: 20px;
  padding: 20px;
  border-radius: var(--radius-lg);
}

.result-header {
  margin-bottom: 16px;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.result-status.success {
  color: var(--accent-color);
}

.result-status.error {
  color: #ff6b6b;
}

.result-details {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.corner-coords h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.coords-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.coord-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-glass);
  border-radius: var(--radius-sm);
}

.coord-label {
  font-size: 13px;
  color: var(--text-muted);
}

.coord-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-color);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.no-result-hint {
  font-size: 14px;
  color: var(--text-muted);
}

/* ========================================
   错误提示
   ======================================== */
.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
  font-size: 14px;
}

/* ========================================
   底部信息
   ======================================== */
.app-footer {
  padding: 16px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  border-top: 1px solid var(--border-color);
}

/* ========================================
   响应式适配
   ======================================== */
@media (max-width: 480px) {
  .app-header {
    padding: 12px 16px;
  }
  
  .logo-text {
    font-size: 20px;
  }
  
  .app-main {
    padding: 16px;
  }
  
  .mode-btn {
    padding: 12px 16px;
    font-size: 14px;
  }
  
  .result-details {
    flex-direction: column;
    gap: 12px;
  }
  
  .coords-grid {
    grid-template-columns: 1fr;
  }
}
</style>
