"use client";

import { useState } from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/request-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Something went wrong.");
      }
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      backgroundColor: "#f5c842",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "serif",
      padding: "20px",
    }}>
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "normal", marginBottom: "8px" }}>Nudge</h1>
        <p style={{
          color: "#b3322a",
          fontSize: "0.7rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: "48px",
        }}>
          For things worth coming back to.
        </p>

        {submitted ? (
          <div>
            <p style={{ fontSize: "1.1rem", color: "#333", marginBottom: "8px" }}>
              Check your email.
            </p>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>
              We sent a login link to <strong>{email}</strong>.
              It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "8px",
                backgroundColor: "#fffbea",
                marginBottom: "12px",
                boxSizing: "border-box",
                fontFamily: "serif",
              }}
            />
            {error && (
              <p style={{ color: "#b3322a", fontSize: "0.85rem", marginBottom: "12px" }}>
                {error}
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#000",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "serif",
              }}
            >
              {loading ? "Sending..." : "Send login link"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}