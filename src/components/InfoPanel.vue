<template>
  <transition name="panel-slide">
    <div v-if="body" class="info-panel" @click.stop>
      <!-- 关闭按钮 -->
      <button class="close-btn" @click="$emit('close')">✕</button>

      <!-- 天体标题 -->
      <div class="panel-header">
        <div class="body-icon">{{ bodyIcon }}</div>
        <div class="body-title">
          <h2 class="body-name">{{ body.name }}</h2>
          <span class="body-name-en">{{ body.nameEn }}</span>
          <span class="body-type-badge">{{ bodyTypeName }}</span>
        </div>
      </div>

      <!-- 描述 -->
      <p class="body-description">{{ body.description }}</p>

      <!-- 物理参数 -->
      <div class="section">
        <h4 class="section-title">
          <span class="section-icon">📊</span> 物理参数
        </h4>
        <div class="stats-grid">
          <div
            v-for="(value, key) in body.stats"
            :key="key"
            class="stat-row"
          >
            <span class="stat-key">{{ key }}</span>
            <span class="stat-val">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 探索历史 -->
      <div v-if="body.explorations && body.explorations.length" class="section">
        <h4 class="section-title">
          <span class="section-icon">🚀</span> 探索历史
        </h4>
        <div class="exploration-list">
          <div
            v-for="(exp, i) in body.explorations"
            :key="i"
            class="exploration-item"
          >
            <span class="exp-year">{{ exp.year }}</span>
            <div class="exp-info">
              <span class="exp-name">{{ exp.name }}</span>
              <span class="exp-type">{{ exp.type }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="panel-actions">
<button v-if="!isProbe" class="action-btn primary" @click="$emit('focus', body)">
          🎯 聚焦观察
        </button>
        <button
          v-if="body.name === '火星' || body.nameEn === 'Mars'"
          class="action-btn secondary"
          @click="goToGallery"
        >
          📷 查看照片
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  body: {
    type: Object,
    default: null
    // 期望结构: { name, nameEn, description, stats, explorations, type }
  }
})

defineEmits(['close', 'focus'])

const router = useRouter()

const bodyIcon = computed(() => {
  if (!props.body) return '⭕'
  if (props.body.type === 'probe') return '🛰️'
  const icons = {
    '太阳': '☀️', Sun: '☀️',
    '水星': '⚫', Mercury: '⚫',
    '金星': '🟡', Venus: '🟡',
    '地球': '🌍', Earth: '🌍',
    '火星': '🔴', Mars: '🔴',
    '木星': '🟠', Jupiter: '🟠',
    '土星': '🪐', Saturn: '🪐',
    '天王星': '🔵', Uranus: '🔵',
    '海王星': '💙', Neptune: '💙',
    '月球': '🌙', Moon: '🌙'
  }
  return icons[props.body.name] || icons[props.body.nameEn] || '⭕'
})

const bodyTypeName = computed(() => {
  if (!props.body) return ''
  const typeMap = {
    star: '恒星',
    planet: '行星',
    moon: '卫星',
    probe: '探测器',
    dwarf: '矮行星'
  }
  return typeMap[props.body.type] || '天体'
})

const isProbe = computed(() => props.body?.type === 'probe')

const goToGallery = () => {
  router.push('/gallery')
}
</script>

<style scoped>
.info-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 340px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  background: rgba(0, 8, 28, 0.92);
  border: 1px solid rgba(100, 163, 255, 0.35);
  border-radius: 18px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(100, 163, 255, 0.1);
  z-index: 200;
  color: #fff;
}

/* 滚动条 */
.info-panel::-webkit-scrollbar { width: 4px; }
.info-panel::-webkit-scrollbar-track { background: transparent; }
.info-panel::-webkit-scrollbar-thumb { background: rgba(100, 163, 255, 0.4); border-radius: 2px; }

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #aaa;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.close-btn:hover {
  background: rgba(255, 80, 80, 0.3);
  border-color: rgba(255, 80, 80, 0.6);
  color: #fff;
}

/* 标题区 */
.panel-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
  padding-right: 36px;
}

.body-icon {
  font-size: 48px;
  line-height: 1;
  flex-shrink: 0;
}

.body-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.body-name {
  font-size: 22px;
  font-weight: bold;
  margin: 0;
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.body-name-en {
  font-size: 13px;
  color: #888;
  font-style: italic;
}

.body-type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(100, 163, 255, 0.15);
  border: 1px solid rgba(100, 163, 255, 0.4);
  border-radius: 10px;
  font-size: 11px;
  color: #64a3ff;
  width: fit-content;
}

/* 描述 */
.body-description {
  font-size: 13px;
  color: #bbb;
  line-height: 1.7;
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* 数据区块 */
.section {
  margin-bottom: 18px;
}

.section-title {
  font-size: 13px;
  color: #64a3ff;
  margin-bottom: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.section-icon {
  margin-right: 4px;
}

/* 参数网格 */
.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border-left: 3px solid rgba(100, 163, 255, 0.4);
}

.stat-key {
  font-size: 12px;
  color: #888;
  flex-shrink: 0;
}

.stat-val {
  font-size: 12px;
  color: #e8f0ff;
  font-weight: 500;
  text-align: right;
  margin-left: 8px;
}

/* 探索历史 */
.exploration-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exploration-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.exp-year {
  font-size: 12px;
  font-weight: bold;
  color: #FFD700;
  min-width: 36px;
  font-family: monospace;
}

.exp-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exp-name {
  font-size: 12px;
  color: #ddd;
  font-weight: 500;
}

.exp-type {
  font-size: 11px;
  color: #777;
}

/* 操作按钮 */
.panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.action-btn {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, #64a3ff, #4fc3f7);
  color: #000;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(100, 163, 255, 0.5);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

/* 过渡动画 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
