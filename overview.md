# PAC 在线生成器 · 交付概览

## 成果
一个纯前端、可部署到 GitHub Pages 的 **PAC 代理自动配置在线生成器**，改造自 [gfw-pac](https://github.com/zhiyi7/gfw-pac)。

- 线上地址：**https://huijiangyuan.github.io/pac-generator/**
- 源码仓库：**https://github.com/huijiangyuan/pac-generator**

## 核心能力（对应你的需求）
1. **填写代理列表**：协议（HTTP/HTTPS/SOCKS4/SOCKS5）+ 地址 + 端口，支持单个增删与批量粘贴（`socks5://127.0.0.1:1080`、`127.0.0.1:7890` 等格式自动解析）。
2. **自动轮询可用代理**：生成形如 `SOCKS5 127.0.0.1:1080; PROXY 1.2.3.4:7890; DIRECT` 的故障转移链——系统/浏览器按顺序自动尝试，不可用时自动切换下一个（PAC 标准行为，即“自动轮询”）。
3. **自动跳过国内 IP**：内置 5823 条中国 IPv4/IPv6 段，命中即直连（沿用 gfw-pac 二进制前缀 + Radix Tree 匹配，O(32)/O(128)）。
4. **自动跳过私有 IP**：10/172.16-31/192.168/127/169.254 及 IPv6 链路本地/唯一本地地址直连。
5. **国外 IP 走代理**：其余流量经代理链；可开关「中国IP直连/私有IP直连/本地直连/国外走代理」。
6. **自定义域名**：预填常用直连/代理域名，支持子域通配与本地 TLD。
7. **实时预览 + 下载/复制**：编辑即时刷新 PAC 预览，一键下载 `pac.js` 或复制代理串；支持浅色/深色/系统主题。

## 文件结构
```
index.html              页面结构
assets/style.css        高级视觉（玻璃拟态、渐变、主题切换）
assets/app.js           UI 交互与实时生成
assets/generator.js     PAC 生成核心（CIDR→二进制→压缩→Radix Tree 注入）
assets/pac-template.js  改造自 gfw-pac 的 PAC 模板（含路由开关占位符）
assets/cn-ip-list.js    内置 5823 条中国 IP 段（JSON 转义）
assets/defaults.js      默认直连/代理域名清单
.github/workflows/update-cn-ip.yml   每周自动更新中国 IP 列表
```

## 验证
- Node vm 桩件：14 项路由断言全部 PASS（直连/代理域名、私有 IP、中国 IP、国外 IP、四个开关）。
- jsdom：UI 渲染、代理增删、开关切换、复制代理串正则均正常，无脚本错误。
- 线上资源（index.html + 全部 assets）HTTP 200 可访问。

## 使用
下载 `pac.js` → 系统/浏览器「自动代理配置」指向该文件即可；或把生成的 pac.js 提交到仓库用作在线 PAC URL。
