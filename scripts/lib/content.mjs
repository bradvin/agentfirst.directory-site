import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const CATEGORY_DIR = path.join(process.cwd(), "content/categories");
const TOOL_DIR = path.join(process.cwd(), "content/tools");
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRICING_VALUES = new Set(["open-source", "freemium", "free", "paid"]);
const GITHUB_USERNAME_PATTERN = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}$/;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      return [fullPath];
    }),
  );

  return files.flat();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalInteger(value) {
  return value === undefined || Number.isInteger(value);
}

function isGitHubUsername(value) {
  return isNonEmptyString(value) && GITHUB_USERNAME_PATTERN.test(value) && !value.endsWith("-");
}

function validateUrl(value, fieldName, errors, sourcePath) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push(`${sourcePath}: ${fieldName} must use http or https`);
    }
  } catch {
    errors.push(`${sourcePath}: ${fieldName} must be a valid URL`);
  }
}

export async function readCategories() {
  const files = (await walk(CATEGORY_DIR)).filter((file) => file.endsWith(".json"));
  const categories = [];

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw);
    const slugFromPath = path.basename(file, ".json");
    categories.push({
      ...data,
      sourcePath: path.relative(process.cwd(), file),
      slugFromPath,
    });
  }

  return categories;
}

export async function readTools() {
  const files = (await walk(TOOL_DIR)).filter((file) => file.endsWith(".md"));
  const tools = [];

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const parsed = matter(raw);
    const slugFromPath = path.basename(file, ".md");
    tools.push({
      ...parsed.data,
      body: parsed.content.trim(),
      sourcePath: path.relative(process.cwd(), file),
      slugFromPath,
    });
  }

  return tools;
}

export async function loadContent() {
  const categories = await readCategories();
  const tools = await readTools();
  return { categories, tools };
}

export async function validateContent() {
  const { categories, tools } = await loadContent();
  const errors = [];
  const categorySlugs = new Set();
  const toolSlugs = new Set();

  for (const category of categories) {
    if (!isNonEmptyString(category.slug)) {
      errors.push(`${category.sourcePath}: slug is required`);
    } else {
      if (!SLUG_PATTERN.test(category.slug)) {
        errors.push(`${category.sourcePath}: slug must be kebab-case`);
      }

      if (category.slug !== category.slugFromPath) {
        errors.push(
          `${category.sourcePath}: slug must match filename (${category.slugFromPath})`,
        );
      }
    }

    if (!isNonEmptyString(category.label)) {
      errors.push(`${category.sourcePath}: label is required`);
    }

    if (!isOptionalInteger(category.sortOrder)) {
      errors.push(`${category.sourcePath}: sortOrder must be an integer when present`);
    }

    if (categorySlugs.has(category.slug)) {
      errors.push(`${category.sourcePath}: duplicate category slug "${category.slug}"`);
    }

    categorySlugs.add(category.slug);
  }

  for (const tool of tools) {
    if (!isNonEmptyString(tool.slug)) {
      errors.push(`${tool.sourcePath}: slug is required`);
    } else {
      if (!SLUG_PATTERN.test(tool.slug)) {
        errors.push(`${tool.sourcePath}: slug must be kebab-case`);
      }

      if (tool.slug !== tool.slugFromPath) {
        errors.push(`${tool.sourcePath}: slug must match filename (${tool.slugFromPath})`);
      }
    }

    if (!isNonEmptyString(tool.name)) {
      errors.push(`${tool.sourcePath}: name is required`);
    }

    if (!isNonEmptyString(tool.description)) {
      errors.push(`${tool.sourcePath}: description is required`);
    }

    if (!isNonEmptyString(tool.body)) {
      errors.push(`${tool.sourcePath}: markdown body is required`);
    }

    if (!isNonEmptyString(tool.category)) {
      errors.push(`${tool.sourcePath}: category is required`);
    } else if (!categorySlugs.has(tool.category)) {
      errors.push(
        `${tool.sourcePath}: category "${tool.category}" does not exist in content/categories`,
      );
    }

    if (!Array.isArray(tool.tags) || tool.tags.length === 0) {
      errors.push(`${tool.sourcePath}: tags must be a non-empty array`);
    } else {
      for (const tag of tool.tags) {
        if (!isNonEmptyString(tag)) {
          errors.push(`${tool.sourcePath}: tags must contain only non-empty strings`);
          break;
        }
      }
    }

    if (!PRICING_VALUES.has(tool.pricing)) {
      errors.push(
        `${tool.sourcePath}: pricing must be one of ${Array.from(PRICING_VALUES).join(", ")}`,
      );
    }

    if (!isGitHubUsername(tool.submittedBy)) {
      errors.push(`${tool.sourcePath}: submittedBy must be a valid GitHub username`);
    }

    if (!isOptionalInteger(tool.sortOrder)) {
      errors.push(`${tool.sourcePath}: sortOrder must be an integer when present`);
    }

    validateUrl(tool.websiteUrl, "websiteUrl", errors, tool.sourcePath);
    validateUrl(tool.githubUrl, "githubUrl", errors, tool.sourcePath);
    validateUrl(tool.logoUrl, "logoUrl", errors, tool.sourcePath);
    validateUrl(tool.ogImageUrl, "ogImageUrl", errors, tool.sourcePath);

    if (toolSlugs.has(tool.slug)) {
      errors.push(`${tool.sourcePath}: duplicate tool slug "${tool.slug}"`);
    }

    toolSlugs.add(tool.slug);
  }

  return {
    categories,
    tools,
    errors,
  };
}
