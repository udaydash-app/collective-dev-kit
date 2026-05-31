DO $$
DECLARE
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  p3 uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.restaurant_purchases (id, purchase_no, supplier_name, notes, purchase_date)
  VALUES (p1, 'PUR-ABJ-001', 'Marché de Cocody', 'Fresh produce, meat & fish - Abidjan market run', now() - interval '3 days');

  INSERT INTO public.restaurant_purchase_items (purchase_id, ingredient_id, quantity, unit_cost)
  SELECT p1, id, q, c FROM (VALUES
    ('9008d002-3086-4580-9160-aa29127dc5b3'::uuid, 5000::numeric, 2.5::numeric),
    ('973d4a75-d877-4bb8-8f69-bf4aa5dd1e57'::uuid, 4000, 2.0),
    ('45831472-1cea-46d2-9d75-6d0ceb75bdef'::uuid, 50, 500),
    ('855431bf-2f51-4b7f-84f4-586c8ac6ccac'::uuid, 3000, 4.0),
    ('bf297fac-5ce3-453e-8a3f-2faf401fbd15'::uuid, 1000, 5.0),
    ('e063fb98-e81e-4a5e-9c3c-81011fcc26c3'::uuid, 3000, 3.0),
    ('f897a6e0-3721-446f-92c6-7ecfa5dc1514'::uuid, 2000, 8.0),
    ('913e767a-e9b2-4898-93b0-aba553138795'::uuid, 60, 100),
    ('c720a7a5-983d-4d7b-8146-564a54e18197'::uuid, 2000, 1.5),
    ('122a0d54-b40f-4332-9e72-41c46b9ba9d1'::uuid, 5000, 0.8),
    ('890da306-8c90-4db1-be59-6140e7432e30'::uuid, 5000, 0.5),
    ('b2e0e4ab-1af6-4d71-a45c-cda4b8bc2bf7'::uuid, 500, 3.0),
    ('f65c8718-28fd-4d0a-b390-0d6a38e63f65'::uuid, 1500, 1.5),
    ('6aad3d71-045d-4c20-bd21-2905af1a0d1f'::uuid, 1000, 4.0),
    ('666cad1e-e3a2-4a07-b397-e2c70bd20d60'::uuid, 10000, 0.5),
    ('ec8bed2b-252d-4273-b7a4-ca82cd20a645'::uuid, 2000, 0.7),
    ('88ab8cc4-1425-413d-9366-33f41f883b4b'::uuid, 2000, 0.4),
    ('23dac471-01ed-4b62-a539-341bad1b097d'::uuid, 1500, 0.8),
    ('a741e343-2aa4-4925-b476-aa0ea944f7b3'::uuid, 3000, 1.0),
    ('58c58c09-74ea-4711-9d69-9ea82fcc492d'::uuid, 200, 5.0),
    ('47ad08e5-21bf-470a-8217-8f3347505a2d'::uuid, 2000, 2.0),
    ('d5898310-7576-49e2-a577-f37ea351ed8a'::uuid, 30, 50),
    ('b8f158af-be1f-484c-8438-899e8b4f1237'::uuid, 20, 100),
    ('aef3408d-fe5c-416b-a05c-c569dc8a8a82'::uuid, 500, 2.0),
    ('d8bf732f-a527-474e-a574-a7b3cb0dd3f5'::uuid, 1000, 6.0)
  ) AS v(id, q, c);

  INSERT INTO public.restaurant_purchases (id, purchase_no, supplier_name, notes, purchase_date)
  VALUES (p2, 'PUR-ABJ-002', 'CDCI Wholesale', 'Dry goods, sauces & packaging', now() - interval '2 days');

  INSERT INTO public.restaurant_purchase_items (purchase_id, ingredient_id, quantity, unit_cost)
  SELECT p2, id, q, c FROM (VALUES
    ('934c56f1-dcf3-437d-893f-1f85f9be7f84'::uuid, 100::numeric, 150::numeric),
    ('8efa4022-a42e-41c6-ae9b-8c891421cadc'::uuid, 100, 50),
    ('b810c267-becd-4238-9161-13377727f35d'::uuid, 5000, 1.5),
    ('51f142e5-8c0a-4b18-8598-96ee6e5295c1'::uuid, 5000, 1.5),
    ('053330cd-6987-4dd0-905c-0d7227194fa7'::uuid, 5000, 1.2),
    ('03041a14-8f8d-4c0f-8bf5-93b0cd52295d'::uuid, 25000, 0.6),
    ('aec2642e-308b-4da4-859b-e619f4776126'::uuid, 50, 50),
    ('9dd6a14a-ca2a-4f29-b7bb-42f08a5cecfe'::uuid, 2000, 1.5),
    ('79582f76-111e-4693-9e44-dfac683537ff'::uuid, 1000, 2.0),
    ('a17d0aa3-38d6-4b66-9379-aa87f7d0c4c1'::uuid, 1000, 1.5),
    ('e6bf915a-8f56-4376-8d52-1e9d7d7e61fe'::uuid, 500, 2.5),
    ('91957a64-021c-4af1-8b91-044b74cffd38'::uuid, 1000, 3.0),
    ('8b123b79-0da9-4eda-bd38-ca2d701090bd'::uuid, 1000, 3.5),
    ('68de397a-c757-43bd-b429-c58b7ecf018b'::uuid, 500, 4.0),
    ('1abfba9c-f573-4077-84f9-3674b8816d58'::uuid, 1000, 2.0),
    ('f2b123d0-7ce6-4e36-b579-2be56ec59cbd'::uuid, 1000, 4.0),
    ('3e944a58-3d50-4076-bcca-43287db90af5'::uuid, 5000, 1.2),
    ('ead9f472-98ef-40b0-bb74-b51aea45d3e2'::uuid, 1000, 1.0),
    ('9b9f3111-c72e-41c4-9c0b-becc5ee33384'::uuid, 5000, 0.3),
    ('6955c127-67b0-47e3-8a0b-780bd20c5f65'::uuid, 200, 15.0),
    ('e0457201-3120-4b1d-af32-7a8b5c1c723a'::uuid, 5000, 0.6),
    ('7b53a5ad-1830-4c90-b525-f65af0b06075'::uuid, 10000, 0.5),
    ('cdcce8ad-deb1-4f05-8dd1-f50658d173f8'::uuid, 2000, 1.5),
    ('8d2c391f-1bfc-4186-8418-04dca9e98266'::uuid, 200, 100),
    ('3622a7e4-d6a5-4409-9020-17a751c3d18f'::uuid, 1000, 10)
  ) AS v(id, q, c);

  INSERT INTO public.restaurant_purchases (id, purchase_no, supplier_name, notes, purchase_date)
  VALUES (p3, 'PUR-ABJ-003', 'Prosuma Supermarket', 'Dairy, beverages and bakery items', now() - interval '1 day');

  INSERT INTO public.restaurant_purchase_items (purchase_id, ingredient_id, quantity, unit_cost)
  SELECT p3, id, q, c FROM (VALUES
    ('9e0bb600-78ef-4965-9b28-a00f33d6f5cf'::uuid, 2000::numeric, 7.0::numeric),
    ('c2d3f9cd-4603-4d8d-8c89-7917a8dad689'::uuid, 1500, 8.0),
    ('1a079669-a0d0-42fc-8d36-622ba382fd40'::uuid, 500, 12.0),
    ('f7f40f82-49b8-4c83-b611-3f006780485d'::uuid, 300, 15.0),
    ('e38323a9-1721-458a-9dd3-0a8c97dc4654'::uuid, 2000, 4.0),
    ('8f8d0ebb-5b01-4600-9589-99a577285ccc'::uuid, 10000, 0.8),
    ('d0a28b52-cc16-4033-8d9d-4bf43b6b6f06'::uuid, 2000, 2.5),
    ('58222566-a335-4c48-b19b-2ec4ad864879'::uuid, 50, 500),
    ('71ba1eba-9018-454a-8d3f-a9cd82d7db12'::uuid, 500, 12.0),
    ('69e60152-0f79-4d3b-aa98-767610dd84fe'::uuid, 1000, 8.0),
    ('30aa7f23-b7d0-4bdd-980a-3e4f714ef359'::uuid, 500, 10.0),
    ('b44fba8f-d441-4014-9aba-5f31cd372704'::uuid, 1000, 15.0),
    ('7d823e5f-de23-41a6-9335-8cc2bc93a685'::uuid, 100, 100),
    ('f5a47e4f-b977-4ac2-8131-ed0732b60c3d'::uuid, 48, 400),
    ('aa931d3b-b822-4f8f-a34e-41fa56b26af3'::uuid, 48, 300),
    ('fa1b1ffa-0a14-474c-914f-fb222bbf7c83'::uuid, 24, 800),
    ('97d2d690-74e2-4ae1-a49c-045d1a6a2be3'::uuid, 100, 50)
  ) AS v(id, q, c);
END $$;