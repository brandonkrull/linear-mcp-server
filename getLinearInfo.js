#!/usr/bin/env node

import { LinearClient } from "@linear/sdk";
import dotenv from "dotenv";

const README = `
# Linear Team Info Extractor
-------------------------

Setup:
1. Install dependencies:
   npm install @linear/sdk dotenv

2. Run in one of two ways:
   
   Option A - Using environment variables:
   LINEAR_API_KEY=your_api_key LINEAR_TEAM_ID=optional_team_id node get_linear_info.js

   Option B - Using command line arguments:
   node get_linear_info.js --apiKey=your_api_key --teamId=optional_team_id

## Output

The script will output a JSON object containing the following information:
- Team ID
- List of labels
- List of statuses
- List of team members with their common labels

## Getting Your Linear API Key

1. Go to Linear's settings
2. Navigate to Account > API
3. Generate a new API key
`;

async function getLinearInfo(apiKey, teamId) {
  if (!apiKey) {
    console.error("Error: Linear API key is required");
    console.log(README);
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });

  try {
    // Get first team (modify if you need a specific team)
    let team = null;
    if (teamId) {
      team = await client.team(teamId);
    } else {
      const teams = await client.teams();
      team = teams.nodes[0];
    }

    // Get team's workflow states
    console.log(`Fetching info for team: ${team.name}`);
    const states = await team.states();
    const statusList = states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
    }));

    // Get organization labels
    console.log("Fetching organization labels...");
    const labels = await team.labels();
    const labelList = labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
    }));

    // Get team members and their issues
    console.log("Fetching team members...");
    const members = await team.members();
    const memberList = await Promise.all(
      members.nodes.map(async (member) => {
        // Get issues assigned to this member
        const issues = await client.issues({
          filter: {
            assignee: { id: { eq: member.id } },
            team: { id: { eq: team.id } },
          },
        });

        // Count label usage
        const labelCounts = {};
        if (issues.nodes && issues.nodes.length > 0) {
          for (const issue of issues.nodes) {
            // Need to await fetching the labels relationship
            const issueLabels = await issue.labels();
            if (issueLabels && issueLabels.nodes) {
              for (const label of issueLabels.nodes) {
                labelCounts[label.id] = (labelCounts[label.id] || 0) + 1;
              }
            }
          }
        }

        // Get top labels (sorted by frequency)
        const topLabels = Object.entries(labelCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([labelId]) => {
            const label = labels.nodes.find((l) => l.id === labelId);
            return label?.name || "Unknown";
          });

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          commonLabels: topLabels,
        };
      })
    );
    // Construct final output
    const output = {
      team_id: team.id,
      labels: labelList,
      statuses: statusList,
      members: memberList,
    };
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("Error fetching Linear data:", error);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      params[key] = value;
    }
  });

  return params;
}

// Main execution
if (process.argv[2] === "--help" || process.argv[2] === "-h") {
  console.log(README);
} else {
  // Load from .env file
  dotenv.config();

  // Check command line args first, fall back to env vars
  const args = parseArgs();
  const apiKey = args.apiKey || process.env.LINEAR_API_KEY;
  const teamId = args.teamId || process.env.LINEAR_TEAM_ID;

  getLinearInfo(apiKey, teamId);
}
