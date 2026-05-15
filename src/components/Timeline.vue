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

    <!-- 单行控制栏 -->
    <div class="controls-row">
      <!-- 播放/暂停 -->
      <button
        class="ctrl-btn play-btn"
        :class="{ playing: store.isPlaying }"
        @click="store.togglePlaying()"
      >
        {{ store.isPlaying ? '⏸' : '▶' }}
      </button>

      <!-- 速度控制 -->
      <div class="speed-wrap">
        <button class="speed-arrow" @click="speedDown" :disabled="speedIdx <= 0">◀</button>
<span class="speed-value">{{ timeScales[speedIdx]?.label || '12小时/秒' }}</span>
        <button class="speed-arrow" @click="speedUp" :disabled="speedIdx >= timeScales.length - 1">▶</button>
      </div>

      <!-- 时间轴主体 -->
      <div class="timeline-track-wrap">
        <!-- 里程碑标记 -->
        <div class="milestones-layer">
          <div
            v-for="m in visibleMilestones"
            :key="m.date"
            class="milestone-dot"
            :style="{ left: getMilestonePos(m) + '%' }"
            @mouseenter="showMilestone(m, $event)"
            @mouseleave="hideMilestone"
          >
            <span class="m-marker">▲</span>
          </div>
        </div>

        <!-- 拖动条 -->
        <div
          ref="trackRef"
          class="timeline-track"
          @click="onTrackClick"
          @mousedown="startDrag"
        >
          <div class="track-fill" :style="{ width: fillPercent + '%' }"></div>
          <div
            class="thumb"
            :style="{ left: fillPercent + '%' }"
            :class="{ dragging: isDragging }"
          ></div>
        </div>

        <!-- 时间刻度 -->
        <div class="time-ticks">
          <span v-for="tick in timeTicks" :key="tick.year" class="tick" :style="{ left: tick.pos + '%' }">
            {{ tick.year }}
          </span>
        </div>
      </div>

      <!-- 日期显示 -->
      <div class="time-display">
        <span class="time-date">{{ store.currentDateStr }}</span>
      </div>

      <!-- 开关组 -->
      <div class="toggle-row">
        <button class="toggle-btn" :class="{ active: store.showOrbits }" @click="store.toggleOrbits()">轨道</button>
        <button class="toggle-btn" :class="{ active: store.showLabels }" @click="store.toggleLabels()">标签</button>
        <button class="toggle-btn" :class="{ active: store.showProbeTrajectories }" @click="store.toggleProbeTrajectories()">探测器</button>
      </div>

      <!-- 重置 -->
      <button class="ctrl-btn reset-btn" @click="resetToNow">🏠</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSpaceStore } from '../stores/useSpaceStore.js'
import { TIME_SCALES } from '../utils/timeUtils.js'

const store = useSpaceStore()
const trackRef = ref(null)
const isDragging = ref(false)
const activeMilestone = ref(null)
const milestonePopupStyle = ref({})

const timeScales = TIME_SCALES

// 速度档位索引
const speedIdx = ref(timeScales.findIndex(s => s.value === store.timeScale))
if (speedIdx.value < 0) speedIdx.value = 0

function speedUp() {
  if (speedIdx.value < timeScales.length - 1) {
    speedIdx.value++
    store.setTimeScale(timeScales[speedIdx.value].value)
  }
}

function speedDown() {
  if (speedIdx.value > 0) {
    speedIdx.value--
    store.setTimeScale(timeScales[speedIdx.value].value)
  }
}

watch(() => store.timeScale, (val) => {
  const idx = timeScales.findIndex(s => s.value === val)
  if (idx >= 0) speedIdx.value = idx
})

const fillPercent = computed(() => {
  const { start, end } = store.timeRange
  return ((store.currentTime - start) / (end - start)) * 100
})

const visibleMilestones = computed(() => store.milestones)

function getMilestonePos(m) {
  const t = new Date(m.date).getTime()
  const { start, end } = store.timeRange
  return ((t - start) / (end - start)) * 100
}

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

// ── 拖动/点击 ──
function getPosFromEvent(e) {
  const rect = trackRef.value.getBoundingClientRect()
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
  return Math.max(0, Math.min(1, x / rect.width))
}

function onTrackClick(e) {
  if (!trackRef.value) return
  store.setTimeByProgress(getPosFromEvent(e))
}

function startDrag(e) {
  isDragging.value = true
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDragMove(e) {
  if (!isDragging.value || !trackRef.value) return
  store.setTimeByProgress(getPosFromEvent(e))
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', stopDrag)
}

// ── 里程碑弹窗 ──
function showMilestone(m, event) {
  activeMilestone.value = m
  const rect = event.target.getBoundingClientRect()
  const barRect = trackRef.value?.closest('.timeline-bar')?.getBoundingClientRect()
  if (barRect) {
    milestonePopupStyle.value = {
      left: (rect.left - barRect.left) + 'px',
      bottom: '54px'
    }
  }
}

function hideMilestone() { activeMilestone.value = null }

function resetToNow() { store.setCurrentTime(Date.now()) }

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
  padding: 8px 24px 10px;
  background: linear-gradient(to top, rgba(4, 8, 24, 0.98), rgba(8, 16, 40, 0.85));
  border-top: 1px solid rgba(180, 160, 120, 0.15);
  backdrop-filter: blur(16px);
}

