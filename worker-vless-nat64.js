// 这是一个Cloudflare Worker脚本，它利用NAT64技术自动填充proxyip。
// 这意味着它可以在仅有IPv6网络的环境下，无需（也不支持）手动设置proxyip，即可访问IPv4的服务器。

// 从Cloudflare的运行时API中导入`connect`函数，用于创建出站TCP套接字连接。
import { connect } from "cloudflare:sockets";

// 定义一个常量，表示WebSocket连接已打开的状态码。
const WS_READY_STATE_OPEN = 1;

// 默认的VLESS用户ID (UUID)。这个值可以被Cloudflare环境变量中的`uuid`覆盖。
let userID = "86c50e3a-5b87-49dd-bd20-03c7f2735e40";

// 一个用于存放域名的数组，目前为空。设计用途可能与反向代理或路由决策相关。
const cn_hostnames = [''];

// 默认的CDN IP或域名，用于生成vless链接。这个值可以被环境变量`cdnip`覆盖。
// 原始代码中使用了Unicode转义序列来隐藏真实值 'www.visa.com.sg'。
let CDNIP = 'www.visa.com.sg';

// --- 预定义的优选IP/域名 ---
// 这些地址用于生成不同节点的配置，可以被环境变量(ip1, ip2, ...)覆盖。
// 它们被分为HTTP和HTTPS两组，对应不同的端口和TLS设置。

// HTTP 节点使用的地址 (通常与非TLS端口配合)
let IP1 = 'www.visa.com';
let IP2 = 'cis.visa.com';
let IP3 = 'africa.visa.com';
let IP4 = 'www.visa.com.sg';
let IP5 = 'www.visaeurope.at';
let IP6 = 'www.visa.com.mt';
let IP7 = 'qa.visamiddleeast.com';

// HTTPS 节点使用的地址 (通常与TLS端口配合)
let IP8 = 'usa.visa.com';
let IP9 = 'myanmar.visa.com';
let IP10 = 'www.visa.com.tw';
let IP11 = 'www.visaeurope.ch';
let IP12 = 'www.visa.com.br';
let IP13 = 'www.visasoutheasteurope.com';

// --- 预定义的端口 ---
// 这些端口同样可以被环境变量(pt1, pt2, ...)覆盖。

// HTTP 端口 (非TLS)
let PT1 = '80';
let PT2 = '8080';
let PT3 = '8880';
let PT4 = '2052';
let PT5 = '2082';
let PT6 = '2086';
let PT7 = '2095';

// HTTPS 端口 (TLS)
let PT8 = '443';
let PT9 = '8443';
let PT10 = '2053';
let PT11 = '2083';
let PT12 = '2087';
let PT13 = '2096';


