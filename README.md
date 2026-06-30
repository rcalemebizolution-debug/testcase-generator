# Casecraft Test Case Generator

A responsive React application that creates structured QA test cases from a module, sub-module, issue details, preconditions, and test steps.

## Run locally

```powershell
npm install
npm run dev
```

## AI-generated real-world scenarios with paid license limits

AI enhanced mode uses Groq through a secure Vercel serverless function. Standard rules remain available as a free fallback.

Add these environment variables in **Vercel -> Project -> Settings -> Environment Variables**:

- `GROQ_API_KEY`: your Groq Console API key
- `GROQ_MODEL`: optional; defaults to `openai/gpt-oss-120b`
- `UPSTASH_REDIS_REST_URL`: your Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: your Upstash Redis REST token
- `ADMIN_API_KEY`: private key for managing paid licenses
- `QUOTA_TIMEZONE`: optional; defaults to `Asia/Manila`
- `MAX_COMPLETION_TOKENS_CEILING`: optional hard cap across all licenses

Apply the variables to Production and Preview, then redeploy. Never place an API key in this README, commit it to GitHub, or paste it into screenshots.

## License quota model

Each paid coworker should get a unique license key. The backend enforces:

- monthly generation limit
- monthly token limit
- hard max completion tokens per request
- extra IP rate limiting for burst protection

The app now expects a `License key` in the UI instead of one shared access code.

## Create or update a paid license

Create a new license:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-admin-api-key" = "YOUR_ADMIN_API_KEY"
}

$body = @{
  label = "QA Team - Maria"
  monthlyGenerationLimit = 60
  monthlyTokenLimit = 90000
  maxCompletionTokens = 800
  enabled = $true
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://YOUR-APP.vercel.app/api/admin/licenses" -Headers $headers -Body $body
```

Update an existing license:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-admin-api-key" = "YOUR_ADMIN_API_KEY"
}

$body = @{
  licenseKey = "cc-your-existing-license-key"
  label = "QA Team - Maria"
  monthlyGenerationLimit = 80
  monthlyTokenLimit = 120000
  maxCompletionTokens = 900
  enabled = $true
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://YOUR-APP.vercel.app/api/admin/licenses" -Headers $headers -Body $body
```

List current licenses and usage:

```powershell
Invoke-RestMethod -Method Get -Uri "https://YOUR-APP.vercel.app/api/admin/licenses" -Headers @{ "x-admin-api-key" = "YOUR_ADMIN_API_KEY" }
```

## Deploy free on Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Keep the detected Vite settings and deploy.

Vercel provides a public address ending in `.vercel.app` and automatically redeploys future GitHub commits.
