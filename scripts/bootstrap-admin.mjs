import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'todaadmin@gmail.com';
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !initialPassword) {
  throw new Error(
    'SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and ADMIN_INITIAL_PASSWORD are required.'
  );
}

if (
  initialPassword.length < 16 ||
  !/[A-Z]/.test(initialPassword) ||
  !/[a-z]/.test(initialPassword) ||
  !/[0-9]/.test(initialPassword)
) {
  throw new Error('ADMIN_INITIAL_PASSWORD must be at least 16 characters and include upper/lowercase letters and a number.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const findAdminAuthUser = async () => {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error('Administrator lookup exceeded the supported user-page limit.');
};

let authUser = await findAdminAuthUser();

if (authUser) {
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: initialPassword,
    email_confirm: true,
    user_metadata: {
      ...authUser.user_metadata,
      name: 'TODA Administrator',
    },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { name: 'TODA Administrator' },
  });
  if (error) throw error;
  authUser = data.user;
}

const { error: profileError } = await supabase.from('users').upsert(
  {
    auth_id: authUser.id,
    email: ADMIN_EMAIL,
    name: 'TODA Administrator',
    user_type: 'admin',
    status: 'active',
    verification_status: null,
  },
  { onConflict: 'auth_id' }
);

if (profileError) throw profileError;

const { data: profile, error: verifyError } = await supabase
  .from('users')
  .select('auth_id,email,user_type,status')
  .eq('auth_id', authUser.id)
  .single();

if (verifyError) throw verifyError;
if (profile.user_type !== 'admin' || profile.status !== 'active') {
  throw new Error('Administrator profile verification failed.');
}

console.log('Administrator account is ready and has the admin role.');
