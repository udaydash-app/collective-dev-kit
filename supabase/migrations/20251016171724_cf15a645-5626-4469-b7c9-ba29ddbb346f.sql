-- Update the Global Market store with new address
UPDATE stores 
SET 
  address = '1009, Rue Docteur Blanchard, Zone 4 C, Marcory',
  city = 'Abidjan',
  phone = '+225 07 59 99 68 94',
  updated_at = now()
WHERE id = '086e4c9f-c660-41fc-ab94-552393c13be8';