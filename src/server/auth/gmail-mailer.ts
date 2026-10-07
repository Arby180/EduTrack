export type GmailCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sender: string;
};

export async function sendGmailMessage(
  credentials: GmailCredentials,
  message: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<"accepted" | "failed"> {
  try {
    if (
      [message.from, ...message.to, message.subject].some((value) =>
        /[\r\n]/.test(value),
      )
    )
      return "failed";
    const tokenResponse = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) return "failed";
    const token = (await tokenResponse.json()) as { access_token?: unknown };
    if (typeof token.access_token !== "string" || !token.access_token)
      return "failed";
    const boundary = `edutrack-${crypto.randomUUID()}`;
    const encode = (value: string) =>
      Buffer.from(value)
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") ?? "";
    const mime = [
      `From: ${message.from}`,
      `To: ${message.to.join(", ")}`,
      `Subject: ${message.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      ...(
        [
          ["text/plain", message.text],
          ["text/html", message.html],
        ] as const
      ).flatMap(([type, body]) => [
        `--${boundary}`,
        `Content-Type: ${type}; charset=UTF-8`,
        "Content-Transfer-Encoding: base64",
        "",
        encode(body),
      ]),
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const response = await fetcher(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
        signal: AbortSignal.timeout(8000),
      },
    );
    return response.ok ? "accepted" : "failed";
  } catch {
    // Never log tokens, message contents, addresses, or provider responses.
    return "failed";
  }
}
