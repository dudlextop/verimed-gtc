import { lstat, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function ensureLink(target, link, type) {
  try {
    const existingLink = await lstat(link);
    if (!existingLink.isSymbolicLink()) {
      throw new Error(`Путь ${link} уже существует и не является ссылкой`);
    }
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    await symlink(target, link, type);
  }
}

if (process.env.VERCEL === "1") {
  const serviceRoot = process.cwd();
  const repositoryRoot = dirname(serviceRoot);

  await Promise.all([
    ensureLink(resolve(serviceRoot, ".next"), resolve(repositoryRoot, ".next"), "dir"),
    ensureLink(
      resolve(serviceRoot, "node_modules"),
      resolve(repositoryRoot, "node_modules"),
      "dir",
    ),
    ensureLink(resolve(serviceRoot, "package.json"), resolve(repositoryRoot, "package.json"), "file"),
  ]);
}
