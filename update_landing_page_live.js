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

const updates = [
  {
    nodeId: "j8DrJyz3Q",
    xml: `<RunYourFreelanceBusinessLikeAPro
        nodeId="j8DrJyz3Q"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 1"
    >
      LinkedIn outreach that actually gets replies
    </RunYourFreelanceBusinessLikeAPro>`
  },
  {
    nodeId: "DMOueQ0pp",
    xml: `<AllInOnePlatformForManagingClientsProjectsAndPaymentsWithout
        nodeId="DMOueQ0pp"
        width="1fr"
        height="fit-content"
        maxWidth="700px"
        inlineTextStyle="/Body/Body XL"
    >
      Qampi's AI copywriter analyzes target profile activity, posts, and company announcements to write unique, natural outreach sequences. No dry templates. Just organic connections.
    </AllInOnePlatformForManagingClientsProjectsAndPaymentsWithout>`
  },
  {
    nodeId: "gaauaj2hO",
    xml: `<MainButton
        nodeId="gaauaj2hO"
        width="fit-content"
        height="fit-content"
        componentId="h4JcoWJSF"
        variant="OBWsuGAEJ"
        ektwzyaAy="Test outreach live"
        yPsg9PA2x="/contact-us"
        FHCLGB0I0="rgb(26, 22, 21)"
     />`
  },
  {
    nodeId: "RheKc9HlL",
    xml: `<MainButton
        nodeId="RheKc9HlL"
        width="fit-content"
        height="fit-content"
        componentId="h4JcoWJSF"
        variant="cMgcydVG6"
        ektwzyaAy="Start free trial"
        yPsg9PA2x="/#pricing"
        FHCLGB0I0="rgb(26, 22, 21)"
     />`
  },
  {
    nodeId: "ad14o9wYC",
    xml: `<TrustedBy7000TopStartupsFreelancersAndStudios
        nodeId="ad14o9wYC"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Normal"
    >
      Trusted by 7,000+ founders, sales reps, and recruiters
    </TrustedBy7000TopStartupsFreelancersAndStudios>`
  },
  {
    nodeId: "W4ZMMJ0vX",
    xml: `<SeamlessAcrossDevices
        nodeId="W4ZMMJ0vX"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Label & Eyebrow/Eyebrow Large"
    >
      hyper-personalized sequences
    </SeamlessAcrossDevices>`
  },
  {
    nodeId: "EfTezZ2cb",
    xml: `<WorkFromAnywhereStayInSync
        nodeId="EfTezZ2cb"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 2"
    >
      No dry templates. Just organic connections.
    </WorkFromAnywhereStayInSync>`
  },
  {
    nodeId: "CEZ7sJk11",
    xml: `<ProjectManagement
        nodeId="CEZ7sJk11"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Label & Eyebrow/Eyebrow Large"
    >
      campaign automation
    </ProjectManagement>`
  },
  {
    nodeId: "bPuzOzTT1",
    xml: `<KeepEveryProjectMovingForward
        nodeId="bPuzOzTT1"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 2"
    >
      Automate your LinkedIn outbound pipelines
    </KeepEveryProjectMovingForward>`
  },
  {
    nodeId: "XWg_JpIFS",
    xml: `<PlanAssignAndDeliverYourWorkAllInOnePlaceWithSmartTaskTracki
        nodeId="XWg_JpIFS"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Large"
    >
      Import lead lists, set up multi-step touchpoint flows, and let Qampi handle the rest. Sync connections and handle replies directly from our inbox console.
    </PlanAssignAndDeliverYourWorkAllInOnePlaceWithSmartTaskTracki>`
  },
  {
    nodeId: "Rbn3cqGPj",
    xml: `<MainButton
        nodeId="Rbn3cqGPj"
        width="fit-content"
        height="fit-content"
        componentId="h4JcoWJSF"
        variant="OBWsuGAEJ"
        ektwzyaAy="Start outreach campaign"
        yPsg9PA2x="/contact-us"
        FHCLGB0I0="rgb(26, 22, 21)"
     />`
  },
  {
    nodeId: "gdjs4eMgf",
    xml: `<FeaturesPill
        nodeId="gdjs4eMgf"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="LinkedIn Sync"
     />`
  },
  {
    nodeId: "lECSlCgmQ",
    xml: `<FeaturesPill
        nodeId="lECSlCgmQ"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="Persona Selector"
     />`
  },
  {
    nodeId: "pHA8Xzkft",
    xml: `<FeaturesPill
        nodeId="pHA8Xzkft"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="AI Copywriting"
     />`
  },
  {
    nodeId: "AE2Bh_eMF",
    xml: `<FeaturesPill
        nodeId="AE2Bh_eMF"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="Outbox Queue"
     />`
  },
  {
    nodeId: "LyjUtpJyE",
    xml: `<ProjectManagement
        nodeId="LyjUtpJyE"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Label & Eyebrow/Eyebrow Large"
    >
      smart outbox console
    </ProjectManagement>`
  },
  {
    nodeId: "CBUIJTAs8",
    xml: `<KeepEveryProjectMovingForward
        nodeId="CBUIJTAs8"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 2"
    >
      Track response rates and conversions live
    </KeepEveryProjectMovingForward>`
  },
  {
    nodeId: "Ehk__4nek",
    xml: `<PlanAssignAndDeliverYourWorkAllInOnePlaceWithSmartTaskTracki
        nodeId="Ehk__4nek"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Large"
    >
      Get an aggregated view of your outbound campaign metrics. Monitor connection acceptance rates, response rates, and positive intent replies at a glance.
    </PlanAssignAndDeliverYourWorkAllInOnePlaceWithSmartTaskTracki>`
  },
  {
    nodeId: "HXLfh2EHO",
    xml: `<MainButton
        nodeId="HXLfh2EHO"
        width="fit-content"
        height="fit-content"
        componentId="h4JcoWJSF"
        variant="OBWsuGAEJ"
        ektwzyaAy="Check your dashboard"
        yPsg9PA2x="/contact-us"
        FHCLGB0I0="rgb(26, 22, 21)"
     />`
  },
  {
    nodeId: "iNfMPn91z",
    xml: `<FeaturesPill
        nodeId="iNfMPn91z"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="Outbox Size"
     />`
  },
  {
    nodeId: "z7IQOKSyX",
    xml: `<FeaturesPill
        nodeId="z7IQOKSyX"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="Analytics Dashboard"
     />`
  },
  {
    nodeId: "ifi6FZWbj",
    xml: `<FeaturesPill
        nodeId="ifi6FZWbj"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="Reply Detection"
     />`
  },
  {
    nodeId: "YXtZN26jX",
    xml: `<FeaturesPill
        nodeId="YXtZN26jX"
        width="1fr"
        height="fit-content"
        componentId="OXxV3C0mQ"
        BC4UHABgE="CRM Sync"
     />`
  },
  {
    nodeId: "DPKVwAP2I",
    xml: `<SmartFlexibleAndBuiltAroundYourBusinessWorkflow
        nodeId="DPKVwAP2I"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 5"
    >
      AI personalization that mimics you perfectly
    </SmartFlexibleAndBuiltAroundYourBusinessWorkflow>`
  },
  {
    nodeId: "CbJt3VIuQ",
    xml: `<PersonalizeEveryDetailFromBrandingAndInterfaceLayoutToColors
        nodeId="CbJt3VIuQ"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Large"
    >
      Qampi's context engine studies recent target posts, comments, and profile summaries. It drafts custom outreach messages that sound entirely organic.
    </PersonalizeEveryDetailFromBrandingAndInterfaceLayoutToColors>`
  },
  {
    nodeId: "YYs398FWi",
    xml: `<IntegratesSeamlesslyWithTheToolsYouAlreadyUse
        nodeId="YYs398FWi"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 5"
    >
      Integrates seamlessly with your existing tech stack
    </IntegratesSeamlesslyWithTheToolsYouAlreadyUse>`
  },
  {
    nodeId: "OVrFzof_E",
    xml: `<SeamlessIntegrationsPlugFreelioIntoTheToolsYouLoveSetUpAutom
        nodeId="OVrFzof_E"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Large"
    >
      Connect Qampi with your HubSpot, Salesforce, or native CRM. Keep your sales pipelines synced automatically without manually copying data.
    </SeamlessIntegrationsPlugFreelioIntoTheToolsYouLoveSetUpAutom>`
  },
  {
    nodeId: "uQyQRdCSI",
    xml: `<BenefitsCard
        nodeId="uQyQRdCSI"
        width="1fr"
        height="fit-content"
        componentId="aqLL7JfDT"
        variant="wlMJBeDDC"
        eQU_fR2hb="Campaign Scheduling"
        mnUwQ7cg6="Define exactly when your messages go out. Set optimal delivery windows aligned with your target's local working hours."
        doSxqWPCv="true"
        emoIuwAXm="false"
     />`
  },
  {
    nodeId: "K7X0nYsAp",
    xml: `<BenefitsCard
        nodeId="K7X0nYsAp"
        width="1fr"
        height="fit-content"
        componentId="aqLL7JfDT"
        variant="wlMJBeDDC"
        eQU_fR2hb="Smart Anti-Detection"
        mnUwQ7cg6="Randomized intervals and human-like typing behaviors guarantee your LinkedIn account remains safe, secure, and fully compliant."
        doSxqWPCv="false"
        emoIuwAXm="true"
     />`
  },
  {
    nodeId: "vlSL5rAGU",
    xml: `<BenefitsCard
        nodeId="vlSL5rAGU"
        width="1fr"
        height="fit-content"
        componentId="aqLL7JfDT"
        variant="wlMJBeDDC"
        eQU_fR2hb="Multi-Persona Selection"
        mnUwQ7cg6="Target founders, developers, or sales reps. Customize dynamic search parameters to segment and adapt sequences automatically."
        doSxqWPCv="false"
        emoIuwAXm="true"
     />`
  }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Starting dynamic live update of ${updates.length} nodes on the Framer canvas...`);
  for (let i = 0; i < updates.length; i++) {
    const item = updates[i];
    console.log(`[${i+1}/${updates.length}] Updating node ${item.nodeId}...`);
    try {
      const res = await callMcp("tools/call", {
        name: "updateXmlForNode",
        arguments: {
          nodeId: item.nodeId,
          xml: item.xml
        }
      });
      if (res.error) {
        console.error(`  x Failed to update ${item.nodeId}:`, res.error);
      } else {
        console.log(`  ✓ Successfully updated node ${item.nodeId}`);
      }
    } catch (err) {
      console.error(`  x Error calling MCP for node ${item.nodeId}:`, err.message);
    }
    // Small pause to allow Framer sync
    await delay(1000);
  }
  console.log("All updates completed!");
}

run();
