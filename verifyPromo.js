// utils/verifyPromo.js
import fetch from "node-fetch";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Verifies whether a promo code is valid for a given domain.
 * 1. Checks your database first (for known verified offers)
 * 2. If not found, performs a live check against the website
 *
 * @param {string} domain - The website domain (e.g., "nike.com")
 * @param {string} code - The promo code to verify
 * @returns {Promise<{ valid: boolean, source: string, message?: string }>}
 */
export async function verifyPromo(domain, code) {
  if (!domain || !code) {
    return { valid: false, source: "input", message: "Missing domain or code" };
  }

  const normalizedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .trim()
    .toLowerCase();

  try {
    // --- 1️⃣ Check your DB first ---
    const dbCheck = await pool.query(
      "SELECT id FROM offers WHERE LOWER(domain) = $1 AND LOWER(code) = $2 LIMIT 1",
      [normalizedDomain, code.toLowerCase()]
    );

    if (dbCheck.rows.length > 0) {
      return { valid: true, source: "database" };
    }

    // --- 2️⃣ Try a live check ---
    const url = `https://${normalizedDomain}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          valid: false,
          source: "network",
          message: `HTTP ${res.status} from ${url}`,
        };
      }

      const html = await res.text();

      // Simple heuristic: check if promo code text appears in page
      const codeRegex = new RegExp(code, "i");
      const found = codeRegex.test(html);

      return {
        valid: found,
        source: "live",
        message: found
          ? "Promo code found on site"
          : "Promo code not found on site",
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        valid: false,
        source: "network",
        message: `Error fetching site: ${err.message}`,
      };
    }
  } catch (err) {
    console.error("verifyPromo error:", err);
    return { valid: false, source: "error", message: err.message };
  }
}
