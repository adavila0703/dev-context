import { config } from 'dotenv';
import * as readlineSync from 'readline-sync';
import { Ollama } from '@langchain/community/llms/ollama';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';

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

async function fetchJiraTicket(ticketNumber: string): Promise<void> {
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

        await analyzeWithOllama(issue);

    } catch (error) {
        console.error('Error fetching Jira data:', error);
    }
}

async function analyzeWithOllama(issue: JiraIssue): Promise<void> {
    try {
        const model = new Ollama({ model: "llama2" });
        
        const prompt = ChatPromptTemplate.fromTemplate(`
            Analyze this Jira ticket and provide insights:
            Ticket: {key}
            Summary: {summary}
            Description: {description}
            Status: {status}
            
            Please provide:
            1. A brief analysis of the ticket
            2. Potential next steps or recommendations
            3. Any potential risks or concerns
        `);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        const response = await chain.invoke({
            key: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description || 'No description provided',
            status: issue.fields.status.name
        });

        console.log('\nAI Analysis:');
        console.log(response);
        console.log("-------------------");

    } catch (error) {
        console.error('Error analyzing with Ollama:', error);
    }
}

async function main() {
    console.log("Jira Ticket Analyzer (Press Ctrl+C to exit)");
    
    while (true) {
        const ticketNumber = readlineSync.question('\nEnter Jira ticket number (e.g., PROJ-123): ');
        if (ticketNumber.trim()) {
            await fetchJiraTicket(ticketNumber.trim());
        }
    }
}

main(); 