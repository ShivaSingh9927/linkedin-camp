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
  // PRICING SECTION
  {
    nodeId: "kDKcS4v3_",
    xml: `<SimplePlansForSeriousWork
        nodeId="kDKcS4v3_"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 2"
    >
      Simple plans for serious growth
    </SimplePlansForSeriousWork>`
  },
  {
    nodeId: "Kjco4olEI",
    xml: `<TrustedBy7000TopStartupsFreelancersAndStudios
        nodeId="Kjco4olEI"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Body/Body Normal"
    >
      Trusted by 7,000+ founders, sales reps, and recruiters
    </TrustedBy7000TopStartupsFreelancersAndStudios>`
  },

  // BLOG SECTION (RESOURCES)
  {
    nodeId: "hP6nXOSP5",
    xml: `<Pricing
        nodeId="hP6nXOSP5"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Label & Eyebrow/Eyebrow Large"
    >
      resources
    </Pricing>`
  },
  {
    nodeId: "ODa0dYDWH",
    xml: `<SimplePlansForSeriousWork
        nodeId="ODa0dYDWH"
        width="1fr"
        height="fit-content"
        inlineTextStyle="/Heading/Heading 2"
    >
      Insights to level-up your LinkedIn game
    </SimplePlansForSeriousWork>`
  },
  {
    nodeId: "avDX11sep",
    xml: `<BlogCard
        nodeId="avDX11sep"
        width="1fr"
        height="fit-content"
        componentId="ceNjEn0pZ"
        variant="LZbvw34aB"
        GCByEC9Fx="The Ultimate Guide to Cold LinkedIn Outreach in 2026"
        pLYLm0921="Learn how to structure messages that command attention and get replies from decision-makers."
        sJR8wjB1z="Shiva Singh"
        UmQTZ_sR3="Growth Architect"
        bYzbMW5xc="Y6mBL48e4"
        p_ifO2pfK="Outreach"
        UYzjJfLeu="rgb(201, 80, 46)"
        jnnkAQ3vy="rgb(255, 255, 255)"
        cCFzCovcz="/blog/:slug"
     />`
  },
  {
    nodeId: "R9s7_ZPg9",
    xml: `<BlogCard
        nodeId="R9s7_ZPg9"
        width="1fr"
        height="fit-content"
        componentId="ceNjEn0pZ"
        variant="s4FWatjEv"
        GCByEC9Fx="10 LinkedIn hook formulas to double conversions"
        pLYLm0921=""
        sJR8wjB1z="Shiva Singh"
        UmQTZ_sR3="Growth Architect"
        bYzbMW5xc="Y6mBL48e4"
        p_ifO2pfK="Copywriting"
        UYzjJfLeu="rgb(21, 108, 194)"
        jnnkAQ3vy="rgb(255, 255, 255)"
        cCFzCovcz="/blog/:slug"
     />`
  },
  {
    nodeId: "bf4nSOOqX",
    xml: `<BlogCard
        nodeId="bf4nSOOqX"
        width="1fr"
        height="fit-content"
        componentId="ceNjEn0pZ"
        variant="s4FWatjEv"
        GCByEC9Fx="How to bypass LinkedIn weekly connection limits safely"
        pLYLm0921=""
        sJR8wjB1z="Shiva Singh"
        UmQTZ_sR3="Growth Architect"
        bYzbMW5xc="Y6mBL48e4"
        p_ifO2pfK="Growth"
        UYzjJfLeu="rgb(207, 141, 19)"
        jnnkAQ3vy="rgb(255, 255, 255)"
        cCFzCovcz="/blog/:slug"
     />`
  },
  {
    nodeId: "zx7g1U2ZB",
    xml: `<BlogCard
        nodeId="zx7g1U2ZB"
        width="1fr"
        height="fit-content"
        componentId="ceNjEn0pZ"
        variant="s4FWatjEv"
        GCByEC9Fx="Understanding positive intent detection in sales"
        pLYLm0921=""
        sJR8wjB1z="Shiva Singh"
        UmQTZ_sR3="Growth Architect"
        bYzbMW5xc="Y6mBL48e4"
        p_ifO2pfK="AI and Tech"
        UYzjJfLeu="rgb(14, 161, 88)"
        jnnkAQ3vy="rgb(255, 255, 255)"
        cCFzCovcz="/blog/:slug"
     />`
  },

  // COMMUNITY SECTION
  {
    nodeId: "anABsEFiI",
    xml: `<CommunityCard
        nodeId="anABsEFiI"
        width="1fr"
        height="fit-content"
        componentId="qNOTomklG"
        variant="wGXcwV1xX"
        cvMU92hp0="15.2K followers"
        C0cJCgT25="X/Twitter"
        DfoPGXjxr="Stay updated on new features and discover how others are using Qampi."
        m9lesnSoM="https://x.com/qampihq"
        QWxn6UVQ_="Follow us"
     />`
  },
  {
    nodeId: "zK3rv7ULo",
    xml: `<CommunityCard
        nodeId="zK3rv7ULo"
        width="1fr"
        height="fit-content"
        componentId="qNOTomklG"
        variant="wGXcwV1xX"
        cvMU92hp0="15K members"
        C0cJCgT25="Discord Community"
        DfoPGXjxr="Connect with other founders, share outbound strategies, and get priority support."
        m9lesnSoM="https://discord.gg/qampi"
        QWxn6UVQ_="Join community"
     />`
  },

  // REVIEWS SECTION (BIG REVIEW AND TICKERS)
  {
    nodeId: "ItTRppmyn",
    xml: `<BigReview
        nodeId="ItTRppmyn"
        width="1fr"
        height="fit-content"
        maxWidth="900px"
        componentId="WiH3d3HBs"
        kZeVm8RiS='""Qampi is by far the best outreach tool I have ever used""'
        myzB2Bc_h="Martha Punla"
        lvmEg89AC="VP Growth, Scale.ai"
     />`
  },

  // DESKTOP REVIEWS
  {
    nodeId: "t5GFS_2PH",
    xml: `<DesktopReview1
        nodeId="t5GFS_2PH"
        position="absolute"
        width="386px"
        height="fit-content"
        top="5755px"
        left="-1413px"
        componentId="ugDauJtmh"
        variant="jpA_HH3dp"
        K3T_HZ6vw='""As a fast-growing sales team, we needed a tool that matched our pace. From lead list import to closing deals, Qampi just works clean, fast, and beautifully built.""'
        FrWUmwkt3="Leah Daniel"
        BUy0U2_Ht="Sales Ops Lead, Teamwork"
     />`
  },
  {
    nodeId: "F_i2o2fo4",
    xml: `<DesktopReview2
        nodeId="F_i2o2fo4"
        position="absolute"
        width="386px"
        height="fit-content"
        top="5755px"
        left="-977px"
        componentId="ugDauJtmh"
        variant="jpA_HH3dp"
        K3T_HZ6vw='""Managing outbound campaigns used to mean spreadsheets, DMs, and missed replies. Qampi keeps our workflows tight and our pipeline full.""'
        FrWUmwkt3="Sergio Walker"
        BUy0U2_Ht="Founder, OutboundScale"
     />`
  },
  {
    nodeId: "ZDhJVaqEz",
    xml: `<DesktopReview3
        nodeId="ZDhJVaqEz"
        position="absolute"
        width="386px"
        height="fit-content"
        top="6083px"
        left="-1413px"
        componentId="ugDauJtmh"
        variant="jpA_HH3dp"
        K3T_HZ6vw='""We used to duct-tape tools together. Now our campaigns, warmups, and unified inbox live in one clean system. It&apos;s everything a sales team needs to stay pro.""'
        FrWUmwkt3="Jane Doe"
        BUy0U2_Ht="Head of Sales, GrowFast"
     />`
  },
  {
    nodeId: "P9YnGvXED",
    xml: `<DesktopReview4
        nodeId="P9YnGvXED"
        position="absolute"
        width="386px"
        height="fit-content"
        top="6083px"
        left="-977px"
        componentId="ugDauJtmh"
        variant="jpA_HH3dp"
        K3T_HZ6vw='""With Qampi, we have scaled our outbound personalization to 500 custom emails per day without losing the organic human touch. Absolutely incredible ROI.""'
        FrWUmwkt3="Amos Chen"
        BUy0U2_Ht="Growth Lead, Vanta"
     />`
  },

  // MOBILE REVIEWS
  {
    nodeId: "IGngnSyPU",
    xml: `<MobileReview1
        nodeId="IGngnSyPU"
        position="absolute"
        width="303px"
        height="fit-content"
        top="6528px"
        left="-1413px"
        componentId="ugDauJtmh"
        variant="NFPD0u5mY"
        K3T_HZ6vw='""As a fast-growing sales team, we needed a tool that matched our pace. From lead list import to closing deals, Qampi just works clean, fast, and beautifully built.""'
        FrWUmwkt3="Leah Daniel"
        BUy0U2_Ht="Sales Ops Lead, Teamwork"
     />`
  },
  {
    nodeId: "AD2YJ15k2",
    xml: `<MobileReview2
        nodeId="AD2YJ15k2"
        position="absolute"
        width="303px"
        height="fit-content"
        top="6528px"
        left="-1061px"
        componentId="ugDauJtmh"
        variant="NFPD0u5mY"
        K3T_HZ6vw='""Managing outbound campaigns used to mean spreadsheets, DMs, and missed replies. Qampi keeps our workflows tight and our pipeline full.""'
        FrWUmwkt3="Sergio Walker"
        BUy0U2_Ht="Founder, OutboundScale"
     />`
  },
  {
    nodeId: "cp6mO51LM",
    xml: `<MobileReview3
        nodeId="cp6mO51LM"
        position="absolute"
        width="303px"
        height="fit-content"
        top="6895px"
        left="-1413px"
        componentId="ugDauJtmh"
        variant="NFPD0u5mY"
        K3T_HZ6vw='""We used to duct-tape tools together. Now our campaigns, warmups, and unified inbox live in one clean system. It&apos;s everything a sales team needs to stay pro.""'
        FrWUmwkt3="Jane Doe"
        BUy0U2_Ht="Head of Sales, GrowFast"
     />`
  },
  {
    nodeId: "RV5JgsYPF",
    xml: `<MobileReview4
        nodeId="RV5JgsYPF"
        position="absolute"
        width="303px"
        height="fit-content"
        top="6895px"
        left="-1061px"
        componentId="ugDauJtmh"
        variant="NFPD0u5mY"
        K3T_HZ6vw='""With Qampi, we have scaled our outbound personalization to 500 custom emails per day without losing the organic human touch. Absolutely incredible ROI.""'
        FrWUmwkt3="Amos Chen"
        BUy0U2_Ht="Growth Lead, Vanta"
     />`
  }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Starting dynamic live update of ${updates.length} nodes (Part 2)...`);
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
  console.log("All Part 2 updates completed!");
}

run();
