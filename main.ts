import { config } from 'dotenv';
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

async function fetchJiraData(): Promise<void> {
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    const jiraDomain = process.env.JIRA_DOMAIN;

    if (!email || !apiToken || !jiraDomain) {
        console.log("Please set JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables");
        return;
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const jql = "project = YOUR_PROJECT_KEY ORDER BY created DESC";
    const url = `https://${jiraDomain}/rest/api/2/search?jql=${jql}`;

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

        jiraResp.issues.forEach(issue => {
            console.log(`Issue Key: ${issue.key}`);
            console.log(`Summary: ${issue.fields.summary}`);
            console.log(`Status: ${issue.fields.status.name}`);
            console.log("-------------------");
        });

    } catch (error) {
        console.error('Error fetching Jira data:', error);
    }
}

fetchJiraData(); 