import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  
  // أنظمة الحركة
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current; // حركة الشريط

  useEffect(() => {
    // تشغيل الحركات
    Animated.parallel([
      // ظهور تدريجي
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
      // تكبير خفيف (Zoom-in)
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 5000,
        useNativeDriver: true,
      }),
      // تحريك شريط التحميل (بدون Native Driver لتجنب الخطأ)
      Animated.timing(progressAnim, {
        toValue: width * 0.6, // يصل لـ 60% من عرض الشاشة
        duration: 4000,
        useNativeDriver: false, // هنا الحل! العرض لا يدعم Native Driver
      })
    ]).start();

    const timer = setTimeout(() => {
      onAuthStateChanged(auth, (user) => {
        router.replace(user ? '/(tabs)/home' : '/auth');
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* التوهج الخلفي */}
      <View style={styles.glow} />

      <Animated.View style={{ 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }],
        }}>
        <Image 
          source={require('../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* شريط التحميل السينمائي */}
      <View style={styles.loaderContainer}>
        <Animated.View style={[styles.progressBar, { width: progressAnim }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: 'rgba(255, 215, 0, 0.15)', // توهج ذهبي خفيف
    borderRadius: width,
    shadowColor: "#FFD700",
    shadowRadius: 100,
    shadowOpacity: 1,
    elevation: 20,
  },
  logo: {
    width: width * 0.7,
    height: width * 0.7,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 100,
    width: width * 0.6,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  }
});