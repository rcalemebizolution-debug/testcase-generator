# Casecraft Test Case Generator

A responsive React application that creates structured QA test cases from a module, sub-module, issue details, preconditions, and test steps.

## Run locally

```powershell
npm install
npm run dev
```

## AI-generated real-world scenarios

AI enhanced mode uses Groq through a secure Vercel serverless function. Standard rules remain available as a free fallback.

Add these environment variables in **Vercel → Project → Settings → Environment Variables**:

- `GROQ_API_KEY`: your Groq Console API key
- `AI_ACCESS_CODE`: a private code you type in the app
- `GROQ_MODEL`: optional; defaults to `openai/gpt-oss-120b`

Apply the variables to Production and Preview, then redeploy. Never place an API key in this README, commit it to GitHub, or paste it into screenshots.

## Deploy free on Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Keep the detected Vite settings and deploy.

Vercel provides a public address ending in `.vercel.app` and automatically redeploys future GitHub commits.
