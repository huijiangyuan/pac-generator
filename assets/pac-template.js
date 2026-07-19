// PAC 模板（改造自 https://github.com/zhiyi7/gfw-pac ，遵循其 Radix Tree + 二进制前缀压缩算法）
// 占位符在生成时由 app.js 替换：
//   __PROXY__         代理故障转移链，如 "SOCKS5 127.0.0.1:1080; PROXY 1.2.3.4:7890; DIRECT"
//   __DOMAINS__       走代理的域名数组 (JSON)
//   __DIRECT_DOMAINS__ 直连的域名数组 (JSON)
//   __LOCAL_TLDS__    本地 TLD 数组 (JSON)
//   __CIDRS__         压缩后的中国 IP 二进制前缀数组字面量
//   __DEBUG__         true/false 是否弹窗调试
window.PAC_TEMPLATE = `var proxy = __PROXY__;

var proxyList = __PROXIES__;

var autoNet = __AUTO_NET__;

var fallbackDirect = __FALLBACK_DIRECT__;

var _proxyCache = null;

var typeMap = { http: 'PROXY', https: 'HTTPS', socks4: 'SOCKS', socks5: 'SOCKS5' };

// 判断两个 IPv4 是否处于同一局域子网（用于“按当前网络自动优选代理”）
function inSameLan(ip, ref) {
    if (!/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(ip) || !/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(ref)) return false;
    var a = ip.split('.'), b = ref.split('.');
    var pa = +a[0], pb = +b[0];
    if (pa === 10 && pb === 10) return true;
    if (pa === 172 && pb === 172) {
        var xa = +a[1], xb = +b[1];
        if (xa >= 16 && xa <= 31 && xb >= 16 && xb <= 31) return a[1] === b[1];
        return false;
    }
    if (pa === 192 && a[1] === '168' && pb === 192 && b[1] === '168') return a[2] === b[2];
    return false;
}

// 判断是否为本机回环地址（localhost / 127.x / ::1）——这类代理永远可达、最优先
function isLoopback(host) {
    return host === 'localhost' || host === '::1' || /^127(\\.\\d{1,3}){3}$/.test(host);
}

// 动态构建代理链：
//   1) 本机回环代理（127.x / localhost）永远排最前——永远可达、延迟最低；
//   2) 开启自动优选时，与本机同网段的代理（如家里/公司 LAN）次之；
//   3) 其余代理最后。结果缓存一次复用。
function getProxy() {
    if (_proxyCache !== null) return _proxyCache;
    try {
        var myIp = autoNet ? myIpAddress() : null;
        var local = [], matched = [], rest = [];
        for (var i = 0; i < proxyList.length; i++) {
            var p = proxyList[i];
            if (isLoopback(p.host)) local.push(p);
            else if (autoNet && isIpAddress(p.host) && inSameLan(myIp, p.host)) matched.push(p);
            else rest.push(p);
        }
        var ordered = local.concat(matched, rest);
        var parts = [];
        for (var j = 0; j < ordered.length; j++) {
            var q = ordered[j];
            var t = typeMap[q.type] || 'PROXY';
            parts.push(t + ' ' + q.host + ':' + q.port);
        }
        if (fallbackDirect) parts.push('DIRECT');
        _proxyCache = parts.join('; ');
    } catch (e) {
        _proxyCache = proxy;
    }
    return _proxyCache;
}

var direct = 'DIRECT';

var directDomains = __DIRECT_DOMAINS__;

var domainsUsingProxy = __DOMAINS__;

var localTlds = __LOCAL_TLDS__;

var cidrs = __CIDRS__;

var allowAlert = __DEBUG__;

function isIpAddress(ip) {
    return /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(ip) || /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(ip);
}

function RadixTree() {
    this.root = new Map();
}

RadixTree.prototype.insert = function(string) {
    var node = this.root;
    for (var i = 0; i < string.length; i++) {
        var char = string[i];
        if (!node.has(char)) {
            node.set(char, new Map());
        }
        node = node.get(char);
    }
};

RadixTree.prototype.search = function(string) {
    var currentNode = this.root;
    var isLastNode = false;
    for (var i=0; i < string.length; i++) {
        var char = string[i];
        if (currentNode.has(char)) {
            currentNode = currentNode.get(char);
            isLastNode = currentNode.size === 0;
        } else {
            break;
        }
    }
    return isLastNode;
}

function ipToBinary(ip) {
    var bin = ''
    // Check if it's IPv4
    if (/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(ip)) {
        bin = ip.split('.').map(function(num) {
            return ("00000000" + parseInt(num, 10).toString(2)).slice(-8);
        }).join('');
    } else if (/^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(ip)) {
        // Expand the IPv6 address if it contains '::'
        var parts = ip.split('::');
        var left = parts[0] ? parts[0].split(':') : [];
        var right = parts[1] ? parts[1].split(':') : [];

        // Calculate the number of zero groups to insert
        var zeroGroups = 8 - (left.length + right.length);

        // Create the full address by inserting zero groups
        var fullAddress = left.concat(Array(zeroGroups + 1).join('0').split('')).concat(right);

        // Convert each group to binary and pad to 16 bits
        bin = fullAddress.map(function(group) {
            return ("0000000000000000" + parseInt(group || '0', 16).toString(2)).slice(-16);
        }).join('');
    }
    // 不要删除前导零！保持完整的二进制字符串以便与CIDR前缀匹配
    return bin;
}

function isInDirectDomain(host) {
    for (var i = 0; i < directDomains.length; i++) {
        var domain = directDomains[i];
        if (host === domain || host.endsWith('.' + domain)) {
            return true;
        }
    }
    return false;
}

function isInProxyDomain(host) {
    for (var i = 0; i < domainsUsingProxy.length; i++) {
        var domain = domainsUsingProxy[i];
        if (host === domain || host.endsWith('.' + domain)) {
            return true;
        }
    }
    return false;
}

function isLocalTestDomain(domain) {
    // Chrome uses .test as testing gTLD.
    var tld = domain.substring(domain.lastIndexOf('.'));
    if (tld === domain) {
        return false;
    }
    return localTlds.some(function(localTld) {
        return tld === localTld;
    });
}

/* https://github.com/frenchbread/private-ip */
function isPrivateIp(ip) {
    return /^(::f{4}:)?10\\.([0-9]{1,3})\\.([0-9]{1,3})\\.([0-9]{1,3})$/i.test(ip) ||
        /^(::f{4}:)?192\\.168\\.([0-9]{1,3})\\.([0-9]{1,3})$/i.test(ip) ||
        /^(::f{4}:)?172\\.(1[6-9]|2\\d|30|31)\\.([0-9]{1,3})\\.([0-9]{1,3})$/i.test(ip) ||
        /^(::f{4}:)?127\\.([0-9]{1,3})\\.([0-9]{1,3})\\.([0-9]{1,3})$/i.test(ip) ||
        /^(::f{4}:)?169\\.254\\.([0-9]{1,3})\\.([0-9]{1,3})$/i.test(ip) ||
        /^f[cd][0-9a-f]{2}:/i.test(ip) ||
        /^fe80:/i.test(ip) ||
        /^::1$/.test(ip) ||
        /^::$/.test(ip);
}

function FindProxyForURL(url, host) {
    if (isInDirectDomain(host)) {
        debug('命中直连域名', host, 'N/A');
        return direct;
    } else if (isInProxyDomain(host)) {
        debug('命中代理域名', host, 'N/A');
        return getProxy();
    } else if (__LOCAL_DIRECT__ && (isPlainHostName(host) || host === 'localhost' || isLocalTestDomain(host))) {
        debug('命中本地主机名或本地tld', host, 'N/A');
        return direct;
    } else if (__PRIVATE_DIRECT__ && isPrivateIp(host)) {
        debug('命中私有 IP 地址', host, 'N/A');
        return direct;
    }

    ip = isIpAddress(host) ? host : dnsResolve(host);

    if (!ip) {
        debug('无法解析 IP 地址', host, 'N/A');
        return getProxy();
    } else if (__PRIVATE_DIRECT__ && isPrivateIp(ip)) {
        debug('域名解析后命中私有 IP 地址', host, ip);
        return direct;
    } else if (__CHINA_DIRECT__ && radixTree.search(ipToBinary(ip))) {
        debug('匹配到直连IP', host, ip);
        return direct;
    }

    debug('未命中任何规则', host, ip);
    return __FOREIGN_PROXY__ ? getProxy() : direct;
}

function debug(msg, host='', ip='') {
    if (!allowAlert) {
        return
    }
    try {
        alert('[' + host + ' -> ' + ip + '] ' + msg);
    } catch (e) {
        allowAlert = false
    }
}

var radixTree = new RadixTree();

(function () {
    debug('开始生成 Radix Tree', 'PAC文件载入开始');
    var lastFullPrefix = '';
    for (var i = 0; i < cidrs.length; i++) {
        var prefix = cidrs[i];
        // 解压缩：如果以~开头，则从lastFullPrefix中还原
        if (prefix.substring(0, 1) !== '~') {
            lastFullPrefix = prefix;
        } else {
            // 计算公共前缀长度
            var suffix = prefix.substring(1);
            var prefixLen = lastFullPrefix.length - suffix.length;
            prefix = lastFullPrefix.substring(0, prefixLen) + suffix;
        }
        // 直接使用二进制字符串插入（无需转换）
        radixTree.insert(prefix);
    }
    debug('Radix Tree 已生成', 'PAC文件载入完毕', cidrs.length.toString() + '个CIDR条目');
})();
`;
