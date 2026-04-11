const {
  buildResponse,
  isOriginAllowed,
  saveManualReceipt,
  updateManualReceipt,
  deleteManualReceipt,
  assertConfigured,
} = require("./_lib/manual-import-gateway");

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin)) {
      return buildResponse(res, 403, { ok: false, error: "Origin not allowed." }, origin);
    }
    return buildResponse(res, 204, {}, origin);
  }

  if (!["POST", "PUT", "DELETE"].includes(req.method)) {
    return buildResponse(res, 405, { ok: false, error: "Method not allowed." }, origin);
  }

  if (origin && !isOriginAllowed(origin)) {
    return buildResponse(res, 403, { ok: false, error: "Origin not allowed." }, origin);
  }

  try {
    assertConfigured();
    const payload = req.body || {};

    if (req.method === "POST") {
      const result = await saveManualReceipt(payload.entry || {}, payload.fileName || null, payload.fileBase64 || null);
      return buildResponse(res, 200, { ok: true, action: "created", ...result }, origin);
    }

    if (req.method === "PUT") {
      const result = await updateManualReceipt(
        payload.id || payload.entry?.id || null,
        payload.entry || {},
        payload.fileName || null,
        payload.fileBase64 || null,
      );
      return buildResponse(res, 200, { ok: true, action: "updated", ...result }, origin);
    }

    const result = await deleteManualReceipt(payload.id || null);
    return buildResponse(res, 200, { ok: true, action: "deleted", ...result }, origin);
  } catch (error) {
    return buildResponse(
      res,
      error.status || 500,
      { ok: false, error: error.message || "Secure manual import failed." },
      origin,
    );
  }
};
