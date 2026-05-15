<template>
  <div class="placeholder-page">
    <div class="placeholder-content">
      <h1>火星奇境</h1>
      <p>高精度火星地形模型 — 奥林帕斯山·水手谷标志性地貌</p>
      <span class="badge">内容待填充</span>
    </div>
  </div>
</template>

<script setup>
// TODO: 实现高精度火星地形模型渲染
// - 火星数字高程模型（DEM）地形映射
// - 奥林帕斯山、水手谷等标志性区域标注
// - 自由视角沉浸式漫游
</script>

<style scoped>
.placeholder-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #2a0a00 0%, #0f0300 100%);
  color: #fff;
}
.placeholder-content {
  text-align: center;
  padding: 40px;
}
.placeholder-content h1 {
  font-size: 48px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #FF7050, #C1440E);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.placeholder-content p {
  font-size: 18px;
  opacity: 0.7;
  margin-bottom: 24px;
}
.badge {
  display: inline-block;
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 13px;
  background: rgba(193,68,14,0.2);
  border: 1px solid rgba(193,68,14,0.4);
  color: #C1440E;
}
</style>