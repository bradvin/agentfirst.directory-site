import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const githubUsernameSchema = z
  .string()
  .regex(/^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}$/)
  .refine((value) => !value.endsWith("-"), "Invalid GitHub username");

const categories = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./content/categories" }),
  schema: z.object({
    slug: slugSchema,
    label: z.string().min(1),
    sortOrder: z.number().int().optional(),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/tools" }),
  schema: z.object({
    slug: slugSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    category: reference("categories"),
    tags: z.array(z.string().min(1)).min(1),
    websiteUrl: z.string().url(),
    githubUrl: z.string().url().optional(),
    pricing: z.enum(["open-source", "freemium", "free", "paid"]),
    submittedBy: githubUsernameSchema,
    logoUrl: z.string().url().optional(),
    ogImageUrl: z.string().url().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const collections = { categories, tools };
