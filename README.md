# DHRUVA – AI-Powered Polar Mission Control System
### Integrated Polar Expedition Logistics & Asset Management System
**Smart India Hackathon 2026 | SIH26062**

DHRUVA is an offline-first AI-powered mission control platform designed to unify polar expedition planning, logistics, inventory, assets, personnel, weather, mapping and emergency response in a single operational system.

It combines local-first data storage, AI/RAG-based mission assistance, risk prediction, what-if simulation and delayed synchronization to support operations in connectivity-constrained environments.

---

## 1. System Overview

### Core Architecture
```text
                         DHRUVA AI CORE
                    ┌─────────────────────┐
                    │ PREDICT             │
                    │ SIMULATE            │
                    │ RECOMMEND           │
                    │ RESPOND             │
                    └──────────┬──────────┘
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        ↓          ↓           ↓           ↓          ↓
   MISSION      CARGO &    INVENTORY &  PERSONNEL   WEATHER &
   PLANNING    LOGISTICS      ASSETS                MAP
        │          │           │           │          │
        └──────────┴───────────┼───────────┴──────────┘
                               ↓
                       EMERGENCY RESPONSE
                               │
                               ↓
                     LOCAL / OFFLINE DATA
                               │
                               ↓
                         HQ SYNCHRONIZATION

##Key Principles
a.Offline-first: Core operations continue without continuous internet.
b.AI-assisted: Converts mission data into predictions and recommendations.
c.RAG-powered: Answers mission-specific questions using trusted documents such as SOPs and equipment manuals.
d.Human-in-the-loop: Critical AI recommendations require human validation.
e.Connected when available: Local changes synchronize with HQ when connectivity returns.

2. Quick Start
Prerequisites:
Make sure the following are installed:
Node.js 18+
Python 3.11+
Git
PostgreSQL
Optional: Docker & Docker Compose
API keys/configuration for the selected LLM and external services

Clone Repository:
git clone https://github.com/<your-username>/dhruva.git
cd dhruva

Frontend:
cd frontend
npm install
npm run dev

The frontend will be available at:

http://localhost:5173

Backend:
cd backend
python -m venv venv
Windows
venv\Scripts\activate
Linux/macOS
source venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Start the API:

uvicorn app.main:app --reload

Backend:

http://localhost:8000

API documentation:

http://localhost:8000/docs
Environment Variables

Create .env files using the provided examples:

cp .env.example .env

Example configuration:

DATABASE_URL=postgresql://user:password@localhost:5432/dhruva
LLM_API_KEY=your_api_key
VECTOR_DB_URL=your_vector_database
JWT_SECRET=change_this_secret

Never commit real API keys, passwords or credentials to GitHub.

3. Pages / Modules

DHRUVA uses role-oriented interfaces rather than exposing the same dashboard to every user.

1. Mission Planning
Create and manage expeditions
Define objectives
Plan routes
Allocate resources
Track mission progress

2. Cargo & Logistics
Cargo tracking
Container management
Shipment tracking
QR-based identification
Resupply planning

3. Inventory & Assets
Equipment inventory
Food and fuel monitoring
Stock levels
Asset condition
Maintenance schedules
Shortage prediction

4. Personnel
Team management
Personnel locations
Movement tracking
Task assignments
Role-based access

5. Weather & Map
Mission locations
Cached maps
Weather information
Route visualization
Environmental alerts

6. Emergency Response
Emergency reporting
AI-assisted assessment
Severity classification
SOS workflow
Offline communication fallback

7. AI Mission Assistant

Users can ask questions using:

Text
Voice
Natural language

Example:

"Generator G-07 is showing a temperature warning. What should I check?"

The assistant retrieves relevant operational knowledge and combines it with available mission data before generating a response.

8. HQ Synchronization

When connectivity becomes available:

LOCAL DATA
    ↓
SYNC QUEUE
    ↓
CONFLICT CHECK
    ↓
SECURE SYNC
    ↓
HQ DATABASE

4. AI / NLP Pipeline

DHRUVA's AI layer combines RAG, structured mission data and predictive intelligence.

User Query / Voice
        ↓
Speech-to-Text
        ↓
Intent & Context Detection
        ↓
┌───────────────────────────────┐
│ Retrieve relevant information │
│                               │
│ • SOPs                        │
│ • Equipment manuals           │
│ • Mission documents           │
│ • Inventory data              │
│ • Asset status                │
│ • Weather / route data        │
└───────────────┬───────────────┘
                ↓
        RAG / Vector Search
                ↓
        Context Construction
                ↓
          LLM / AI Engine
                ↓
    ┌───────────┼────────────┐
    ↓           ↓            ↓
  Answer      Risk        Recommendation
              Analysis
    └───────────┼────────────┘
                ↓
        Human Validation
                ↓
          Action / Alert
RAG Pipeline

Mission documents are processed through:

Documents
   ↓
Text Extraction
   ↓
Chunking
   ↓
Embeddings
   ↓
Vector Database
   ↓
Semantic Retrieval
   ↓
Relevant Context
   ↓
LLM

RAG helps ground responses in approved mission-specific information instead of relying solely on the model's general knowledge.

Risk Intelligence

The system can combine:

Inventory levels
Fuel consumption
Weather conditions
Route information
Equipment status
Personnel information
Historical mission data

to identify potential operational risks.

AI Flow

COLLECT → PREDICT → SIMULATE → RECOMMEND → RESPOND

5. Technology Stack
Layer	Technologies
Frontend	React, TypeScript, Tailwind CSS
Web/PWA	PWA, Service Worker
Offline Storage	IndexedDB
Backend	Python, FastAPI
API	REST, WebSockets
Database	PostgreSQL
Cache/Tasks	Redis
AI	LLM, ML models
RAG	Embeddings, Vector Database
NLP	NLP pipeline, Speech-to-Text
Maps	MapLibre / offline map data
Authentication	JWT / RBAC
Deployment	Docker
Hardware	GPS, QR/Barcode scanners, sensors
Communication	Internet + available satellite/alternative links

Actual integrations should be documented in /docs/architecture.md as the implementation evolves.

6. Project Structure
dhruva/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── ai/
│   │   ├── rag/
│   │   ├── prediction/
│   │   ├── emergency/
│   │   ├── database/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
│
├── data/
│   ├── documents/
│   ├── maps/
│   └── seed/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── database.md
│   └── deployment.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md

7. Ethical Guidelines

DHRUVA is designed as an AI-assisted decision-support system, not an autonomous authority.

Human Oversight

Critical decisions must remain with authorized expedition personnel.

AI Transparency

The system should clearly distinguish:

Retrieved information
Sensor/database data
AI-generated recommendations
Predictions and uncertainty
No Blind Automation

AI recommendations should not automatically trigger dangerous physical actions.

Data Privacy

Personnel and mission data should be:

Encrypted
Access-controlled
Logged
Stored only when necessary
Reliable Sources

RAG responses should prioritize approved:

SOPs
Equipment manuals
Mission documents
Official operational guidelines
Fail-Safe Design

If AI, GPS, sensors or connectivity fail, essential manual workflows should remain available.

Responsible AI

The system should be tested for:

Hallucinations
Bias
Incorrect retrieval
Unsafe recommendations
Failure under incomplete data

8. Security

DHRUVA should implement:

Role-Based Access Control
Secure authentication
Encrypted communication
Encryption of sensitive local data
Audit logs
API validation
Secure secret management
Offline data protection
Sync conflict detection

9. Development Methodology

DHRUVA follows an iterative development approach:

REQUIREMENTS
     ↓
SYSTEM DESIGN
     ↓
UI/UX PROTOTYPE
     ↓
CORE MODULES
     ↓
OFFLINE LAYER
     ↓
AI + RAG
     ↓
INTEGRATION
     ↓
TESTING
     ↓
FIELD SIMULATION
     ↓
DEPLOYMENT

Testing should include:

Unit testing
API testing
Offline-mode testing
Synchronization testing
AI/RAG evaluation
Security testing
Failure/recovery testing
User acceptance testing

10. License

This project is released under the MIT License.

MIT License

Copyright (c) 2026 DHRUVA Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and sell copies of the Software,
subject to the conditions of the MIT License.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

DHRUVA – One platform. One mission view. Intelligent decisions.

### React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
