import { db } from './src/db/index.ts';
import { garments } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function fix() {
  const g15 = await db.select().from(garments).where(eq(garments.id, '15-2736'));
  const g13 = await db.select().from(garments).where(eq(garments.id, '13S-1060'));
  
  if (g15.length && g13.length) {
    const feedback = g15[0].reviewer_feedback;
    
    // Clear feedback on 15-2736
    await db.update(garments)
      .set({ reviewer_feedback: null })
      .where(eq(garments.id, '15-2736'));
      
    // Set feedback on 13S-1060 and optionally set status to Approved or keep it pending
    // Let's set it to Approved since user says "moved to Approved Archive"
    // Wait, the user said it moved to Approved Archive. If it's pending right now, the UI wouldn't show it there.
    // Wait! In the user's second screenshot, they clicked on "Approved Archive" and it shows 11S-1906 and 15-2736.
    // So 13S-1060 is NOT in Approved Archive! The user is saying "13S-1060... has moved to Approved Archive, however the garment number is now 15-2736"
    // The user THINKS that 15-2736 is 13S-1060 but with a wrong ID!
    // Because they see the feedback they wrote, they assume it's the SAME garment that got its ID jumbled!
    
    await db.update(garments)
      .set({ reviewer_feedback: feedback })
      .where(eq(garments.id, '13S-1060'));
      
    console.log("Transferred feedback from 15-2736 to 13S-1060");
  }
}
fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
