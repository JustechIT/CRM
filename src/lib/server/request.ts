type Incoming = { headers: Headers; url: string };
export function publicOrigin(request: Incoming) {
  const parsed = new URL(request.url),
    host = request.headers.get("host") ?? parsed.host;
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwarded === "http" || forwarded === "https"
      ? forwarded + ":"
      : parsed.protocol;
  return new URL(`${protocol}//${host}`).origin;
}
export function requestHasSameOrigin(request: Incoming) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === publicOrigin(request);
  } catch {
    return false;
  }
}
