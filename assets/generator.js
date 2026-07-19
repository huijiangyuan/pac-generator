// PAC 生成核心（复刻 gfw-pac 的 CIDR 二进制前缀转换 + Radix Tree 压缩算法）
(function (global) {
  'use strict';

  // 将 CIDR / 单个 IP 转为二进制前缀字符串（与 gfw-pac 的 convert_cidr 等价）
  function cidrToBinary(cidr) {
    cidr = cidr.trim();
    if (!cidr) return '';
    var hasSlash = cidr.indexOf('/') !== -1;
    var addr = cidr, prefixLen = null;
    if (hasSlash) {
      var parts = cidr.split('/');
      addr = parts[0];
      prefixLen = parseInt(parts[1], 10);
    }

    // IPv4
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
      var nums = addr.split('.').map(function (n) { return parseInt(n, 10); });
      var intVal = ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
      var bin = intVal.toString(2).padStart(32, '0');
      var len = (prefixLen === null) ? 32 : prefixLen;
      return bin.slice(0, len);
    }

    // IPv6
    if (/^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(addr) || addr.indexOf('::') !== -1) {
      var groups = expandIPv6(addr);
      if (!groups) return '';
      var big = BigInt(0);
      for (var i = 0; i < 8; i++) {
        big = (big << BigInt(16)) | BigInt(parseInt(groups[i] || '0', 16));
      }
      var bin6 = big.toString(2).padStart(128, '0');
      var len6 = (prefixLen === null) ? 128 : prefixLen;
      return bin6.slice(0, len6);
    }

    return '';
  }

  function expandIPv6(addr) {
    var parts = addr.split('::');
    var left = parts[0] ? parts[0].split(':') : [];
    var right = parts[1] ? parts[1].split(':') : [];
    var zeroGroups = 8 - (left.length + right.length);
    if (zeroGroups < 0) return null;
    var full = left.concat(new Array(zeroGroups).fill('0')).concat(right);
    return full;
  }

  // 与 gfw-pac 的压缩逻辑等价：按 (长度, 字典序) 排序，相同长度且公共前缀≥80% 时用 ~ 压缩
  function compressCidrs(list) {
    var sorted = list.slice().sort(function (a, b) {
      if (a.length !== b.length) return a.length - b.length;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    var out = sorted.slice();
    var lastFull = '';
    for (var i = 0; i < sorted.length; i++) {
      var cur = sorted[i];
      var prev = i > 0 ? sorted[i - 1] : '';
      if (prev.length !== cur.length) {
        lastFull = cur;
        continue;
      }
      var p = 0, min = Math.min(lastFull.length, cur.length);
      while (p < min && lastFull[p] === cur[p]) p++;
      if (p < lastFull.length * 0.8) {
        lastFull = cur;
        continue;
      }
      out[i] = '~' + cur.slice(p);
    }
    return out;
  }

  function buildProxyString(proxies, fallbackDirect) {
    var typeMap = { http: 'PROXY', https: 'HTTPS', socks4: 'SOCKS', socks5: 'SOCKS5' };
    var parts = [];
    (proxies || []).forEach(function (p) {
      if (!p || !p.host || !p.port) return;
      var t = typeMap[p.type] || 'PROXY';
      parts.push(t + ' ' + p.host + ':' + p.port);
    });
    if (parts.length === 0) return 'DIRECT';
    if (fallbackDirect) parts.push('DIRECT');
    return parts.join('; ');
  }

  function parseProxyText(text) {
    // 支持 socks5://127.0.0.1:1080 / 127.0.0.1:7890 / http://1.2.3.4:8080 等格式
    var result = [];
    (text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var type = 'http', host = line, port = '';
      var m = line.match(/^([a-zA-Z0-9]+):\/\/(.+)$/);
      if (m) {
        var scheme = m[1].toLowerCase();
        if (['http', 'https', 'socks', 'socks4', 'socks5'].indexOf(scheme) !== -1) {
          type = scheme === 'socks' ? 'socks4' : scheme;
          host = m[2];
        }
      }
      var hm = host.match(/^([^:]+):(\d+)$/);
      if (hm) { host = hm[1]; port = hm[2]; }
      if (host && port) result.push({ type: type, host: host, port: port });
    });
    return result;
  }

  function buildCidrsLiteral(cnListText) {
    var raw = (cnListText || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var bins = [];
    for (var i = 0; i < raw.length; i++) {
      var b = cidrToBinary(raw[i]);
      if (b) bins.push(b);
    }
    var compressed = compressCidrs(bins);
    return "'" + compressed.join(',') + "'.split(',')";
  }

  function generatePAC(opts) {
    opts = opts || {};
    var proxyStr = buildProxyString(opts.proxies, opts.fallbackDirect !== false);
    var cidrsLiteral = buildCidrsLiteral(opts.cnList || (global.CN_IP_LIST || ''));
    var proxiesArr = (opts.proxies || [])
      .filter(function (p) { return p && p.host && p.port; })
      .map(function (p) { return { type: p.type || 'http', host: p.host, port: p.port }; });

    var template = global.PAC_TEMPLATE || '';
    var map = {
      '__PROXY__': JSON.stringify(proxyStr),
      '__PROXIES__': JSON.stringify(proxiesArr),
      '__AUTO_NET__': opts.autoNet ? 'true' : 'false',
      '__FALLBACK_DIRECT__': opts.fallbackDirect !== false ? 'true' : 'false',
      '__DOMAINS__': JSON.stringify(opts.proxyDomains || [], null, 0),
      '__DIRECT_DOMAINS__': JSON.stringify(opts.directDomains || [], null, 0),
      '__LOCAL_TLDS__': JSON.stringify(opts.localTlds || [], null, 0),
      '__CIDRS__': cidrsLiteral,
      '__DEBUG__': opts.debug ? 'true' : 'false',
      '__CHINA_DIRECT__': opts.chinaDirect !== false ? 'true' : 'false',
      '__PRIVATE_DIRECT__': opts.privateDirect !== false ? 'true' : 'false',
      '__LOCAL_DIRECT__': opts.localDirect !== false ? 'true' : 'false',
      '__FOREIGN_PROXY__': opts.foreignProxy !== false ? 'true' : 'false'
    };
    var out = template;
    Object.keys(map).forEach(function (key) {
      // 占位符可能出现多次（如 __PRIVATE_DIRECT__ 在 host/ip 两处），全部替换
      out = out.split(key).join(String(map[key]));
    });
    return out;
  }

  global.PACGenerator = {
    cidrToBinary: cidrToBinary,
    compressCidrs: compressCidrs,
    buildProxyString: buildProxyString,
    parseProxyText: parseProxyText,
    buildCidrsLiteral: buildCidrsLiteral,
    generatePAC: generatePAC
  };
})(window);
