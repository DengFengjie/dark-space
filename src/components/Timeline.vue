<template>
  <div class="timeline-bar">
    <!-- 里程碑弹窗 -->
    <transition name="milestone-pop">
      <div v-if="activeMilestone" class="milestone-popup" :style="milestonePopupStyle">
        <span class="m-icon">{{ activeMilestone.icon }}</span>
        <div class="m-info">
          <div class="m-date">{{ activeMilestone.date }}</div>
          <div class="m-name">{{ activeMilestone.name }}</div>
        </div>
      </div>
    </transition>

    <!-- 时间轴主体 -->
    <div class="timeline-track-wrap">
      <!-- 里程碑标记 -->
      <div class="milestones-layer">
        <div
          v-for="m in visibleMilestones"
          :key="m.date"
          class="milestone-dot"
          :style="{ left: getMilestonePos(m) + '%', borderColor: m.color }"
          :title="m.name"
          @mouseenter="showMilestone(m, $event)"
          @mouseleave="hideMilestone"
        >
          <span class="m-dot-icon">{{ m.icon }}</span>
        </div>
      </div>

      <!-- 拖动条 -->
      <div
        ref="trackRef"
        class="timeline-track"
        @click="onTrackClick"
        @mousedown="startDrag"
      >
        <!-- 已过进度 -->
        <div class="track-fill" :style="{ width: fillPercent + '%' }" />
        <!-- 滑块 -->
        <div
          class="thumb"
          :style="{ left: fillPercent + '%' }"
          :class="{ dragging: isDragging }"
        />
      </div>

      <!-- 时间刻度标签 -->
      <div class="time-ticks">
        <span v-for="tick in timeTicks" :key="tick.year" class="tick" :style="{ left: tick.pos + '%' }">
          {{ tick.year }}
        </span>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="controls-row">
      <!-- 播放/暂停 -->
      <button class="ctrl-btn play-btn" @click="store.togglePlaying()" :title="store.isPlaying ? '暂停' : '播放'">
        {{ store.isPlaying ? '⏸' : '▶️' }}
      </button>

      <!-- 速度选择 -->
      <div class="speed-wrap">
        <span class="speed-label">速度</span>
        <select class="speed-select" v-model="selectedScale" @change="onSpeedChange">
          <option v-for="s in timeScales" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>

      <!-- 当前时间显示 -->
      <div class="time-display">
        <span class="time-year">{{ store.currentYear }}</span>
        <span class="time-date">{{ store.currentDateStr }}</span>
      </div>

      <!-- 轨道/标签开关 -->
      <div class="toggle-row">
        <button
          class="toggle-btn"
          :class="{ active: store.showOrbits }"
          @click="store.toggleOrbits()"
        >
          轨道
        </button>
        <button
          class="toggle-btn"
          :class="{ active: store.showLabels }"
          @click="store.toggleLabels()"
        >
          标签
        </button>
        <button
          class="toggle-btn"
          :class="{ active: store.showProbeTrajectories }"
          @click="store.toggleProbeTrajectories()"
        >
          探测器
        </button>
      </div>

      <!-- 重置 -->
      <button class="ctrl-btn" @click="resetToNow" title="跳转到今天">🏠</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSpaceStore } from '../stores/useSpaceStore.js'
import { TIME_SCALES } from '../utils/timeUtils.js'

const store = useSpaceStore()
const trackRef = ref(null)
const isDragging = ref(false)
const activeMilestone = ref(null)
const milestonePopupStyle = ref({})
const selectedScale = ref(store.timeScale)

const timeScales = TIME_SCALES

// 填充进度百分比
const fillPercent = computed(() => {
  const { start, end } = store.timeRange
  return ((store.currentTime - start) / (end - start)) * 100
})

// 里程碑位置计算
const visibleMilestones = computed(() => store.milestones)

function getMilestonePos(m) {
  const t = new Date(m.date).getTime()
  const { start, end } = store.timeRange
  return ((t - start) / (end - start)) * 100
}

// 时间刻度（每10年一个刻度）
const timeTicks = computed(() => {
  const { start, end } = store.timeRange
  const startYear = new Date(start).getFullYear()
  const endYear = new Date(end).getFullYear()
  const ticks = []
  for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) {
    const t = new Date(y, 0, 1).getTime()
    const pos = ((t - start) / (end - start)) * 100
    ticks.push({ year: y, pos })
  }
  return ticks
})

