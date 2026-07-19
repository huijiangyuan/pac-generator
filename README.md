# PAC 在线生成器

一个纯前端的 **PAC（Proxy Auto-Config）在线生成工具**，改造自 [gfw-pac](https://github.com/zhiyi7/gfw-pac)。

特点：

- 🌐 **自动分流**：国内 IP 段（内置 5823 条 IPv4/IPv6）、私有 IP（10/172.16-31/192.168/127/169.254 等）、本地地址直连；其余国外流量走代理。
- 🔁 **多代理故障转移（自动轮询可用代理）**：填写多个代理，生成的 PAC 形如 `SOCKS5 127.0.0.1:1080; PROXY 1.2.3.4:7890; DIRECT`，系统/浏览器会按顺序自动尝试，不可用时自动切换下一个。
- 🎛️ **灵活规则**：可开关「中国 IP 直连 / 私有 IP 直连 / 本地直连 / 国外走代理」，自定义走代理与直连域名，支持子域通配。
- ⚡ **Radix Tree 匹配**：沿用 gfw-pac 的二进制前缀 + Radix Tree 算法，O(32)/O(128) 时间复杂度，全平台（Win/Mac/Linux/iOS/Android + Chrome/Edge/Firefox）兼容，脚本为 ES5。
- 🔒 **纯本地**：所有生成均在浏览器完成，不上传任何信息。

## 使用

1. 打开站点（GitHub Pages 或本地 `index.html`）。
2. 在「① 代理服务器」填写你的代理（支持 `socks5://127.0.0.1:1080`、`127.0.0.1:7890`、`https://1.2.3.4:8080` 批量粘贴）。
3. 按需调整路由规则与自定义域名。
4. 点击「下载 pac.js」，把文件指向系统/浏览器的自动代理配置。

详细步骤见站点内「如何使用生成的 PAC？」折叠区。

## 原理

`FindProxyForURL` 判定顺序：

1. 命中「走代理域名」→ 代理链
2. 命中「直连域名」→ DIRECT
3. 本地主机名 / localhost / 本地 TLD → DIRECT
4. 私有 IP → DIRECT
5. 域名解析后：私有 IP → DIRECT；命中中国 IP 段 → DIRECT
6. 其余 → 代理链（不可用时按 PAC 故障转移自动跳下一个，末尾可兜底 DIRECT）

## 部署（GitHub Pages）

仓库根目录即站点根目录，推送到 `main` 并在仓库 Settings → Pages 选择 `main` 分支 `/` 根目录即可。也可直接将本仓库内容托管到任意静态空间。

## 数据更新

`.github/workflows/update-cn-ip.yml` 每周自动从 [Loyalsoldier/geoip](https://github.com/Loyalsoldier/geoip) 拉取最新 `cn.txt` 并更新 `assets/cn-ip-list.js`。也可在页面内「从远程更新」框填入 `cn.txt` 地址即时刷新（仅本次会话生效）。

## 许可

基于 [gfw-pac](https://github.com/zhiyi7/gfw-pac)（MIT）改造。
