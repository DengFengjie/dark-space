# API接口文档 📡

深空探测可视化展示平台后端API接口说明

## 🌐 基础信息

- **Base URL**: `http://localhost:8080/api`
- **数据格式**: JSON
- **字符编码**: UTF-8
- **请求方式**: GET, POST

## 📋 接口列表

### 1. 获取行星列表

获取太阳系所有行星的基本信息

**接口地址**: `GET /api/planets`

**请求参数**: 无

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "水星",
    "nameEn": "Mercury",
    "distanceFromSun": "5790万公里",
    "orbitalPeriod": "88天",
    "diameter": "4,879公里",
    "moons": 0
  },
  {
    "id": 2,
    "name": "金星",
    "nameEn": "Venus",
    "distanceFromSun": "1.08亿公里",
    "orbitalPeriod": "225天",
    "diameter": "12,104公里",
    "moons": 0
  }
]
```

**响应字段说明**:
- `id`: 行星ID
- `name`: 中文名称
- `nameEn`: 英文名称
- `distanceFromSun`: 距太阳距离
- `orbitalPeriod`: 公转周期
- `diameter`: 直径
- `moons`: 卫星数量

---

### 2. 获取特定天体信息

根据天体名称获取详细信息

**接口地址**: `GET /api/info/:planet`

**路径参数**:
- `planet`: 天体标识符 (mars, moon, earth等)

**请求示例**:
```
GET /api/info/mars
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "火星",
    "nameEn": "Mars",
    "description": "火星是太阳系第四颗行星，被称为红色星球。",
    "type": "类地行星",
    "physicalProperties": {
      "diameter": "6,779公里",
      "mass": "6.39 × 10^23千克",
      "density": "3.93 g/cm³",
      "surfaceGravity": "3.71 m/s²"
    },
    "orbitalProperties": {
      "distanceFromSun": "2.28亿公里",
      "orbitalPeriod": "687地球日",
      "rotationPeriod": "24.6小时",
      "eccentricity": "0.0934"
    },
    "surfaceProperties": {
      "temperature": "-87°C ~ -5°C",
      "atmosphere": "二氧化碳95.3%",
      "surfaceArea": "1.448亿平方公里"
    },
    "moons": [
      {
        "name": "火卫一",
        "nameEn": "Phobos",
        "diameter": "22.2公里"
      },
      {
        "name": "火卫二",
        "nameEn": "Deimos",
        "diameter": "12.6公里"
      }
    ],
    "explorationHistory": [
      {
        "year": 1976,
        "mission": "海盗1号",
        "type": "着陆器"
      },
      {
        "year": 2021,
        "mission": "天问一号",
        "type": "轨道器+巡视器"
      }
    ]
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "Planet not found",
  "message": "未找到指定的天体信息"
}
```

---

### 3. 获取太阳系概览

获取太阳系整体的统计信息

**接口地址**: `GET /api/solar-system`

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "太阳系",
    "age": "约46亿年",
    "centerStar": {
      "name": "太阳",
      "type": "G型主序星",
      "diameter": "139.2万公里",
      "mass": "1.989 × 10^30千克"
    },
    "planetCount": 8,
    "dwarfPlanetCount": 5,
    "totalMoons": 200,
    "asteroidBelt": true,
    "kuiperBelt": true,
    "oortCloud": true
  }
}
```

---

### 4. 搜索天体

根据关键词搜索天体

**接口地址**: `GET /api/search`

**查询参数**:
- `q`: 搜索关键词
- `type`: 天体类型 (可选: planet, moon, star)

**请求示例**:
```
GET /api/search?q=火星
GET /api/search?q=earth&type=planet
```

**响应示例**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 4,
      "name": "火星",
      "type": "planet",
      "relevance": 1.0
    }
  ]
}
```

---

## 🔐 认证说明

当前版本暂不需要认证，后续版本将添加API密钥认证机制。

## ⚡ 速率限制

- 单个IP每分钟最多100次请求
- 超过限制将返回429状态码

## 📝 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

## 🧪 测试示例

### 使用curl测试

```bash
# 获取行星列表
curl http://localhost:8080/api/planets

# 获取火星信息
curl http://localhost:8080/api/info/mars

# 搜索天体
curl "http://localhost:8080/api/search?q=月球"
```

### 使用JavaScript fetch

```javascript
// 获取行星列表
fetch('http://localhost:8080/api/planets')
  .then(response => response.json())
  .then(data => console.log(data));

// 获取特定天体信息
fetch('http://localhost:8080/api/info/mars')
  .then(response => response.json())
  .then(data => console.log(data));
```

### 使用Python requests

```python
import requests

# 获取行星列表
response = requests.get('http://localhost:8080/api/planets')
print(response.json())

# 获取火星信息
response = requests.get('http://localhost:8080/api/info/mars')
print(response.json())
```

## 📊 数据更新

天体数据定期从NASA和CNSA官方来源更新，确保数据的准确性和权威性。

## 🔗 相关链接

- [NASA官网](https://www.nasa.gov/)
- [中国国家航天局](http://www.cnsa.gov.cn/)
- [国际天文学联合会](https://www.iau.org/)

## 📞 技术支持

如有问题请联系：
- 提交Issue
- 发送邮件至技术支持邮箱

---

**API版本**: v1.0.0  
**最后更新**: 2024
