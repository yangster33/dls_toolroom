<template>
  <div class="donate">
    <header class="donate-head">
      <h1 class="donate-title">支持我</h1>
      <p class="donate-lead">
        这个工具间是我利用业余时间维护的个人项目。如果它替你省下了加班时间，欢迎请我喝杯咖啡。
      </p>
    </header>

    <div class="donate-grid">
      <section class="donate-panel">
        <header class="donate-panel-head">
          <PhCreditCard class="donate-icon" />
          <span>支付宝</span>
        </header>
        <div class="donate-qr">
          <canvas ref="alipayCanvas" class="size-48"></canvas>
        </div>
        <p class="donate-caption readout">扫码支持</p>
      </section>

      <section class="donate-panel">
        <header class="donate-panel-head">
          <PhGlobe class="donate-icon" />
          <span>微信</span>
        </header>
        <div class="donate-qr">
          <canvas ref="wechatCanvas" class="size-48"></canvas>
        </div>
        <p class="donate-caption readout">扫码支持</p>
      </section>
    </div>

    <footer class="donate-foot">
      <p>每一份支持都会用于工具维护与服务器开销。</p>
      <p>工具本身永远免费，结果请以人工复核为准。</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PhCreditCard, PhGlobe } from '@phosphor-icons/vue'
import QRCode from 'qrcode'
import { logger } from '@/utils/logger'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '支持作者',
  description: '如果大龙山工具间对您的工作有帮助，欢迎扫码支持作者。工具本身永远免费。',
  path: '/donate',
  keywords: ['支持作者', '赞助', '大龙山工具间'],
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

<style scoped>
.donate {
  max-width: 720px;
  margin: 0 auto;
}

.donate-head {
  padding: 1.5rem 1.5rem 1.25rem;
  border: 1px solid var(--color-base-300);
  border-bottom: 0;
}

.donate-title {
  font-family: var(--font-drawing);
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.03em;
}

.donate-lead {
  margin-top: 0.5rem;
  max-width: 46ch;
  font-size: 13px;
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
}

.donate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--color-base-300);
}

.donate-panel {
  padding: 1.25rem;
  border-left: 1px solid var(--color-base-300);
}

.donate-panel:first-child {
  border-left: 0;
}

.donate-panel-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  font-size: 13px;
  border-bottom: 1px solid var(--color-base-300);
}

.donate-icon {
  width: 16px;
  height: 16px;
  color: var(--color-primary);
}

.donate-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background-color: #ffffff;
  border: 1px solid var(--color-base-300);
}

.donate-caption {
  margin-top: 0.625rem;
  font-size: 11px;
  text-align: center;
  color: var(--text-muted);
}

.donate-foot {
  padding: 1rem 1.5rem;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-muted);
  border: 1px solid var(--color-base-300);
  border-top: 0;
  background-color: var(--color-base-200);
}

@media (max-width: 640px) {
  .donate-grid {
    grid-template-columns: 1fr;
  }

  .donate-panel {
    border-left: 0;
    border-top: 1px solid var(--color-base-300);
  }

  .donate-panel:first-child {
    border-top: 0;
  }
}
</style>
