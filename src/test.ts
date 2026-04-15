import { DOMParser } from "./parser";
import { DOMNode } from "./domtree";

// 1. Siapkan HTML Mentah (mengandung berbagai edge cases)
const rawHTML = `
<html>
  <head>
    <meta charset="UTF-8">
    <title>Anime Party List</title>
    </head>
  <body>
    <div id="app" class="container dark-mode">
      <h1 class="header">Frieren & Friends</h1>
      <p>Daftar party pengantar Frieren:</p>
      <ul id="party-list">
        <li class="member mage">Fern <img src="fern.png"></li>
        <li class="member warrior">Stark <br></li>
      </ul>
    </div>
  </body>
</html>
`;

// 2. Eksekusi Parser
console.log("Memulai proses parsing HTML...");
const rootNode = DOMParser.parse(rawHTML);
console.log("Parsing selesai!\n");

// 3. Fungsi Helper untuk memvisualisasikan DOM Tree ke Terminal
function printTree(node: DOMNode, depth: number = 0) {
  // Buat indentasi berdasarkan kedalaman node
  const indent = "  ".repeat(depth);

  // Format atribut agar mudah dibaca
  let attrStr = "";
  const attrs = Object.entries(node.attributes);
  if (attrs.length > 0) {
    attrStr = " " + attrs.map(([key, val]) => `${key}="${val}"`).join(" ");
  }

  // Cetak node ke console
  if (node.tag === "#text") {
    console.log(`${indent} "${node.text}"`);
  } else if (node.tag === "#document") {
    console.log(`${indent} ROOT: #document`);
  } else {
    console.log(`${indent} <${node.tag}${attrStr}>`);
  }

  // Rekursi: Cetak semua anak-anaknya dengan kedalaman + 1
  for (const child of node.children) {
    printTree(child, depth + 1);
  }
}

console.log("=== VISUALISASI DOM TREE ===");
printTree(rootNode);
