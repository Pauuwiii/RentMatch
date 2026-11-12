import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");

const html = readFileSync(resolve(dist, "index.template.html"), "utf8").replace(/\r\n/g, "\n");
writeFileSync(resolve(dist, "index.html"), html);

for (const directory of ["js", "css"]) {
  const source = resolve(dist, directory);
  const destination = resolve(root, directory);
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}
