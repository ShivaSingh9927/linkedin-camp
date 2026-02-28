# Product Overview - Waalaxy Replication

## Description
A modern LinkedIn automation and outreach platform designed to streamline lead generation and campaign management. It uses a hybrid architecture combining a Chrome Extension for secure session management and lead scraping with a cloud-based backend for workflow execution.

## Key Features
- **Lead Importer**: Chrome extension that scrapes leads from LinkedIn search results and syncs them to a central CRM.
- **Session Sync**: Automatically extracts and syncs LinkedIn `li_at` cookies for cloud-based actions.
- **Campaign Builder**: Drag-and-drop flowchart interface (React Flow) for creating complex outreach sequences.
- **Automated Workflow Execution**: Background workers (BullMQ + Playwright) that execute connection requests, messages, and profile visits.
- **Anti-Bot Safeguards**: Specialized human emulation, randomized delays, and residential proxy integration.
- **CRM & Analytics**: Dashboard to manage leads and track campaign performance (acceptance rates, replies, etc.).
- **AI Personalization**: Integration with AI to generate contextualized connection messages.
