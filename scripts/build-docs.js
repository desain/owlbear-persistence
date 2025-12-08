#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function replaceFrontmatter(content, key, value) {
    const regex = new RegExp(`^(${key}: ).*$`, "m");
    return content.replace(regex, `$1${value}`);
}

function syncMetadata() {
    // Read package.json
    const packageJsonPath = resolve(rootDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const { description, author } = packageJson;
    if (description.length >= 128) {
        throw Error("description.length >= 128");
    }

    // Update manifest.json
    const manifestPath = resolve(rootDir, "public", "manifest.json");
    const manifestJson = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const { name, homepage_url: homepageUrl } = manifestJson;
    manifestJson.description = description;
    manifestJson.author = author;
    writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + "\n");
    console.log(`✅ Synced ${manifestPath}`);

    // Update docs/store.md
    const storeMdPath = resolve(rootDir, "docs", "store.md");
    let storeMdContent = readFileSync(storeMdPath, "utf-8");

    storeMdContent = replaceFrontmatter(storeMdContent, "title", name);
    storeMdContent = replaceFrontmatter(
        storeMdContent,
        "description",
        description,
    );
    storeMdContent = replaceFrontmatter(storeMdContent, "author", author);
    storeMdContent = replaceFrontmatter(
        storeMdContent,
        "learn-more",
        homepageUrl,
    );
    storeMdContent = storeMdContent.replace(/^# .*$/m, `# ${name}`);

    writeFileSync(storeMdPath, storeMdContent);
    console.log(`✅ Synced ${storeMdPath}`);
}

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
    return fileContent;
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
        syncMetadata();
        updateFile("README.md");
        updateFile("docs", "store.md");
        console.log("✅ Documentation build complete!");
    } catch (error) {
        console.error("❌ Documentation build failed:", error.message);
        process.exit(1);
    }
}

main();
