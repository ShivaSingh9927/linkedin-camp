const https = require('https');
const url = require('url');

const mcpUrl = "https://mcp.unframer.co/mcp?id=317ea0502ecd99b494dc4b3ab505e805d36064bc9bbd3dded764a7e31e7049ee&secret=ZE6lW794UBlNpXcuEcfiSS89XpS39B2W";

function callMcp(method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(mcpUrl);
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream, application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const responseJson = JSON.parse(body);
          resolve(responseJson);
        } catch (e) {
          reject(new Error(`Failed to parse response JSON: ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  try {
    console.log("Listing tools...");
    const res = await callMcp("tools/list");
    if (res.result && res.result.tools) {
      console.log("\nAvailable Framer MCP Tools:\n");
      res.result.tools.forEach(t => {
        console.log(`- ${t.name}: ${t.description.split('\n')[0]}`);
      });
    } else {
      console.log("Response:", JSON.stringify(res, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
