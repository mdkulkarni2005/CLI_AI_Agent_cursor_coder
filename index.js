import { OpenAI } from "openai/client.js";
import { exec } from "node:child_process";
import 'dotenv/config';
import readline from "readline";

const OPENAI_API_KEY = process.env.OPENAI_KEY;

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

function getWeatherInfo(cityname) {
  return `${cityname} has 43 degree C`;
}

function executeCommand(command) {
  return new Promise ((resolve, rejcet) => {
    exec(command, function (err, stdout, stderr) {
      if(err) {
        return reject(err)
      }
      resolve(`stdoutL ${stdout} \nstderr:${stderr}`)
    })
  })
}

const TOOLS_MAP = {
  getWeatherInfo: getWeatherInfo,
  executeCommand: executeCommand
};

const SYSTEM_PROMPT = `
    you are an helful AI assistant who is designed to resolve user query.
    you work on START, THINK, ACTION, OBSERVE and OUTPUT Mode.

    in start phase, user gives a query to you.
    Then, you THINK how to resolve that query atleast 3-4 time and make sure that all is clear.
    If ther ei need to call a tool, you call an ACTION event with tool and input parameters.
    if there is an action call, wait for the OBSERVE that is output of the tools
    based on the OBSERVE from prev step, you either output or repeat the loop 

    Rules:
    - Always wait for next step.
    - Always output a single step and wait for the next step
    - Output must be strictly JSON
    - Only call tool action form Available tools only. 
    - Strictly follow the output formate in JSON

    Available Tools:
    - getWeatherInfo(city: string):string
    - executeCommand(command):string executes a given linux command on user's device and return the STDOUT and STDERR

    Example:
    START: What is weather of Patiala?
    THINK: The use is aksing for the weather of Patiala.
    THINK: From the available tools, I must call getWeatherInfo tool for Patila as input
    ACTION: Call Tool getWeatherInfo(patiala)
    OBSERVE: 32 Degree C
    THINK: The output of getWeatherInfo for patiala is 32 Degree C
    OUTPUT: Hey, The Weather of Patiala is 32 Degreee C which is quite hot.

    Output Example: 
    { "role": "user", "content": "What is weather of patiala?" }
    { "step": "think", "content": "The use is aksing for the weather of Patiala." }
    { "step": "think", "content": "From the available tools, I must call getWeatherInfo tool for Patila as input" }
    { "step": "action", "tool": "getWeatherInfo", "input": "patiala" }
    { "step": "observe", "content": "32 Degree C" }
    { "step": "output", "content": "Hey, The Weather of Patiala is 32 Degreee C which is quite hot" }

    Output Formate:
    {"step": "string", "tool": "string", "input": "string", "content": "string"}
`;

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("How may I help you? ", async (userQuery) => {
    rl.close();
    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      { role: "user", content: userQuery }
    ];

    while (true) {
      const response = await client.chat.completions.create({
        model: "gpt-4.1",
        response_format: { type: "json_object" },
        messages: messages,
      });
      messages.push({
        role: "assistant",
        content: response.choices[0].message.content,
      });
      const parsed_response = JSON.parse(response.choices[0].message.content);

      if (parsed_response.step && parsed_response.step === "think") {
        console.log(`AI: ${parsed_response.content}`);
        continue;
      }
      if (parsed_response.step && parsed_response.step === "output") {
        console.log(`BOT: ${parsed_response.content}`);
        break;
      }
      if (parsed_response.step && parsed_response.step === "action") {
        const tool = parsed_response.tool;
        const input = parsed_response.input;

        const value = await TOOLS_MAP[tool](input);
        console.log(`Tool Call: ${tool}: (${input}): (${value})`);

        messages.push({
          role: "assistant",
          content: JSON.stringify({ step: "observe", content: value }),
        });
      }
      continue;
    }
  });
}

main();