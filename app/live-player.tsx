import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, 
  Image, ImageBackground, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';

// Firebase
import { auth, db } from '../firebaseConfig'; 
import { 
  collection, query, onSnapshot, addDoc, 
  serverTimestamp, limit, getDocs, doc, getDoc, setDoc, deleteDoc 
} from 'firebase/firestore';

export default function LivePlayerScreen() {
  const router = useRouter();
  const [liveData, setLiveData] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<any>(null);
  
  const [isLandscape, setIsLandscape] = useState(false);
  const [showChat, setShowChat] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);

  // 1. إدارة تدوير الشاشة
  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
      const orientation = evt.orientationInfo.orientation;
      setIsLandscape(orientation === 3 || orientation === 4);
    });
    return () => ScreenOrientation.removeOrientationChangeListener(subscription);
  }, []);

  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    }
  };

  // 2. جلب البيانات ونظام الانضمام
  useEffect(() => {
    let currentLiveId: string | null = null;
    const fetchInitialData = async () => {
      try {
        if (!auth.currentUser) return;
        const uSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (uSnap.exists()) {
          const data = uSnap.data();
          setUserData(data);
          const qLive = query(collection(db, "lives"), limit(1));
          const querySnapshot = await getDocs(qLive);
          if (!querySnapshot.empty) {
            currentLiveId = querySnapshot.docs[0].id;
            setActiveId(currentLiveId);
            setLiveData(querySnapshot.docs[0].data());
            
            // إضافة رسالة انضمام
            await addDoc(collection(db, "lives", currentLiveId, "chat"), {
              text: `انضم إلى البث المباشر`,
              senderName: data.fullName || "مستخدم",
              rank: data.rank || "عضو",
              level: data.level || 1,
              type: "join_message",
              createdAt: serverTimestamp()
            });

            // إضافة المستخدم لعداد المشاهدين
            await setDoc(doc(db, "lives", currentLiveId, "viewers", auth.currentUser.uid), {
              joinedAt: serverTimestamp()
            });
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchInitialData();

    return () => {
      if (currentLiveId && auth.currentUser) {
        deleteDoc(doc(db, "lives", currentLiveId, "viewers", auth.currentUser.uid));
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    };
  }, []);

  // 3. مراقبة المشاهدين والدردشة
  useEffect(() => {
    if (!activeId) return;
    const unsubV = onSnapshot(collection(db, "lives", activeId, "viewers"), (s) => setViewerCount(s.size));
    const unsubC = onSnapshot(query(collection(db, "lives", activeId, "chat"), limit(50)), (s) => {
      const msgs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    });
    return () => { unsubV(); unsubC(); };
  }, [activeId]);

  const handleSend = async () => {
    if (!message.trim() || !activeId) return;
    const txt = message; const currentReply = replyTo;
    setMessage(''); setReplyTo(null);
    try {
      await addDoc(collection(db, "lives", activeId, "chat"), {
        text: txt,
        senderName: userData?.fullName,
        senderId: auth.currentUser?.uid,
        senderImage: userData?.profileImage || "",
        rank: userData?.rank || "عضو",
        level: userData?.level || 1,
        replyTo: currentReply ? { text: currentReply.text, senderName: currentReply.senderName } : null,
        type: "text",
        createdAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      <StatusBar hidden={isLandscape} />
      
      {/* منطقة الفيديو */}
      <View style={[styles.videoBox, isLandscape && (showChat ? styles.videoLandscapeHalf : styles.videoLandscapeFull)]}>
        <Video 
          source={{ uri: liveData?.url }} 
          style={styles.video} 
          useNativeControls={true} 
          resizeMode={ResizeMode.COVER} 
          shouldPlay 
        />
        
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.glassBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row' }}>
             <TouchableOpacity style={styles.glassBtn} onPress={() => setShowChat(!showChat)}>
              <Ionicons name={showChat ? "chatbubble" : "chatbubble-outline"} size={22} color={showChat ? "#FFD700" : "#FFF"} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.glassBtn, {marginLeft: 10}]} onPress={toggleOrientation}>
              <Ionicons name={isLandscape ? "contract" : "expand"} size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.viewerBadge}>
          <Ionicons name="eye" size={12} color="#FFF" />
          <Text style={styles.viewerText}>{viewerCount}</Text>
        </View>
      </View>

      {/* منطقة الدردشة */}
      {showChat && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.chatContainer, isLandscape && styles.chatLandscape]}>
          <ImageBackground source={require('../assets/images/jiyan_bg.png')} style={{ flex: 1 }} resizeMode="cover">
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={item => item.id}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => {
                if (item.type === "join_message") {
                  return <View style={styles.joinContainer}><Text style={styles.joinText}>✨ انضم {item.senderName} • {item.rank}</Text></View>;
                }
                const isMe = item.senderId === auth.currentUser?.uid;
                return (
                  <TouchableOpacity activeOpacity={0.8} onLongPress={() => setReplyTo(item)} style={[styles.msgWrapper, isMe ? { paddingLeft: 20 } : { paddingRight: 20, alignItems: 'flex-end' }]}>
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                      {item.replyTo && (
                        <View style={styles.replyInBubble}>
                          <Text style={styles.replyInName}>{item.replyTo.senderName}</Text>
                          <Text style={styles.replyInText} numberOfLines={1}>{item.replyTo.text}</Text>
                        </View>
                      )}
                      <View style={styles.headerRow}>
                        <Text style={styles.lvlTxt}>Lv.{item.level}</Text>
                        <Text style={[styles.rankTxt, item.rank === 'admin' && { color: '#FFD700' }]}>{item.rank}</Text>
                        <Text style={styles.nameTxt}>{item.senderName}</Text>
                      </View>
                      <Text style={styles.msgTxt}>{item.text}</Text>
                      
                      {/* زر صورة المستخدم للانتقال للملف الشخصي */}
                      <TouchableOpacity 
                        onPress={() => item.senderId && router.push(`/user/${item.senderId}`)}
                        style={[styles.avatarFrame, isMe ? { left: -18 } : { right: -18 }]}
                      >
                        <Image source={item.senderImage ? { uri: item.senderImage } : require('../assets/images/avatar.png')} style={styles.avatarImg} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: 10 }}
            />

            {replyTo && (
              <View style={styles.replyBar}>
                <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={24} color="#FFD700" /></TouchableOpacity>
                <View style={styles.replyContent}>
                  <Text style={styles.replyTitle}>الرد على {replyTo.senderName}</Text>
                  <Text style={styles.replyMsg} numberOfLines={1}>{replyTo.text}</Text>
                </View>
              </View>
            )}

            <View style={styles.inputArea}>
              <TextInput style={styles.input} value={message} onChangeText={setMessage} placeholder="دردشة..." placeholderTextColor="#666" />
              <TouchableOpacity onPress={handleSend} style={styles.sendBtn}><Ionicons name="send" size={20} color="#000" /></TouchableOpacity>
            </View>
          </ImageBackground>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  containerLandscape: { flexDirection: 'row' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  videoBox: { width: '100%', height: 230 },
  videoLandscapeFull: { width: '100%', height: '100%' },
  videoLandscapeHalf: { width: '70%', height: '100%' },
  video: { flex: 1 },
  topOverlay: { position: 'absolute', top: 15, left: 15, right: 15, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  glassBtn: { backgroundColor: 'rgba(0,0,0,0.5)', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  viewerBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(255,0,0,0.7)', flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignItems: 'center' },
  viewerText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  chatContainer: { flex: 1, backgroundColor: '#000' },
  chatLandscape: { width: '30%', height: '100%', borderLeftWidth: 1, borderLeftColor: '#222' },
  joinContainer: { alignSelf: 'center', backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 15, marginVertical: 8 },
  joinText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  msgWrapper: { width: '100%', marginVertical: 6 },
  bubble: { padding: 10, borderRadius: 15, maxWidth: '80%', position: 'relative' },
  myBubble: { backgroundColor: 'rgba(25, 25, 25, 0.95)', borderLeftWidth: 3, borderLeftColor: '#FFD700' },
  otherBubble: { backgroundColor: 'rgba(40, 40, 40, 0.95)', borderRightWidth: 3, borderRightColor: '#00FF64' },
  replyInBubble: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 5, borderRadius: 5, borderRightWidth: 2, borderRightColor: '#888', marginBottom: 5 },
  replyInName: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  replyInText: { color: '#888', fontSize: 10, textAlign: 'right' },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 4 },
  nameTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 11, marginLeft: 5 },
  rankTxt: { color: '#AAA', fontSize: 9, marginLeft: 5 },
  lvlTxt: { color: '#777', fontSize: 9 },
  msgTxt: { color: '#EEE', fontSize: 13, textAlign: 'right' },
  avatarFrame: { position: 'absolute', bottom: -5, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#111', backgroundColor: '#222', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  replyBar: { flexDirection: 'row', backgroundColor: '#111', padding: 8, alignItems: 'center', borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  replyContent: { flex: 1, paddingLeft: 10 },
  replyTitle: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  replyMsg: { color: '#888', fontSize: 11 },
  inputArea: { flexDirection: 'row-reverse', padding: 10, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center' },
  input: { flex: 1, height: 42, backgroundColor: '#181818', borderRadius: 21, paddingHorizontal: 15, color: '#FFF', textAlign: 'right', marginLeft: 10 },
  sendBtn: { backgroundColor: '#FFD700', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' }
});