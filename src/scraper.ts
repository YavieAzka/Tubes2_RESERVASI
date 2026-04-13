import axios from "axios";
import * as https from "https";

// Bypass SSL certificate check
const agent = new https.Agent({rejectUnauthorized: false})

export async function scrapeHTML(url: string): Promise<string> {
    const response = await axios.get(url, {
        headers: {
            // Nyamar jadi chrome biar bisa ambil data
            "User-Angent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        },
        // Tunggu 15 detik, baru anggap gagal
        timeout: 15000, 
        httpsAgent: agent,
    });

    return response.data;
}