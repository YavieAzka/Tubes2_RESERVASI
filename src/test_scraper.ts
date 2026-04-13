import { scrapeHTML } from "./scraper";

async function main() {
  const html = await scrapeHTML("https://example.com");
  console.log(html.substring(0, 500)); // Tampilkan 500 karakter pertama
}

main();