package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type JiraIssue struct {
	Key    string `json:"key"`
	Fields struct {
		Summary     string `json:"summary"`
		Description string `json:"description"`
		Status      struct {
			Name string `json:"name"`
		} `json:"status"`
	} `json:"fields"`
}

type JiraResponse struct {
	Issues []JiraIssue `json:"issues"`
}

func main() {
	email := os.Getenv("JIRA_EMAIL")
	apiToken := os.Getenv("JIRA_API_TOKEN")
	jiraDomain := os.Getenv("JIRA_DOMAIN")

	if email == "" || apiToken == "" || jiraDomain == "" {
		fmt.Println("Please set JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables")
		return
	}

	auth := base64.StdEncoding.EncodeToString([]byte(email + ":" + apiToken))

	client := &http.Client{}
	jql := "project = YOUR_PROJECT_KEY ORDER BY created DESC"
	url := fmt.Sprintf("https://%s/rest/api/2/search?jql=%s", jiraDomain, jql)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Add("Authorization", "Basic "+auth)
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Error: API returned status code %d\n", resp.StatusCode)
		fmt.Printf("Response body: %s\n", string(body))
		return
	}

	var jiraResp JiraResponse
	err = json.Unmarshal(body, &jiraResp)
	if err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		return
	}

	for _, issue := range jiraResp.Issues {
		fmt.Printf("Issue Key: %s\n", issue.Key)
		fmt.Printf("Summary: %s\n", issue.Fields.Summary)
		fmt.Printf("Status: %s\n", issue.Fields.Status.Name)
		fmt.Printf("-------------------\n")
	}
}
