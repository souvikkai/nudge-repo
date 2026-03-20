"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("No token found in the URL.");
      setStatus("error");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Verification failed.");
        }
        // Store session in localStorage
        localStorage.setItem("nudge_token", data.token);
        localStorage.setItem("nudge_user_id", data.user_id);
        localStorage.setItem("nudge_email", data.email);
        setStatus("success");
        // Redirect to main app after short delay
        setTimeout(() => router.push("/"), 1000);
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    }

    verify();
  }, [searchParams, router]);

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

        {status === "verifying" && (
          <p style={{ color: "#333", fontSize: "1rem" }}>Signing you in...</p>
        )}
        {status === "success" && (
          <p style={{ color: "#333", fontSize: "1rem" }}>✓ Signed in! Redirecting...</p>
        )}
        {status === "error" && (
          <div>
            <p style={{ color: "#b3322a", fontSize: "1rem", marginBottom: "16px" }}>
              {error}
            </p>
            <a href="/login" style={{
              color: "#000",
              fontSize: "0.9rem",
              textDecoration: "underline",
            }}>
              Try again
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}