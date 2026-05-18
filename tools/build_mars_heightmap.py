"""
build_mars_heightmap.py
=======================
将 MGS MOLA MEGDR 64ppd 四个象限切片拼接为全球高程图，
并输出适用于 Three.js displacementMap 的归一化 PNG。

输入（位于项目根目录）:
  megt90n000gb.img  -- lat  0~90°N, lon   0~180°E  (MSB int16, 5760×11520)
  megt90n180gb.img  -- lat  0~90°N, lon 180~360°E
  megt00n000gb.img  -- lat  0~90°S, lon   0~180°E
  megt00n180gb.img  -- lat  0~90°S, lon 180~360°E

输出 (写入 src/public/models/bodies/mars/):
  mars_height_full.tif   -- 原始 int16 全球 GeoTIFF（23040×11520）
  mars_height_4k.png     -- 4096×2048  16-bit 归一化 PNG
  mars_height_8k.png     -- 8192×4096  16-bit 归一化 PNG

高程范围（与 mars_assets_manifest.json 一致）:
  MIN_ELEV_M = -8200  (希腊平原最低点)
  MAX_ELEV_M = 21218  (MOLA 实测最大值, 文档记录)

用法:
  cd <project_root>
  python tools/build_mars_heightmap.py
"""

import os
import sys
import struct
import zlib
import time

import numpy as np
from PIL import Image

# ── 路径配置 ────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR   = os.path.join(PROJECT_ROOT, 'src', 'public', 'models', 'bodies', 'mars')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── 切片定义 ─────────────────────────────────────────────────────────────
# 每个切片：5760 行 × 11520 列，MSB 大端 int16，单位 meter
TILE_ROWS  = 5760
TILE_COLS  = 11520
DTYPE      = '>i2'   # MSB big-endian int16

# 按 (行偏移, 列偏移) 排列四个象限
# 全图: 行 0 = 90°N, 行 5760 = 0°, 行 11520 = 90°S
#        列 0 = 0°E, 列 11520 = 180°E, 列 23040 = 360°E (= 0°)
TILES = [
    ('megt90n000gb.img', 0,    0),       # lat  0~90°N, lon   0~180°E  → top-left
    ('megt90n180gb.img', 0,    TILE_COLS), # lat  0~90°N, lon 180~360°E → top-right
    ('megt00n000gb.img', TILE_ROWS, 0),    # lat  0~90°S, lon   0~180°E → bottom-left
    ('megt00n180gb.img', TILE_ROWS, TILE_COLS), # lat  0~90°S, lon 180~360°E → bottom-right
]

# ── 高程归一化范围（米）─────────────────────────────────────────────────
MIN_ELEV_M = -8200
MAX_ELEV_M = 21218  # 文档记录的 MOLA 全球最大值

# ── 输出分辨率 ───────────────────────────────────────────────────────────
OUTPUT_SIZES = [
    ('mars_height_4k.png',   4096,  2048),
    ('mars_height_8k.png',   8192,  4096),
    ('mars_height_16k.png', 16384,  8192),
]

# ────────────────────────────────────────────────────────────────────────

def log(msg):
    # 强制 utf-8 输出避免 Windows GBK 控制台乱码
    line = f'[{time.strftime("%H:%M:%S")}] {msg}\n'
    sys.stdout.buffer.write(line.encode('utf-8', errors='replace'))
    sys.stdout.buffer.flush()


def read_img_tile(filename):
    """读取单个 MOLA MEGDR .IMG 文件（MSB int16）"""
    path = os.path.join(PROJECT_ROOT, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f'切片文件不存在: {path}')
    expected_bytes = TILE_ROWS * TILE_COLS * 2  # int16 = 2 bytes
    actual_bytes   = os.path.getsize(path)
    if actual_bytes != expected_bytes:
        raise ValueError(
            f'{filename}: 文件大小 {actual_bytes} bytes，'
            f'期望 {expected_bytes} bytes ({TILE_ROWS}×{TILE_COLS}×2)'
        )
    log(f'  读取 {filename}  ({TILE_ROWS}×{TILE_COLS}, int16, {actual_bytes/1e6:.0f} MB)')
    data = np.fromfile(path, dtype=DTYPE)
    data = data.reshape(TILE_ROWS, TILE_COLS)
    return data


def assemble_global(tiles_data, tiles_info):
    """将四个象限拼成全球图"""
    global_rows = TILE_ROWS * 2   # 11520
    global_cols = TILE_COLS * 2   # 23040
    log(f'拼接全球图: {global_cols}×{global_rows}  ({global_cols*global_rows*2/1e6:.0f} MB)')
    global_map = np.empty((global_rows, global_cols), dtype=np.int16)
    for (filename, row_off, col_off), tile_data in zip(tiles_info, tiles_data):
        global_map[row_off:row_off + TILE_ROWS,
                   col_off:col_off + TILE_COLS] = tile_data
        log(f'  已放置 {filename} → 行[{row_off}:{row_off+TILE_ROWS}], 列[{col_off}:{col_off+TILE_COLS}]')
    return global_map


