<template>
  <div 
    v-if="enabled" 
    class="flowing-background-container" 
    :class="{ 'flowing-background-absolute': positionMode === 'absolute' }"
    :style="containerStyle"
  >
    <div class="flowing-gradient" :style="gradientStyle"></div>
    
    <div class="flowing-blobs">
      <div
        v-for="(blob, index) in computedBlobs"
        :key="index"
        class="blob"
        :style="getBlobStyle(blob, index)"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface BlobConfig {
  size: number
  color: string
  top?: string | number
  right?: string | number
  bottom?: string | number
  left?: string | number
}

interface Props {
  enabled?: boolean
  colors?: string[]
  gradientDuration?: string
  blobDuration?: string
  gradientOpacity?: number
  blobOpacity?: number
  blurRadius?: number
  blobs?: BlobConfig[]
  positionMode?: 'fixed' | 'absolute'
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  colors: () => ['#3b82f6', '#f472b6', '#8b5cf6'],
  gradientDuration: '15s',
  blobDuration: '20s',
  gradientOpacity: 0.08,
  blobOpacity: 0.15,
  blurRadius: 60,
  blobs: () => [],
  positionMode: 'fixed'
})

const containerStyle = computed(() => ({
  '--blur-radius': `${props.blurRadius}px`
}))

const gradientStyle = computed(() => {
  const colors = props.colors
  const stops = colors.flatMap((color, i) => [
    color,
    `${(i + 1) / colors.length * 100}%`
  ])
  
  return {
    background: `linear-gradient(135deg, ${stops.join(', ')})`,
    backgroundSize: '400% 400%',
    opacity: props.gradientOpacity,
    animationDuration: props.gradientDuration
  }
})

const defaultBlobs = computed<BlobConfig[]>(() => [
  { size: 400, color: props.colors[0]!, top: -150, left: -150 },
  { size: 350, color: props.colors[1]!, bottom: -100, right: -100 },
  { size: 300, color: props.colors[2]!, top: '50%', right: '10%' },
  { size: 250, color: props.colors[0]!, bottom: '20%', left: '15%' },
] as BlobConfig[])

const computedBlobs = computed(() => {
  return props.blobs.length > 0 ? props.blobs : defaultBlobs.value
})

const getBlobStyle = (blob: BlobConfig, index: number) => {
  const delay = -(index * 5)
  return {
    width: `${blob.size}px`,
    height: `${blob.size}px`,
    background: blob.color,
    top: blob.top,
    right: blob.right,
    bottom: blob.bottom,
    left: blob.left,
    opacity: props.blobOpacity,
    animationDuration: props.blobDuration,
    animationDelay: `${delay}s`,
    filter: `blur(${props.blurRadius}px)`
  }
}
</script>

<style scoped>
.flowing-background-container {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.flowing-background-absolute {
  position: absolute;
}

.flowing-gradient {
  position: absolute;
  inset: 0;
  animation: gradientFlow ease infinite;
}

@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.flowing-blobs {
  position: absolute;
  inset: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  animation: blobFloat ease-in-out infinite;
}

@keyframes blobFloat {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(50px, -30px) scale(1.1);
  }
  50% {
    transform: translate(-30px, 50px) scale(0.9);
  }
  75% {
    transform: translate(-50px, -20px) scale(1.05);
  }
}
</style>