export default {
  /**
   * Cloudflare Worker的主处理函数，每个进入的请求都会由它处理。
   * @param {Request} request - 传入的HTTP请求对象。
   * @param {object} env - 包含在Cloudflare上配置的环境变量的对象。
   * @param {object} ctx - 请求的执行上下文。
   * @returns {Promise<Response>} - 返回一个Promise，解析为Response对象。
   */
  async fetch(request, env, ctx) {
    try {
      // 使用环境变量中的值覆盖默认配置（如果存在）。
      // 这允许用户在不修改代码的情况下，通过Cloudflare仪表盘自定义配置。
      userID = env.uuid || userID;
      CDNIP = env.cdnip || CDNIP;
	  IP1 = env.ip1 || IP1;
	  IP2 = env.ip2 || IP2;
	  // ... (其他IP和Port的覆盖逻辑)
	  IP13 = env.ip13 || IP13;
	  PT1 = env.pt1 || PT1;
	  // ...
	  PT13 = env.pt13 || PT13;

      // 获取请求头中的'Upgrade'字段，用于判断是否是WebSocket升级请求。
      const upgradeHeader = request.headers.get("Upgrade");
      const url = new URL(request.url);
      
      // 如果请求不是WebSocket升级请求，则作为常规HTTP请求处理。
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        switch (url.pathname) {
          // 如果请求路径是 `/<userID>`，则返回配置信息的HTML页面。
          case `/${userID}`: {
            const vlessConfig = getVLESSConfig(userID, request.headers.get("Host"));
            return new Response(vlessConfig, {
              status: 200,
              headers: { "Content-Type": "text/html;charset=utf-8" },
            });
          }
		  // 如果请求路径是 `/<userID>/ty`，则返回通用的Base64编码的订阅内容。
		  case `/${userID}/ty`: {
			const tyConfig = gettyConfig(userID, request.headers.get('Host'));
			return new Response(tyConfig, {
				status: 200,
				headers: { "Content-Type": "text/plain;charset=utf-8" }
			});
		  }
		  // 如果请求路径是 `/<userID>/cl`，则返回Clash-meta格式的订阅内容。
		  case `/${userID}/cl`: {
			const clConfig = getclConfig(userID, request.headers.get('Host'));
			return new Response(clConfig, {
				status: 200,
				headers: { "Content-Type": "text/plain;charset=utf-8" }
			});
		  }
		  // 如果请求路径是 `/<userID>/sb`，则返回Sing-box格式的订阅内容。
		  case `/${userID}/sb`: {
			const sbConfig = getsbConfig(userID, request.headers.get('Host'));
			return new Response(sbConfig, {
				status: 200,
				headers: { "Content-Type": "application/json;charset=utf-8" }
			});
		  }
		  // 以下是仅包含TLS节点的订阅链接
		  case `/${userID}/pty`: {
			const ptyConfig = getptyConfig(userID, request.headers.get('Host'));
			return new Response(ptyConfig, {
				status: 200,
				headers: { "Content-Type": "text/plain;charset=utf-8" }
			});
		  }
		  case `/${userID}/pcl`: {
			const pclConfig = getpclConfig(userID, request.headers.get('Host'));
			return new Response(pclConfig, {
				status: 200,
				headers: { "Content-Type": "text/plain;charset=utf-8" }
			});
		  }
		  case `/${userID}/psb`: {
			const psbConfig = getpsbConfig(userID, request.headers.get('Host'));
			return new Response(psbConfig, {
				status: 200,
				headers: { "Content-Type": "application/json;charset=utf-8" }
			});
		  }
          // 对于所有其他路径
          default:
            // 这个分支可以作为一个反向代理，但默认配置下cn_hostnames为空，因此通常会执行第一个if块。
            if (cn_hostnames.includes('')) {
              // 返回请求的Cloudflare相关信息，可用于调试。
              return new Response(JSON.stringify(request.cf, null, 4), {
                status: 200,
                headers: { "Content-Type": "application/json;charset=utf-8" },
              });
            }
            // --- 以下是反向代理的逻辑，在当前配置下不会被触发 ---
            const randomHostname = cn_hostnames[Math.floor(Math.random() * cn_hostnames.length)];
            const newHeaders = new Headers(request.headers);
            // 伪造客户端IP和来源
            newHeaders.set("cf-connecting-ip", "1.2.3.4");
            newHeaders.set("x-forwarded-for", "1.2.3.4");
            newHeaders.set("x-real-ip", "1.2.3.4");
            newHeaders.set("referer", "https://www.google.com/search?q=edtunnel");
            const proxyUrl = "https://" + randomHostname + url.pathname + url.search;
            let modifiedRequest = new Request(proxyUrl, {
              method: request.method,
              headers: newHeaders,
              body: request.body,
              redirect: "manual", // 禁止自动重定向
            });
            const proxyResponse = await fetch(modifiedRequest, { redirect: "manual" });
            // 如果代理服务器返回301或302重定向，则返回错误。
            if ([301, 302].includes(proxyResponse.status)) {
              return new Response(`Redirects to ${randomHostname} are not allowed.`, {
                status: 403,
                statusText: "Forbidden",
              });
            }
            return proxyResponse;
        }
      }
      // 如果请求是WebSocket升级请求，则调用handleVLESSWebSocket函数进行处理。
      return await handleVLESSWebSocket(request);
    } catch (err) {
      // 捕获任何在处理过程中发生的错误，并将其作为响应返回。
      let e = err;
      return new Response(e.toString());
    }
  },
};

/**
 * 处理VLESS over WebSocket的连接。
 * @param {Request} request - 传入的WebSocket升级请求。
 * @returns {Promise<Response>} - 返回一个建立WebSocket连接的响应。
 */
