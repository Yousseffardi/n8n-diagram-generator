# n8n Diagram Generator

Paste a project description or an n8n workflow JSON and get a clean
architecture diagram as a PNG. Choose from multiple visual styles.

<img width="1287" height="708" alt="image" src="https://github.com/user-attachments/assets/6e2e56ba-0895-4df9-9d30-d8ca582ba097" />


## How it works
<img width="1024" height="1024" alt="n8n-diagram" src="https://github.com/user-attachments/assets/02063e2f-0ebf-4bd3-91bd-c8f8e139790e" />

React UI → n8n Webhook → Switch (text / n8n-json) → Code (summarize)
→ LLM extractor → Style presets → Image prompt writer → OpenAI Image API → PNG

## Setup
1. Import `workflow/diagram-generator.json` into n8n
2. Add your OpenAI credentials and activate the workflow
3. Copy the webhook URL
4. In the project:
   ```bash
   cp .env.example .env     # then paste your webhook URL
   npm install
   npm run dev
   ```

## Tech
React, Vite, n8n, OpenAI

## Styles
Flat Corporate, Dark Neon, Minimal, Hand Drawn, Blueprint, Isometric, Pastel

## React app  UI
<img width="1863" height="968" alt="image" src="https://github.com/user-attachments/assets/4ca94a32-ccd3-4d5f-9e31-5e2b9753f74c" />

<img width="1908" height="989" alt="image" src="https://github.com/user-attachments/assets/c0f59d6b-de50-4dca-a8a0-7241941c9d76" />
