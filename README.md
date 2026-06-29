# Casecraft Test Case Generator

A responsive React application that generates structured QA test cases from:

- Main module and sub module
- Issue title and details
- Preconditions
- Test steps
- Priority and coverage depth

## Run locally

```powershell
npm install
npm run dev
```

Open the local address shown in the terminal. Use **Use example** to load sample content, or enter your own issue details and select **Generate test cases**.

## Production build

```powershell
npm run build
```

The app keeps draft form content in the browser, validates required fields, and supports copying or downloading the generated suite.

## AI-generated real-world scenarios

The app includes an optional **AI enhanced** mode backed by a secure Vercel serverless function. Standard rules remain available if AI is not configured or temporarily unavailable.

Create these environment variables in Vercel under **Project → Settings → Environment Variables**:

- `OPENAI_API_KEY`: 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
- `AI_ACCESS_CODE`: a private code you will type into the app before generating
- `OPENAI_MODEL`: optional; defaults to `gpt-5.4-mini`

Apply the variables to Production, Preview, and Development, then redeploy the project. Never upload a `.env` file or API key to GitHub.

For local AI testing, copy `.env.example` to `.env.local`, add your private values, and run the project with `vercel dev`. Regular `npm run dev` continues to support Standard rules mode.

## Deploy free on Vercel

1. Create a GitHub repository and upload this project.
2. Sign in to [Vercel](https://vercel.com/) using GitHub.
3. Select **Add New → Project**, then import the repository.
4. Keep the detected Vite settings and select **Deploy**.

Vercel will provide a free public address ending in `.vercel.app`. Future pushes to the GitHub repository will deploy automatically.
