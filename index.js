#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

function printHelp() {
    console.log(`
Pterodactyl Diff/Patch Applier CLI (ptero-patch)

Usage:
  ptero-patch init [options]
  ptero-patch apply <patch-file-or-url> [options]
  ptero-patch generate [options]
  ptero-patch snapshot list
  ptero-patch snapshot restore <name>

Commands:
  init              Initialize/customize configuration paths
  apply             Apply a unified diff or patch file to the project
  generate          Generate a patch file from a Git repository commit range
  snapshot          Manage backups/snapshots of project files (list or restore)

Options:
  --help, -h        Show help menu
  `);
}

function parseArgs(args) {
    const parsed = {
        _command: args[0],
        _args: [],
        options: {}
    };

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("-")) {
            // Support single char flags and double dash flags
            const cleanKey = arg.replace(/^-+/, "");
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith("-")) {
                parsed.options[cleanKey] = nextArg;
                i++;
            } else {
                parsed.options[cleanKey] = true;
            }
        } else {
            parsed._args.push(arg);
        }
    }
    return parsed;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
        printHelp();
        process.exit(0);
    }

    const parsed = parseArgs(args);
    const command = parsed._command;

    try {
        switch (command) {
            case "init":
                const initCmd = require("./commands/init");
                await initCmd(parsed);
                break;
            case "apply":
                const applyCmd = require("./commands/apply");
                await applyCmd(parsed);
                break;
            case "generate":
                const generateCmd = require("./commands/generate");
                await generateCmd(parsed);
                break;
            case "snapshot":
                const snapshotCmd = require("./commands/snapshot");
                await snapshotCmd(parsed);
                break;
            default:
                console.error(`Unknown command: ${command}`);
                printHelp();
                process.exit(1);
        }
    } catch (err) {
        console.error("Execution failed:", err.message);
        process.exit(1);
    }
}

main();
