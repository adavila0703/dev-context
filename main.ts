import { config } from 'dotenv';
import * as readlineSync from 'readline-sync';
import { Ollama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';

config();

interface JiraStatus {
  name: string;
}

interface JiraFields {
  summary: string;
  description: string;
  status: JiraStatus;
}

interface JiraIssue {
  key: string;
  fields: JiraFields;
}

interface JiraResponse {
  issues: JiraIssue[];
}

interface GitHubPRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
}

interface DevelopmentContext {
  jiraIssue?: JiraIssue;
  pullRequest?: {
    pr: GitHubPR;
    files: GitHubPRFile[];
  };
}

async function fetchJiraTicket(ticketNumber: string): Promise<JiraIssue | undefined> {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const jiraDomain = process.env.JIRA_DOMAIN;

  if (!email || !apiToken || !jiraDomain) {
    console.log("Please set JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables");
    return;
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const jql = `key = ${ticketNumber}`;
  const url = `https://${jiraDomain}/rest/api/2/search?jql=${encodeURIComponent(jql)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error: API returned status code ${response.status}`);
      console.log(`Response body: ${errorText}`);
      return;
    }

    const jiraResp: JiraResponse = await response.json();

    if (jiraResp.issues.length === 0) {
      console.log(`No ticket found with number ${ticketNumber}`);
      return;
    }

    const issue = jiraResp.issues[0];
    console.log('\nTicket Details:');
    console.log(`Issue Key: ${issue.key}`);
    console.log(`Summary: ${issue.fields.summary}`);
    console.log(`Status: ${issue.fields.status.name}`);
    console.log(`Description: ${issue.fields.description || 'No description provided'}`);
    console.log("-------------------");

    return issue;

  } catch (error) {
    console.error('Error fetching Jira data:', error);
    return;
  }
}

async function fetchGitHubPR(prNumber: string, repo: string): Promise<{ pr: GitHubPR; files: GitHubPRFile[] } | undefined> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;

  if (!token || !owner || !repo) {
    console.log("Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables");
    return;
  }

  try {
    const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;

    const [prResponse, filesResponse] = await Promise.all([
      fetch(prUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }),
      fetch(filesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
    ]);

    if (!prResponse.ok || !filesResponse.ok) {
      console.log(`Error: API returned status code ${prResponse.status} or ${filesResponse.status}`);
      return;
    }

    const pr: GitHubPR = await prResponse.json();
    const files: GitHubPRFile[] = await filesResponse.json();

    console.log('\nPull Request Details:');
    console.log(`PR #${pr.number}: ${pr.title}`);
    console.log(`State: ${pr.state}`);
    console.log(`Created by: ${pr.user.login}`);
    console.log(`Created at: ${new Date(pr.created_at).toLocaleString()}`);
    console.log(`Last updated: ${new Date(pr.updated_at).toLocaleString()}`);
    console.log('\nModified Files:');

    files.forEach(file => {
      console.log(`\nFile: ${file.filename}`);
      console.log(`Status: ${file.status}`);
      console.log(`Changes: +${file.additions} -${file.deletions}`);
      if (file.patch) {
        console.log('\nCode changes:');
        console.log(file.patch);
      }
    });

    console.log("-------------------");

    return { pr, files };

  } catch (error) {
    console.error('Error fetching GitHub PR data:', error);
    return;
  }
}

async function analyzeWithOllama(context: DevelopmentContext): Promise<void> {
  try {
    const model = new Ollama({
      model: process.env.OLLAMA_MODEL,
      temperature: Number.parseFloat(process.env.OLLAMA_TEMPERATURE || "0.5"),
      maxRetries: Number.parseInt(process.env.OLLAMA_MAX_RETRIES || '3'),
    });

    console.log('Connecting with model:', model.model);

    const prompt = PromptTemplate.fromTemplate(`
  You are a senior software engineer preparing to review a pull request. Before diving into the code, you want a clear and concise summary of the Jira ticket and how the PR addresses it.


  ${context.jiraIssue ? `
  **Jira Data:**  
  - Ticket: {jira_key}  
  - Summary: {jira_summary}  
  - Description: {jira_description}  
  - Status: {jira_status}  
  ` : ''}

  ${context.pullRequest ? `
  **Pull Request Data:**  
  - PR #{pr_number}: {pr_title}  
  - State: {pr_state}  
  - Created by: {pr_author}  
  - Description: {pr_body}  

  **Modified Files:**  
  {pr_files}  

  **Code Changes:**  
  {pr_patches}  

  Responde in this format:

  **Context (One Paragraph):**  
  Summarize the Jira ticket in a way that highlights the core problem and any relevant technical details. Then, briefly explain how the PR attempts to resolve it, focusing only on the most critical aspects of the changes. Be clear and concise.

  **Opinion:**  
  Analyze whether the PR effectively solves the problem. If it does, explain why the approach is appropriate. If not, highlight gaps, risks, or alternative approaches that might be better. Keep it direct and actionable.
  ` : ''}
`);

    const chain = prompt.pipe(model);

    const response = await chain.invoke({
      jira_key: context.jiraIssue?.key || '',
      jira_summary: context.jiraIssue?.fields.summary || '',
      jira_description: context.jiraIssue?.fields.description || '',
      jira_status: context.jiraIssue?.fields.status.name || '',
      pr_number: context.pullRequest?.pr.number || '',
      pr_title: context.pullRequest?.pr.title || '',
      pr_state: context.pullRequest?.pr.state || '',
      pr_author: context.pullRequest?.pr.user.login || '',
      pr_body: context.pullRequest?.pr.body || '',
      pr_files: context.pullRequest?.files.map(f =>
        `${f.filename} (${f.status}): +${f.additions} -${f.deletions}`
      ).join('\n') || '',
      pr_patches: context.pullRequest?.files.map(f =>
        `=== ${f.filename} ===\n${f.patch || 'No patch available'}`
      ).join('\n\n') || ''
    });

    console.log('\nAI Analysis:');
    console.log(response);
    console.log("-------------------");

  } catch (error) {
    console.error('Error analyzing with Ollama:', error);
  }
}

async function main() {
  console.log("Development Context Tool (Press Ctrl+C to exit)");

  while (true) {
    const context: DevelopmentContext = {};

    console.log("\nEnter information (press Enter to skip):");
    const repo = readlineSync.question('Repo name: ');
    const ticketNumber = readlineSync.question('Jira ticket number (e.g., PROJ-123): ');
    const prNumber = readlineSync.question('GitHub PR number: ');

    if (ticketNumber.trim()) {
      context.jiraIssue = await fetchJiraTicket(ticketNumber.trim());
    }

    if (prNumber.trim()) {
      context.pullRequest = await fetchGitHubPR(prNumber.trim(), repo.trim());
    }

    if (context.jiraIssue || context.pullRequest) {
      await analyzeWithOllama(context);
    } else {
      console.log('No data provided. Please enter at least one identifier.');
    }
  }
}

main(); 
