import { LinearClient } from "@linear/sdk";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

export async function getLinearInfo() {
  // Load API key from .env
  dotenv.config();
  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;

  if (!apiKey) {
    console.error("LINEAR_API_KEY environment variable is required");
    process.exit(1);
  }
  // Check if cached data exists and is from today
  const cacheFile = 'linear-cache.json';

  try {
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const lastModified = new Date(stats.mtime);
      const now = new Date();
      
      // Check if the file was created today
      if (lastModified.toDateString() === now.toDateString()) {
        console.log('Using cached Linear data from today');
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        return cachedData;
      }
    }
  } catch (err) {
    console.error('Error checking cache:', err);
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
    const states = await team.states();
    const statusList = states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
    }));

    // Get organization labels
    const labels = await team.labels();
    const labelList = labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
    }));

    // Get team members and their issues
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
          .slice(0, 1) // Get top 5 labels
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

    // Write output to JSON file
    fs.writeFileSync('linear_info.json', JSON.stringify(output, null, 2));
    console.log('Linear info written to linear_info.json');
  } catch (error) {
    console.error("Error fetching Linear data:", error);
  }
}

getLinearInfo();