async function handleVLESSWebSocket(request) {
  // 创建一个WebSocket对，一个用于客户端(clientWS)，一个用于服务器(serverWS)。
  const wsPair = new WebSocketPair();
  const [clientWS, serverWS] = Object.values(wsPair);

  // 接受服务器端的WebSocket连接。
  serverWS.accept();

  // 从'sec-websocket-protocol'请求头中获取VLESS的早期数据（如果有的话）。
  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
  // 创建一个可读流，用于从WebSocket接收数据。
  const wsReadable = createWebSocketReadableStream(serverWS, earlyDataHeader);
  let remoteSocket = null; // 用于存储到目标服务器的TCP连接。

  let udpStreamWrite = null; // 用于写入UDP数据的函数。
  let isDns = false; // 标记当前连接是否是DNS查询。
  
  // 将WebSocket的可读流通过管道连接到一个可写流，以处理传入的数据块。
  wsReadable.pipeTo(new WritableStream({
    async write(chunk) {
      // 如果是DNS查询并且UDP流处理器已准备好，直接将数据写入UDP流。
      if (isDns && udpStreamWrite) {
        return udpStreamWrite(chunk);
      }
      
      // 如果已经建立了到远程服务器的TCP连接，则直接将数据块写入该连接。
      if (remoteSocket) {
        const writer = remoteSocket.writable.getWriter();
        await writer.write(chunk);
        writer.releaseLock();
        return;
      }

      // 如果没有远程连接，这必须是包含VLESS头的第一个数据块。
      // 解析VLESS头部信息。
      const result = parseVLESSHeader(chunk, userID);
      if (result.hasError) {
        throw new Error(result.message);
      }

      // 准备VLESS响应头，版本号与请求一致，附加位为0。
      const vlessRespHeader = new Uint8Array([result.vlessVersion[0], 0]);
      // 获取VLESS头之后
      // 的原始客户端数据。
      const rawClientData = chunk.slice(result.rawDataIndex);
      
      // 如果是UDP请求
      if (result.isUDP) {
        // 目前只支持DNS查询（端口53）的UDP代理。
        if (result.portRemote === 53) {
          isDns = true;
          // 设置UDP出站处理器
          const { write } = await handleUDPOutBound(serverWS, vlessRespHeader);
          udpStreamWrite = write;
          // 将第一个数据包写入UDP处理器。
          udpStreamWrite(rawClientData);
          return;
        } else {
          throw new Error('UDP代理仅支持DNS(端口53)');
        }
      }

      // --- TCP代理的核心逻辑 ---

      // 封装了连接和写入初始数据的函数。
      async function connectAndWrite(address, port) {
        // 使用`connect` API建立到目标地址和端口的TCP连接。
        const tcpSocket = await connect({
          hostname: address,
          port: port
        });
        remoteSocket = tcpSocket;
        const writer = tcpSocket.writable.getWriter();
        // 将第一个数据包写入目标服务器。
        await writer.write(rawClientData);
        writer.releaseLock();
        return tcpSocket;
      }
      
      // 将IPv4地址转换为NAT64的IPv6地址。
      function convertToNAT64IPv6(ipv4Address) {
        const parts = ipv4Address.split('.');
        // ... (省略了地址验证和转换的实现细节)
        // 使用一个已知的NAT64前缀来合成IPv6地址。
        const prefixes = ['2001:67c:2960:6464::'];
        const chosenPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        return `[${chosenPrefix}${hex[0]}${hex[1]}:${hex[2]}${hex[3]}]`;
      }
      
      // 通过DoH（DNS over HTTPS）获取域名的IPv4地址，然后转换为NAT64 IPv6地址。
      async function getIPv6ProxyAddress(domain) {
        try {
          // 向公共DNS服务器查询A记录
          const dnsQuery = await fetch(`https://1.1.1.1/dns-query?name=${domain}&type=A`, {
            headers: { 'Accept': 'application/dns-json' }
          });
          const dnsResult = await dnsQuery.json();
          if (dnsResult.Answer && dnsResult.Answer.length > 0) {
            const aRecord = dnsResult.Answer.find(record => record.type === 1);
            if (aRecord) {
              const ipv4Address = aRecord.data;
              // 将获取到的IPv4地址转换为NAT64 IPv6地址。
              return convertToNAT64IPv6(ipv4Address);
            }
          }
          throw new Error('无法解析域名的IPv4地址');
        } catch (err) {
          throw new Error(`DNS解析失败: ${err.message}`);
        }
      }

      // 重试函数，当直接连接失败时被调用。
      async function retry() {
        try {
          // 获取目标的NAT64 IPv6地址。
          const proxyIP = await getIPv6ProxyAddress(result.addressRemote);
          console.log(`尝试通过NAT64 IPv6地址 ${proxyIP} 连接...`);
          // 使用NAT64地址进行连接。
          const tcpSocket = await connect({
            hostname: proxyIP,
            port: result.portRemote
          });
          remoteSocket = tcpSocket;
          const writer = tcpSocket.writable.getWriter();
          await writer.write(rawClientData);
          writer.releaseLock();
          // 将远程连接的数据流回传给WebSocket客户端。
          pipeRemoteToWebSocket(tcpSocket, serverWS, vlessRespHeader, null);
        } catch (err) {
          console.error('NAT64 IPv6连接失败:', err);
          serverWS.close(1011, 'NAT64 IPv6连接失败: ' + err.message);
        }
      }

      // --- 首次连接尝试 ---
      try {
        // 首先尝试直接连接客户端请求的目标地址。
        const tcpSocket = await connectAndWrite(result.addressRemote, result.portRemote);
        // 如果连接成功，则开始双向转发数据，并传入`retry`函数作为连接失败时的回调。
        pipeRemoteToWebSocket(tcpSocket, serverWS, vlessRespHeader, retry);
      } catch (err) {
        console.error('连接失败:', err);
        // 如果直接连接失败，不是立即重试，而是在`pipeRemoteToWebSocket`中判断是否需要重试。
        // 如果初始连接就抛出异常，通常意味着地址无法解析或被拒绝，直接关闭连接。
        serverWS.close(1011, '连接失败');
      }
    },
    close() {
      // 当WebSocket关闭时，确保远程TCP连接也被关闭。
      if (remoteSocket) {
        closeSocket(remoteSocket);
      }
    }
  })).catch(err => {
    // 捕获流处理中的任何错误。
    console.error('WebSocket 错误:', err);
    closeSocket(remoteSocket);
    serverWS.close(1011, '内部错误');
  });

  // 返回一个101 Switching Protocols响应，完成WebSocket握手。
  return new Response(null, {
    status: 101,
    webSocket: clientWS,
  });
}