// ──────────────────────────────────────────
// 速度控制
function onSpeedChange() {
  store.setTimeScale(selectedScale.value)
}

// ──────────────────────────────────────────
// 轨道点击 & 拖动
function getPosFromEvent(e) {
  const rect = trackRef.value.getBoundingClientRect()
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
  return Math.max(0, Math.min(1, x / rect.width))
}

function onTrackClick(e) {
  if (!trackRef.value) return
  const p = getPosFromEvent(e)
  store.setTimeByProgress(p)
}

function startDrag(e) {
  isDragging.value = true
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDragMove(e) {
  if (!isDragging.value || !trackRef.value) return
  const p = getPosFromEvent(e)
  store.setTimeByProgress(p)
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

// ──────────────────────────────────────────
// 里程碑弹窗
function showMilestone(m, event) {
  activeMilestone.value = m
  const rect = event.target.getBoundingClientRect()
  const barRect = trackRef.value?.closest('.timeline-bar')?.getBoundingClientRect()
  if (barRect) {
    milestonePopupStyle.value = {
      left: (rect.left - barRect.left) + 'px',
      bottom: '60px'
    }
  }
}

function hideMilestone() {
  activeMilestone.value = null
}

// ──────────────────────────────────────────
// 重置到今天
function resetToNow() {
  store.setCurrentTime(Date.now())
}

// 清理拖动事件
onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.timeline-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 300;
  padding: 10px 24px 12px;
  background: linear-gradient(to top, rgba(0, 5, 20, 0.97), rgba(0, 5, 20, 0.85));
  border-top: 1px solid rgba(100, 163, 255, 0.2);
  backdrop-filter: blur(12px);
}

/* ── 轨道区 ── */
.timeline-track-wrap {
  position: relative;
  margin-bottom: 6px;
  padding-top: 24px; /* 为里程碑点留空间 */
}

.milestones-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  pointer-events: none;
}

.milestone-dot {
  position: absolute;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #FFD700;
  background: rgba(0, 5, 20, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: all;
  transition: transform 0.2s;
  z-index: 10;
}

.milestone-dot:hover {
  transform: translateX(-50%) scale(1.3);
}

.m-dot-icon {
  font-size: 12px;
  line-height: 1;
}

/* 轨道 */
.timeline-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
}

.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #1a4acc, #64a3ff, #4fc3f7);
  border-radius: 3px;
  pointer-events: none;
}

.thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background: #64a3ff;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(100, 163, 255, 0.8);
  pointer-events: none;
  transition: width 0.15s, height 0.15s;
}

.thumb.dragging {
  width: 20px;
  height: 20px;
}

/* 刻度 */
.time-ticks {
  position: relative;
  height: 16px;
  margin-top: 4px;
}

.tick {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

/* ── 控制栏 ── */
.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.ctrl-btn:hover {
  background: rgba(100, 163, 255, 0.25);
  border-color: rgba(100, 163, 255, 0.5);
}

.play-btn {
  width: 40px;
  height: 40px;
  font-size: 18px;
  background: rgba(100, 163, 255, 0.2);
  border-color: rgba(100, 163, 255, 0.5);
}

/* 速度 */
.speed-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.speed-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.speed-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.speed-select option {
  background: #001030;
}

/* 时间显示 */
.time-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
}

.time-year {
  font-size: 20px;
  font-weight: bold;
  color: #64a3ff;
  font-family: monospace;
  line-height: 1;
}

.time-date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
}

/* 开关按钮 */
.toggle-row {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.toggle-btn {
  padding: 6px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: rgba(100, 163, 255, 0.2);
  border-color: rgba(100, 163, 255, 0.5);
  color: #64a3ff;
}

.toggle-btn:hover {
  border-color: rgba(100, 163, 255, 0.4);
  color: #aaa;
}

/* ── 里程碑弹窗 ── */
.milestone-popup {
  position: absolute;
  background: rgba(0, 8, 30, 0.95);
  border: 1px solid rgba(255, 215, 0, 0.5);
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 500;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.m-icon { font-size: 20px; }

.m-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-date {
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.m-name {
  font-size: 13px;
  color: #FFD700;
  font-weight: 600;
}

/* 弹窗动画 */
.milestone-pop-enter-active,
.milestone-pop-leave-active {
  transition: all 0.2s ease;
}

.milestone-pop-enter-from,
.milestone-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 768px) {
  .toggle-row { display: none; }
  .speed-wrap { display: none; }
}
</style>
