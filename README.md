# PAC 在线生成器

> 🌐 **在线使用（免安装，直接打开）**：**[https://huijiangyuan.github.io/pac-generator/](https://huijiangyuan.github.io/pac-generator/)**
>
> 纯前端工具，打开即用，所有生成都在浏览器本地完成，不上传任何信息。

一个纯前端的 **PAC（Proxy Auto-Config）在线生成工具**，改造自 [gfw-pac](https://github.com/zhiyi7/gfw-pac)。

特点：

- 🌐 **自动分流**：国内 IP 段（内置 5823 条 IPv4/IPv6）、私有 IP（10/172.16-31/192.168/127/169.254 等）、本地地址直连；其余国外流量走代理。
- 🔁 **多代理故障转移（自动轮询可用代理）**：填写多个代理，生成的 PAC 形如 `SOCKS5 127.0.0.1:1080; PROXY 1.2.3.4:7890; DIRECT`，系统/浏览器会按顺序自动尝试，不可用时自动切换下一个。
- 🎛️ **灵活规则**：可开关「中国 IP 直连 / 私有 IP 直连 / 本地直连 / 国外走代理」，自定义走代理与直连域名，支持子域通配。
- ⚡ **Radix Tree 匹配**：沿用 gfw-pac 的二进制前缀 + Radix Tree 算法，O(32)/O(128) 时间复杂度，全平台（Win/Mac/Linux/iOS/Android + Chrome/Edge/Firefox）兼容，脚本为 ES5。
- 🔒 **纯本地**：所有生成均在浏览器完成，不上传任何信息。

## 使用

1. 打开在线站点：**[https://huijiangyuan.github.io/pac-generator/](https://huijiangyuan.github.io/pac-generator/)**（或本地双击 `index.html`）。
2. 在「① 代理服务器」填写你的代理（支持 `socks5://127.0.0.1:1080`、`127.0.0.1:7890`、`https://1.2.3.4:8080` 批量粘贴）。
3. 按需调整路由规则与自定义域名。
4. 点击「下载 pac.js」，把文件指向系统/浏览器的自动代理配置；或点「🚀 一键托管到 GitHub Gist」拿到永久直链。

详细步骤见站点内「如何使用生成的 PAC？」折叠区。

## 一键托管到 GitHub Gist（返回永久直链）

不想自己找空间托管？生成后点「🚀 一键托管到 GitHub Gist」即可：

1. 在 [GitHub Token 创建页](https://github.com/settings/tokens/new) 生成一个 **Personal Access Token (classic)** —— ⚠️ 必须是 **classic**，细粒度 Token 不支持 gist 权限，用了会 401 失败。
2. Note 取个名、Expiration 选期限，**权限只勾 `gist` 一项**（托管 PAC 唯一需要的，别勾其他）。生成后立刻复制保存。
3. 把 Token 填进站点的 Token 框并点「保存」——**Token 仅存浏览器 localStorage，只发往 `api.github.com`，绝不上传别处**；泄露后去 Tokens 页 Revoke 即可，已生成的直链不受影响。
4. 点「🚀 一键托管」：工具会把 `pac.js` 创建为一个**私密 Gist**，并返回一条直链 `https://gist.githubusercontent.com/<你>/<id>/raw/pac.js`。
5. 把这条直链填进系统 / 浏览器的「自动代理配置 URL」（或 SwitchyOmega 的 PAC 模式）即可。
6. **再次点击会更新同一个 Gist，直链 URL 保持不变**——以后改了代理规则，只要重新点一下托管，之前填的 URL 依然有效。

> 说明：Gist 设为私密（不公开列出），但任何拿到直链的人都能访问，请勿把直链发给不信任的人。直链由 GitHub 的 `gist.githubusercontent.com` 提供，绝大多数系统/浏览器客户端可直接使用；个别严格客户端要求 `application/x-ns-proxy-autoconfig` 类型时，可改走 jsDelivr 等带正确 MIME 的 CDN。

## 代理填写：协议说明 & 常用工具对照

### 故障转移链的排序规则

生成的 PAC 会按以下优先级把代理排成故障转移链（浏览器/系统按顺序尝试，连不上自动跳下一个）：

1. **本机回环代理（`127.0.0.1` / `localhost` / `::1`）永远最前** —— 永远可达、延迟最低。
2. 开启「按当前网络自动优选代理」时，**与本机同网段的代理**（如家里 `192.168.31.x`、公司 `192.168.1.x`）次之。
3. 其余代理按你填写的顺序排列，末尾可追加 `DIRECT` 兜底。

> 嫌手填麻烦？站点「① 代理服务器」卡片里有 **Clash / V2RayN / Shadowsocks / sing-box 一键添加** 按钮，自动填好本机地址与默认端口；也有「批量粘贴」支持 `socks5://127.0.0.1:1080` 等格式。

### 四种协议模式

| 模式 | PAC 关键字 | 说明 | 何时用 |
|------|-----------|------|--------|
| **HTTP** | `PROXY` | 最基础、兼容性最好。浏览器把请求交给代理代为访问，仅 TCP。 | 绝大多数本地软件（Clash/V2Ray）都开放 HTTP 端口，**PAC 里最常用、最稳**。 |
| **HTTPS** | `HTTPS` | “CONNECT 隧道代理”，先与代理建立 TLS 加密通道再传请求，代理看不到明文。 | 本机 `127.x` 一般没必要；多用于**远端代理服务器**之间。 |
| **SOCKS4** | `SOCKS` | 古老协议：仅 IPv4、无认证、不支持 UDP，基本已被淘汰。 | 除非老软件只支持它，否则不要用。 |
| **SOCKS5** | `SOCKS5` | 现代 SOCKS：支持 IPv4/IPv6、UDP（游戏/视频/QUIC 需要）、可选认证。 | 本地软件几乎都优先提供，**最通用**；需要 UDP 时必选。 |

### 常用代理软件怎么填

| 软件 | 推荐协议 | 常见端口 | 填写示例 |
|------|---------|---------|---------|
| Clash / Clash Verge / mihomo | HTTP 或 SOCKS5 | 7890(HTTP) / 7891(SOCKS5) | `127.0.0.1:7890` 选 http |
| V2Ray / V2RayN | SOCKS5 或 HTTP | 10808(SOCKS5) / 10809(HTTP) | `127.0.0.1:10808` 选 socks5 |
| Shadowsocks (SS) | SOCKS5 | 1080 | `127.0.0.1:1080` 选 socks5 |
| ShadowsocksR (SSR) | SOCKS5 | 1080 | `127.0.0.1:1080` 选 socks5 |
| Trojan / Trojan-Go | SOCKS5 或 HTTP | 通常 1080 | `127.0.0.1:1080` 选 socks5 |
| sing-box | HTTP / SOCKS5 / mixed | 20171(HTTP)/20172(SOCKS5)/20170(mixed) | `127.0.0.1:20172` 选 socks5 |
| ClashX (macOS) | HTTP | 7890 | `127.0.0.1:7890` 选 http |
| NekoBox / Hiddify | SOCKS5 / mixed | 2080 / mixed | 看软件设置页端口 |

> 注：**mixed 端口**同时接受 HTTP 与 SOCKS5，填哪种协议都行；具体端口以你软件「设置 / 端口」页显示为准。直接粘贴 `socks5://127.0.0.1:1080` 也能自动识别类型与端口。

## 原理

`FindProxyForURL` 判定顺序：

1. 命中「走代理域名」→ 代理链
2. 命中「直连域名」→ DIRECT
3. 本地主机名 / localhost / 本地 TLD → DIRECT
4. 私有 IP → DIRECT
5. 域名解析后：私有 IP → DIRECT；命中中国 IP 段 → DIRECT
6. 其余 → 代理链（不可用时按 PAC 故障转移自动跳下一个，末尾可兜底 DIRECT）

## 部署（GitHub Pages）

本仓库已通过 GitHub Pages 部署，可直接访问：**[https://huijiangyuan.github.io/pac-generator/](https://huijiangyuan.github.io/pac-generator/)**

如需自行部署：仓库根目录即站点根目录，推送到 `main` 并在仓库 Settings → Pages 选择 `main` 分支 `/` 根目录即可；也可直接将本仓库内容托管到任意静态空间（Vercel / Netlify / 对象存储等）。

## 数据更新

`.github/workflows/update-cn-ip.yml` 每周自动从 [Loyalsoldier/geoip](https://github.com/Loyalsoldier/geoip) 拉取最新 `cn.txt` 并更新 `assets/cn-ip-list.js`。也可在页面内「从远程更新」框填入 `cn.txt` 地址即时刷新（仅本次会话生效）。

## 许可

基于 [gfw-pac](https://github.com/zhiyi7/gfw-pac)（MIT）改造。
