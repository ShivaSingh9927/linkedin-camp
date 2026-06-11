const https = require('https');
const url = require('url');

const mcpUrl = "https://mcp.unframer.co/mcp?id=317ea0502ecd99b494dc4b3ab505e805d36064bc9bbd3dded764a7e31e7049ee&secret=ZE6lW794UBlNpXcuEcfiSS89XpS39B2W";

function callMcp(method, params, id = 1) {
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
    const pageId = "obBLBu_h4";
    console.log(`Fetching XML for page ${pageId}...`);
    const nodeRes = await callMcp("tools/call", {
      name: "getNodeXml",
      arguments: {
        nodeId: pageId
      }
    });
    
    const xmlText = nodeRes.result?.content?.[0]?.text || '';
    console.log("\n--- Page XML Length:", xmlText.length);
    if (xmlText) {
      const fs = require('fs');
      fs.writeFileSync('/home/shiva/Documents/linkedin-camp/scratch_framer_page.xml', xmlText);
      console.log("Successfully saved page XML to /home/shiva/Documents/linkedin-camp/scratch_framer_page.xml");
      
      console.log("XML Snippet:");
      console.log(xmlText.substring(0, 2000));
    } else {
      console.log("Response:", JSON.stringify(nodeRes, null, 2));
    }
  } catch (err) {
    console.error("Error running MCP commands:", err);
  }
}

run();
