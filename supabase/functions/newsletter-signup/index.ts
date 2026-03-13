import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 5;
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 3;
const ATTEMPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

async function hashValue(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getTurnstileSecret(supabaseAdmin: ReturnType<typeof createClient>) {
  const configuredSecret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY")?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const { data, error } = await supabaseAdmin
    .from("app_private_config")
    .select("config_value")
    .eq("config_key", "cloudflare_turnstile_secret_key")
    .maybeSingle();

  if (error) {
    console.error("turnstile secret lookup failed", error);
    return "";
  }

  return typeof data?.config_value === "string" ? data.config_value.trim() : "";
}

async function verifyTurnstile(
  supabaseAdmin: ReturnType<typeof createClient>,
  token: string,
  clientIp: string,
) {
  try {
    const configuredSecret = await getTurnstileSecret(supabaseAdmin);
    const secret = configuredSecret || TEST_TURNSTILE_SECRET;

    // Only use Cloudflare's dummy secret for local/test flows when no production secret is configured.
    if (!configuredSecret && !token.includes(".DUMMY.TOKEN.")) {
      return { success: false, "error-codes": ["turnstile-test-token-invalid"] };
    }

    const formData = new FormData();
    formData.set("secret", secret);
    formData.set("response", token);

    if (clientIp && clientIp !== "unknown") {
      formData.set("remoteip", clientIp);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || typeof payload.success !== "boolean") {
      return { success: false, "error-codes": ["turnstile-siteverify-failed"] };
    }

    return payload;
  } catch (error) {
    console.error("turnstile verification failed", error);
    return { success: false, "error-codes": ["turnstile-request-failed"] };
  }
}

async function isRateLimited(
  supabaseAdmin: ReturnType<typeof createClient>,
  emailHash: string,
  ipHash: string,
) {
  const emailSince = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString();
  const ipSince = new Date(Date.now() - IP_WINDOW_MS).toISOString();

  const [emailWindow, ipWindow] = await Promise.all([
    supabaseAdmin
      .from("newsletter_signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .gte("created_at", emailSince),
    supabaseAdmin
      .from("newsletter_signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", ipSince),
  ]);

  if (emailWindow.error) {
    throw emailWindow.error;
  }

  if (ipWindow.error) {
    throw ipWindow.error;
  }

  return (emailWindow.count ?? 0) >= EMAIL_MAX_ATTEMPTS || (ipWindow.count ?? 0) >= IP_MAX_ATTEMPTS;
}

async function cleanupAttempts(supabaseAdmin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString();
  await supabaseAdmin.from("newsletter_signup_attempts").delete().lt("created_at", cutoff);
}

async function recordAttempt(
  supabaseAdmin: ReturnType<typeof createClient>,
  emailHash: string,
  ipHash: string,
) {
  const { error } = await supabaseAdmin.from("newsletter_signup_attempts").insert({
    email_hash: emailHash,
    ip_hash: ipHash,
  });

  if (error) {
    console.error("newsletter attempt log failed", error);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid request payload." }, 400);
    }

    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ success: false, error: "Enter a valid email address." }, 400);
    }

    if (!token) {
      return jsonResponse({ success: false, error: "Complete the security check before subscribing." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const clientIp = getClientIp(request);
    const [emailHash, ipHash] = await Promise.all([
      hashValue(email),
      hashValue(clientIp),
    ]);

    if (await isRateLimited(supabaseAdmin, emailHash, ipHash)) {
      return jsonResponse({ success: false, error: "Too many attempts. Please try again later." }, 429);
    }

    const turnstileResult = await verifyTurnstile(supabaseAdmin, token, clientIp);
    if (!turnstileResult.success) {
      return jsonResponse({ success: false, error: "Security check failed. Please try again." }, 400);
    }

    await cleanupAttempts(supabaseAdmin);

    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({ email });

    if (error && error.code !== "23505") {
      console.error("newsletter insert failed", error);
      return jsonResponse({ success: false, error: "Unable to save your request right now." }, 500);
    }

    await recordAttempt(supabaseAdmin, emailHash, ipHash);

    return jsonResponse({
      success: true,
      alreadySubscribed: error?.code === "23505",
    });
  } catch (error) {
    console.error("newsletter-signup unexpected error", error);
    return jsonResponse({ success: false, error: "Unexpected server error." }, 500);
  }
});