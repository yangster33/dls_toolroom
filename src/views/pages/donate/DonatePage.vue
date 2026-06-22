<template>
  <div class="min-h-screen backdrop-blur-sm py-12">
    <div class="container mx-auto px-4 max-w-2xl">
      <!-- 标题区域 -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-primary to-secondary mb-4"
        >
          <PhHeart class="w-10 h-10 text-white" />
        </div>
        <h1 class="text-3xl font-bold text-base-content mb-2">感谢支持</h1>
        <p class="text-base-content/70">您的支持是我前进的动力 💪</p>
      </div>

      <!-- 收款码区域 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- 支付宝 -->
        <div
          class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div class="flex items-center mb-4">
            <PhCreditCard class="w-6 h-6 mr-2" />
            <span class="text-lg font-semibold">支付宝</span>
          </div>
          <div class="bg-white rounded-xl p-4 mb-4">
            <div class="flex justify-center">
              <canvas ref="alipayCanvas" class="w-48 h-48"></canvas>
            </div>
          </div>
          <p class="text-center text-sm opacity-90">扫码支持</p>
        </div>

        <!-- 微信 -->
        <div
          class="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div class="flex items-center mb-4">
            <PhGlobe class="w-6 h-6 mr-2" />
            <span class="text-lg font-semibold">微信</span>
          </div>
          <div class="bg-white rounded-xl p-4 mb-4">
            <div class="flex justify-center">
              <canvas ref="wechatCanvas" class="w-48 h-48"></canvas>
            </div>
          </div>
          <p class="text-center text-sm opacity-90">扫码支持</p>
        </div>
      </div>

      <!-- 底部说明 -->
      <div class="text-center mt-8 text-base-content/60 text-sm">
        <p>每一份支持都将用于改善工具间的功能和体验</p>
        <p class="mt-1">感谢您的慷慨解囊！ 🙏</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PhHeart, PhCreditCard, PhGlobe } from '@phosphor-icons/vue'
import QRCode from 'qrcode'
import { logger } from '@/utils/logger'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '支持作者',
  description: '如果大龙山工具间对您的工作有帮助，欢迎扫码支持作者，您的支持是我前进的动力。',
  path: '/donate',
  keywords: ['支持作者', '赞助', '打赏', '大龙山工具间'],
})

const alipayCanvas = ref<HTMLCanvasElement | null>(null)
const wechatCanvas = ref<HTMLCanvasElement | null>(null)

// 收款码字符串（请替换为实际的收款码内容）
const alipayCode = 'https://qr.alipay.com/fkx15986einlbzh35jbs5a2'
const wechatCode = 'wxp://f2f0m11MC-qk82DO1iVqm6SOACGYRkmgdu9H3JJIuS_UCEI3dw7qCsx6_Wq8sMVeHTCv'

const generateQRCode = async (text: string, canvas: HTMLCanvasElement | null) => {
  if (!canvas) return

  try {
    await QRCode.toCanvas(canvas, text, {
      width: 192,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  } catch (error) {
    logger.error('QR Code generation error:', error)
  }
}

onMounted(async () => {
  await generateQRCode(alipayCode, alipayCanvas.value)
  await generateQRCode(wechatCode, wechatCanvas.value)
})
</script>
