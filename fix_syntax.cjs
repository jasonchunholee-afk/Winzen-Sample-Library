const fs = require('fs');
let code = fs.readFileSync('/app/applet/server.ts', 'utf8');

code = code.replace(
  "structural_feedback: '', // Cleared after processing content_notes: g.content_notes || '', hashtags: g.hashtags || '',",
  "structural_feedback: '',\n        content_notes: g.content_notes || '', hashtags: g.hashtags || '',"
);

// Fix the trailing catch blocks
const badCatchBlock = `
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });`;

const goodCatchBlock = `
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });`;

code = code.replace(badCatchBlock, goodCatchBlock);

fs.writeFileSync('/app/applet/server.ts', code);
