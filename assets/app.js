// PAC 在线生成器 · 前端交互逻辑
(function () {
  'use strict';

  // ---------- 主题 ----------
  var THEME_KEY = 'pac-theme';
  function applyTheme(t) {
    if (t === 'system') {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    document.querySelectorAll('#themeSwitch button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-theme') === t);
    });
  }
  var savedTheme = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(savedTheme);
  document.querySelectorAll('#themeSwitch button').forEach(function (b) {
    b.addEventListener('click', function () {
      savedTheme = b.getAttribute('data-theme');
      localStorage.setItem(THEME_KEY, savedTheme);
      applyTheme(savedTheme);
    });
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (savedTheme === 'system') applyTheme('system');
    });
  }

  // ---------- 代理状态 ----------
  var proxies = [
    { type: 'socks5', host: '127.0.0.1', port: '1080' },
    { type: 'http', host: '192.168.1.1', port: '7890' }
  ];
  var TYPES = ['http', 'https', 'socks4', 'socks5'];

  var proxyListEl = document.getElementById('proxyList');
  function renderProxies() {
    proxyListEl.innerHTML = '';
    proxies.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'proxy-row';
      var opts = TYPES.map(function (t) {
        return '<option value="' + t + '"' + (t === p.type ? ' selected' : '') + '>' + t + '</option>';
      }).join('');
      row.innerHTML =
        '<select data-i="' + i + '" data-k="type">' + opts + '</select>' +
        '<input data-i="' + i + '" data-k="host" placeholder="地址 / 域名" value="' + escapeAttr(p.host) + '" />' +
        '<input data-i="' + i + '" data-k="port" placeholder="端口" value="' + escapeAttr(p.port) + '" />' +
        '<button class="rm" data-i="' + i + '" title="删除">×</button>';
      proxyListEl.appendChild(row);
    });
  }
  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }

  proxyListEl.addEventListener('input', function (e) {
    var t = e.target;
    var i = t.getAttribute('data-i');
    var k = t.getAttribute('data-k');
    if (i == null || k == null) return;
    proxies[+i][k] = t.value;
    regenerate();
  });
  proxyListEl.addEventListener('click', function (e) {
    if (e.target.classList.contains('rm')) {
      proxies.splice(+e.target.getAttribute('data-i'), 1);
      renderProxies();
      regenerate();
    }
  });
  document.getElementById('addProxy').addEventListener('click', function () {
    proxies.push({ type: 'socks5', host: '', port: '' });
    renderProxies();
    regenerate();
  });

  // 批量粘贴
  var bulkBox = document.getElementById('bulkBox');
  document.getElementById('bulkBtn').addEventListener('click', function () {
    bulkBox.style.display = bulkBox.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('bulkCancel').addEventListener('click', function () { bulkBox.style.display = 'none'; });
  document.getElementById('bulkApply').addEventListener('click', function () {
    var parsed = PACGenerator.parseProxyText(document.getElementById('bulkText').value);
    if (parsed.length) {
      proxies = proxies.concat(parsed);
      renderProxies();
      regenerate();
      toast('已添加 ' + parsed.length + ' 个代理');
    } else {
      toast('未解析到有效代理');
    }
    bulkBox.style.display = 'none';
  });

  // 常用工具一键添加：避免手填协议/端口出错
  var TOOL_PRESETS = {
    clash:   { type: 'http',   host: '127.0.0.1', port: '7890' },
    v2ray:   { type: 'socks5', host: '127.0.0.1', port: '10808' },
    ss:      { type: 'socks5', host: '127.0.0.1', port: '1080' },
    singbox: { type: 'socks5', host: '127.0.0.1', port: '20172' }
  };
  function hasProxy(p) {
    return proxies.some(function (x) { return x.host === p.host && x.port === p.port; });
  }
  document.querySelectorAll('.chip[data-tool]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var preset = TOOL_PRESETS[btn.getAttribute('data-tool')];
      if (!preset) return;
      if (!hasProxy(preset)) {
        proxies.push({ type: preset.type, host: preset.host, port: preset.port });
        renderProxies();
        regenerate();
        toast('已添加 ' + preset.host + ':' + preset.port + ' (' + preset.type + ')');
      } else {
        toast('该代理已存在');
      }
    });
  });
  document.getElementById('clearProxy').addEventListener('click', function () {
    proxies = [];
    renderProxies();
    regenerate();
    toast('已清空代理列表');
  });

  // ---------- 域名默认值 ----------
  document.getElementById('proxyDomains').value = (window.DEFAULT_PROXY_DOMAINS || []).join('\n');
  document.getElementById('directDomains').value = (window.DEFAULT_DIRECT_DOMAINS || []).join('\n');
  document.getElementById('localTlds').value = (window.DEFAULT_LOCAL_TLDS || []).join('\n');

  function lines(id) {
    return document.getElementById(id).value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function bool(id) { return document.getElementById(id).checked; }

  // ---------- 生成 ----------
  var lastPAC = '';
  function regenerate() {
    var opts = {
      proxies: proxies,
      fallbackDirect: bool('fallbackDirect'),
      autoNet: bool('autoNet'),
      directDomains: lines('directDomains'),
      proxyDomains: lines('proxyDomains'),
      localTlds: lines('localTlds'),
      cnList: window.CN_IP_LIST || '',
      debug: bool('debug'),
      chinaDirect: bool('chinaDirect'),
      privateDirect: bool('privateDirect'),
      localDirect: bool('localDirect'),
      foreignProxy: bool('foreignProxy')
    };
    var pac = PACGenerator.generatePAC(opts);
    lastPAC = pac;
    renderPreview(pac, proxies.filter(function (p) { return p.host && p.port; }).length);
  }

  function renderPreview(pac, proxyCount) {
    var preview = document.getElementById('preview');
    preview.innerHTML = highlight(pac);
    var bytes = new Blob([pac]).size;
    var cnCount = (window.CN_IP_LIST || '').split(/\r?\n/).filter(Boolean).length;
    document.getElementById('stats').innerHTML =
      stat('PAC 体积', (bytes / 1024).toFixed(1) + ' KB') +
      stat('中国 IP 段', cnCount + ' 条') +
      stat('代理数量', proxyCount + ' 个') +
      stat('类型', 'ES5 / 全平台');
  }
  function stat(k, v) {
    return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function highlight(code) {
    var h = escapeHtml(code);
    h = h.replace(/('[^']*'|"[^"]*")/g, '<span class="str">$1</span>');
    h = h.replace(/\b(var|function|return|if|else|for|new|true|false|null)\b/g, '<span class="kw">$1</span>');
    return h;
  }

  // ---------- 工具栏：复制 / 下载 ----------
  document.getElementById('downloadBtn').addEventListener('click', function () {
    if (!lastPAC) return;
    var blob = new Blob([lastPAC], { type: 'application/x-ns-proxy-autoconfig' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'pac.js';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已下载 pac.js');
  });
  document.getElementById('copyBtn').addEventListener('click', function () {
    copyText(lastPAC, '已复制完整 PAC');
  });
  document.getElementById('copyProxyBtn').addEventListener('click', function () {
    var m = lastPAC.match(/var proxy = (".*?");/);
    copyText(m ? JSON.parse(m[1]) : '', '已复制代理串');
  });
  function copyText(text, msg) {
    if (!text) { toast('暂无可复制内容'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(msg); }, function () { fallbackCopy(text, msg); });
    } else { fallbackCopy(text, msg); }
  }
  function fallbackCopy(text, msg) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(msg); } catch (e) { toast('复制失败'); }
    ta.remove();
  }

  // ---------- 远程更新中国 IP 列表 ----------
  document.getElementById('reloadCnBtn').addEventListener('click', function () {
    var url = document.getElementById('cnUrl').value.trim();
    var status = document.getElementById('cnStatus');
    if (!url) { status.textContent = '请先填写远程 cn.txt 地址（如 Loyalsoldier/geoip 的 release 文件）。'; return; }
    status.textContent = '正在下载并更新…';
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (txt) {
      var n = txt.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).length;
      window.CN_IP_LIST = txt;
      regenerate();
      status.textContent = '✅ 已更新为 ' + n + ' 条（本次会话生效）。';
      toast('中国 IP 列表已更新');
    }).catch(function (e) {
      status.textContent = '❌ 更新失败：' + e.message + '（可能是跨域限制，建议下载后替换本地文件）';
    });
  });

  // 输入框变化时实时刷新
  ['proxyDomains', 'directDomains', 'localTlds', 'fallbackDirect', 'autoNet', 'chinaDirect',
   'privateDirect', 'localDirect', 'foreignProxy', 'debug'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', regenerate);
    el.addEventListener('change', regenerate);
  });

  // ---------- Toast ----------
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  // ---------- 一键托管到 GitHub Gist ----------
  var GIST_TOKEN_KEY = 'pac-gist-token';
  var GIST_ID_KEY = 'pac-gist-id';
  var GIST_URL_KEY = 'pac-gist-url';
  var gistTokenEl = document.getElementById('gistToken');
  var gistId = localStorage.getItem(GIST_ID_KEY) || '';
  gistTokenEl.value = localStorage.getItem(GIST_TOKEN_KEY) || '';
  if (localStorage.getItem(GIST_URL_KEY)) {
    document.getElementById('gistUrl').value = localStorage.getItem(GIST_URL_KEY);
    document.getElementById('gistUrlWrap').style.display = 'block';
    document.getElementById('gistCopy').style.display = '';
    setGistStatus('已托管过，再次点击将更新同一 Gist（URL 不变）', false);
  }
  function setGistStatus(msg, isErr) {
    var el = document.getElementById('gistStatus');
    el.textContent = msg;
    el.style.color = isErr ? 'var(--danger)' : 'var(--ok)';
  }
  document.getElementById('gistSave').addEventListener('click', function () {
    var t = gistTokenEl.value.trim();
    if (!t) { localStorage.removeItem(GIST_TOKEN_KEY); toast('已清除本地 Token'); return; }
    localStorage.setItem(GIST_TOKEN_KEY, t);
    toast('Token 已保存到本地');
  });
  document.getElementById('gistHost').addEventListener('click', function () {
    var token = (gistTokenEl.value || localStorage.getItem(GIST_TOKEN_KEY) || '').trim();
    if (!token) { setGistStatus('请先填写 GitHub Token 并点「保存」（需 gist 权限）', true); return; }
    if (!lastPAC) { toast('暂无可托管内容'); return; }
    var btn = document.getElementById('gistHost');
    btn.disabled = true; setGistStatus('正在托管…', false);
    var headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    var url, body;
    if (gistId) {
      url = 'https://api.github.com/gists/' + gistId;
      body = JSON.stringify({ files: { 'pac.js': { content: lastPAC } } });
    } else {
      url = 'https://api.github.com/gists';
      body = JSON.stringify({
        description: 'PAC 自动配置文件（由 PAC 在线生成器生成）',
        public: false,
        files: { 'pac.js': { content: lastPAC } }
      });
    }
    fetch(url, { method: gistId ? 'PATCH' : 'POST', headers: headers, body: body })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error((e && e.message) || ('HTTP ' + r.status)); });
        return r.json();
      })
      .then(function (data) {
        var raw = data.files && data.files['pac.js'] && data.files['pac.js'].raw_url;
        // 去掉版本段，得到稳定直链（始终指向最新内容）
        if (raw) raw = raw.replace(/\/raw\/[^/]+?\//, '/raw/');
        gistId = data.id;
        localStorage.setItem(GIST_ID_KEY, gistId);
        if (raw) {
          localStorage.setItem(GIST_URL_KEY, raw);
          document.getElementById('gistUrl').value = raw;
          document.getElementById('gistUrlWrap').style.display = 'block';
          document.getElementById('gistCopy').style.display = '';
        }
        setGistStatus(gistId ? '✅ 已更新同一 Gist，直链保持不变' : '✅ 已创建 Gist，直链如下（再次点击会更新同一 Gist）', false);
        toast('托管成功');
      })
      .catch(function (e) {
        var msg = e.message || String(e);
        if (/401/.test(msg)) msg = 'Token 无效或无 gist 权限，请重新生成（需勾选 gist 范围）';
        else if (/403/.test(msg)) msg = '请求被拒（可能 Token 无 gist 权限或触发限流）';
        else if (/Failed to fetch/.test(msg)) msg = '网络 / CORS 错误：请确认能访问 api.github.com';
        setGistStatus('❌ ' + msg, true);
      })
      .finally(function () { btn.disabled = false; });
  });
  document.getElementById('gistCopy').addEventListener('click', function () {
    copyText(document.getElementById('gistUrl').value, '已复制 PAC 直链');
  });

  // ---------- 启动 ----------
  renderProxies();
  regenerate();
})();
