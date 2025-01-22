import { LinearClient } from "@linear/sdk";
import dotenv from "dotenv";

async function getLinearInfo() {
  // Load API key from .env
  dotenv.config();
  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  
  if (!apiKey) {
    console.error("LINEAR_API_KEY environment variable is required");
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });

  try {
    // Get first team (modify if you need a specific team)
    const team = await client.team(teamId);
    
    // Get team's workflow states
    const states = await team.states();
    const statusList = states.nodes.map(state => ({
      id: state.id,
      name: state.name
    }));

    // Get organization labels
    const labels = await team.labels();
    const labelList = labels.nodes.map(label => ({
      id: label.id,
      name: label.name
    }));

    // Construct final output
    const output = {
      team_id: team.id,
      labels: labelList,
      statuses: statusList
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("Error fetching Linear data:", error);
  }
}

getLinearInfo();