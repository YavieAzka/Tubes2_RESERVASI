import { NextResponse } from "next/server";
// Import dari engine scraper yang sudah Anda buat.
// Asumsi: engine berada di folder root proyek (Tubes2_RESERVASI/src/)
import { scrapeHTML } from "@/core/scraper";
import { DOMParser } from "@/core/parser";
import { SelectorMatcher } from "@/core/selector-matcher";
import { DOMNode } from "@/core/domtree";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, selector } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL tidak diberikan" },
        { status: 400 },
      );
    }

    // 1. Ambil HTML mentah dari website target
    const htmlString = await scrapeHTML(url);

    // 2. Parse HTML menjadi struktur DOM Tree kustom Anda
    const root = DOMParser.parse(htmlString);

    let results: any[] = [];

    // 3. Jika ada input selector CSS, gunakan SelectorMatcher untuk mencari data
    if (selector && selector.trim() !== "") {
      const matchedNodes: DOMNode[] = SelectorMatcher.querySelectorAll(
        root,
        selector,
      );

      // Format hasil pencarian agar mudah ditampilkan di frontend (JSON)
      results = matchedNodes.map((node) => ({
        tag: node.tag,
        text: node.text,
        attributes: node.attributes,
        // Optional: menampilkan class atau id untuk kemudahan debugging
        classes: node.classes,
        id: node.id,
      }));
    } else {
      // Jika tidak ada selector, kita bisa kembalikan informasi root saja
      // Peringatan: Jangan mengembalikan seluruh root tree karena ukurannya bisa terlalu besar
      // sehingga menyebabkan error Maximum Call Stack / Out of Memory saat di stringify JSON.
      results = [
        {
          info: "Tidak ada selector spesifik yang diminta. Menampilkan sebagian dari dokumen HTML.",
          htmlPreview: htmlString.substring(0, 500) + "...",
        },
      ];
    }

    return NextResponse.json({
      success: true,
      message: "Scraping & Parsing berhasil",
      matchedCount: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error("Scraping Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Terjadi kesalahan internal" },
      { status: 500 },
    );
  }
}
