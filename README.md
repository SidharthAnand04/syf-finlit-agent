# SYF Financial Literacy AI Chatbot

TMGT 461 – Hoeft Technology & Management Program  
University of Illinois Urbana-Champaign  

## Overview

This repository contains a proof-of-concept AI-powered financial literacy chatbot developed for Synchrony Financial.

The chatbot addresses customer confusion around credit products by providing clear, structured, plain-language explanations of:

- Deferred interest promotions  
- Payment allocation rules  
- Statement vs. current balance  
- Promotional payoff amounts  
- Residual (trailing) interest  
- Grace period mechanics  
- Minimum payment implications  

The system embeds financial education directly into the credit product exploration journey to improve transparency and customer confidence.



## Scope

This prototype is intentionally limited to:

- Synchrony → Financing → Credit Cards & Loans pages  

Not included:

- Synchrony Bank  
- Business products  
- CareCredit  
- Real-time account data  
- Credit decisioning  
- Personal financial advice  

This is an educational tool only.



## Architecture

High-level system flow:

User → Web Chat → Guardrails → Intent Router  
→ Retriever (Vector DB) → Prompt Builder  
→ LLM → Structured Educational Response  

### Core Components

- Frontend: Web-based chat UI  
- Backend: Python (FastAPI / Flask)  
- Retrieval: Embedded Synchrony public content  
- LLM: OpenAI / Claude  
- Logging: Output validation + quality tracking  



## Features

### Educational Explanations
Explains credit concepts in structured, plain language.

### Scenario-Based Guidance
Users can describe situations (e.g., “Why was I charged interest?”) and receive contextual explanations.

### Compliance Guardrails
- No personal data collection  
- No credit decisions  
- No hallucinated promotions  
- Redirects out-of-scope queries  



## Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/syf-financial-literacy-chatbot.git
cd syf-financial-literacy-chatbot
```
### 2. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Add Environment Variables

Create `.env` file:

```
OPENAI_API_KEY=your_key_here
VECTOR_DB_PATH=./vector_store
```

### 5. Run Backend

```bash
python app.py
```

### 6. Run Frontend

```bash
npm install
npm run dev
```



## Validation

The chatbot was tested against a structured question bank derived from common credit-related customer confusion.

Evaluation criteria:

* Factual accuracy
* Plain-language clarity
* Compliance boundary adherence
* Tone consistency

Future improvements include automated LLM-based grading and expanded edge-case testing.

## Limitations

* Prototype-level system
* Educational use only
* No real-time financial data
* Not production-integrated


## Team

- Sidharth Anand
- Ella Bruks
- Anushka Gautam
- Federico Vegas

Spring 2026
Synchrony Financial Capstone Project
