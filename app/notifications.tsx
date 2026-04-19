import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Modal,
  TouchableOpacity, ActivityIndicator, ImageBackground, Image, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// إعدادات Firebase
import { auth, db } from '../firebaseConfig';
import { 
  collection, query, onSnapshot, doc, 
  deleteDoc, serverTimestamp, addDoc, updateDoc, orderBy, arrayUnion 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CINEMATIC_BG_IMAGE = require('../assets/jiyan_bg.png');

export default function NotificationsScreen() {
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // حالات التنبيه المخصص
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'success' });

  useEffect(() => {
    if (!currentUserId) return;

    const q = query(
      collection(db, `users/${currentUserId}/notifications`),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(allData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUserId]);

  // وظيفة إظهار التنبيه المخصص
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setCustomAlert({ visible: true, title, message, type });
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, `users/${currentUserId}/notifications`, id));
    } catch (e) {
      console.error("Delete Error:", e);
    }
  };

  const handleAcceptFriend = async (notif: any) => {
    if (!currentUserId) return;
    try {
      const senderId = notif.fromId;
      const myRef = doc(db, "users", currentUserId);
      const senderRef = doc(db, "users", senderId);

      await updateDoc(myRef, { friends: arrayUnion(senderId) });
      await updateDoc(senderRef, { friends: arrayUnion(currentUserId) });
      
      await addDoc(collection(db, `users/${senderId}/notifications`), {
        type: 'system',
        title: 'تم قبول طلبك',
        body: `وافق المستخدم على طلب الصداقة الخاص بك، يمكنك الآن المراسلة.`,
        timestamp: serverTimestamp(),
        read: false
      });

      await deleteDoc(doc(db, `users/${currentUserId}/notifications`, notif.id));
      showAlert("نجاح", "تمت إضافة الصديق بنجاح!", "success");
    } catch (e) { 
      showAlert("خطأ", "فشل قبول طلب الصداقة.", "error");
    }
  };

  const handleWatchInvite = async (notif: any) => {
    if (notif.status === 'expired') {
      showAlert("تنبيه", "انتهت صلاحية هذه الدعوة.", "info");
      return;
    }
    try {
      // تحديث الحالة إلى منتهي لمنع الدخول المتكرر أو لإظهار أنها قرأت
      await updateDoc(doc(db, `users/${currentUserId}/notifications`, notif.id), {
        status: 'expired',
        read: true
      });

      // التوجيه إلى PlayerParty مع تمرير البيانات (سواء فيلم أو مسلسل)
      router.push({
        pathname: "/PlayerParty",
        params: { 
          id: notif.seriesId || notif.movieId, // يدعم النوعين
          episodeId: notif.episodeId || null,   // خاص بالمسلسلات
          roomID: notif.fromId, 
          videoUrl: notif.videoUrl 
        }
      });
    } catch (e) {
      console.error("Watch Invite Error:", e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, `users/${currentUserId}/notifications`, id), { read: true });
    } catch (e) {
      console.error("Mark as read error:", e);
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#FFD700" size="large" /></View>;

  return (
    <View style={styles.container}>
      <ImageBackground source={CINEMATIC_BG_IMAGE} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={28} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>مركز التنبيهات</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-open-outline" size={60} color="#222" />
              <Text style={styles.emptyText}>صندوق الوارد فارغ</Text>
            </View>
          ) : (
            notifications.map((item) => (
              <View key={item.id} style={[styles.card, item.read === false && styles.unreadCard]}>
                
                <View style={[
                  styles.iconContainer, 
                  item.type === 'friend_request' ? styles.friendIconBg : 
                  item.type === 'watch_invite' ? styles.watchIconBg : styles.systemIconBg
                ]}>
                  {item.type === 'friend_request' && item.senderAvatar ? (
                    <Image source={{ uri: item.senderAvatar }} style={styles.senderImg} />
                  ) : item.type === 'watch_invite' ? (
                    <View style={styles.avatarWrapper}>
                        <Image source={{ uri: item.senderAvatar || 'https://via.placeholder.com/150' }} style={styles.senderImg} />
                        <View style={styles.miniIconBadge}>
                            <MaterialCommunityIcons name="movie-play" size={12} color="#000" />
                        </View>
                    </View>
                  ) : (
                    <Ionicons 
                      name={item.type === 'friend_request' ? "person-add" : "notifications-outline"} 
                      size={20} 
                      color={item.type === 'friend_request' ? "#FFD700" : "#00E5FF"} 
                    />
                  )}
                </View>

                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <TouchableOpacity onPress={() => handleDeleteNotification(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#444" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{item.title || "تنبيه جديد"}</Text>
                  </View>
                  
                  <Text style={styles.body}>{item.body || "لا يوجد تفاصيل"}</Text>
                  
                  {item.type === 'friend_request' && (
                    <View style={styles.btnRow}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptFriend(item)}>
                        <Text style={styles.btnText}>قبول</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.rejectBtn} 
                        onPress={() => handleDeleteNotification(item.id)}
                      >
                        <Text style={styles.rejectText}>رفض</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {item.type === 'watch_invite' && (
                    <TouchableOpacity 
                      style={[styles.watchBtn, item.status === 'expired' && styles.expiredBtn]} 
                      onPress={() => handleWatchInvite(item)}
                    >
                       <LinearGradient 
                          colors={item.status === 'expired' ? ['#222', '#111'] : ['#FFD700', '#B8860B']} 
                          style={styles.watchGradient}
                       >
                          <Text style={[styles.btnText, item.status === 'expired' && styles.expiredBtnText]}>
                            {item.status === 'expired' ? 'منتهي' : 'مشاهدة الآن'}
                          </Text>
                       </LinearGradient>
                    </TouchableOpacity>
                  )}

                  {item.type !== 'friend_request' && item.type !== 'watch_invite' && item.read === false && (
                    <TouchableOpacity style={styles.closeBtn} onPress={() => markAsRead(item.id)}>
                      <Text style={styles.closeBtnText}>فهمت</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </ImageBackground>

      {/* مودال التنبيه المخصص */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
           <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.modalBox}>
              <View style={[styles.modalIconCircle, { borderColor: customAlert.type === 'error' ? '#ff4444' : '#FFD700' }]}>
                <Ionicons 
                  name={customAlert.type === 'error' ? "close-circle" : "checkmark-circle"} 
                  size={40} 
                  color={customAlert.type === 'error' ? "#ff4444" : "#FFD700"} 
                />
              </View>
              <Text style={styles.modalTitle}>{customAlert.title}</Text>
              <Text style={styles.modalMessage}>{customAlert.message}</Text>
              <TouchableOpacity 
                style={styles.modalBtn} 
                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
              >
                <Text style={styles.modalBtnText}>حسناً</Text>
              </TouchableOpacity>
           </LinearGradient>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 55, paddingHorizontal: 25, marginBottom: 25 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row-reverse', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 22, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  unreadCard: { borderColor: 'rgba(255, 215, 0, 0.2)', backgroundColor: 'rgba(255, 215, 0, 0.03)' },
  iconContainer: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginLeft: 15, overflow: 'hidden' },
  avatarWrapper: { width: '100%', height: '100%', position: 'relative' },
  senderImg: { width: '100%', height: '100%' },
  miniIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFD700', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#000' },
  friendIconBg: { backgroundColor: 'rgba(255, 215, 0, 0.1)' },
  systemIconBg: { backgroundColor: 'rgba(0, 229, 255, 0.05)' },
  watchIconBg: { backgroundColor: 'rgba(255, 215, 0, 0.08)' },
  content: { flex: 1, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  title: { color: '#FFD700', fontSize: 15, fontWeight: 'bold' },
  body: { color: '#CCC', fontSize: 13, marginTop: 6, textAlign: 'right', lineHeight: 20 },
  btnRow: { flexDirection: 'row', marginTop: 15 },
  acceptBtn: { backgroundColor: '#FFD700', paddingHorizontal: 25, paddingVertical: 8, borderRadius: 10, marginLeft: 12 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  rejectBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 25, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  rejectText: { color: '#888', fontSize: 13 },
  watchBtn: { marginTop: 15, borderRadius: 10, overflow: 'hidden' },
  expiredBtn: { borderWidth: 1, borderColor: '#333' },
  expiredBtnText: { color: '#666' },
  watchGradient: { paddingHorizontal: 20, paddingVertical: 8 },
  closeBtn: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10 },
  closeBtnText: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 150 },
  emptyText: { color: '#333', marginTop: 15, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: width * 0.8, borderRadius: 30, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalIconCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalMessage: { color: '#AAA', fontSize: 16, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  modalBtn: { backgroundColor: '#FFD700', width: '100%', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  modalBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});