/* ── 单行控制栏 ── */
.controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
}

/* ── 通用按钮 ── */
.ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.22s;
  flex-shrink: 0;
}

.ctrl-btn:hover {
  background: rgba(255, 215, 100, 0.2);
  border-color: rgba(255, 215, 100, 0.45);
  color: #FFD770;
}

/* 播放按钮 */
.play-btn {
  width: 38px;
  height: 38px;
  font-size: 16px;
  background: rgba(255, 215, 100, 0.1);
  border-color: rgba(255, 215, 100, 0.3);
  color: #FFD770;
}

.play-btn.playing {
  background: rgba(255, 215, 100, 0.2);
  border-color: rgba(255, 215, 100, 0.55);
  color: #FFEAAA;
  box-shadow: 0 0 14px rgba(255, 200, 60, 0.35);
}

/* 重置按钮 */
.reset-btn {
  font-size: 14px;
}

/* ── 速度控制 ── */
.speed-wrap {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.speed-arrow {
  width: 28px;
  height: 30px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
}

.speed-arrow:hover:not(:disabled) {
  background: rgba(255, 215, 100, 0.18);
  border-color: rgba(255, 215, 100, 0.4);
  color: #FFD770;
}

.speed-arrow:disabled {
  opacity: 0.2;
  cursor: default;
}

.speed-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  min-width: 60px;
  text-align: center;
  font-family: 'Segoe UI', monospace;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ── 时间轴轨道区 ── */
.timeline-track-wrap {
  position: relative;
  flex: 1;
  min-width: 160px;
  padding-top: 12px;
}

.milestones-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  pointer-events: none;
}

.milestone-dot {
  position: absolute;
  transform: translateX(-50%);
  width: 16px;
  height: 20px;
  cursor: pointer;
  pointer-events: all;
  z-index: 5;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.m-marker {
  font-size: 10px;
  color: rgba(255, 215, 100, 0.6);
  line-height: 1;
  transition: color 0.2s, transform 0.2s;
}

.milestone-dot:hover .m-marker {
  color: #FFD770;
  transform: scale(1.5);
}

/* 轨道条 */
.timeline-track {
  position: relative;
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
}

.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #E6A817, #F5D76E, #FFEAAA);
  border-radius: 3px;
  pointer-events: none;
  box-shadow: 0 0 12px rgba(245, 215, 110, 0.45);
}

.thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #FFF8E7, #F5D76E);
  border: 2px solid #FFEAAA;
  border-radius: 50%;
  box-shadow: 0 0 16px rgba(245, 215, 110, 0.65), 0 0 6px rgba(255, 255, 255, 0.5);
  pointer-events: none;
  transition: width 0.1s, height 0.1s, box-shadow 0.1s;
}

.thumb.dragging {
  width: 18px;
  height: 18px;
  box-shadow: 0 0 24px rgba(245, 215, 110, 0.9), 0 0 10px rgba(255, 255, 255, 0.7);
}

/* 刻度 */
.time-ticks {
  position: relative;
  height: 15px;
  margin-top: 3px;
}

.tick {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  pointer-events: none;
  font-family: 'Segoe UI', monospace;
}

/* ── 日期显示 ── */
.time-display {
  flex-shrink: 0;
  min-width: 100px;
  text-align: center;
}

.time-date {
  font-size: 14px;
  color: #FFEAAA;
  font-family: 'Segoe UI', monospace;
  font-weight: 600;
  letter-spacing: 0.8px;
}

/* ── 开关按钮 ── */
.toggle-row {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.toggle-btn {
  padding: 5px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.22s;
  white-space: nowrap;
}

.toggle-btn:hover {
  border-color: rgba(255, 215, 100, 0.35);
  color: rgba(255, 255, 255, 0.7);
}

.toggle-btn.active {
  background: rgba(255, 215, 100, 0.18);
  border-color: rgba(255, 200, 60, 0.5);
  color: #FFD770;
  box-shadow: 0 0 10px rgba(255, 200, 60, 0.25);
}

/* ── 里程碑弹窗 ── */
.milestone-popup {
  position: absolute;
  background: rgba(8, 12, 30, 0.97);
  border: 1px solid rgba(255, 215, 100, 0.5);
  border-radius: 12px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 500;
  white-space: nowrap;
  box-shadow: 0 4px 22px rgba(0, 0, 0, 0.6);
}

.m-icon { font-size: 22px; line-height: 1; }

.m-info { display: flex; flex-direction: column; gap: 2px; }

.m-date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Segoe UI', monospace;
}

.m-name {
  font-size: 14px;
  color: #FFD770;
  font-weight: 600;
}

.milestone-pop-enter-active,
.milestone-pop-leave-active { transition: all 0.15s ease; }

.milestone-pop-enter-from,
.milestone-pop-leave-to { opacity: 0; transform: translateY(5px); }

@media (max-width: 768px) {
  .toggle-row { display: none; }
  .speed-wrap { display: none; }
}
</style>