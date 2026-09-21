import { Router } from "express";
import { UploadDiagnosticLogger } from "../services/UploadDiagnosticLogger.ts";

export function createUploadDiagnosticRouter(): Router {
  const router = Router();
  const uploadLogger = UploadDiagnosticLogger.getInstance();

  router.get("/logs", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      res.json(uploadLogger.getRecentLogs(undefined, limit));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read diagnostic logs" });
    }
  });

  router.get("/raw", (req, res) => {
    try {
      const rawText = uploadLogger.getRawLog();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="upload_diagnostic_trace.log"');
      res.send(rawText);
    } catch (err: any) {
      res.status(500).send("Failed to export diagnostic log");
    }
  });

  router.post("/clear", (req, res) => {
    try {
      uploadLogger.clear();
      res.json({ success: true, message: "Diagnostic logs cleared" });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to clear logs" });
    }
  });

  return router;
}
