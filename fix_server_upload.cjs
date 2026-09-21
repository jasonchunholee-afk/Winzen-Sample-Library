const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `
  app.post("/api/images", async (req, res) => {
    try {
      const { garmentId, role, filename, url } = req.body;
      
      const existing = await db.select().from(garments).where(eq(garments.id, garmentId));
      if (existing.length === 0) {
        await db.insert(garments).values({ id: garmentId, status: 'pending' });
      }
      // Instead of storing just filename, we might want to store the URL if it's external.
      // But the current frontend appends \`/images_thumb/\${img.filename}\`.
      // Let's store the full Firebase URL in 'filename' for now, or adapt the frontend.
      // Wait, if filename starts with http, we can use it directly in frontend.
      await db.insert(images).values({ garment_id: garmentId, role, filename: url });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Save image metadata error:", error);
      res.status(500).json({ error: "Failed to save image metadata" });
    }
  });

  // --- UPLOAD ---`;

serverCode = serverCode.replace("  // --- UPLOAD ---", newEndpoint);

// Wait, the API /api/garments in server.ts maps the filename to a local path:
// url: \`/images_thumb/\${img.filename}\`
// We need to change that so if filename starts with 'http', it just uses it directly.
const garmentsMapping = `        const gImages = allImages.filter(img => img.garment_id === g.id).map(img => {
          const isExternal = img.filename?.startsWith('http');
          return {
            id: img.id,
            role: img.role,
            url: isExternal ? img.filename : \`/images_thumb/\${img.filename}\`,
            fullUrl: isExternal ? img.filename : \`/images_ai/\${img.filename}\`,
            fallbackUrl: isExternal ? img.filename : \`/images/\${img.filename}\`
          };
        });`;

serverCode = serverCode.replace(/        const gImages = allImages\.filter\(img => img\.garment_id === g\.id\)\.map\(img => \(\{\n          id: img\.id,\n          role: img\.role,\n          url: `\/images_thumb\/\$\{img\.filename\}`,\n          fullUrl: `\/images_ai\/\$\{img\.filename\}`,\n          fallbackUrl: `\/images\/\$\{img\.filename\}`\n        \}\)\);/, garmentsMapping);

fs.writeFileSync('server.ts', serverCode);
