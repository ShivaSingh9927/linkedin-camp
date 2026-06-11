const https = require('https');
const url = require('url');

const targetUrl = "https://mcp.unframer.co/mcp?id=317ea0502ecd99b494dc4b3ab505e805d36064bc9bbd3dded764a7e31e7049ee&secret=ZE6lW794UBlNpXcuEcfiSS89XpS39B2W";
const parsedUrl = url.parse(targetUrl);

console.log("Sending POST request to:", targetUrl);

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port,
  path: parsedUrl.path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);
  let body = '';
  res.on('data', (chunk) => { body += chunk.toString(); });
  res.on('end', () => {
    console.log("Response Body:", body);
  });
});

req.on('error', (err) => {
  console.error("Error:", err);
});

req.end();
