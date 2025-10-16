-- Assign categories to products based on product name patterns

-- Agarbatti products
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'agarbatti')
WHERE category_id IS NULL 
AND (name ILIKE '%agarbatti%' OR name ILIKE '%dhoop%' OR name ILIKE '%diya%' 
     OR name ILIKE '%kapoor%' OR name ILIKE '%havan%' OR name ILIKE '%gangajal%'
     OR name ILIKE '%gaumutar%' OR name ILIKE '%loban%');

-- Baby products
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'baby')
WHERE category_id IS NULL 
AND (name ILIKE '%baby%' OR name ILIKE '%diaper%');

-- Beer products
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'beer')
WHERE category_id IS NULL 
AND name ILIKE '%beer%';

-- Biscuits
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'biscuits')
WHERE category_id IS NULL 
AND (name ILIKE '%biscuit%' OR name ILIKE '%cookies%');

-- Butter, Mayo, Jam
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'butter-mayo-jam')
WHERE category_id IS NULL 
AND (name ILIKE '%butter%' OR name ILIKE '%mayo%' OR name ILIKE '%jam%' 
     OR name ILIKE '%spread%');

-- Candies
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'candies')
WHERE category_id IS NULL 
AND (name ILIKE '%candy%' OR name ILIKE '%lollipop%' OR name ILIKE '%toffee%');

-- Chips
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'chips')
WHERE category_id IS NULL 
AND (name ILIKE '%chips%' OR name ILIKE '%crisp%');

-- Chocolates
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'chocolates')
WHERE category_id IS NULL 
AND (name ILIKE '%chocolate%' OR name ILIKE '%cocoa%');

-- Conserves (canned goods)
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'conserves')
WHERE category_id IS NULL 
AND (name ILIKE '%canned%' OR name ILIKE '%tinned%' OR name ILIKE '%conserve%');

-- Cosmetics
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'cosmetics')
WHERE category_id IS NULL 
AND (name ILIKE '%makeup%' OR name ILIKE '%cosmetic%' OR name ILIKE '%lipstick%' 
     OR name ILIKE '%foundation%' OR name ILIKE '%mascara%');

-- Dental Care
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'dental-care')
WHERE category_id IS NULL 
AND (name ILIKE '%toothpaste%' OR name ILIKE '%toothbrush%' OR name ILIKE '%mouthwash%' 
     OR name ILIKE '%dental%' OR name ILIKE '%floss%');

-- Desserts
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'desserts')
WHERE category_id IS NULL 
AND (name ILIKE '%dessert%' OR name ILIKE '%pudding%' OR name ILIKE '%cake%' 
     OR name ILIKE '%pastry%');

-- Detergents
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'detergents')
WHERE category_id IS NULL 
AND (name ILIKE '%detergent%' OR name ILIKE '%washing powder%' OR name ILIKE '%laundry%');

-- Dry Fruits
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'dry-fruits')
WHERE category_id IS NULL 
AND (name ILIKE '%almond%' OR name ILIKE '%cashew%' OR name ILIKE '%raisin%' 
     OR name ILIKE '%walnut%' OR name ILIKE '%pistachio%' OR name ILIKE '%dried fruit%');

-- Flour
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'flour')
WHERE category_id IS NULL 
AND (name ILIKE '%flour%' OR name ILIKE '%atta%' OR name ILIKE '%maida%');

-- Grains
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'grains')
WHERE category_id IS NULL 
AND (name ILIKE '%wheat%' OR name ILIKE '%oats%' OR name ILIKE '%barley%' 
     OR name ILIKE '%grain%');

-- Hygienes
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'hygienes')
WHERE category_id IS NULL 
AND (name ILIKE '%sanitizer%' OR name ILIKE '%tissue%' OR name ILIKE '%wipes%' 
     OR name ILIKE '%sanitary%' OR name ILIKE '%pad%');

-- Ketchup & Mustards
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'ketchup-mustards')
WHERE category_id IS NULL 
AND (name ILIKE '%ketchup%' OR name ILIKE '%catchup%' OR name ILIKE '%mustard%' 
     OR name ILIKE '%moutarde%');

