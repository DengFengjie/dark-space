<template>
  <div class="placeholder-page">
    <div class="placeholder-content">
      <h1>木星巨眼</h1>
      <p>云带深处 — 朱诺号JunoCam 可见光纹理三维可视化</p>
      <span class="badge">内容待填充</span>
    </div>
  </div>
</template>

<script setup>
// TODO: 实现木星高精度三维球体渲染
// - 朱诺号 JunoCam 可见光纹理映射
// - 大气分层可视化（条纹、大红斑）
// - 自由视角旋转/缩放
</script>

<style scoped>
.placeholder-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #1a0e08 0%, #0a0503 100%);
  color: #fff;
}
.placeholder-content {
  text-align: center;
  padding: 40px;
}
.placeholder-content h1 {
  font-size: 48px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #E8A87C, #C77D43);
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
  background: rgba(200,125,67,0.2);
  border: 1px solid rgba(200,125,67,0.4);
  color: #C77D43;
}
</style>