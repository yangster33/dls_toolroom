<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">{{ toolConfig?.name || '二维码工具' }}</h1>
    <p class="text-gray-600 mb-6">
      {{ toolConfig?.description || '生成和识别二维码的工具。' }}
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <PhQrCode class="w-5 h-5" />
          生成二维码
        </h2>
        
        <div class="mb-4">
          <label class="label">
            <span class="label-text">输入内容</span>
          </label>
          <textarea
            v-model="inputText"
            placeholder="请输入要生成二维码的内容（支持文本、URL等）"
            class="textarea textarea-bordered w-full h-32"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="label">
              <span class="label-text">二维码大小</span>
            </label>
            <input
              v-model.number="qrSize"
              type="range"
              min="100"
              max="400"
              class="range range-primary w-full"
            />
            <span class="text-sm text-gray-500">{{ qrSize }}px</span>
          </div>
          <div>
            <label class="label">
              <span class="label-text">纠错级别</span>
            </label>
            <select v-model="errorLevel" class="select select-bordered w-full">
              <option value="L">L - 低</option>
              <option value="M">M - 中</option>
              <option value="Q">Q - 较高</option>
              <option value="H">H - 高</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="label">
              <span class="label-text">前景色（码点颜色）</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="foregroundColor"
                type="color"
                class="w-12 h-10 rounded cursor-pointer border-2 border-gray-300"
              />
              <input
                v-model="foregroundColor"
                type="text"
                class="input input-bordered flex-1"
                placeholder="#000000"
              />
            </div>
          </div>
          <div>
            <label class="label">
              <span class="label-text">背景色</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="backgroundColor"
                type="color"
                class="w-12 h-10 rounded cursor-pointer border-2 border-gray-300"
              />
              <input
                v-model="backgroundColor"
                type="text"
                class="input input-bordered flex-1"
                placeholder="#FFFFFF"
              />
            </div>
          </div>
        </div>

        <button
          @click="downloadQrCode"
          :disabled="!qrCodeUrl"
          class="btn btn-secondary mb-4"
        >
          <PhDownload class="w-4 h-4 mr-2" />
          下载二维码
        </button>

        <div
          v-if="qrCodeUrl"
          class="flex items-center justify-center bg-white rounded-lg p-4 border border-gray-200"
        >
          <img :src="qrCodeUrl" :alt="'二维码: ' + inputText" class="rounded-lg" />
        </div>
        <div v-else class="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
          <p class="text-gray-400">生成的二维码将显示在这里</p>
        </div>
      </div>

      <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <PhMagnifyingGlass class="w-5 h-5" />
          识别二维码
        </h2>

        <div class="mb-4">
          <label class="label">
            <span class="label-text">选择二维码图片</span>
          </label>
          <div
            class="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors"
            @click="triggerFileInput"
            @drop.prevent="handleDrop"
            @dragover.prevent
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
            />
            <PhUpload class="w-12 h-12 text-gray-400 mb-2" />
            <p class="text-gray-500">点击或拖拽上传二维码图片</p>
            <p class="text-xs text-gray-400">支持 JPG、PNG、GIF 格式</p>
          </div>
        </div>

        <div v-if="selectedFile" class="mb-4 p-3 bg-base-200 rounded-lg">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700">{{ selectedFile.name }}</span>
            <button @click="clearFile" class="btn btn-xs btn-error">
              <PhX class="w-3 h-3" />
              清除
            </button>
          </div>
        </div>

        <div v-if="previewImage" class="mb-4">
          <label class="label">
            <span class="label-text">预览</span>
          </label>
          <img :src="previewImage" class="max-w-full rounded-lg border border-gray-200" />
        </div>

        <div v-if="scanResult" class="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 class="font-semibold text-green-800 mb-2 flex items-center gap-2">
            <PhCheckCircle class="w-5 h-5" />
            识别成功
          </h3>
          <p class="text-green-700 break-all">{{ scanResult }}</p>
          <button
            @click="copyResult"
            class="mt-2 btn btn-xs btn-green"
          >
            <PhCopy class="w-3 h-3 mr-1" />
            复制结果
          </button>
        </div>

        <div v-if="scanError" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 class="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <PhInfo class="w-5 h-5" />
            识别失败
          </h3>
          <p class="text-red-700">{{ scanError }}</p>
        </div>

        <div v-if="isScanning" class="flex items-center justify-center py-4">
          <div class="flex items-center gap-2 text-primary">
            <PhCpu class="w-5 h-5 animate-spin" />
            正在识别...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}
import {
  PhQrCode,
  PhArrowRight,
  PhDownload,
  PhMagnifyingGlass,
  PhUpload,
  PhX,
  PhCheckCircle,
  PhCopy,
  PhInfo,
  PhCpu,
} from '@phosphor-icons/vue'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { getToolById } from '../toolData'
import { useToast } from '@/composables/useToast'

const { error: toastError, success: toastSuccess } = useToast()

const toolConfig = getToolById('qrcode')

const inputText = ref('')
const qrSize = ref(200)
const errorLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const foregroundColor = ref('#000000')
const backgroundColor = ref('#FFFFFF')
const qrCodeUrl = ref('')

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewImage = ref('')
const scanResult = ref('')
const scanError = ref('')
const isScanning = ref(false)

const generateQrCode = async () => {
  if (!inputText.value.trim()) {
    qrCodeUrl.value = ''
    return
  }

  try {
    qrCodeUrl.value = await QRCode.toDataURL(inputText.value, {
      width: qrSize.value,
      margin: 2,
      errorCorrectionLevel: errorLevel.value,
      color: {
        dark: foregroundColor.value,
        light: backgroundColor.value,
      },
    })
  } catch (error) {
    toastError('生成二维码时发生错误')
    console.error('QR Code generation error:', error)
  }
}

const debouncedGenerate = debounce(generateQrCode, 200)

watch([inputText, qrSize, errorLevel, foregroundColor, backgroundColor], () => {
  debouncedGenerate()
})

const downloadQrCode = () => {
  if (!qrCodeUrl.value) return

  const link = document.createElement('a')
  link.download = 'qrcode.png'
  link.href = qrCodeUrl.value
  link.click()
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files && files.length > 0 && files[0]) {
    processFile(files[0])
  }
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0 && files[0]) {
    processFile(files[0])
  }
}

const processFile = (file: File) => {
  selectedFile.value = file
  scanResult.value = ''
  scanError.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string
    scanQrCode(previewImage.value)
  }
  reader.readAsDataURL(file)
}

const scanQrCode = async (imageUrl: string) => {
  isScanning.value = true
  scanError.value = ''

  try {
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
  } catch (error) {
    scanError.value = '识别过程中发生错误: ' + (error as Error).message
  } finally {
    isScanning.value = false
  }
}

const clearFile = () => {
  selectedFile.value = null
  previewImage.value = ''
  scanResult.value = ''
  scanError.value = ''
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const copyResult = () => {
  if (!scanResult.value) return

  navigator.clipboard.writeText(scanResult.value).then(() => {
    toastSuccess('已复制到剪贴板')
  })
}
</script>