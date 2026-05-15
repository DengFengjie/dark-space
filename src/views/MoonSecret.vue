<template>
  <div class="placeholder-page">
    <div class="placeholder-content">
      <h1>月球秘境</h1>
      <p>高精度月球三维球体 — 陨石坑标注与阿波罗着陆点</p>
      <span class="badge">内容待填充</span>
    </div>
  </div>
</template>

<script setup>
// TODO: 实现高精度月球三维球体渲染
// - 高精度月面纹理映射
// - 陨石坑与阿波罗着陆点标注
// - 自由视角近距离观察
</script>

<style scoped>
.placeholder-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #111 0%, #050505 100%);
  color: #fff;
}
.placeholder-content {
  text-align: center;
  padding: 40px;
}
.placeholder-content h1 {
  font-size: 48px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #D8D8D8, #8A8A8A);
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
  background: rgba(200,200,200,0.15);
  border: 1px solid rgba(200,200,200,0.35);
  color: #aaa;
}
</style>