-- Milk, Yogurt, Cheese
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'milk-yogurt-cheese')
WHERE category_id IS NULL 
AND (name ILIKE '%milk%' OR name ILIKE '%yogurt%' OR name ILIKE '%cheese%' 
     OR name ILIKE '%curd%' OR name ILIKE '%dairy%');

-- Oils
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'oils')
WHERE category_id IS NULL 
AND (name ILIKE '%oil%' OR name ILIKE '%ghee%');

-- Pasta & Noodles
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'pasta-noodles')
WHERE category_id IS NULL 
AND (name ILIKE '%pasta%' OR name ILIKE '%noodle%' OR name ILIKE '%macaroni%' 
     OR name ILIKE '%spaghetti%');

-- Perfumes & Deos
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'perfumes-deos')
WHERE category_id IS NULL 
AND (name ILIKE '%perfume%' OR name ILIKE '%deodorant%' OR name ILIKE '%deo%' 
     OR name ILIKE '%fragrance%' OR name ILIKE '%cologne%');

-- Pickles
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'pickles')
WHERE category_id IS NULL 
AND (name ILIKE '%pickle%' OR name ILIKE '%achar%');

-- Hair Care (Produit Capliaries)
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'produit-capliaries')
WHERE category_id IS NULL 
AND (name ILIKE '%shampoo%' OR name ILIKE '%conditioner%' OR name ILIKE '%hair%');

-- Rice & Couscous
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'rice-couscous')
WHERE category_id IS NULL 
AND (name ILIKE '%rice%' OR name ILIKE '%couscous%' OR name ILIKE '%basmati%');

-- Salt
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'salt')
WHERE category_id IS NULL 
AND name ILIKE '%salt%';

-- Soaps
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'soaps')
WHERE category_id IS NULL 
AND name ILIKE '%soap%';

-- Soda & Juice
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'soda-juice')
WHERE category_id IS NULL 
AND (name ILIKE '%soda%' OR name ILIKE '%juice%' OR name ILIKE '%cola%' 
     OR name ILIKE '%pepsi%' OR name ILIKE '%sprite%' OR name ILIKE '%fanta%'
     OR name ILIKE '%drink%');

-- Sauces
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'sauces')
WHERE category_id IS NULL 
AND (name ILIKE '%sauce%' OR name ILIKE '%souces%');

-- Spices
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'spices')
WHERE category_id IS NULL 
AND (name ILIKE '%spice%' OR name ILIKE '%masala%' OR name ILIKE '%pepper%' 
     OR name ILIKE '%chilli%' OR name ILIKE '%turmeric%' OR name ILIKE '%cumin%');

-- Sugar
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'sugar')
WHERE category_id IS NULL 
AND (name ILIKE '%sugar%' OR name ILIKE '%sweetener%');

-- Sweets
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'sweets')
WHERE category_id IS NULL 
AND (name ILIKE '%sweet%' OR name ILIKE '%mithai%');

-- Tea & Coffee
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'tea-coffee')
WHERE category_id IS NULL 
AND (name ILIKE '%tea%' OR name ILIKE '%coffee%' OR name ILIKE '%chai%');

-- Tobacco
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'tobacco')
WHERE category_id IS NULL 
AND (name ILIKE '%cigarette%' OR name ILIKE '%tobacco%' OR name ILIKE '%cigar%');

-- Vinegars
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'vinegars')
WHERE category_id IS NULL 
AND name ILIKE '%vinegar%';

-- Water
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'water')
WHERE category_id IS NULL 
AND name ILIKE '%water%';

-- Whisky & Liquers
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'whisky-liquers')
WHERE category_id IS NULL 
AND (name ILIKE '%whisky%' OR name ILIKE '%whiskey%' OR name ILIKE '%liqueur%' 
     OR name ILIKE '%vodka%' OR name ILIKE '%rum%' OR name ILIKE '%gin%' 
     OR name ILIKE '%brandy%' OR name ILIKE '%cognac%' OR name ILIKE '%tequila%');

-- Wines
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'wines')
WHERE category_id IS NULL 
AND name ILIKE '%wine%';

-- Assign remaining products to "Grocery" as a catch-all
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'grocery')
WHERE category_id IS NULL;