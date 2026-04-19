import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, 
  ActivityIndicator, ScrollView, ImageBackground, Alert, 
  TextInput, Modal, Dimensions 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard'; // مكتبة النسخ

// إعدادات Firebase
import { auth, db } from '../firebaseConfig'; 
import { 
  doc, onSnapshot, collection, updateDoc, deleteDoc, 
  setDoc, getDoc 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const { width, height } = Dimensions.get('window');

export default function GlobalFinalProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'blocked'>('friends');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newBio, setNewBio] = useState('');

  // ميزة نسخ المعرف ID
  const copyToClipboard = async (id: string) => {
    await Clipboard.setStringAsync(id);
    Alert.alert("تم النسخ", "تم نسخ معرف الحساب بنجاح ✅");
  };

  const getCinematicFrame = (rank: string) => {
    const styles: any = {
      "إمبراطور المنصة 👑": { colors: ['#FFD700', '#FFF', '#FFD700'], shadow: '#FFD700', glow: 25, border: 5 },
      "سينمائي خارق 🔥": { colors: ['#FF0000', '#FF7F00', '#FF0000'], shadow: '#FF4500', glow: 22, border: 4.5 },
      "القائد 🎖️": { colors: ['#00C9FF', '#92FE9D', '#00C9FF'], shadow: '#00C9FF', glow: 18, border: 4 },
      "أسطورة 🏆": { colors: ['#DAA520', '#F4D03F', '#B8860B'], shadow: '#DAA520', glow: 18, border: 4 },
      "سينمائي 🎬": { colors: ['#4B0082', '#8A2BE2', '#4B0082'], shadow: '#8A2BE2', glow: 15, border: 3.5 },
      "نجم ⭐️": { colors: ['#E0FFFF', '#FFF', '#AFEEEE'], shadow: '#00FFFF', glow: 12, border: 3 },
      "متقدم 🛡️": { colors: ['#555', '#AAA', '#555'], shadow: '#777', glow: 5, border: 2 },
    };
    return styles[rank] || { colors: ['#111', '#222'], shadow: 'transparent', glow: 0, border: 1.5 };
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { router.replace('/auth'); return; }

    // 1. جلب بيانات المستخدم الأساسية
    const unsubUser = onSnapshot(doc(db, "users", user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentPoints = Number(data.points) || 0;
        let totalXP = Number(data.totalXP) || currentPoints;

        if (currentPoints > totalXP) {
          totalXP = currentPoints;
          await updateDoc(doc(db, "users", user.uid), { totalXP });
        }

        const level = Math.floor(totalXP / 10000) + 1;
        let rank = "عضو";
        if (level >= 170) rank = "إمبراطور المنصة 👑";
        else if (level >= 90) rank = "سينمائي خارق 🔥";
        else if (level >= 70) rank = "القائد 🎖️";
        else if (level >= 50) rank = "أسطورة 🏆";
        else if (level >= 40) rank = "سينمائي 🎬";
        else if (level >= 25) rank = "نجم ⭐️";
        else if (level >= 10) rank = "متقدم 🛡️";

        if (data.rank !== rank || data.level !== level) {
          await updateDoc(doc(db, "users", user.uid), { rank, level });
        }

        setUserData({ id: docSnap.id, ...data, level, rank, points: currentPoints });
        setNewName(data.fullName || '');
        setNewUsername(data.username || '');
        setNewBio(data.bio || '');
      }
      setLoading(false);
    });

    // 2. جلب الأصدقاء والمحظورين (مع جلب بياناتهم من مجموعة users)
    const fetchDetailedUsers = (collectionPath: string, stateSetter: any) => {
      return onSnapshot(collection(db, collectionPath), async (snapshot) => {
        const usersList = await Promise.all(snapshot.docs.map(async (d) => {
          const userRef = doc(db, "users", d.id);
          const userDoc = await getDoc(userRef);
          return { id: d.id, ...userDoc.data() };
        }));
        stateSetter(usersList);
      });
    };

    const unsubFriends = fetchDetailedUsers(`users/${user.uid}/friends`, setFriends);
    const unsubBlocked = fetchDetailedUsers(`users/${user.uid}/blockedUsers`, setBlockedUsers);

    return () => { unsubUser(); unsubFriends(); unsubBlocked(); };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLogoutModalVisible(false);
      router.replace('/auth');
    } catch (error) {
      Alert.alert("خطأ", "فشل تسجيل الخروج");
    }
  };

  const pickImage = async () => {
    let res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!res.canceled) await updateDoc(doc(db, "users", auth.currentUser!.uid), { profileImage: res.assets[0].uri });
  };

  const handleSave = async () => {
    let cost = (newName !== userData.fullName ? 300 : 0) + (newUsername !== userData.username ? 4000 : 0);
    if (userData.points < cost) return Alert.alert("خطأ", "نقاطك لا تكفي");
    await updateDoc(doc(db, "users", auth.currentUser!.uid), { fullName: newName, username: newUsername, bio: newBio, points: userData.points - cost });
    setEditModalVisible(false);
  };

  const handleBlock = async (item: any) => {
    const myUid = auth.currentUser!.uid;
    await setDoc(doc(db, `users/${myUid}/blockedUsers`, item.id), { blockedAt: serverTimestamp() });
    await deleteDoc(doc(db, `users/${myUid}/friends`, item.id));
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#FFD700" size="large" /></View>;

  const frame = getCinematicFrame(userData?.rank);

  return (
    <View style={styles.container}>
      <ImageBackground source={require('../assets/jiyan_bg.png')} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(0,0,0,0.8)', '#000']} style={StyleSheet.absoluteFill} />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setLogoutModalVisible(true)} style={styles.glassBtn}>
            <Ionicons name="log-out-outline" size={24} color="#FF4B4B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.glassBtn}>
            <Ionicons name="options-outline" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={pickImage} style={[styles.glowWrapper, { shadowColor: frame.shadow, shadowRadius: frame.glow }]}>
              <LinearGradient colors={frame.colors} style={[styles.frameGradient, { padding: frame.border }]}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }} style={styles.mainAvatar} />
                  <View style={styles.camBadge}><Ionicons name="camera" size={12} color="#000" /></View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.uName}>{userData?.fullName}</Text>
            
            {/* عرض المعرف مع خاصية النسخ */}
            <TouchableOpacity onPress={() => copyToClipboard(userData?.id)} style={styles.copyIdBtn}>
              <Text style={styles.uTag}>ID: {userData?.id?.slice(0, 10)}... <Ionicons name="copy-outline" size={12} color="#666" /></Text>
            </TouchableOpacity>
            
            <LinearGradient colors={['#111', '#050505']} style={[styles.rankBadge, { borderColor: frame.shadow || '#222' }]}>
              <Text style={[styles.rankTxt, { color: frame.shadow === 'transparent' ? '#FFD700' : frame.shadow }]}>{userData?.rank}</Text>
            </LinearGradient>

            <Text style={styles.bioTxt}>{userData?.bio || "لا توجد سيرة ذاتية لهذا القائد"}</Text>
          </View>

          <View style={styles.statsRow}>
             <View style={styles.statBox}><Text style={styles.sNum}>{userData?.points}</Text><Text style={styles.sLab}>النقاط</Text></View>
             <View style={styles.divider} />
             <View style={styles.statBox}><Text style={styles.sNum}>{userData?.level}</Text><Text style={styles.sLab}>المستوى</Text></View>
             <View style={styles.divider} />
             <View style={styles.statBox}><Text style={styles.sNum}>{friends.length}</Text><Text style={styles.sLab}>الأصدقاء</Text></View>
          </View>

          <View style={styles.listsContainer}>
            <View style={styles.tabHeader}>
              <TouchableOpacity onPress={()=>setActiveTab('blocked')} style={[styles.tab, activeTab==='blocked' && styles.activeTab]}>
                <Text style={[styles.tabText, activeTab==='blocked' && styles.activeTabText]}>المحظورين ({blockedUsers.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setActiveTab('friends')} style={[styles.tab, activeTab==='friends' && styles.activeTab]}>
                <Text style={[styles.tabText, activeTab==='friends' && styles.activeTabText]}>الأصدقاء ({friends.length})</Text>
              </TouchableOpacity>
            </View>

            {(activeTab === 'friends' ? friends : blockedUsers).map((item) => (
              <View key={item.id} style={styles.userCard}>
                <View style={styles.cardActions}>
                  {activeTab === 'friends' ? (
                    <TouchableOpacity onPress={()=>handleBlock(item)} style={styles.actionBtnRed}>
                      <Ionicons name="ban" size={14} color="#FFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={()=>deleteDoc(doc(db, `users/${auth.currentUser!.uid}/blockedUsers`, item.id))} style={styles.actionBtnGreen}>
                      <Text style={styles.aTxt}>فك الحظر</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.cardInfo}>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={styles.cName}>{item.fullName || "مستخدم"}</Text>
                        <Text style={styles.cUser}>@{item.username || "unknown"}</Text>
                    </View>
                    <Image source={{uri: item.profileImage || 'https://via.placeholder.com/150'}} style={styles.cImg} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ImageBackground>

      {/* مودالات (الخروج، التعديل) - بقيت كما هي في الكود الأصلي مع تحسينات طفيفة */}
      <Modal visible={logoutModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1a1a1a', '#000']} style={styles.logoutContent}>
            <Ionicons name="alert-circle" size={40} color="#FF4B4B" style={{marginBottom:10}}/>
            <Text style={styles.logoutTitle}>تسجيل الخروج؟</Text>
            <Text style={styles.logoutSub}>هل أنت متأكد أنك تريد مغادرة المنصة؟</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.confirmLogoutBtn}><Text style={styles.confirmLogoutText}>تأكيد الخروج</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setLogoutModalVisible(false)} style={styles.cancelLogoutBtn}><Text style={styles.cancelLogoutText}>إلغاء</Text></TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.mBack}><LinearGradient colors={['#111', '#000']} style={styles.mSheet}>
          <View style={styles.modalHandle} /><Text style={styles.mTitle}>تعديل البيانات</Text>
          <TextInput style={styles.mInput} value={newName} onChangeText={setNewName} placeholder="الاسم الجديد" placeholderTextColor="#333" />
          <TextInput style={styles.mInput} value={newUsername} onChangeText={setNewUsername} placeholder="اسم المستخدم" placeholderTextColor="#333" />
          <TextInput style={[styles.mInput, {height: 80}]} multiline value={newBio} onChangeText={setNewBio} placeholder="السيرة الذاتية..." placeholderTextColor="#333" />
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}><Text style={styles.saveBtnText}>حفظ</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setEditModalVisible(false)} style={styles.closeBtn}><Text style={styles.closeBtnText}>إغلاق</Text></TouchableOpacity>
        </LinearGradient></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, paddingHorizontal: 20, zIndex: 10 },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  header: { alignItems: 'center', marginTop: 0 },
  glowWrapper: { elevation: 30, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1 },
  frameGradient: { borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { backgroundColor: '#000', borderRadius: 90, padding: 3, position: 'relative' },
  mainAvatar: { width: 120, height: 120, borderRadius: 60 },
  camBadge: { position: 'absolute', bottom: 5, right: 10, backgroundColor: '#FFD700', padding: 6, borderRadius: 10, borderWidth: 2, borderColor: '#000' },
  uName: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 15 },
  copyIdBtn: { marginTop: 5, padding: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  uTag: { color: '#666', fontSize: 11 },
  rankBadge: { marginTop: 15, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  rankTxt: { fontWeight: 'bold', fontSize: 12 },
  bioTxt: { color: '#AAA', textAlign: 'center', paddingHorizontal: 50, marginTop: 15, lineHeight: 20, fontSize: 13 },
  statsRow: { flexDirection: 'row-reverse', backgroundColor: 'rgba(255,255,255,0.03)', margin: 25, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statBox: { flex: 1, alignItems: 'center' },
  sNum: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  sLab: { color: '#555', fontSize: 10, marginTop: 2 },
  divider: { width: 1, height: '60%', backgroundColor: '#222' },
  listsContainer: { paddingHorizontal: 20 },
  tabHeader: { flexDirection: 'row-reverse', backgroundColor: '#0a0a0a', borderRadius: 12, padding: 4, marginBottom: 15 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  activeTab: { backgroundColor: '#FFD700' },
  tabText: { color: '#555', fontWeight: 'bold', fontSize: 13 },
  activeTabText: { color: '#000' },
  userCard: { flexDirection: 'row', backgroundColor: '#0a0a0a', padding: 12, borderRadius: 15, marginBottom: 8, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#111' },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  cImg: { width: 42, height: 42, borderRadius: 10, marginLeft: 12 },
  cName: { color: '#EEE', fontWeight: 'bold', fontSize: 14 },
  cUser: { color: '#444', fontSize: 10 },
  cardActions: { flexDirection: 'row' },
  actionBtnRed: { backgroundColor: 'rgba(255,0,0,0.1)', padding: 8, borderRadius: 8 },
  actionBtnGreen: { backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  aTxt: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  logoutContent: { width: '80%', padding: 25, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  logoutTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  logoutSub: { color: '#888', textAlign: 'center', marginVertical: 15, fontSize: 14 },
  confirmLogoutBtn: { backgroundColor: '#FF4B4B', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center' },
  confirmLogoutText: { color: '#FFF', fontWeight: 'bold' },
  cancelLogoutBtn: { marginTop: 15 },
  cancelLogoutText: { color: '#555' },
  mBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  mSheet: { width: '100%', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: '#222' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  mTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  mInput: { backgroundColor: '#050505', color: '#FFF', padding: 15, borderRadius: 15, marginBottom: 12, textAlign: 'right', borderWidth: 1, borderColor: '#151515' },
  saveBtn: { backgroundColor: '#FFD700', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#000', fontWeight: 'bold' },
  closeBtn: { marginTop: 15, alignItems: 'center' },
  closeBtnText: { color: '#444' }
});