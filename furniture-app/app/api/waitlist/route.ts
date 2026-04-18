export async function POST(request: Request) {
  const { firstName, email } = await request.json();

  if (!firstName || !email) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    console.warn("[waitlist] Mailchimp env vars not set — skipping");
    return Response.json({ ok: true });
  }

  // Datacenter is the suffix after the last dash in the API key (e.g. "us21")
  const dc = apiKey.split("-").at(-1);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members`;

  try {
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
    if (res.ok) {
      console.log(`[waitlist] subscribed: ${firstName} <${email}>`);
    } else {
      console.error(`[waitlist] Mailchimp error for ${email}:`, data.title, data.detail);
    }
  } catch (err) {
    console.error("[waitlist] Mailchimp request failed:", err);
  }

  // Always let the user through regardless of Mailchimp outcome
  return Response.json({ ok: true });
}
