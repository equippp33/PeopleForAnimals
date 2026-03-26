-- Step 1: Add a new temporary column with the correct type
ALTER TABLE arv_dogs 
ADD COLUMN age_temp TEXT 
CHECK (age_temp IN ('adult', 'puppy'));

-- Step 2: Copy and convert data from old column to new column
UPDATE arv_dogs 
SET age_temp = 
  CASE 
    WHEN age <= 3 THEN 'puppy' 
    ELSE 'adult' 
  END
WHERE age IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE arv_dogs 
DROP COLUMN age;

-- Step 4: Rename the new column
ALTER TABLE arv_dogs 
RENAME COLUMN age_temp TO age;
