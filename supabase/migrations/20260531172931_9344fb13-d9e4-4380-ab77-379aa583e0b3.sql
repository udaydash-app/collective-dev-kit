
-- Add reverse/adjust triggers so editing purchase lines properly updates stock
CREATE OR REPLACE FUNCTION public.restaurant_purchase_item_reverse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur_stock numeric;
BEGIN
  SELECT stock INTO cur_stock FROM public.restaurant_ingredients WHERE id = OLD.ingredient_id FOR UPDATE;
  UPDATE public.restaurant_ingredients
    SET stock = COALESCE(cur_stock,0) - OLD.quantity, updated_at = now()
    WHERE id = OLD.ingredient_id;
  UPDATE public.restaurant_purchases
    SET total = (SELECT COALESCE(SUM(total),0) FROM public.restaurant_purchase_items WHERE purchase_id = OLD.purchase_id)
    WHERE id = OLD.purchase_id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_rest_purchase_item_reverse ON public.restaurant_purchase_items;
CREATE TRIGGER trg_rest_purchase_item_reverse
AFTER DELETE ON public.restaurant_purchase_items
FOR EACH ROW EXECUTE FUNCTION public.restaurant_purchase_item_reverse();

CREATE OR REPLACE FUNCTION public.restaurant_purchase_item_adjust()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur_stock numeric; delta numeric;
BEGIN
  delta := NEW.quantity - OLD.quantity;
  IF NEW.ingredient_id <> OLD.ingredient_id THEN
    -- treat as reverse old + apply new
    UPDATE public.restaurant_ingredients SET stock = COALESCE(stock,0) - OLD.quantity, updated_at = now() WHERE id = OLD.ingredient_id;
    UPDATE public.restaurant_ingredients SET stock = COALESCE(stock,0) + NEW.quantity, last_cost = NEW.unit_cost, updated_at = now() WHERE id = NEW.ingredient_id;
  ELSE
    UPDATE public.restaurant_ingredients
      SET stock = COALESCE(stock,0) + delta,
          last_cost = NEW.unit_cost,
          updated_at = now()
      WHERE id = NEW.ingredient_id;
  END IF;
  UPDATE public.restaurant_purchases
    SET total = (SELECT COALESCE(SUM(total),0) FROM public.restaurant_purchase_items WHERE purchase_id = NEW.purchase_id)
    WHERE id = NEW.purchase_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rest_purchase_item_adjust ON public.restaurant_purchase_items;
CREATE TRIGGER trg_rest_purchase_item_adjust
AFTER UPDATE ON public.restaurant_purchase_items
FOR EACH ROW EXECUTE FUNCTION public.restaurant_purchase_item_adjust();

-- Update Abidjan market prices to realistic XOF values (per unit: g/ml/pcs)
-- Helper: update unit_cost per ingredient name across the 3 seeded purchases
DO $$
DECLARE
  prices jsonb := '{
    "Chicken Breast": 3.5, "Chicken Wings": 2.5, "Beef Steak": 5.0, "Beef Patty": 750,
    "Fish Fillet": 4.0, "Shrimp": 12, "Bacon": 8, "Pepperoni": 10, "Egg": 125,
    "Onion": 0.8, "Tomato": 1.0, "Potato": 0.7, "Carrot": 1.0, "Cabbage": 0.6,
    "Cucumber": 1.0, "Lettuce": 2.0, "Bell Pepper": 2.5, "Mushroom": 6, "Garlic": 4,
    "Lemon": 75, "Orange": 150, "Mixed Fruits": 3, "Mixed Vegetables": 1.5,
    "Fresh Herbs": 8, "Pickle": 3,
    "Bread Slice": 75, "Burger Bun": 200, "Pizza Dough": 2.5, "Flour": 0.8,
    "Rice": 0.8, "Pasta": 2.5, "French Fries": 2.0, "Sugar": 0.8, "Salt": 0.4,
    "Cooking Oil": 1.8, "Olive Oil": 6, "Vinegar": 1.5, "Soy Sauce": 3,
    "Ketchup": 2.5, "Mayonnaise": 3, "Mustard": 4, "BBQ Sauce": 4,
    "Alfredo Sauce": 5, "Tomato Sauce": 2, "Curry Paste": 6, "Coconut Milk": 2,
    "Black Pepper": 25, "Takeaway Box": 150, "Napkin": 15, "Spring Roll Wrapper": 75,
    "Cheddar Cheese": 12, "Mozzarella": 11, "Mozzarella Cheese": 11, "Blue Cheese": 20,
    "Butter": 6, "Heavy Cream": 4, "Milk": 1.0, "Chocolate": 12, "Cocoa Powder": 15,
    "Coffee Beans": 20, "Mascarpone": 18, "Lady Finger Biscuit": 150,
    "Ice Cream Scoop": 800, "Coca-Cola Bottle": 500, "Beer Bottle": 1000,
    "Yogurt": 2, "Honey": 8, "Vanilla Extract": 30, "Strawberry": 5,
    "Banana": 100, "Apple": 200, "Pineapple": 1500, "Watermelon": 2500
  }'::jsonb;
  k text; v numeric;
BEGIN
  FOR k, v IN SELECT key, (value)::text::numeric FROM jsonb_each(prices) LOOP
    UPDATE public.restaurant_purchase_items pi
      SET unit_cost = v
      FROM public.restaurant_ingredients i, public.restaurant_purchases p
      WHERE pi.ingredient_id = i.id
        AND pi.purchase_id = p.id
        AND p.purchase_no LIKE 'PUR-ABJ-%'
        AND i.name = k;
  END LOOP;
END $$;
