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

    <!-- 评论表单 -->
    <div class="p-4 bg-base-200 rounded-lg mb-6">
      <div class="space-y-3">
        <!-- 评论内容（必填） -->
        <div>
          <textarea
            v-model="formContent"
            class="w-full p-3 bg-base-100 rounded-lg border focus:outline-none resize-none"
            :class="errors.content ? 'border-error' : 'border-base-300 focus:border-primary'"
            rows="3"
            placeholder="写下你的评论..."
          ></textarea>
          <span v-if="errors.content" class="text-error text-xs mt-1">{{ errors.content }}</span>
        </div>

        <!-- 可选信息行 -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <input
              v-model="formNickname"
              type="text"
              class="input input-bordered w-full bg-base-100"
              :class="{ 'input-error': errors.nickname }"
              placeholder="昵称（选填）"
            />
            <span v-if="errors.nickname" class="text-error text-xs mt-1">{{ errors.nickname }}</span>
          </div>
          <div>
            <input
              v-model="formPhone"
              type="tel"
              class="input input-bordered w-full bg-base-100"
              :class="{ 'input-error': errors.phone }"
              placeholder="电话（选填）"
            />
            <span v-if="errors.phone" class="text-error text-xs mt-1">{{ errors.phone }}</span>
          </div>
          <div>
            <input
              v-model="formEmail"
              type="email"
              class="input input-bordered w-full bg-base-100"
              :class="{ 'input-error': errors.email }"
              placeholder="邮箱（选填）"
            />
            <span v-if="errors.email" class="text-error text-xs mt-1">{{ errors.email }}</span>
          </div>
          <div>
            <select
              v-model="formType"
              class="select select-bordered w-full bg-base-100"
              :class="{ 'select-error': errors.type }"
              required
            >
              <option value="" disabled>请选择留言类型</option>
              <option value="complaint">吐槽</option>
              <option value="bug">bug上报</option>
              <option value="praise">赞美</option>
              <option value="other">其他</option>
            </select>
            <span v-if="errors.type" class="text-error text-xs mt-1">{{ errors.type }}</span>
          </div>
        </div>

        <!-- 验证码行 -->
        <div class="flex items-center gap-3">
          <span
            class="select-none bg-base-300 text-base-content px-3 py-1.5 rounded font-mono text-lg tracking-widest italic line-through"
          >
            {{ captchaCode }}
          </span>
          <button class="btn btn-ghost btn-sm" @click="refreshCaptcha">换一张</button>
          <div>
            <input
              v-model="formCaptcha"
              type="text"
              class="input input-bordered w-32 bg-base-100"
              :class="{ 'input-error': errors.captcha }"
              placeholder="验证码"
              maxlength="4"
            />
            <span v-if="errors.captcha" class="text-error text-xs block mt-1">{{ errors.captcha }}</span>
          </div>
        </div>

        <div class="flex justify-between items-center">
          <span v-if="submitError" class="text-error text-sm">{{ submitError }}</span>
          <span v-else></span>
          <button
            class="btn btn-primary btn-sm"
            :disabled="submitting"
            @click="handleSubmit"
          >
            <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
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
import { ref, reactive, onMounted } from 'vue'
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

const VALID_TYPES = ['complaint', 'bug', 'praise', 'other']

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

// ── 验证码 ──────────────────────────────────────
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

// ── 表单数据 ────────────────────────────────────
const formContent = ref('')
const formNickname = ref('')
const formPhone = ref('')
const formEmail = ref('')
const formType = ref<CommentType | ''>('')
const formCaptcha = ref('')
const submitError = ref('')
const submitting = ref(false)

// ── 校验错误 ────────────────────────────────────
const errors = reactive({
  content: '',
  nickname: '',
  phone: '',
  email: '',
  type: '',
  captcha: '',
})

function clearErrors() {
  errors.content = ''
  errors.nickname = ''
  errors.phone = ''
  errors.email = ''
  errors.type = ''
  errors.captcha = ''
  submitError.value = ''
}

// ── 前端校验（与后端 CommentCreateSerializer 规则一致） ──
function validate(): boolean {
  clearErrors()
  let valid = true

  // content — 必填，去空白后不能为空
  if (!formContent.value.trim()) {
    errors.content = '评论内容不能为空'
    valid = false
  }

  // type — 必填，必须是合法枚举值
  if (!formType.value) {
    errors.type = '请选择留言类型'
    valid = false
  } else if (!VALID_TYPES.includes(formType.value)) {
    errors.type = '无效的留言类型'
    valid = false
  }

  // nickname — 选填，有填的话最长 50 字符
  if (formNickname.value.length > 50) {
    errors.nickname = '昵称最多 50 个字符'
    valid = false
  }

  // phone — 选填，有填的话最长 30 字符
  if (formPhone.value.length > 30) {
    errors.phone = '电话最多 30 个字符'
    valid = false
  }

  // email — 选填，有填的话必须合法格式，最长 100 字符
  const emailVal = formEmail.value.trim()
  if (emailVal) {
    if (emailVal.length > 100) {
      errors.email = '邮箱最多 100 个字符'
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errors.email = '邮箱格式不正确'
      valid = false
    }
  }

  // captcha — 必填，4 位
  if (!formCaptcha.value.trim()) {
    errors.captcha = '请输入验证码'
    valid = false
  } else if (formCaptcha.value.toUpperCase() !== captchaCode.value.toUpperCase()) {
    errors.captcha = '验证码错误'
    refreshCaptcha()
    formCaptcha.value = ''
    valid = false
  }

  return valid
}

// ── API 调用 ────────────────────────────────────
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

// ── 提交 ────────────────────────────────────────
const handleSubmit = async () => {
  if (!validate()) return

  submitting.value = true
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
    } else if (data.errors) {
      // 映射服务端校验错误到对应字段
      const serverErrors = data.errors as Record<string, string[]>
      if (serverErrors.content) errors.content = serverErrors.content[0]!
      if (serverErrors.type) errors.type = serverErrors.type[0]!
      if (serverErrors.nickname) errors.nickname = serverErrors.nickname[0]!
      if (serverErrors.phone) errors.phone = serverErrors.phone[0]!
      if (serverErrors.email) errors.email = serverErrors.email[0]!
      submitError.value = data.msg || '提交失败，请检查输入'
    } else {
      submitError.value = data.msg || '提交失败，请重试'
    }
  } catch (error) {
    submitError.value = '网络错误，请重试'
    logger.error('Failed to submit comment:', error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchComments()
  fetchStats()
  incrementView()
})
</script>
