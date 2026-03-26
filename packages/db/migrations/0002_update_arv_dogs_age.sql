-- Drop the existing column
ALTER TABLE arv_dogs DROP COLUMN age;

-- Add the column back with the new type
ALTER TABLE arv_dogs ADD COLUMN age TEXT CHECK (age IN ('adult', 'puppy'));
