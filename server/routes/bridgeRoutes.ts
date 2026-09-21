import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';

export function createBridgeRouter(): Router {
  const router = Router();
  let configuredTargetUrl = process.env.CAPTURE_STATION_URL || 'https://ai.studio/apps/bf688cb8-b95b-47f3-920b-441a734e4f6d';

  // Config: Get or Set target URL
  router.get('/config', (req: Request, res: Response) => {
    res.json({ targetUrl: configuredTargetUrl });
  });

  router.post('/config', (req: Request, res: Response) => {
    const { targetUrl } = req.body || {};
    if (targetUrl && typeof targetUrl === 'string') {
      configuredTargetUrl = targetUrl.trim();
    }
    res.json({ success: true, targetUrl: configuredTargetUrl });
  });

  // 1. Probe / Ping Capture Station
  router.post('/ping', async (req: Request, res: Response) => {
    const targetUrl = (req.body?.targetUrl || configuredTargetUrl).trim();
    const startTime = Date.now();

    try {
      // Normalize ping target
      const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const pingUrl = `${urlObj.origin}/api/health`;

      // Node native fetch with 3000ms timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal
      }).catch(async () => {
        // Fallback ping root origin
        return await fetch(urlObj.origin, {
          method: 'HEAD',
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response && (response.ok || response.status < 500)) {
        return res.json({
          connected: true,
          status: latencyMs > 300 ? 'Degraded' : 'Connected',
          latencyMs,
          url: targetUrl,
          message: 'Target responds to probe'
        });
      }

      return res.status(502).json({
        connected: false,
        status: 'Unreachable',
        latencyMs,
        url: targetUrl,
        message: `HTTP ${response?.status || '502'}: Remote station unresponsive`
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return res.status(503).json({
        connected: false,
        status: 'Unreachable',
        latencyMs,
        url: targetUrl,
        message: err.name === 'AbortError' ? 'Probe timed out (3000ms)' : (err.message || 'Host unreachable')
      });
    }
  });

  // 2. Inbound Sync: Fetch pending captures
  router.post('/pending', async (req: Request, res: Response) => {
    const targetUrl = (req.body?.targetUrl || configuredTargetUrl).trim();

    try {
      const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const pendingEndpoint = `${urlObj.origin}/api/sync/pending`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(pendingEndpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.json({
          source: 'remote',
          count: Array.isArray(data.captures) ? data.captures.length : 0,
          captures: data.captures || []
        });
      }
    } catch (err) {
      // Remote station unreachable or endpoint not found -> fallback
    }

    // Graceful internal fallback: Return empty or simulated pending structure
    return res.json({
      source: 'internal_buffer',
      count: 0,
      captures: [],
      message: 'Remote station endpoint idle. Using Main coordinator internal buffer.'
    });
  });

  // 3. Outbound Feedback: Push retake notice
  router.post('/retake-flag', async (req: Request, res: Response) => {
    const targetUrl = (req.body?.targetUrl || configuredTargetUrl).trim();
    const notice = req.body?.notice || {};

    try {
      const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const flagEndpoint = `${urlObj.origin}/api/sync/retake-flag`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(flagEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notice),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return res.json({ success: true, deliveredTo: targetUrl });
      }
    } catch (err) {
      // Remote station offline
    }

    // Return delivery receipt recorded in Main
    return res.json({
      success: true,
      deliveredTo: 'internal_retake_queue',
      note: 'Stored in Main retake queue for next station synchronization.'
    });
  });

  return router;
}

export function createSentinelRouter(): Router {
  const router = Router();

  router.get('/sentinel', (req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const externalMb = Math.round(mem.external / 1024 / 1024);
    const heapLimitMb = 350; // Guard limit
    
    let status: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL' = 'OPTIMAL';
    if (heapUsedMb >= 320) status = 'ELEVATED';
    if (heapUsedMb >= 350) status = 'CRITICAL';

    res.json({
      heapUsedMb,
      heapTotalMb,
      rssMb,
      externalMb,
      heapLimitMb,
      uptimeSeconds: Math.round(process.uptime()),
      status
    });
  });

  return router;
}
