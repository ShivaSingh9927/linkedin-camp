from datetime import datetime

FALLBACK_STRATEGY = {
    "gtm": {
        "positioning": "We help businesses improve their LinkedIn outreach with AI-powered personalization",
        "primaryChannel": "LinkedIn outbound",
        "salesMotion": "Direct outreach",
        "buyingCommittee": ["Founder", "VP Sales", "Head of Growth"],
        "averageDealSize": "Unknown",
        "salesCycle": "7-14 days"
    },
    "icp": {
        "primary": {
            "title": "Business Owner / Sales Leader",
            "companySize": "1-50 employees",
            "industry": "B2B",
            "painPoints": ["Low reply rates on cold outreach", "Generic messages that get ignored", "No time to personalize at scale"],
            "goals": ["Book more meetings", "Generate qualified leads", "Scale outreach efficiently"],
            "objections": ["Too expensive", "Will LinkedIn ban me", "AI messages sound robotic"],
            "triggerEvents": ["Growing sales team", "Launching new product", "Need more pipeline"]
        },
        "secondary": {
            "title": "Recruiter / HR Professional",
            "companySize": "Any",
            "industry": "Any",
            "painPoints": ["Hard to reach passive candidates", "Low response rates on InMail", "Time-consuming outreach"],
            "goals": ["Fill positions faster", "Build talent pipeline", "Reach passive candidates"]
        }
    },
    "messagingPillars": [
        {
            "pillar": "AI Personalization",
            "angle": "Messages that sound like you, not a bot",
            "proof": "Fine-tuned on your writing style, not templates",
            "hook": "Your prospects won't know it's AI"
        },
        {
            "pillar": "Reply Rate",
            "angle": "3x more replies than manual outreach",
            "proof": "34% average reply rate across thousands of users",
            "hook": "Stop sending messages into the void"
        },
        {
            "pillar": "Time Savings",
            "angle": "Set up in 2 minutes, runs on autopilot",
            "proof": "Users save 10+ hours per week on outreach",
            "hook": "Focus on closing, not prospecting"
        }
    ],
    "outreachAngles": {
        "founder": {
            "hook": "Reference their recent milestone, funding, or growth",
            "valueProp": "Help you scale outreach without hiring an SDR",
            "cta": "Quick call to share what worked for similar founders",
            "tone": "Peer-to-peer, no fluff, data-driven"
        },
        "vp_sales": {
            "hook": "Reference their team size, quota pressure, or sales process",
            "valueProp": "Help your team book more meetings without more headcount",
            "cta": "15-min demo to show your team's potential pipeline",
            "tone": "Professional, ROI-focused, metric-driven"
        },
        "recruiter": {
            "hook": "Reference their open roles or hiring challenges",
            "valueProp": "Reach passive candidates before they apply elsewhere",
            "cta": "Quick chat about your talent pipeline strategy",
            "tone": "Helpful, relationship-focused"
        }
    },
    "objections": {
        "too_expensive": {
            "response": "Acknowledge concern, reframe as ROI (1 closed deal covers months of subscription)",
            "pivot": "Offer free trial to prove value first"
        },
        "will_linkedin_ban_me": {
            "response": "Explain safety features: human-like delays, limit detection, auto-pause on flag",
            "pivot": "Share zero-ban track record across thousands of users"
        },
        "ai_sounds_robotic": {
            "response": "Explain fine-tuning on their writing style, show example",
            "pivot": "Prospects can't tell the difference from human-written"
        }
    },
    "competitiveLandscape": {
        "directCompetitors": ["Waalaxy", "Dux-Soup", "Expandi"],
        "theirWeaknesses": ["Template-based, not AI-personalized", "High ban risk, no safety features", "Complex setup, steep learning curve"],
        "ourAdvantages": ["Fine-tuned AI that writes like you", "Human-like behavior patterns, zero bans", "2-minute setup, no database needed"],
        "whenToMention": "Only when prospect asks about alternatives or mentions using another tool"
    },
    "commentStrategy": {
        "goal": "Position sender as thought leader in their industry",
        "approach": "Add unique insight, reference personal experience, ask thoughtful question",
        "avoid": ["Generic praise", "Self-promotion", "Yes/no questions"],
        "topics": ["AI in sales", "Outbound strategy", "LinkedIn growth", "Industry trends"]
    },
    "_metadata": {
        "generatedAt": datetime.utcnow().isoformat(),
        "model": "fallback",
        "version": 1,
        "isFallback": True,
        "note": "This is a fallback strategy. Complete your AI Profile for a personalized strategy."
    }
}
