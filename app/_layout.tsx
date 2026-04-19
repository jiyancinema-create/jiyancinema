import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    // نغلف التطبيق بـ GestureHandler لدعم حركات السحب واللمس المتقدمة
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* التحكم في شكل شريط الحالة العلوي (الساعة والبطارية) ليناسب الخلفية السوداء */}
      <StatusBar style="light" />
      
      {/* نظام التنقل بين الشاشات */}
      <Stack
        screenOptions={{
          headerShown: false, // إخفاء الشريط العلوي الافتراضي
          animation: 'fade',  // جعل الانتقال بين الشاشات ناعماً (تلاشي)
          contentStyle: { backgroundColor: '#000' } // توحيد لون الخلفية لكل الشاشات للأسود
        }}
      >
        {/* تعريف الشاشات الأساسية */}
        <Stack.Screen name="index" /> 
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}