import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView, 
  ActivityIndicator, Modal, Pressable, Dimensions, Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { 
  collection, query, onSnapshot, doc, where, 
  documentId, updateDoc, arrayUnion, arrayRemove 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function ChatList() {
  const router = useRouter();
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  
  const [optionsModal, setOptionsModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
        setLoading(false);
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (userSnap) => {
      if (userSnap.exists()) {
        const myData = userSnap.data();
        setCurrentUserData(myData);
        
        const myFriendsIds = myData.friends || [];
        const blockedUsers = myData.blocked || [];
        const pinnedUsers = myData.pinned || [];

        const visibleFriendsIds = myFriendsIds.filter((id: string) => !blockedUsers.includes(id));

        if (visibleFriendsIds.length === 0) {
          setFriendsList([]);
          setLoading(false);
          return;
        }

        const friendsQuery = query(
          collection(db, "users"),
          where(documentId(), "in", visibleFriendsIds.slice(0, 30)) 
        );

        const unsubFriends = onSnapshot(friendsQuery, (friendsSnap) => {
          const loadedFriends = friendsSnap.docs.map(d => {
            const data = d.data();
            const unreadCount = myData.unreadMessages?.[d.id] || 0;
            return {
              id: d.id,
              ...data,
              unreadCount,
              isPinned: pinnedUsers.includes(d.id)
            };
          });

          const sortedFriends = loadedFriends.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
            if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
            return 0;
          });

          setFriendsList(sortedFriends);
          setLoading(false);
        }, (error) => {
            console.error("Error fetching friends:", error);
            setLoading(false);
        });

        return () => unsubFriends();
      }
    }, (error) => {
        console.error("Error fetching user data:", error);
        setLoading(false);
    });

    return () => unsubUser();
  }, []);

  const togglePin = async (friendId: string, isPinned: boolean) => {
    try {
        const myRef = doc(db, "users", auth.currentUser!.uid);
        await updateDoc(myRef, {
          pinned: isPinned ? arrayRemove(friendId) : arrayUnion(friendId)
        });
        setOptionsModal(false);
    } catch (e) {
        Alert.alert("خطأ", "لم يتمكن النظام من تحديث التثبيت");
    }
  };

  const handleBlock = async (friendId: string) => {
    try {
        const myRef = doc(db, "users", auth.currentUser!.uid);
        await updateDoc(myRef, { blocked: arrayUnion(friendId) });
        setOptionsModal(false);
    } catch (e) {
        Alert.alert("خطأ", "فشل تنفيذ عملية الحظر");
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      activeOpacity={0.7}
      style={[styles.chatCard, item.isPinned && styles.pinnedCard]} 
      onPress={() => router.push(`/chat/${item.id}`)}
      onLongPress={() => {
        setSelectedFriend(item);
        setOptionsModal(true);
      }}
    >
      <View style={styles.cardGlow} />
      
      <View style={styles.avatarWrapper}>
        <LinearGradient
          colors={item.status === 'online' ? ['#FFD700', '#555'] : ['#222', '#111']}
          style={styles.avatarFrame}
        >
          <Image source={{ uri: item.profileImage || 'https://via.placeholder.com/150' }} style={styles.avatar} />
        </LinearGradient>
        {item.status === 'online' && <View style={styles.onlineStatusDot} />}
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.infoTopRow}>
           <Text style={styles.timeText}>{item.status === 'online' ? 'نشط' : 'بعيد'}</Text>
           <View style={styles.nameContainer}>
             {item.isPinned && <MaterialCommunityIcons name="pin" size={14} color="#FFD700" style={{marginLeft: 4}} />}
             <Text style={styles.userName} numberOfLines={1}>{item.fullName}</Text>
           </View>
        </View>

        <View style={styles.infoBottomRow}>
          {item.unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
            </View>
          )}
          <Text style={styles.lastMsgText} numberOfLines={1}>
            {item.status === 'online' ? 'متواجد الآن في السينما' : `قائد برتبة ${item.rank || 'عضو'}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0f0f0f', '#000']} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        {/* تم إزالة زر الرجوع من هنا */}
        <View style={{ width: 45 }} /> 
        
        <Text style={styles.headerTitle}>غرفة المراسلة</Text>
        
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="search-outline" size={22} color="#555" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : (
        <FlatList
          data={friendsList}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="comment-off-outline" size={60} color="#1a1a1a" />
              <Text style={styles.emptyTitle}>لا توجد محادثات</Text>
              <Text style={styles.emptySub}>ابدأ بإضافة الأصدقاء لمشاركتهم الأفلام</Text>
            </View>
          }
        />
      )}

      <Modal visible={optionsModal} transparent animationType="slide" onRequestClose={() => setOptionsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Image source={{ uri: selectedFriend?.profileImage || 'https://via.placeholder.com/150' }} style={styles.modalAvatar} />
            <Text style={styles.modalName}>{selectedFriend?.fullName}</Text>
            <Text style={styles.modalDetail}>@{selectedFriend?.username}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.actionRow} 
                onPress={() => togglePin(selectedFriend?.id, selectedFriend?.isPinned)}
              >
                <Text style={styles.actionText}>{selectedFriend?.isPinned ? "إلغاء التثبيت" : "تثبيت المحادثة"}</Text>
                <Ionicons name="pin" size={20} color="#FFD700" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionRow, { borderBottomWidth: 0 }]} 
                onPress={() => handleBlock(selectedFriend?.id)}
              >
                <Text style={[styles.actionText, { color: '#FF4C4C' }]}>حظر القائد</Text>
                <Ionicons name="ban" size={20} color="#FF4C4C" />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#111'
  },
  headerIconBtn: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  listPadding: { padding: 15, paddingBottom: 100 },
  chatCard: { 
    flexDirection: 'row-reverse', 
    padding: 12, 
    borderRadius: 24, 
    backgroundColor: '#0a0a0a', 
    marginBottom: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#151515',
    overflow: 'hidden'
  },
  pinnedCard: { borderColor: '#FFD700', backgroundColor: '#0d0d05' },
  cardGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,215,0,0.02)' },
  avatarWrapper: { position: 'relative' },
  avatarFrame: { padding: 2, borderRadius: 20 },
  avatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#111' },
  onlineStatusDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00FF66', borderWidth: 3, borderColor: '#0a0a0a' },
  chatInfo: { flex: 1, marginRight: 15, height: 50, justifyContent: 'space-between' },
  infoTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  nameContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  userName: { color: '#EEE', fontSize: 16, fontWeight: '700', maxWidth: width * 0.4 },
  timeText: { color: '#444', fontSize: 10, fontWeight: 'bold' },
  infoBottomRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  lastMsgText: { color: '#666', fontSize: 12, textAlign: 'right', flex: 1 },
  unreadCountBadge: { backgroundColor: '#FFD700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 10 },
  unreadCountText: { color: '#000', fontSize: 10, fontWeight: '900' },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { color: '#333', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  emptySub: { color: '#1a1a1a', fontSize: 13, marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#222', borderRadius: 2, marginBottom: 20 },
  modalAvatar: { width: 80, height: 80, borderRadius: 25, marginBottom: 15, borderWidth: 1, borderColor: '#FFD700' },
  modalName: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  modalDetail: { color: '#444', fontSize: 13, marginBottom: 25 },
  modalActions: { width: '100%', backgroundColor: '#050505', borderRadius: 20, padding: 5 },
  actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderColor: '#111' },
  actionText: { color: '#EEE', fontSize: 15, fontWeight: '600' }
});