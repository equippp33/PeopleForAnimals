import { db } from "../src";
import { sql } from "drizzle-orm";

async function updateAgeColumn() {
  try {
    // First, add a new temporary column with the correct type
    await db.execute(sql`
      ALTER TABLE arv_dogs 
      ADD COLUMN IF NOT EXISTS age_temp TEXT 
      CHECK (age_temp IN ('adult', 'puppy'))
    `);

    // Copy data from old column to new column (converting numbers to categories)
    await db.execute(sql`
      UPDATE arv_dogs 
      SET age_temp = 
        CASE 
          WHEN age <= 3 THEN 'puppy' 
          ELSE 'adult' 
        END
      WHERE age IS NOT NULL
    `);

    // Drop the old column
    await db.execute(sql`
      ALTER TABLE arv_dogs 
      DROP COLUMN IF EXISTS age
    `);

    // Rename the new column
    await db.execute(sql`
      ALTER TABLE arv_dogs 
      RENAME COLUMN age_temp TO age
    `);

    console.log("Successfully updated age column to use 'adult'/'puppy' values");
  } catch (error) {
    console.error("Error updating age column:", error);
  } finally {
    process.exit();
  }
}

updateAgeColumn();
