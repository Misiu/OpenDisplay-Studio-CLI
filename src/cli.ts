#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { initProject } from "./init.js";
import { publishProject } from "./publish.js";
import { serveProject } from "./serve.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version?: unknown };

if (typeof packageJson.version !== "string") {
  throw new Error("Missing package version in package.json");
}

const program = new Command();
program
  .name("odstudio")
  .description("OpenDisplay Studio widget development CLI")
  .version(packageJson.version, "-v, --version");

program.command("init")
  .argument("<name>", "widget/project name")
  .description("Create a new widget project")
  .action(async (name: string) => {
    const target = await initProject(name);
    console.log(`Created ${target}`);
    console.log(`Next: cd ${target} && odstudio serve`);
  });

program.command("serve")
  .description("Start the live preview workbench")
  .option("-p, --port <port>", "port", "7341")
  .option("--no-open", "do not open the browser")
  .action(async (options: { port: string; open: boolean }) => {
    await serveProject(process.cwd(), Number(options.port), options.open);
  });

program.command("publish")
  .description("Validate and build a distributable widget folder and ZIP")
  .action(async () => {
    const result = await publishProject();
    console.log(`Folder: ${result.packageDir}`);
    console.log(`ZIP:    ${result.zipPath}`);
  });

await program.parseAsync(process.argv);