// ... (其他辅助函数如 createWebSocketReadableStream, parseVLESSHeader, pipeRemoteToWebSocket 等的注释已在上面逻辑中穿插解释)
// ... (所有配置生成函数如 getVLESSConfig, gettyConfig, getclConfig 等已解码并将在下方展示)

/**
 * 生成包含配置信息和订阅链接的HTML页面。
 * @param {string} userID 用户的UUID
 * @param {string | null} hostName 当前请求的主机名
 * @returns {string} 完整的HTML内容
 */
function getVLESSConfig(userID, hostName) {
  // 生成WebSocket (非TLS) 的VLESS链接
  const wvlessws = `vless://${userID}@${CDNIP}:8880?encryption=none&security=none&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#${hostName}`;
  // 生成WebSocket + TLS 的VLESS链接
  const pvlesswstls = `vless://${userID}@${CDNIP}:8443?encryption=none&security=tls&type=ws&host=${hostName}&sni=${hostName}&fp=random&path=%2F%3Fed%3D2560#${hostName}`;
  // 备注信息
  const note = `甬哥博客地址：https://ygkkk.blogspot.com\n甬哥YouTube频道：https://www.youtube.com/@ygkkk\n甬哥TG电报群组：https://t.me/ygkkktg\n甬哥TG电报频道：https://t.me/ygkkktgpd\n\nProxyIP使用nat64自动生成，无需设置`;
  // 生成各种订阅链接
  const ty = `https://${hostName}/${userID}/ty`;
  const cl = `https://${hostName}/${userID}/cl`;
  const sb = `https://${hostName}/${userID}/sb`;
  const pty = `https://${hostName}/${userID}/pty`;
  const pcl = `https://${hostName}/${userID}/pcl`;
  const psb = `https://${hostName}/${userID}/psb`;

  // 将所有节点（包括http和https）的vless链接拼接后进行Base64编码，作为通用分享链接。
  const wkvlessshare = btoa(`vless://${userID}@${IP1}:${PT1}?encryption=none&security=none&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V1_${IP1}_${PT1}\nvless://${userID}@${IP2}:${PT2}?encryption=none&security=none&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V2_${IP2}_${PT2}\n ... (其他节点) ... \nvless://${userID}@${IP13}:${PT13}?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V13_${IP13}_${PT13}`);

  // 仅将https节点的vless链接拼接后进行Base64编码。
  const pgvlessshare = btoa(`vless://${userID}@${IP8}:${PT8}?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V8_${IP8}_${PT8}\n ... (其他TLS节点) ... \nvless://${userID}@${IP13}:${PT13}?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V13_${IP13}_${PT13}`);	

  // 将备注中的换行符替换为HTML的<br>标签，以便在页面上显示。
  const noteshow = note.replace(/\n/g, '<br>');
  // HTML模板头部，引入Bootstrap样式和复制到剪贴板的JS函数。
  const displayHtml = `...`; // 省略了大部分HTML代码，因为它们主要是UI展示

  // 根据当前访问的域名是否是Cloudflare的workers.dev域名，返回不同的HTML页面。
  // workers.dev域名通常不支持直接TLS连接，所以会同时显示TLS和非TLS节点。
  // 自定义域名通常配置了SSL，所以主要显示TLS节点。
  if (hostName.includes("workers.dev")) {
    // 返回适用于 workers.dev 域名的HTML页面
    return `... 页面HTML，包含 wkvlessshare 和所有订阅链接 ...`;
  } else {
    // 返回适用于自定义域名的HTML页面
    return `... 页面HTML，包含 pgvlessshare 和仅TLS的订阅链接 ...`;
  }
}

