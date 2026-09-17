// Drive the Qampi MCP server over stdio exactly as an MCP client would:
// spawn it, handshake, list tools, call a couple against production.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const KEY = process.env.QAMPI_API_KEY;
let fails = 0;
const ok = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'} ${n}`); if (!c) fails++; };

async function connect(mode) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/home/shiva/Documents/linkedin-camp/packages/mcp-server/dist/index.js'],
    env: { ...process.env, QAMPI_API_KEY: KEY, QAMPI_MODE: mode },
  });
  const client = new Client({ name: 'qampi-mcp-test', version: '0.0.1' });
  await client.connect(transport);
  return client;
}

// ---- read-only mode (the default posture)
const ro = await connect('read-only');
const roTools = (await ro.listTools()).tools.map(t => t.name).sort();
console.log('read-only tools:', roTools.join(', '));
ok('read tools are exposed', roTools.includes('qampi_status') && roTools.includes('qampi_list_leads'));
ok('WRITE tools are NOT exposed in read-only mode',
   !roTools.some(n => ['qampi_add_leads', 'qampi_launch_campaign', 'qampi_create_campaign'].includes(n)));

const status = JSON.parse((await ro.callTool({ name: 'qampi_status', arguments: {} })).content[0].text);
ok(`qampi_status returns the live account (${status.account?.email})`, status.account?.email?.includes('rajaji'));
ok(`status carries LinkedIn health (${status.account?.linkedin?.health})`, status.account?.linkedin?.connected === true);
ok(`status carries the ramped invite budget (cap ${status.usage?.invites?.cap})`, typeof status.usage?.invites?.cap === 'number');

const leads = JSON.parse((await ro.callTool({ name: 'qampi_list_leads', arguments: { limit: 3 } })).content[0].text);
ok(`qampi_list_leads returns leads (${leads.data?.length})`, Array.isArray(leads.data) && leads.data.length > 0);

const tpl = JSON.parse((await ro.callTool({ name: 'qampi_list_templates', arguments: {} })).content[0].text);
ok(`qampi_list_templates returns templates (${tpl.data?.length})`, (tpl.data?.length || 0) > 0);

// An error must arrive as readable text, not a stack trace.
const bad = await ro.callTool({ name: 'qampi_get_lead', arguments: { leadId: 'nope' } });
ok(`404 surfaces as a readable error (${(bad.content?.[0]?.text || '').slice(0, 40)}…)`,
   bad.isError === true && /NOT_FOUND/.test(bad.content[0].text));
await ro.close();

// ---- full mode
const full = await connect('full');
const fullTools = (await full.listTools()).tools.map(t => t.name).sort();
console.log('full-mode tools:', fullTools.join(', '));
ok('write tools appear in full mode', fullTools.includes('qampi_add_leads') && fullTools.includes('qampi_launch_campaign'));

const launch = (await full.listTools()).tools.find(t => t.name === 'qampi_launch_campaign');
ok('launch is annotated destructive', launch?.annotations?.destructiveHint === true);
ok('launch requires an explicit confirm flag', JSON.stringify(launch?.inputSchema).includes('confirm'));
const noConfirm = await full.callTool({ name: 'qampi_launch_campaign', arguments: { campaignId: 'x' } });
ok('launch without confirm is rejected before any HTTP call', noConfirm.isError === true);
await full.close();

process.exit(fails ? 1 : 0);
