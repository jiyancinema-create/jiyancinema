import React, { useState, useEffect, useRef } from 'react';
import { 
  View, StyleSheet, Dimensions, Text, TextInput, 
  TouchableOpacity, FlatList, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';

// Firebase
import { auth, db } from '../firebaseConfig';
import { 
  doc, onSnapshot, updateDoc, collection, 
  addDoc, query, orderBy, serverTimestamp 
} from 'firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerParty() {
  const { id, roomID, videoUrl } = useLocalSearchParams();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  
  // حالات الدردشة
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  // 1. نظام المزامنة
  useEffect(() => {
    if (!roomID) return;
    const unsub = onSnapshot(doc(db, "watch_rooms", roomID as string), (docSnap) => {
      const data = docSnap.data();
      if (data && videoRef.current && data.lastUpdatedBy !== auth.currentUser?.uid) {
        setIsRemoteUpdate(true);
        videoRef.current.getStatusAsync().then((status: any) => {
          if (Math.abs(status.positionMillis - data.position) > 2000) {
            videoRef.current?.setPositionAsync(data.position);
          }
          if (data.isPlaying) videoRef.current?.playAsync();
          else videoRef.current?.pauseAsync();
        });
        setTimeout(() => setIsRemoteUpdate(false), 1000);
      }
    });
    return () => unsub();
  }, [roomID]);

  // 2. نظام الدردشة الفوري
  useEffect(() => {
    if (!roomID) return;
    const q = query(
      collection(db, `watch_rooms/${roomID}/messages`),
      orderBy("timestamp", "asc")
    );
    const unsubChat = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });
    return () => unsubChat();
  }, [roomID]);

  // معالجة تحديث حالة الفيديو مع حماية من الأخطاء
  const handlePlaybackStatusUpdate = async (status: any) => {
    // التصحيح: التحقق من وجود roomID قبل محاولة التحديث لتجنب خطأ undefined
    if (status.isLoaded && !isRemoteUpdate && roomID) {
      try {
        await updateDoc(doc(db, "watch_rooms", roomID as string), {
          position: status.positionMillis,
          isPlaying: status.isPlaying,
          lastUpdatedBy: auth.currentUser?.uid
        });
      } catch (e) {
        console.error("Firebase Update Error:", e);
      }
    }
  };

  const sendMessage = async () => {
    if (message.trim().length === 0 || !roomID) return;
    try {
      await addDoc(collection(db, `watch_rooms/${roomID}/messages`), {
        text: message,
        senderId: auth.currentUser?.uid,
        timestamp: serverTimestamp(),
      });
      setMessage('');
    } catch (e) { console.error(e); }
  };

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
      <Video
        ref={videoRef}
        source={{ uri: (videoUrl as string) || "" }}
        resizeMode={ResizeMode.CONTAIN}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        style={styles.video}
        useNativeControls
        shouldPlay
      />

      {/* شارة التوصيل */}
      <View style={styles.partyBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.partyText}>جلسة مشتركة</Text>
      </View>

      {/* شريط التحكم الجانبي */}
      <View style={styles.sideControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          router.back();
        }}>
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={toggleOrientation}>
          <MaterialCommunityIcons 
            name={isLandscape ? "screen-rotation-portrait" : "screen-rotation"} 
            size={22} 
            color="#FFF" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlBtn, showChat && styles.chatActive]} 
          onPress={() => setShowChat(!showChat)}
        >
          <Ionicons name={showChat ? "chatbubbles" : "chatbubbles-outline"} size={22} color={showChat ? "#000" : "#FFD700"} />
        </TouchableOpacity>
      </View>

      {/* واجهة الدردشة العائمة */}
      {showChat && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.chatContainer}
        >
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.chatGradient}>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[
                  styles.msgBubble, 
                  item.senderId === auth.currentUser?.uid ? styles.myMsg : styles.theirMsg
                ]}>
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              )}
              contentContainerStyle={styles.msgList}
            />
            
            <View style={styles.inputArea}>
              <TextInput
                style={styles.input}
                placeholder="تحدث الآن..."
                placeholderTextColor="#666"
                value={message}
                onChangeText={setMessage}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Ionicons name="paper-plane" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  
  partyBadge: { 
    position: 'absolute', top: 40, left: 20, 
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, 
    paddingVertical: 5, borderRadius: 15, flexDirection: 'row', 
    alignItems: 'center', borderLeftWidth: 2, borderLeftColor: '#FFD700',
    zIndex: 10
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD700', marginRight: 8 },
  partyText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  
  sideControls: { 
    position: 'absolute', top: 40, right: 15, 
    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', 
    borderRadius: 25, paddingVertical: 10, zIndex: 10 
  },
  controlBtn: { 
    width: 42, height: 42, borderRadius: 21, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 12 
  },
  chatActive: { backgroundColor: '#FFD700' },

  chatContainer: { 
    position: 'absolute', bottom: 0, width: '100%', 
    height: SCREEN_HEIGHT * 0.4 
  },
  chatGradient: { flex: 1, paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'flex-end' },
  msgList: { paddingBottom: 10 },
  msgBubble: { 
    paddingHorizontal: 15, paddingVertical: 8, 
    borderRadius: 18, marginBottom: 6, maxWidth: '80%' 
  },
  myMsg: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,215,0,0.3)' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)' },
  msgText: { color: '#FFF', fontSize: 14, textAlign: 'right' },
  
  inputArea: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 25, height: 50, paddingHorizontal: 5 
  },
  input: { flex: 1, color: '#FFF', paddingHorizontal: 15, textAlign: 'right', fontSize: 14 },
  sendBtn: { 
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: '#FFD700', justifyContent: 'center', 
    alignItems: 'center' 
  }
});