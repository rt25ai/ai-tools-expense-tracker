const { buildResponse, isOriginAllowed, saveManualReceipt, assertConfigured } = require("./_lib/manual-import-gateway");

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin)) {
      return buildResponse(res, 403, { ok: false, error: "Origin not allowed." }, origin);
    }
    return buildResponse(res, 204, {}, origin);
  }

  if (req.method !== "POST") {
    return buildResponse(res, 405, { ok: false, error: "Method not allowed." }, origin);
  }

  if (origin && !isOriginAllowed(origin)) {
    return buildResponse(res, 403, { ok: false, error: "Origin not allowed." }, origin);
  }

  try {
    assertConfigured();
    const payload = req.body || {};
    const result = await saveManualReceipt(payload.entry || {}, payload.fileName || null, payload.fileBase64 || null);
    return buildResponse(res, 200, { ok: true, ...result }, origin);
  } catch (error) {
    return buildResponse(res, 500, { ok: false, error: error.message || "Secure manual import failed." }, origin);
  }
};
