import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL/Key bulunamadı. .env.local dosyasını kontrol edin.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native'de JS zamanlayicilari uygulama arka plandayken calismaz, bu
// yuzden Supabase'in otomatik token yenileme mekanizmasi arka planda
// duraklar. Uygulama tekrar on plana gectiginde yenilemeyi manuel tetikleyip
// kullanicinin sessiz sedasiz oturumdan dusmesini (yeniden giris istenmesini)
// onluyoruz. Kullanici sadece kendi cikis yaptiginda oturum kapanacak.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
