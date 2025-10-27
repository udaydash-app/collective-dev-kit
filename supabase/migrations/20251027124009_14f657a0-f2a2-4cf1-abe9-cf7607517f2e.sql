-- Update user role to admin to access admin orders page
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = '43fb7354-cdeb-48a6-8f45-3602a0bc6005';

-- Also update the profile role to match
UPDATE profiles 
SET role = 'admin' 
WHERE id = '43fb7354-cdeb-48a6-8f45-3602a0bc6005';