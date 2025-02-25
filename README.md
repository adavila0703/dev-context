# dev-context

A development context tool that combines Jira ticket and GitHub PR information for better code review context.

## Getting started

1. Copy `.env.example` to `.env` and fill in your credentials:

### Jira Setup
- Go to your Jira account -> Profile -> Security -> Create API token
- Fill in your `.env`:
  - `JIRA_EMAIL`: Your Jira account email
  - `JIRA_API_TOKEN`: The API token you created
  - `JIRA_DOMAIN`: Your Jira domain (e.g., your-company.atlassian.net)

### GitHub Setup
- Go to GitHub Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic)
- Generate a new token with `repo` scope
- Fill in your `.env`:
  - `GITHUB_TOKEN`: Your personal access token
  - `GITHUB_OWNER`: The owner of the repository (username or organization)
  - `GITHUB_REPO`: The name of the repository

### Running the Tool
1. Install dependencies: `npm install`
2. Download and install Ollama
3. Install bun `npm install -g bun`
4. bun main.ts

## Usage
- Enter a Jira ticket number (e.g., PROJ-123) to get ticket details
- Enter a GitHub PR number to get PR details
- The tool will analyze both and provide insights for code review

