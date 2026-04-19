import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Dimensions, ImageBackground, Modal, Alert, Linking, Share 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// إعدادات Firebase
import { auth, db } from '../../firebaseConfig'; 
import { 
  doc, onSnapshot, collection, query, where, 
  updateDoc, arrayUnion, increment, orderBy, limit 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CINEMATIC_BG_IMAGE = require('../../assets/jiyan_bg.png'); 

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [lives, setLives] = useState<any[]>([]); 
  const [tasks, setTasks] = useState<any[]>([]); 
  const [posts, setPosts] = useState<any[]>([]); 
  const [allUsers, setAllUsers] = useState<any[]>([]); 
  const [unreadNotifications, setUnreadNotifications] = useState(0); 
  const [searchQuery, setSearchQuery] = useState(''); 

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const getRankStyle = (rank: string) => {
    const styles: any = {
      "إمبراطور المنصة 👑": { colors: ['#FFD700', '#FFF', '#B8860B'], shadow: '#FFD700' },
      "سينمائي خارق 🔥": { colors: ['#FF4500', '#FF0000', '#8B0000'], shadow: '#FF4500' },
      "نجم ⭐️": { colors: ['#00FFFF', '#FFF', '#008B8B'], shadow: '#00FFFF' },
    };
    return styles[rank] || { colors: ['#222', '#111'], shadow: 'transparent' };
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) setUserData({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    });

    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("userId", "==", user.uid), where("read", "==", false)), (s) => {
      setUnreadNotifications(s.size);
    });

    const unsubLives = onSnapshot(query(collection(db, "lives"), where("status", "==", true)), (s) => 
      setLives(s.docs.map(d => ({id: d.id, ...d.data()})))
    );

    const unsubPosts = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(10)), (s) => 
      setPosts(s.docs.map(d => ({id: d.id, ...d.data()})))
    );

    const unsubTasks = onSnapshot(query(collection(db, "tasks"), orderBy("createdAt", "desc")), (s) => 
      setTasks(s.docs.map(d => ({id: d.id, ...d.data()})))
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (s) => {
      setAllUsers(s.docs.map(d => ({id: d.id, ...d.data()})).filter(u => u.id !== user.uid));
    });

    return () => { unsubUser(); unsubNotifs(); unsubLives(); unsubPosts(); unsubTasks(); unsubUsers(); };
  }, []);

  const filteredUsers = allUsers.filter(u => 
    u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTaskPress = (task: any) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const executeTaskAction = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !selectedTask) return;
    try {
      if (selectedTask.type === 'insta') {
        await Linking.openURL(`https://instagram.com/${selectedTask.username || 'dewran_haji'}`);
      } else if (selectedTask.type === 'share') {
        await Share.share({ message: `انضم إلينا في تطبيق جيان سينما! 🎬\n${selectedTask.link || 'https://jiyan-cinema.com'}` });
      }
      await updateDoc(doc(db, "tasks", selectedTask.id), { completedBy: arrayUnion(userId) });
      await updateDoc(doc(db, "users", userId), { points: increment(selectedTask.reward || 0) });
      setShowTaskModal(false);
      Alert.alert("رائع! ✨", `لقد حصلت على ${selectedTask.reward} نقطة.`);
    } catch (error) {
      Alert.alert("خطأ", "تعذر إكمال المهمة.");
    }
  };

  const frame = getRankStyle(userData?.rank);

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#FFD700" size="large" /></View>;

  return (
    <View style={styles.container}>
      <ImageBackground source={CINEMATIC_BG_IMAGE} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.4)', '#000']} style={StyleSheet.absoluteFill} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop: 60, paddingBottom: 110}}>
          
          {/* Header الاحترافي */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/notifications')}>
              {unreadNotifications > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadNotifications > 9 ? '+9' : unreadNotifications}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="bell-outline" size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.userSection} onPress={() => router.push('/profile')}>
                <View style={styles.headerText}>
                    <Text style={styles.welcomeTxt}>مرحباً بك،</Text>
                    <Text style={styles.userName} numberOfLines={1}>{userData?.fullName || "Dewran Haji"}</Text>
                </View>
                <View style={[styles.avatarGlow, { shadowColor: frame.shadow }]}>
                    <Image source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }} style={[styles.avatar, {borderColor: frame.shadow || '#FFD700'}]} />
                </View>
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
             <View style={styles.statItem}>
                <FontAwesome5 name="medal" size={14} color="#FFD700" />
                <Text style={styles.statText}>{userData?.rank || "عضو"}</Text>
             </View>
             <View style={styles.statDivider} />
             <View style={styles.statItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFD700" />
                <Text style={styles.statText}>{userData?.points || 0} XP</Text>
             </View>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <TextInput placeholder="ابحث عن أصدقاء..." placeholderTextColor="#555" style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
            <Ionicons name="search-outline" size={20} color="#FFD700" />
          </View>

          {searchQuery.length > 0 ? (
            <View style={styles.searchContainer}>
              {filteredUsers.map(u => (
                <TouchableOpacity key={u.id} style={styles.userSearchCard} onPress={() => router.push(`/user/${u.id}`)}>
                  <View style={styles.userInfo}><Text style={styles.userSearchName}>{u.fullName}</Text><Text style={styles.userSearchRank}>@{u.username}</Text></View>
                  <Image source={{ uri: u.profileImage }} style={styles.userSearchImg} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              {/* Live Section */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>البث المباشر</Text>
                <View style={styles.livePulse} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft: 20}}>
                  {lives.map(live => (
                      <TouchableOpacity key={live.id} style={styles.eventCard} onPress={() => router.push({ pathname: '/live-player', params: { streamUrl: live.url } })}>
                          <ImageBackground source={{ uri: live.image }} style={styles.eventBg} imageStyle={{borderRadius: 20}}>
                              <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
                              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.eventOverlay}>
                                  <Text style={styles.eventTitle} numberOfLines={1}>{live.title}</Text>
                              </LinearGradient>
                          </ImageBackground>
                      </TouchableOpacity>
                  ))}
              </ScrollView>

              {/* News Section */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>آخر الأخبار</Text>
                <MaterialCommunityIcons name="newspaper-variant-outline" size={20} color="#FFD700" />
              </View>
              <View style={styles.postsWrapper}>
                {posts.map(post => (
                  <View key={post.id} style={styles.postCard}>
                    {post.image && <Image source={{ uri: post.image }} style={styles.postImage} />}
                    <View style={styles.postContent}>
                      <Text style={styles.postTitle}>{post.title}</Text>
                      <Text style={styles.postDesc} numberOfLines={3}>{post.description}</Text>
                      <View style={styles.postFooter}>
                        <Text style={styles.postDate}>{new Date(post.createdAt?.seconds * 1000).toLocaleDateString('ar-EG')}</Text>
                        <TouchableOpacity onPress={() => Share.share({ message: post.title })}>
                           <Ionicons name="share-outline" size={18} color="#FFD700" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Tasks Section */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>مركز المهام</Text>
                <Text style={styles.xpLabel}>+XP</Text>
              </View>
              <View style={styles.tasksWrapper}>
                {tasks.filter(t => !t.completedBy?.includes(auth.currentUser?.uid)).map(task => (
                  <TouchableOpacity key={task.id} style={styles.taskCard} onPress={() => handleTaskPress(task)}>
                    <View style={styles.taskIconBg}><Ionicons name="flash" size={18} color="#FFD700" /></View>
                    <View style={styles.taskInfo}><Text style={styles.taskName}>{task.title}</Text><Text style={styles.taskReward}>+{task.reward} XP</Text></View>
                    <Ionicons name="chevron-back" size={16} color="#444" />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </ImageBackground>

      {/* Modal */}
      <Modal visible={showTaskModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#1a1a1a', '#000']} style={styles.modalContent}>
            <View style={styles.modalIconBox}><Ionicons name="rocket-outline" size={40} color="#FFD700" /></View>
            <Text style={styles.modalTitle}>{selectedTask?.title}</Text>
            <Text style={styles.modalBody}>{selectedTask?.description}</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={executeTaskAction}><Text style={styles.confirmBtnText}>إبدأ المهمة ⚡️</Text></TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTaskModal(false)}><Text style={styles.closeBtnText}>إغلاق</Text></TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25 },
  userSection: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginRight: 12, alignItems: 'flex-end' },
  welcomeTxt: { color: '#888', fontSize: 11 },
  userName: { color: '#FFF', fontSize: 17, fontWeight: 'bold', width: 120, textAlign: 'right' },
  avatarGlow: { elevation: 10, shadowOpacity: 0.5, shadowRadius: 8 },
  avatar: { width: 48, height: 48, borderRadius: 15, borderWidth: 1.5 },
  notificationBtn: { width: 45, height: 45, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeContainer: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF0000', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 1, borderColor: '#000' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  statsBar: { flexDirection: 'row-reverse', backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 25, marginTop: 20, borderRadius: 15, padding: 12, justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statItem: { flexDirection: 'row-reverse', alignItems: 'center' },
  statText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginRight: 8 },
  statDivider: { width: 1, height: 15, backgroundColor: 'rgba(255,255,255,0.1)' },
  searchBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 25, marginTop: 20, padding: 12, borderRadius: 15, alignItems: 'center' },
  searchInput: { flex: 1, color: '#FFF', textAlign: 'right', marginRight: 10 },
  labelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 25, marginTop: 30, marginBottom: 15 },
  label: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0000' },
  eventCard: { width: 240, height: 130, marginRight: 15 },
  eventBg: { flex: 1, justifyContent: 'space-between' },
  liveTag: { backgroundColor: '#FF0000', paddingHorizontal: 8, paddingVertical: 2, borderTopLeftRadius: 20, borderBottomRightRadius: 10, alignSelf: 'flex-start' },
  liveTagText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  eventOverlay: { padding: 10, height: '50%', justifyContent: 'flex-end' },
  eventTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  postsWrapper: { paddingHorizontal: 25 },
  postCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, marginBottom: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  postImage: { width: '100%', height: 160 },
  postContent: { padding: 15 },
  postTitle: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', marginBottom: 5 },
  postDesc: { color: '#AAA', fontSize: 13, textAlign: 'right' },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  postDate: { color: '#555', fontSize: 11 },
  xpLabel: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  tasksWrapper: { paddingHorizontal: 25 },
  taskCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  taskIconBg: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  taskInfo: { flex: 1, alignItems: 'flex-end' },
  taskName: { color: '#FFF', fontSize: 14 },
  taskReward: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 25, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalIconBox: { width: 70, height: 70, backgroundColor: '#111', borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  modalBody: { color: '#888', textAlign: 'center', marginVertical: 15 },
  confirmBtn: { backgroundColor: '#FFD700', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#000', fontWeight: 'bold' },
  closeBtn: { marginTop: 15 },
  closeBtnText: { color: '#666' },
  searchContainer: { paddingHorizontal: 25 },
  userSearchCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#111', padding: 12, borderRadius: 15, marginBottom: 8 },
  userInfo: { flex: 1, alignItems: 'flex-end', marginRight: 12 },
  userSearchName: { color: '#FFF', fontWeight: 'bold' },
  userSearchRank: { color: '#444', fontSize: 11 },
  userSearchImg: { width: 40, height: 40, borderRadius: 10 }
});