/**
 * 生成通用订阅内容 (Base64编码的vless链接列表)
 * @param {string} userID
 * @param {string | null} hostName
 * @returns {string}
 */
function gettyConfig(userID, hostName) {
	const vlessshare = btoa(`vless://${userID}@${IP1}:${PT1}?encryption=none&security=none&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V1_${IP1}_${PT1}\n ... (所有13个节点) ...`);
	return vlessshare;
}

/**
 * 生成Clash-meta格式的订阅配置文件 (YAML)
 * @param {string} userID
 * @param {string | null} hostName
 * @returns {string}
 */
function getclConfig(userID, hostName) {
    // 返回一个完整的Clash配置字符串，其中包含了所有13个节点。
    // 非TLS节点 `tls: false`
    // TLS节点 `tls: true` 和 `servername: ${hostName}`
    return `
port: 7890
...
proxies:
- name: CF_V1_${IP1}_${PT1}
  type: vless
  server: ${IP1.replace(/[\[\]]/g, '')}
  port: ${PT1}
  uuid: ${userID}
  tls: false
  network: ws
  ws-opts:
    path: "/?ed=2560"
    headers:
      Host: ${hostName}
...
- name: CF_V8_${IP8}_${PT8}
  type: vless
  server: ${IP8.replace(/[\[\]]/g, '')}
  port: ${PT8}
  uuid: ${userID}
  tls: true
  network: ws
  servername: ${hostName}
  ws-opts:
    path: "/?ed=2560"
    headers:
      Host: ${hostName}
... (其他节点和规则) ...
`;
}
	
/**
 * 生成Sing-box格式的订阅配置文件 (JSON)
 * @param {string} userID
 * @param {string | null} hostName
 * @returns {string}
 */
function getsbConfig(userID, hostName) {
    // 返回一个完整的Sing-box配置字符串 (JSON格式)。
    // 非TLS节点没有 `tls` 字段。
    // TLS节点有 `tls` 字段，且 "enabled": true。
    return `{
      "outbounds": [
        ...
        {
          "server": "${IP1}",
          "server_port": ${PT1},
          "tag": "CF_V1_${IP1}_${PT1}",
          ...
          "type": "vless",
          "uuid": "${userID}"
        },
        ...
        {
          "server": "${IP8}",
          "server_port": ${PT8},
          "tag": "CF_V8_${IP8}_${PT8}",
          "tls": {
            "enabled": true,
            "server_name": "${hostName}",
            ...
          },
          ...
          "type": "vless",
          "uuid": "${userID}"
        },
        ... (其他节点和配置) ...
      ]
    }`;
}

// 以下是仅生成TLS节点的订阅配置函数

function getptyConfig(userID, hostName) {
	const vlessshare = btoa(`vless://${userID}@${IP8}:${PT8}?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2560#CF_V8_${IP8}_${PT8}\n ... (所有6个TLS节点) ...`);
	return vlessshare;
}
	
function getpclConfig(userID, hostName) {
    // 返回Clash配置，但只包含proxies数组中的TLS节点 (IP8-IP13)。
    return `
...
proxies:
- name: CF_V8_${IP8}_${PT8}
  type: vless
  server: ${IP8.replace(/[\[\]]/g, '')}
  port: ${PT8}
  uuid: ${userID}
  tls: true
  ...
... (其他TLS节点和规则) ...
`;
}
		
function getpsbConfig(userID, hostName) {
    // 返回Sing-box配置，但只包含outbounds数组中的TLS节点 (IP8-IP13)。
    return `{
      "outbounds": [
        ...
        {
          "server": "${IP8}",
          "server_port": ${PT8},
          "tag": "CF_V8_${IP8}_${PT8}",
          "tls": {
            "enabled": true,
            ...
          },
          ...
          "type": "vless",
          "uuid": "${userID}"
        },
        ... (其他TLS节点和配置) ...
      ]
    }`;
}