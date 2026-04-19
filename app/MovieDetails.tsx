import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, ScrollView, Modal,
  TouchableOpacity, ActivityIndicator, Dimensions, StatusBar, FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// استيراد Firebase
import { db } from '../firebaseConfig'; 
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

const { width, height } = Dimensions.get('window');

export default function MovieDetails() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWatchModes, setShowWatchModes] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [myUserData, setMyUserData] = useState<any>(null);

  // حالة التنبيه المخصص
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'success' });

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        if (id) {
          const docRef = doc(db, "movies", id as string);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setMovie({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) { console.error("Movie Fetch Error:", error); } 
      finally { setLoading(false); }
    };

    const fetchInitialData = async () => {
      try {
        if (currentUser) {
          const myDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (myDoc.exists()) {
            setMyUserData(myDoc.data());
          }

          const q = query(collection(db, "users"), where("uid", "!=", currentUser.uid));
          const querySnapshot = await getDocs(q);
          const friendsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFriends(friendsData);
        }
      } catch (error) { console.error("Data Fetch Error:", error); }
    };

    fetchMovie();
    fetchInitialData();
  }, [id, currentUser]);

  // دالة إظهار التنبيه المخصص
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setCustomAlert({ visible: true, title, message, type });
  };

  const sendInvite = async (friendId: string, friendUsername: string) => {
    if (!currentUser) return showAlert("خطأ", "يجب عليك تسجيل الدخول أولاً", "error");
    
    setSendingInvite(true);
    try {
      const senderName = myUserData?.username || currentUser.displayName || 'صديقك';

      await addDoc(collection(db, `users/${friendId}/notifications`), {
        type: 'watch_invite',
        title: 'دعوة مشاهدة فيلم',
        body: `يدعوك ${senderName} لمشاهدة فيلم ${movie?.title}`,
        senderName: senderName,
        senderAvatar: myUserData?.profileImage || currentUser.photoURL || 'https://via.placeholder.com/150',
        movieId: id,
        fromId: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false,
        status: 'pending' 
      });

      setShowFriendsList(false);
      // إظهار نافذة النجاح السينمائية
      showAlert("نجاح", `تم إرسال طلب مشاهدة إلى ${friendUsername}.`, "success");
    } catch (error) {
      console.error("Invite Error:", error);
      showAlert("خطأ", "حدثت مشكلة أثناء إرسال الإشعار.", "error");
    } finally {
      setSendingInvite(false);
    }
  };

  const startSingleWatch = () => {
    setShowWatchModes(false);
    router.push({
      pathname: "/PlayerSingle",
      params: { id: movie?.id, videoUrl: movie?.videoUrl }
    });
  };

  const startPartyWatch = () => {
    setShowWatchModes(false);
    setShowFriendsList(true);
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      
      <View style={styles.headerHero}>
        <Image source={{ uri: movie?.posterUrl }} style={styles.backImage} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', '#000']} style={styles.mainOverlay} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.topContent}>
          <View style={styles.posterWrapper}>
            <Image source={{ uri: movie?.posterUrl }} style={styles.frontPoster} />
            <LinearGradient colors={['transparent', 'rgba(255,215,0,0.1)']} style={styles.posterGlow} />
          </View>
          <Text style={styles.titleText}>{movie?.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.glassInfo}><Text style={styles.glassText}>{movie?.year}</Text></View>
            <View style={styles.glassInfo}><Text style={styles.glassText}>{movie?.country}</Text></View>
            <View style={styles.goldBadge}>
              <Ionicons name="star" size={14} color="#000" />
              <Text style={styles.goldText}>{movie?.rating}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.sectionLine}>
             <Text style={styles.sectionLabel}>القصة</Text>
             <View style={styles.goldLine} />
          </View>
          <Text style={styles.descriptionText}>{movie?.description || "رحلة سينمائية مذهلة تنتظرك."}</Text>
        </View>
        <View style={{height: 120}} /> 
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.mainPlayBtn} onPress={() => setShowWatchModes(true)}>
          <LinearGradient colors={['#FFD700', '#B8860B']} style={styles.playGradient}>
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.playBtnText}>اختر وضع المشاهدة</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* مودال أوضاع المشاهدة */}
      <Modal visible={showWatchModes} transparent animationType="slide">
        <View style={styles.bottomModalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>كيف تود المشاهدة؟</Text>
            
            <TouchableOpacity style={styles.sheetOption} onPress={startSingleWatch}>
              <View style={styles.optionIconBox}>
                <Ionicons name="person" size={22} color="#FFD700" />
              </View>
              <Text style={styles.optionText}>مشاهدة بمفردي</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetOption, styles.goldBorder]} onPress={startPartyWatch}>
              <View style={styles.optionIconBox}>
                <Ionicons name="people" size={22} color="#FFD700" />
              </View>
              <View style={{flex: 1}}>
                 <Text style={styles.optionText}>مشاهدة مع صديق</Text>
                 <Text style={styles.optionSubText}>شارك المتعة الآن</Text>
              </View>
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>جديد</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelSheet} onPress={() => setShowWatchModes(false)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الأصدقاء */}
      <Modal visible={showFriendsList} transparent animationType="slide">
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomSheet, {height: height * 0.75}]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>أرسل دعوة لصديق</Text>
            
            <FlatList 
              data={friends}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{paddingBottom: 20}}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.friendRow} 
                  onPress={() => sendInvite(item.uid, item.username)}
                >
                  <Image source={{uri: item.profileImage || 'https://via.placeholder.com/150'}} style={styles.friendImg} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendNameText}>{item.username}</Text>
                    <View style={styles.friendRankBox}>
                      <Text style={styles.friendRankText}>{item.rank || "عضو"}</Text>
                    </View>
                  </View>
                  {sendingInvite ? <ActivityIndicator size="small" color="#FFD700" /> : <Ionicons name="send" size={20} color="#FFD700" />}
                </TouchableOpacity>
              )}
            />
            
            <TouchableOpacity style={styles.cancelSheet} onPress={() => setShowFriendsList(false)}>
              <Text style={styles.goldCancelText}>إغلاق القائمة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال التنبيه المخصص (بديل Alert) */}
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

      <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  headerHero: { position: 'absolute', width: width, height: height * 0.5 },
  backImage: { width: '100%', height: '100%', opacity: 0.5 },
  mainOverlay: { ...StyleSheet.absoluteFillObject },
  scroll: { flex: 1 },
  topContent: { alignItems: 'center', marginTop: height * 0.12 },
  posterWrapper: { width: width * 0.55, height: height * 0.32, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  frontPoster: { width: '100%', height: '100%' },
  posterGlow: { ...StyleSheet.absoluteFillObject },
  titleText: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  badgeRow: { flexDirection: 'row-reverse', marginTop: 12 },
  glassInfo: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginHorizontal: 4 },
  glassText: { color: '#CCC', fontSize: 12 },
  goldBadge: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  goldText: { color: '#000', fontWeight: 'bold', marginLeft: 4 },
  detailsSection: { paddingHorizontal: 30, marginTop: 30 },
  sectionLine: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  goldLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,215,0,0.2)' },
  descriptionText: { color: '#999', fontSize: 15, lineHeight: 24, textAlign: 'right' },
  bottomBar: { position: 'absolute', bottom: 0, width: width, padding: 25, backgroundColor: 'rgba(0,0,0,0.8)' },
  mainPlayBtn: { width: '100%', height: 60, borderRadius: 18, overflow: 'hidden' },
  playGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  playBtnText: { color: '#000', fontSize: 18, fontWeight: '900', marginLeft: 10 },
  floatingBack: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  bottomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  bottomSheet: { width: width, backgroundColor: '#0A0A0A', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, borderWidth: 1, borderColor: '#1A1A1A' },
  sheetHandle: { width: 50, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  sheetOption: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 20, marginBottom: 15 },
  optionIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  optionText: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'right' },
  optionSubText: { color: '#666', fontSize: 12, textAlign: 'right' },
  goldBorder: { borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  newBadge: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  newBadgeText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  cancelSheet: { marginTop: 10, alignItems: 'center', padding: 10 },
  cancelText: { color: '#555', fontSize: 16 },
  goldCancelText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  friendRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0F0F0F', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1A1A1A' },
  friendImg: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 1, borderColor: '#FFD700' },
  friendInfo: { flex: 1, marginRight: 15 },
  friendNameText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  friendRankBox: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 5 },
  friendRankText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },

  // تنسيقات التنبيه المخصص الجديدة
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: width * 0.8, borderRadius: 30, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalIconCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalMessage: { color: '#AAA', fontSize: 16, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  modalBtn: { backgroundColor: '#FFD700', width: '100%', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  modalBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});