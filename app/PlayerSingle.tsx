import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, StatusBar } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function PlayerSingle() {
  const { videoUrl } = useLocalSearchParams();
  const router = useRouter();
  const [isLandscape, setIsLandscape] = useState(false);
  
  // نستخدم حالة للأبعاد لضمان تحديث الواجهة عند الدوران
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    // مراقبة تغير أبعاد الشاشة لتحديث الفيديو فوراً
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => {
      subscription?.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // دالة التحكم في تدوير الشاشة
  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
      setIsLandscape(true);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <Video
        source={{ uri: videoUrl as string }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        // يمتلئ الشاشة (STRETCH) في الأفقي، ويحافظ على النسبة (CONTAIN) في العمودي
        resizeMode={isLandscape ? ResizeMode.STRETCH : ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        style={{ width: dimensions.width, height: dimensions.height }}
      />

      {/* أدوات التحكم العلوية - تصميم راقٍ */}
      <View style={[styles.overlayControls, { top: isLandscape ? 20 : 40 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={toggleOrientation}>
          <MaterialCommunityIcons 
            name={isLandscape ? "screen-rotation-portrait" : "screen-rotation"} 
            size={24} 
            color="#FFD700" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  overlayControls: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  }
});