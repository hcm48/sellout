export async function POST(request: Request) {
  const { firstName, email } = await request.json();

  if (!firstName || !email) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    console.error("[waitlist] Mailchimp env vars not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Datacenter is the suffix after the last dash in the API key (e.g. "us21")
  const dc = apiKey.split("-").at(-1);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      status: "subscribed",
      merge_fields: { FNAME: firstName },
    }),
  });

  const data = await res.json();

  // 400 with "Member Exists" is fine — user already subscribed, let them through
  if (res.ok || data.title === "Member Exists") {
    console.log(`[waitlist] subscribed: ${firstName} <${email}>`);
    return Response.json({ ok: true });
  }

  console.error("[waitlist] Mailchimp error:", data);
  return Response.json({ error: data.detail || "Failed to subscribe" }, { status: 500 });
}
