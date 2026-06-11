const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const { URL } = require('url');

const PORT = parseInt(process.argv[2]) || 3000;
const DNS_SERVERS = (process.env.PROXY_DNS || '8.8.8.8,8.8.4.4').split(',');
dns.setServers(DNS_SERVERS);
console.log(`Custom DNS servers: ${DNS_SERVERS.join(', ')}`);

function resolveHost(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, { all: true }, (err, addresses) => {
      if (err && err.code === 'ENOTFOUND') {
        // fallback: let system resolve
        resolve(hostname);
      } else if (err) {
        reject(err);
      } else if (addresses && addresses.length > 0) {
        resolve(addresses[0].address || addresses[0]);
      } else {
        resolve(hostname);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  const { method, url, headers } = req;
  const parsed = new URL(url);

  (async () => {
    try {
      const ip = await resolveHost(parsed.hostname);
      const options = {
        hostname: ip,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method,
        headers: { ...headers, 'Proxy-Connection': undefined, Host: parsed.hostname },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (e) => { res.writeHead(502); res.end(`Proxy error: ${e.message}`); });
      req.pipe(proxyReq);
    } catch (e) {
      res.writeHead(502); res.end(`DNS error: ${e.message}`);
    }
  })();
});

server.on('connect', (req, clientSocket, head) => {
  const [hostname, port] = req.url.split(':');
  const targetPort = parseInt(port) || 443;

  (async () => {
    try {
      const ip = await resolveHost(hostname);
      const serverSocket = net.connect(targetPort, ip, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });
      serverSocket.on('error', (e) => { clientSocket.end(); });
      clientSocket.on('error', () => { serverSocket.end(); });
    } catch (e) {
      clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\n\r\nDNS error: ${e.message}`);
    }
  })();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Forward proxy (with custom DNS) on http://127.0.0.1:${PORT}`);
});