import { appendCdpPath, fetchJson, withCdpSocket } from "../cdp.helpers.js";
import { normalizeCdpWsUrl } from "../cdp.js";
import type { BrowserRouteContext } from "../server-context.js";
import { readBody, resolveProfileContext } from "./agent.shared.js";
import type { BrowserRouteRegistrar } from "./types.js";
import { jsonError, toNumber, toStringOrEmpty } from "./utils.js";

async function callBookmarksViaCdp(
  cdpUrl: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const version = await fetchJson<{ webSocketDebuggerUrl?: string }>(
    appendCdpPath(cdpUrl, "json/version"),
  );
  const wsUrlRaw = String(version?.webSocketDebuggerUrl ?? "").trim();
  if (!wsUrlRaw) {
    throw new Error(
      "Chrome extension relay not connected. Attach a tab via the OpenClaw Browser Relay toolbar button.",
    );
  }
  const wsUrl = normalizeCdpWsUrl(wsUrlRaw, cdpUrl);
  return (await withCdpSocket(wsUrl, async (send) => {
    return await send(method, params);
  })) as Record<string, unknown>;
}

export function registerBrowserAgentBookmarksRoutes(
  app: BrowserRouteRegistrar,
  ctx: BrowserRouteContext,
) {
  app.get("/bookmarks", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    try {
      const result = await callBookmarksViaCdp(profileCtx.profile.cdpUrl, "Bookmarks.getTree");
      res.json({ ok: true, ...result });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.get("/bookmarks/search", async (req, res) => {
    const query = toStringOrEmpty(req.query.query);
    if (!query) {
      return jsonError(res, 400, "query is required");
    }
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    try {
      const result = await callBookmarksViaCdp(profileCtx.profile.cdpUrl, "Bookmarks.search", {
        query,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post("/bookmarks/create", async (req, res) => {
    const body = readBody(req);
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    const params: Record<string, unknown> = {};
    const title = toStringOrEmpty(body.title);
    const url = toStringOrEmpty(body.url);
    const parentId = toStringOrEmpty(body.parentId);
    const index = toNumber(body.index);
    if (title) params.title = title;
    if (url) params.url = url;
    if (parentId) params.parentId = parentId;
    if (index !== null) params.index = index;
    try {
      const result = await callBookmarksViaCdp(
        profileCtx.profile.cdpUrl,
        "Bookmarks.create",
        params,
      );
      res.json({ ok: true, bookmark: result });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post("/bookmarks/update", async (req, res) => {
    const body = readBody(req);
    const id = toStringOrEmpty(body.id);
    if (!id) return jsonError(res, 400, "id is required");
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    const params: Record<string, unknown> = { id };
    const title = toStringOrEmpty(body.title);
    const url = toStringOrEmpty(body.url);
    if (title) params.title = title;
    if (url) params.url = url;
    if (!title && !url) return jsonError(res, 400, "title or url is required");
    try {
      const result = await callBookmarksViaCdp(
        profileCtx.profile.cdpUrl,
        "Bookmarks.update",
        params,
      );
      res.json({ ok: true, bookmark: result });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post("/bookmarks/move", async (req, res) => {
    const body = readBody(req);
    const id = toStringOrEmpty(body.id);
    if (!id) return jsonError(res, 400, "id is required");
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    const params: Record<string, unknown> = { id };
    const parentId = toStringOrEmpty(body.parentId);
    const index = toNumber(body.index);
    if (parentId) params.parentId = parentId;
    if (index !== null) params.index = index;
    if (!parentId && index === null) return jsonError(res, 400, "parentId or index is required");
    try {
      const result = await callBookmarksViaCdp(
        profileCtx.profile.cdpUrl,
        "Bookmarks.move",
        params,
      );
      res.json({ ok: true, bookmark: result });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post("/bookmarks/remove", async (req, res) => {
    const body = readBody(req);
    const id = toStringOrEmpty(body.id);
    if (!id) return jsonError(res, 400, "id is required");
    const recursive = body.recursive === true;
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    try {
      await callBookmarksViaCdp(
        profileCtx.profile.cdpUrl,
        recursive ? "Bookmarks.removeTree" : "Bookmarks.remove",
        { id },
      );
      res.json({ ok: true });
    } catch (err) {
      jsonError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });
}
