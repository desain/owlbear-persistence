#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readContentFile(filename) {
    const path = resolve(rootDir, "docs", "content", filename);
    return readFileSync(path, "utf-8");
}

function replaceSection(fileContent, sectionHeader, nextSectionHeader) {
    // Replace the features section
    const match = fileContent.match(
        new RegExp(
            `(## ${sectionHeader}\\n\\n)([\\s\\S]*?)(\\n\\n## ${nextSectionHeader})`,
        ),
    );
    if (match) {
        const contentFilename =
            sectionHeader.toLowerCase().replaceAll(" ", "-") + ".md";
        const lines = readContentFile(contentFilename).split("\n").slice(2); // Skip the header
        const text = lines.join("\n").trim();
        return fileContent.replace(match[0], `${match[1]}${text}${match[3]}`);
    }
}

function updateFile(...pathElems) {
    const path = resolve(rootDir, ...pathElems);
    let content = readFileSync(path, "utf-8");

    content = replaceSection(content, "Features", "How to use");
    content = replaceSection(content, "How to use", "Development|$");

    writeFileSync(path, content);
    console.log(`✅ Updated ${path}`);
}

function main() {
    console.log("🔧 Building documentation...");

    try {
        updateFile("README.md");
        updateFile("docs", "store.md");
        console.log("✅ Documentation build complete!");
    } catch (error) {
        console.error("❌ Documentation build failed:", error.message);
        process.exit(1);
    }
}

main();
