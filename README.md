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

## Deploy free on Vercel

1. Create a GitHub repository and upload this project.
2. Sign in to [Vercel](https://vercel.com/) using GitHub.
3. Select **Add New → Project**, then import the repository.
4. Keep the detected Vite settings and select **Deploy**.

Vercel will provide a free public address ending in `.vercel.app`. Future pushes to the GitHub repository will deploy automatically.
