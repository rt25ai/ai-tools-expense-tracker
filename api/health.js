const { OWNER, REPO, DEFAULT_BRANCH, buildResponse, isOriginAllowed, assertConfigured } = require("./_lib/manual-import-gateway");

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin)) {
      return buildResponse(res, 403, { ok: false, error: "Origin not allowed." }, origin);
    }
    return buildResponse(res, 204, {}, origin);
  }

  try {
    assertConfigured();
  } catch (error) {
    return buildResponse(res, 500, { ok: false, error: error.message }, origin);
  }

  return buildResponse(
    res,
    200,
    {
      ok: true,
      mode: "secure-gateway",
      target: `${OWNER}/${REPO}@${DEFAULT_BRANCH}`,
    },
    origin,
  );
};
