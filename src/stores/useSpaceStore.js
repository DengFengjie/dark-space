import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSpaceStore = defineStore('space', () => {
  // 当前时间（Unix时间戳，毫秒）
  const currentTime = ref(new Date('1991-12-26').getTime())

  // 选中的天体对象
  const selectedBody = ref(null)

  // 时间轴播放状态
  const isPlaying = ref(true)

  // 时间加速比例（每帧推进的毫秒数，按60fps计算）
  const timeScale = ref(720000) // 默认 12小时/秒（最慢档）

  // 显示轨道线
  const showOrbits = ref(true)

  // 显示探测器轨迹
  const showProbeTrajectories = ref(true)

  // 是否显示标签
  const showLabels = ref(true)

  // 相机聚焦目标（用于平滑飞行）
  const cameraTarget = ref(null)

  // 时间范围（时间轴起止，毫秒）
  const timeRange = ref({
    start: new Date('1970-01-01').getTime(),
    end: new Date('2035-12-31').getTime()
  })

  // 当前视图模式：'solar' | 'mars' | 'moon'
  const viewMode = ref('solar')

  // 重要里程碑事件
  const milestones = ref([
    { date: '1969-07-20', name: '阿波罗11号登月', icon: '🌙', color: '#FFD700' },
    { date: '1977-09-05', name: '旅行者1号发射', icon: '🚀', color: '#64a3ff' },
    { date: '1977-08-20', name: '旅行者2号发射', icon: '🚀', color: '#4fc3f7' },
    { date: '1990-02-14', name: '旅行者1号拍摄暗淡蓝点', icon: '📷', color: '#87CEEB' },
    { date: '1997-07-04', name: '火星探路者着陆', icon: '🔴', color: '#C1440E' },
    { date: '2004-01-03', name: '勇气号着陆火星', icon: '🤖', color: '#FF6B4A' },
    { date: '2012-08-06', name: '好奇号着陆火星', icon: '🤖', color: '#FF8C00' },
    { date: '2015-07-14', name: '新视野号飞越冥王星', icon: '⭕', color: '#DDA0DD' },
    { date: '2021-02-18', name: '毅力号着陆火星', icon: '🤖', color: '#CD853F' },
    { date: '2021-05-22', name: '天问一号祝融号着陆', icon: '🇨🇳', color: '#FF4500' }
  ])

  // ────── 计算属性 ──────

  // 当前儒略日
  const julianDay = computed(() => {
    return (currentTime.value / 86400000) + 2440587.5
  })

  // 当前UTC日期字符串 YYYY-MM-DD
  const currentDateStr = computed(() => {
    return new Date(currentTime.value).toISOString().split('T')[0]
  })

  // 当前年份
  const currentYear = computed(() => {
    return new Date(currentTime.value).getFullYear()
  })

  // 时间轴进度 0~1
  const timeProgress = computed(() => {
    const { start, end } = timeRange.value
    return (currentTime.value - start) / (end - start)
  })

  // ────── Actions ──────

  const setCurrentTime = (time) => {
    currentTime.value = Math.max(timeRange.value.start, Math.min(timeRange.value.end, time))
  }

  const setTimeByProgress = (progress) => {
    const { start, end } = timeRange.value
    setCurrentTime(start + progress * (end - start))
  }

  const advanceTime = () => {
    if (isPlaying.value) {
      setCurrentTime(currentTime.value + timeScale.value)
    }
  }

  const setSelectedBody = (body) => {
    selectedBody.value = body
  }

  const clearSelectedBody = () => {
    selectedBody.value = null
  }

  const togglePlaying = () => {
    isPlaying.value = !isPlaying.value
  }

  const setTimeScale = (scale) => {
    timeScale.value = scale
  }

  const toggleOrbits = () => {
    showOrbits.value = !showOrbits.value
  }

  const toggleProbeTrajectories = () => {
    showProbeTrajectories.value = !showProbeTrajectories.value
  }

  const toggleLabels = () => {
    showLabels.value = !showLabels.value
  }

  const setCameraTarget = (target) => {
    cameraTarget.value = target
  }

  const setViewMode = (mode) => {
    viewMode.value = mode
  }

  return {
    currentTime,
    selectedBody,
    isPlaying,
    timeScale,
    showOrbits,
    showProbeTrajectories,
    showLabels,
    cameraTarget,
    timeRange,
    viewMode,
    milestones,
    julianDay,
    currentDateStr,
    currentYear,
    timeProgress,
    setCurrentTime,
    setTimeByProgress,
    advanceTime,
    setSelectedBody,
    clearSelectedBody,
    togglePlaying,
    setTimeScale,
    toggleOrbits,
    toggleProbeTrajectories,
    toggleLabels,
    setCameraTarget,
    setViewMode
  }
})
