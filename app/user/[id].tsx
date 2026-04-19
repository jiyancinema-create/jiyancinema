import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, 
  ActivityIndicator, ImageBackground, Dimensions, ScrollView, Alert 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// إعدادات Firebase
import { auth, db } from '../../firebaseConfig';
import { 
  doc, getDoc, collection, addDoc, serverTimestamp, 
  query, where, onSnapshot, deleteDoc, setDoc 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const BG_IMAGE = require('../../assets/jiyan_bg.png'); 

export default function OthersProfileScreen() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'friends'>('none');

  // --- نظام الرتب والألوان ---
  const getRankStyle = (rank: string) => {
    const styles: any = {
      "إمبراطور المنصة 👑": { colors: ['#FFD700', '#FFF', '#8A2BE2'], shadow: '#FFD700' },
      "سينمائي خارق 🔥": { colors: ['#FF0000', '#FFD700', '#0000FF'], shadow: '#FF4500' },
      "القائد": { colors: ['#DAA520', '#FFD700', '#B8860B'], shadow: '#FFD700' },
      "اسطورة": { colors: ['#DAA520', '#FFD700', '#B8860B'], shadow: '#FFD700' },
      "الماسي": { colors: ['#00FFFF', '#FFF', '#00CED1'], shadow: '#00FFFF' },
      "سينمائي": { colors: ['#0000FF', '#4169E1'], shadow: '#0000FF' },
      "نجم": { colors: ['#FF0000', '#DC143C'], shadow: '#FF0000' },
      "متقدم": { colors: ['#FFFF00', '#FFD700'], shadow: '#FFFF00' },
      "عضو": { colors: ['#333', '#111'], shadow: 'transparent' },
    };
    return styles[rank] || { colors: ['#222', '#111'], shadow: 'transparent' };
  };

  useEffect(() => {
    if (!id || !auth.currentUser) return;

    // جلب بياناتي الشخصية
    const fetchMe = async () => {
        const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
        if (snap.exists()) setCurrentUserData(snap.data());
    };

    // جلب بيانات المستخدم الآخر
    const fetchUserData = async () => {
      try {
        const docRef = doc(db, "users", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    // مراقبة حالة الصداقة والطلبات تلقائياً
    const myUid = auth.currentUser.uid;
    
    // 1. التحقق إذا كان صديقاً بالفعل
    const unsubFriends = onSnapshot(doc(db, "users", myUid), (snapshot) => {
      const myFriends = snapshot.data()?.friends || [];
      if (myFriends.includes(id)) {
        setFriendshipStatus('friends');
      } else {
        // 2. إذا لم يكن صديقاً، نتحقق من وجود طلب معلق
        const qPending = query(
          collection(db, `users/${id}/notifications`),
          where("fromId", "==", myUid),
          where("type", "==", "friend_request")
        );
        const unsubPending = onSnapshot(qPending, (notifSnap) => {
          setFriendshipStatus(!notifSnap.empty ? 'pending' : 'none');
        });
        return () => unsubPending();
      }
    });

    fetchMe();
    fetchUserData();
    return () => unsubFriends();
  }, [id]);

  // دالة إرسال الطلب
  const handleAddFriend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !id) return;

    try {
      await addDoc(collection(db, `users/${id}/notifications`), {
        fromId: currentUser.uid,
        title: "طلب صداقة جديد",
        body: `أرسل لك ${currentUserData?.fullName || "مستخدم"} طلب صداقة`,
        type: "friend_request",
        status: "pending", // حالة الطلب داخل الإشعار
        read: false,
        timestamp: serverTimestamp(),
      });
      Alert.alert("تم الإرسال", "تم إرسال طلب الصداقة بنجاح.");
    } catch (error) {
      Alert.alert("خطأ", "فشل إرسال الطلب.");
    }
  };

  // دالة إزالة الصداقة (تلقائية للطرفين)
  const handleUnfriend = () => {
    Alert.alert("إزالة الصديق", "هل تريد إزالة هذا الشخص من قائمة أصدقائك؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "نعم، إزالة", style: "destructive", onPress: async () => {
          const myUid = auth.currentUser?.uid;
          if(!myUid) return;
          try {
            // تحديث مصفوفتي ومصفوفة الطرف الآخر (تلقائي)
            const myRef = doc(db, "users", myUid);
            const otherRef = doc(db, "users", id as string);
            
            const mySnap = await getDoc(myRef);
            const otherSnap = await getDoc(otherRef);

            const myNewFriends = (mySnap.data()?.friends || []).filter((fId: string) => fId !== id);
            const otherNewFriends = (otherSnap.data()?.friends || []).filter((fId: string) => fId !== myUid);

            await setDoc(myRef, { friends: myNewFriends }, { merge: true });
            await setDoc(otherRef, { friends: otherNewFriends }, { merge: true });
            
            Alert.alert("تم", "تمت إزالة الصديق بنجاح.");
          } catch (e) { console.log(e); }
      }}
    ]);
  };

  const frame = getRankStyle(user?.rank);

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#FFD700" size="large" /></View>;

  return (
    <View style={styles.container}>
      <ImageBackground source={BG_IMAGE} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']} style={StyleSheet.absoluteFill} />
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-forward" size={28} color="#FFD700" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.avatarGlow, { shadowColor: frame.shadow }]}>
              <LinearGradient colors={frame.colors} style={styles.avatarBorder}>
                <View style={styles.innerAvatarBg}>
                    <Image source={{ uri: user?.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                </View>
              </LinearGradient>
            </View>
            
            <Text style={styles.userName}>{user?.fullName}</Text>
            <Text style={styles.userHandle}>@{user?.username}</Text>
            
            <View style={[styles.rankBadge, { borderColor: frame.shadow !== 'transparent' ? frame.shadow : '#222' }]}>
              <Text style={[styles.rankText, { color: frame.shadow === 'transparent' ? '#888' : frame.shadow }]}>
                {user?.rank || "عضو"}
              </Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{user?.points || 0}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{Math.floor((user?.points || 0) / 1000) + 1}</Text>
              <Text style={styles.statLabel}>المستوى</Text>
            </View>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={[
                styles.mainBtn,
                friendshipStatus === 'friends' ? styles.removeBtn : 
                friendshipStatus === 'pending' ? styles.pendingBtn : styles.addBtn
              ]}
              onPress={() => {
                if (friendshipStatus === 'none') handleAddFriend();
                if (friendshipStatus === 'friends') handleUnfriend();
              }}
              disabled={friendshipStatus === 'pending'}
            >
              <Ionicons 
                name={friendshipStatus === 'friends' ? "person-remove" : friendshipStatus === 'pending' ? "time" : "person-add"} 
                size={22} color={friendshipStatus === 'none' ? "#000" : (friendshipStatus === 'friends' ? "#FF4C4C" : "#FFD700")} 
              />
              <Text style={[styles.mainBtnText, { color: friendshipStatus === 'none' ? "#000" : (friendshipStatus === 'friends' ? "#FF4C4C" : "#FFD700") }]}>
                {friendshipStatus === 'friends' ? "إزالة الصديق" : friendshipStatus === 'pending' ? "طلب معلق" : "إضافة صديق"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bioContainer}>
            <View style={styles.bioHeader}>
              <Text style={styles.bioTitle}>النبذة التعريفية</Text>
              <MaterialCommunityIcons name="text-account" size={20} color="#FFD700" />
            </View>
            <View style={styles.bioContent}>
              <Text style={styles.bioText}>{user?.bio || "لا توجد نبذة لهذا المستخدم."}</Text>
            </View>
          </View>

        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  scrollContent: { paddingBottom: 60 },
  backBtn: { marginTop: 55, marginRight: 25, alignSelf: 'flex-end', width: 45, height: 45, backgroundColor: '#080808', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  header: { alignItems: 'center', marginTop: 10 },
  avatarGlow: { shadowOpacity: 0.8, shadowRadius: 20, elevation: 25 },
  avatarBorder: { padding: 4, borderRadius: 38 },
  innerAvatarBg: { backgroundColor: '#000', borderRadius: 34, padding: 2 },
  avatar: { width: 110, height: 110, borderRadius: 32 },
  userName: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 18 },
  userHandle: { color: '#555', fontSize: 14, marginTop: 4 },
  rankBadge: { backgroundColor: 'rgba(255,255,255,0.02)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 15, marginTop: 15, borderWidth: 1 },
  rankText: { fontSize: 12, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row-reverse', backgroundColor: '#050505', marginHorizontal: 35, marginTop: 35, borderRadius: 25, paddingVertical: 22, borderWidth: 1, borderColor: '#0f0f0f' },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: '50%', backgroundColor: '#111', alignSelf: 'center' },
  statVal: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#333', fontSize: 11, marginTop: 4, fontWeight: 'bold' },
  actionSection: { marginTop: 35, paddingHorizontal: 35 },
  mainBtn: { flexDirection: 'row-reverse', height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', width: '100%' },
  addBtn: { backgroundColor: '#FFD700' },
  pendingBtn: { backgroundColor: 'rgba(255,215,0,0.03)', borderWidth: 1, borderColor: '#FFD700' },
  removeBtn: { backgroundColor: 'rgba(255, 76, 76, 0.03)', borderWidth: 1, borderColor: '#FF4C4C' },
  mainBtnText: { fontWeight: 'bold', fontSize: 16, marginRight: 12 },
  bioContainer: { marginHorizontal: 35, marginTop: 40 },
  bioHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 15 },
  bioTitle: { color: '#FFF', fontSize: 17, fontWeight: 'bold', marginRight: 10 },
  bioContent: { backgroundColor: '#050505', padding: 22, borderRadius: 25, borderWidth: 1, borderColor: '#0f0f0f' },
  bioText: { color: '#777', textAlign: 'right', lineHeight: 24, fontSize: 14 }
});