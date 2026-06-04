<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="card-title text-xl">{{ config.title }}</h2>
        <p class="text-base-content/70 text-sm mt-1">{{ config.subtitle }}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="badge badge-secondary">{{ stats.view_count }} 浏览</span>
        <span class="badge badge-primary">{{ stats.comment_count }} 条评论</span>
      </div>
    </div>

    <!-- 评论表单（置顶） -->
    <div class="p-4 bg-base-200 rounded-lg mb-6">
      <div class="space-y-3">
        <!-- 评论内容（必填） -->
        <textarea
          v-model="formContent"
          class="w-full p-3 bg-base-100 rounded-lg border border-base-300 focus:border-primary focus:outline-none resize-none"
          rows="3"
          placeholder="写下你的评论..."
        ></textarea>

        <!-- 可选信息行 -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            v-model="formNickname"
            type="text"
            class="input input-bordered w-full bg-base-100"
            placeholder="昵称（选填）"
          />
          <input
            v-model="formPhone"
            type="tel"
            class="input input-bordered w-full bg-base-100"
            placeholder="电话（选填）"
          />
          <input
            v-model="formEmail"
            type="email"
            class="input input-bordered w-full bg-base-100"
            placeholder="邮箱（选填）"
          />
          <select v-model="formType" class="select select-bordered w-full bg-base-100" required>
            <option value="" disabled>请选择留言类型</option>
            <option value="complaint">吐槽</option>
            <option value="bug">bug上报</option>
            <option value="praise">赞美</option>
            <option value="other">其他</option>
          </select>
        </div>

        <!-- 验证码行 -->
        <div class="flex items-center gap-3">
          <span
            class="select-none bg-base-300 text-base-content px-3 py-1.5 rounded font-mono text-lg tracking-widest italic line-through"
          >
            {{ captchaCode }}
          </span>
          <button class="btn btn-ghost btn-sm" @click="refreshCaptcha">换一张</button>
          <input
            v-model="formCaptcha"
            type="text"
            class="input input-bordered w-32 bg-base-100"
            placeholder="验证码"
            maxlength="4"
          />
        </div>

        <div class="flex justify-between items-center">
          <span v-if="submitError" class="text-error text-sm">{{ submitError }}</span>
          <span v-else></span>
          <button class="btn btn-primary btn-sm" :disabled="!canSubmit" @click="submitComment">
            发表评论
          </button>
        </div>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="space-y-3">
      <div v-for="comment in comments" :key="comment.id" class="p-4 bg-base-200 rounded-lg">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="font-semibold text-sm text-base-content">
            {{ comment.nickname || '匿名' }}
          </span>
          <span class="badge badge-sm" :class="COMMENT_TYPE_COLORS[comment.type]">
            {{ COMMENT_TYPE_LABELS[comment.type] }}
          </span>
          <span class="text-xs text-base-content/50">{{ comment.created_at }}</span>
        </div>
        <p class="text-base-content/80 text-sm leading-relaxed">{{ comment.content }}</p>
      </div>

      <div v-if="comments.length === 0" class="text-center text-base-content/50 py-12">
        暂无评论，来说两句吧
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { logger } from '@/utils/logger'

type CommentType = 'complaint' | 'bug' | 'praise' | 'other'

const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  complaint: '吐槽',
  bug: 'bug上报',
  praise: '赞美',
  other: '其他',
}

const COMMENT_TYPE_COLORS: Record<CommentType, string> = {
  complaint: 'badge-error',
  bug: 'badge-warning',
  praise: 'badge-success',
  other: 'badge-neutral',
}

interface Comment {
  id: string
  nickname: string
  phone: string
  email: string
  type: CommentType
  content: string
  created_at: string
}

interface CommentConfig {
  title: string
  subtitle: string
}

interface PageStats {
  page_key: string
  view_count: number
  comment_count: number
}

interface Props {
  config?: CommentConfig
  pageKey: string
}

const props = withDefaults(defineProps<Props>(), {
  config: () => ({
    title: '用户评论',
    subtitle: '所有评论均为匿名发布',
  }),
})

const captchaChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function randomCaptcha(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += captchaChars[Math.floor(Math.random() * captchaChars.length)]
  }
  return code
}

const captchaCode = ref(randomCaptcha())
const refreshCaptcha = () => {
  captchaCode.value = randomCaptcha()
}

const formContent = ref('')
const formNickname = ref('')
const formPhone = ref('')
const formEmail = ref('')
const formType = ref<CommentType | ''>('')
const formCaptcha = ref('')
const submitError = ref('')

const canSubmit = computed(
  () =>
    formContent.value.trim().length > 0 &&
    formCaptcha.value.trim().length > 0 &&
    formType.value !== '',
)

const comments = ref<Comment[]>([])
const stats = ref<PageStats>({ page_key: props.pageKey, view_count: 0, comment_count: 0 })

const fetchComments = async () => {
  try {
    const res = await fetch(`/api/comments?page_key=${props.pageKey}`)
    const data = await res.json()
    if (data.code === 0) {
      comments.value = data.data.list
    }
  } catch (error) {
    logger.error('Failed to fetch comments:', error)
  }
}

const fetchStats = async () => {
  try {
    const res = await fetch(`/api/page-stats/${props.pageKey}`)
    const data = await res.json()
    if (data.code === 0) {
      stats.value = data.data
    }
  } catch (error) {
    logger.error('Failed to fetch stats:', error)
  }
}

const incrementView = async () => {
  try {
    await fetch(`/api/page-stats/${props.pageKey}/view`, { method: 'POST' })
    stats.value.view_count++
  } catch (error) {
    logger.error('Failed to increment view:', error)
  }
}

const submitComment = async () => {
  submitError.value = ''

  if (!formContent.value.trim()) {
    submitError.value = '请输入评论内容'
    return
  }

  if (!formType.value) {
    submitError.value = '请选择留言类型'
    return
  }

  if (formCaptcha.value.toUpperCase() !== captchaCode.value.toUpperCase()) {
    submitError.value = '验证码错误'
    refreshCaptcha()
    formCaptcha.value = ''
    return
  }

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_key: props.pageKey,
        nickname: formNickname.value.trim(),
        phone: formPhone.value.trim(),
        email: formEmail.value.trim(),
        type: formType.value,
        content: formContent.value.trim(),
      }),
    })

    const data = await res.json()
    if (data.code === 0) {
      comments.value.unshift(data.data)
      stats.value.comment_count++

      formContent.value = ''
      formNickname.value = ''
      formPhone.value = ''
      formEmail.value = ''
      formType.value = ''
      formCaptcha.value = ''
      refreshCaptcha()
    } else {
      submitError.value = '提交失败，请重试'
    }
  } catch (error) {
    submitError.value = '提交失败，请重试'
    logger.error('Failed to submit comment:', error)
  }
}

onMounted(() => {
  fetchComments()
  fetchStats()
  incrementView()
})
</script>