def save_geotiff(data, out_path):
    """尝试用 GDAL 保存 GeoTIFF；若无 GDAL 则跳过"""
    try:
        from osgeo import gdal, osr
        rows, cols = data.shape
        driver  = gdal.GetDriverByName('GTiff')
        opts    = ['COMPRESS=DEFLATE', 'PREDICTOR=2', 'BIGTIFF=YES']
        ds      = driver.Create(out_path, cols, rows, 1, gdal.GDT_Int16,
                                options=opts)
        # 设置地理变换: top-left 为 (0°E, 90°N), 每像素 1/64°
        res = 1.0 / 64.0
        ds.SetGeoTransform([0.0, res, 0.0, 90.0, 0.0, -res])
        srs = osr.SpatialReference()
        srs.SetGeogCS(
            'GCS_Mars_2000_Sphere',
            'D_Mars_2000_Sphere',
            'Mars_2000_Sphere_IAU_IAG',
            3396000.0, 0.0
        )
        ds.SetProjection(srs.ExportToWkt())
        ds.GetRasterBand(1).WriteArray(data)
        ds.GetRasterBand(1).SetNoDataValue(-32768)
        ds.FlushCache()
        ds = None
        log(f'  保存 GeoTIFF: {out_path}')
    except ImportError:
        log('  (GDAL 未安装，跳过 GeoTIFF 输出；如需 GeoTIFF 请安装 osgeo)')


def normalize_to_uint16(data, min_m, max_m):
    """将 int16 高程数据归一化到 uint16 [0, 65535]"""
    arr = data.astype(np.float32)
    arr = np.clip(arr, min_m, max_m)
    arr = (arr - min_m) / (max_m - min_m) * 65535.0
    return arr.astype(np.uint16)


def write_16bit_png(arr_u16, filename):
    """将 uint16 numpy 数组写为标准 16-bit 灰度 PNG。
    不依赖 Pillow 保存路径，直接用 struct + zlib 生成合规 PNG。
    PNG 规范要求 16-bit 灰度值以大端字节序存储。
    """
    h, w = arr_u16.shape

    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    # IHDR: width, height, bit_depth=16, color_type=0 (grayscale)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 16, 0, 0, 0, 0))

    # 行扫描：每行前缀 filter byte 0 (None filter)，值转大端 bytes
    arr_be = arr_u16.astype('>u2')
    rows_bytes = b''.join(b'\x00' + arr_be[r].tobytes() for r in range(h))
    idat = chunk(b'IDAT', zlib.compress(rows_bytes, level=6))
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend)


def downsample_and_save_png(data_uint16, target_w, target_h, out_path):
    """LANCZOS 降采样后保存为真正的 16-bit 灰度 PNG（无 Pillow 废弃警告）。
    流程：uint16 → PIL 'I' mode（仅用于 resize）→ numpy uint16 → write_16bit_png
    """
    src_h, src_w = data_uint16.shape

    if src_w != target_w or src_h != target_h:
        log(f'  降采样 {src_w}x{src_h} -> {target_w}x{target_h} ...')
        # 用 Pillow 'I'(int32) 模式做高质量 LANCZOS resize
        img_i = Image.fromarray(data_uint16.astype(np.int32), mode='I')
        img_i = img_i.resize((target_w, target_h), Image.Resampling.LANCZOS)
        # 转回 uint16：clip 保证不溢出
        arr_out = np.clip(np.array(img_i, dtype=np.int32), 0, 65535).astype(np.uint16)
    else:
        arr_out = data_uint16

    write_16bit_png(arr_out, out_path)
    size_kb = os.path.getsize(out_path) // 1024
    log(f'  [OK] 已保存 {os.path.basename(out_path)}  ({target_w}x{target_h}, 16-bit grayscale PNG, {size_kb} KB)')


def main():
    log('─────────────────────────────────────────────────────')
    log('MOLA MEGDR 高程图拼接工具')
    log(f'项目根目录: {PROJECT_ROOT}')
    log(f'输出目录:   {OUTPUT_DIR}')
    log('─────────────────────────────────────────────────────')

    # 1. 读取四个切片
    log('\n[步骤 1] 读取 .IMG 切片')
    tiles_data = []
    for (filename, row_off, col_off) in TILES:
        t = read_img_tile(filename)
        log(f'    高程范围: {int(t.min())} ~ {int(t.max())} m')
        tiles_data.append(t)

    # 2. 拼接全球图
    log('\n[步骤 2] 拼接全球图')
    global_map = assemble_global(tiles_data, TILES)
    log(f'  全图高程范围: {int(global_map.min())} ~ {int(global_map.max())} m')

    # 3. 保存 GeoTIFF（如有 GDAL）
    log('\n[步骤 3] 保存原始 GeoTIFF')
    tif_path = os.path.join(OUTPUT_DIR, 'mars_height_full.tif')
    save_geotiff(global_map, tif_path)

    # 4. 归一化到 uint16
    log(f'\n[步骤 4] 归一化高程 [{MIN_ELEV_M}, {MAX_ELEV_M}] m → [0, 65535]')
    data_u16 = normalize_to_uint16(global_map, MIN_ELEV_M, MAX_ELEV_M)
    log(f'  归一化后范围: {int(data_u16.min())} ~ {int(data_u16.max())}')

    # 释放原始 int16 以减少内存占用
    del global_map, tiles_data

    # 5. 输出各分辨率 PNG
    log('\n[步骤 5] 输出 PNG height maps')
    for (filename, w, h) in OUTPUT_SIZES:
        out_path = os.path.join(OUTPUT_DIR, filename)
        downsample_and_save_png(data_u16, w, h, out_path)

    log('\n─────────────────────────────────────────────────────')
    log('全部完成！')
    log('生成文件:')
    for (filename, w, h) in OUTPUT_SIZES:
        p = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(p):
            log(f'  {p}')
    log('')
    log('后续步骤：')
    log('  1. 检查标注对齐：奥林帕斯山 (lat=18.65, lon=-133.8)')
    log('     → 在贴图上应位于左侧偏中区域（约 x=7830, y=4600 @ 8K）')
    log('  2. 如发现经度偏移，在 deepMarsScene.js 的 texture 上调整 offset.x')
    log('  3. height texture 扩展名已是 .png，manifest 无需修改')
    log('─────────────────────────────────────────────────────')


if __name__ == '__main__':
    main()
