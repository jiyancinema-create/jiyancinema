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
import { 
  doc, getDoc, collection, getDocs, addDoc, 
  serverTimestamp, query, where, orderBy 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

const { width, height } = Dimensions.get('window');

export default function SeriesDetails() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [series, setSeries] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('episodes'); 
  
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasons, setSeasons] = useState<number[]>([]);
  
  const [showWatchModes, setShowWatchModes] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [myUserData, setMyUserData] = useState<any>(null);

  const [customAlert, setCustomAlert] = useState({ 
    visible: false, title: '', message: '', type: 'success' 
  });

  useEffect(() => {
    const fetchSeriesData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const docRef = doc(db, "series", id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSeries({ id: docSnap.id, ...data });
          
          const totalSeasons = data.totalSeasons || 1;
          const seasonsArray = Array.from({ length: totalSeasons }, (_, i) => i + 1);
          setSeasons(seasonsArray);
          
          fetchEpisodesBySeason(1);
        }
      } catch (error) { 
        console.error("Error fetching series:", error); 
      } finally { 
        setLoading(false); 
      }
    };

    const fetchInitialData = async () => {
      try {
        if (currentUser) {
          const myDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (myDoc.exists()) setMyUserData(myDoc.data());

          const q = query(collection(db, "users"), where("uid", "!=", currentUser.uid));
          const querySnapshot = await getDocs(q);
          const friendsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFriends(friendsData);
        }
      } catch (error) { console.error("Data Fetch Error:", error); }
    };

    fetchSeriesData();
    fetchInitialData();
  }, [id, currentUser]);

  const fetchEpisodesBySeason = async (seasonNum: number) => {
    setEpisodesLoading(true);
    try {
      const episodesRef = collection(db, "series", id as string, "episodes");
      const q = query(
        episodesRef, 
        where("seasonNumber", "==", seasonNum),
        orderBy("episodeNumber", "asc") // تم التأكد من الاسم هنا
      );
      
      const querySnapshot = await getDocs(q);
      const episodesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEpisodes(episodesData);
    } catch (error) {
      console.error("Error fetching episodes:", error);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setCustomAlert({ visible: true, title, message, type });
  };

  const handleEpisodePress = (episode: any) => {
    setSelectedEpisode(episode);
    setShowWatchModes(true);
  };

  const startSingleWatch = () => {
    setShowWatchModes(false);
    router.push({
      pathname: "/PlayerSingle",
      params: { videoUrl: selectedEpisode?.videoUrl, title: selectedEpisode?.title }
    });
  };

  const sendInvite = async (friendId: string, friendUsername: string) => {
    if (!currentUser) return showAlert("خطأ", "يجب عليك تسجيل الدخول أولاً", "error");
    
    setSendingInvite(true);
    try {
      const senderName = myUserData?.username || currentUser.displayName || 'صديقك';

      await addDoc(collection(db, `users/${friendId}/notifications`), {
        type: 'watch_invite',
        title: 'دعوة مشاهدة مسلسل',
        body: `يدعوك ${senderName} لمشاهدة الحلقة ${selectedEpisode?.episodeNumber} من ${series?.title}`,
        senderName: senderName,
        senderAvatar: myUserData?.profileImage || currentUser.photoURL || 'https://via.placeholder.com/150',
        seriesId: id,
        episodeId: selectedEpisode?.id,
        videoUrl: selectedEpisode?.videoUrl,
        fromId: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false,
        status: 'pending' 
      });

      setShowFriendsList(false);
      showAlert("نجاح", `تم إرسال طلب مشاهدة إلى ${friendUsername}.`, "success");
    } catch (error) {
      showAlert("خطأ", "حدثت مشكلة أثناء إرسال الإشعار.", "error");
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <View style={styles.headerHero}>
        <Image source={{ uri: series?.posterUrl }} style={styles.backImage} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', '#000']} style={styles.mainOverlay} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.topContent}>
          <View style={styles.posterWrapper}>
            <Image source={{ uri: series?.posterUrl }} style={styles.frontPoster} />
            <LinearGradient colors={['transparent', 'rgba(255,215,0,0.1)']} style={styles.posterGlow} />
          </View>
          <Text style={styles.titleText}>{series?.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.glassInfo}><Text style={styles.glassText}>{series?.year}</Text></View>
            <View style={styles.glassInfo}><Text style={styles.glassText}>{series?.country}</Text></View>
            <View style={styles.goldBadge}>
              <Ionicons name="star" size={14} color="#000" />
              <Text style={styles.goldText}>{series?.rating}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'episodes' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('episodes')}
          >
            <Text style={[styles.tabText, activeTab === 'episodes' && styles.activeTabText]}>الحلقات</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'info' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>القصة</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailsSection}>
          {activeTab === 'info' ? (
            <Text style={styles.descriptionText}>{series?.description || "قصة درامية مشوقة بانتظارك."}</Text>
          ) : (
            <View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.seasonsScroll} 
                contentContainerStyle={{flexDirection: 'row-reverse'}}
              >
                {seasons.map((num) => (
                  <TouchableOpacity 
                    key={num} 
                    style={[styles.seasonBtn, selectedSeason === num && styles.activeSeasonBtn]} 
                    onPress={() => { setSelectedSeason(num); fetchEpisodesBySeason(num); }}
                  >
                    <Text style={[styles.seasonBtnText, selectedSeason === num && styles.activeSeasonBtnText]}>
                      الجزء {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {episodesLoading ? (
                <ActivityIndicator color="#FFD700" style={{marginTop: 20}} />
              ) : (
                episodes.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    activeOpacity={0.7} 
                    style={styles.episodeCard} 
                    onPress={() => handleEpisodePress(item)}
                  >
                    <LinearGradient colors={['#1A1A1A', '#0A0A0A']} style={styles.episodeGradient}>
                      <View style={styles.playIconCircle}>
                        <Ionicons name="play" size={18} color="#000" />
                      </View>
                      <View style={styles.episodeInfo}>
                        <Text style={styles.episodeTitle}>الحلقة {item.episodeNumber}</Text>
                        <Text style={styles.episodeSubText} numberOfLines={1}>
                          {item.title || "اضغط للمشاهدة"}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-left" size={24} color="#FFD700" />
                    </LinearGradient>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
        <View style={{height: 100}} /> 
      </ScrollView>

      {/* المودالات كما هي */}
      <Modal visible={showWatchModes} transparent animationType="slide">
        <View style={styles.bottomModalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>اختر وضع المشاهدة</Text>
            <TouchableOpacity style={styles.sheetOption} onPress={startSingleWatch}>
              <View style={styles.optionIconBox}><Ionicons name="person" size={22} color="#FFD700" /></View>
              <Text style={styles.optionText}>مشاهدة بمفردي</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetOption, styles.goldBorder]} onPress={() => { setShowWatchModes(false); setShowFriendsList(true); }}>
              <View style={styles.optionIconBox}><Ionicons name="people" size={22} color="#FFD700" /></View>
              <View style={{flex: 1}}>
                 <Text style={styles.optionText}>مشاهدة مع صديق</Text>
                 <Text style={styles.optionSubText}>أرسل دعوة الآن</Text>
              </View>
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>جديد</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelSheet} onPress={() => setShowWatchModes(false)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFriendsList} transparent animationType="slide">
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomSheet, {height: height * 0.75}]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>أرسل دعوة لصديق</Text>
            <FlatList 
              data={friends}
              keyExtractor={(item) => item.id} // تم تعديل المفتاح ليكون id
              renderItem={({item}) => (
                <TouchableOpacity style={styles.friendRow} onPress={() => sendInvite(item.id, item.username)}>
                  <Image source={{uri: item.profileImage || 'https://via.placeholder.com/150'}} style={styles.friendImg} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendNameText}>{item.username}</Text>
                    <View style={styles.friendRankBox}><Text style={styles.friendRankText}>{item.rank || "عضو"}</Text></View>
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

      <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#FFF" />
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
  topContent: { alignItems: 'center', marginTop: height * 0.1 },
  posterWrapper: { width: width * 0.5, height: height * 0.3, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  frontPoster: { width: '100%', height: '100%' },
  posterGlow: { ...StyleSheet.absoluteFillObject },
  titleText: { color: '#FFF', fontSize: 26, fontWeight: '900', marginTop: 15, textAlign: 'center', paddingHorizontal: 20 },
  badgeRow: { flexDirection: 'row-reverse', marginTop: 12 },
  glassInfo: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginHorizontal: 4 },
  glassText: { color: '#CCC', fontSize: 12 },
  goldBadge: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  goldText: { color: '#000', fontWeight: 'bold', marginLeft: 4 },
  tabContainer: { flexDirection: 'row-reverse', marginHorizontal: 30, marginTop: 30, backgroundColor: '#0F0F0F', borderRadius: 15, padding: 5, borderWidth: 1, borderColor: '#1A1A1A' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTabBtn: { backgroundColor: '#FFD700' },
  tabText: { color: '#555', fontWeight: 'bold' },
  activeTabText: { color: '#000' },
  detailsSection: { paddingHorizontal: 25, marginTop: 25 },
  descriptionText: { color: '#999', fontSize: 15, lineHeight: 24, textAlign: 'right' },
  seasonsScroll: { marginBottom: 20 },
  seasonBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: '#111', marginLeft: 10, borderWidth: 1, borderColor: '#222' },
  activeSeasonBtn: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  seasonBtnText: { color: '#666', fontWeight: 'bold' },
  activeSeasonBtnText: { color: '#000' },
  episodeCard: { marginBottom: 15, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#1A1A1A' },
  episodeGradient: { flexDirection: 'row-reverse', alignItems: 'center', padding: 15 },
  playIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  episodeInfo: { flex: 1, marginRight: 15 },
  episodeTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  episodeSubText: { color: '#666', fontSize: 12, textAlign: 'right', marginTop: 3 },
  floatingBack: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  bottomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  bottomSheet: { width: width, backgroundColor: '#0A0A0A', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, borderWidth: 1, borderColor: '#1A1A1A' },
  sheetHandle: { width: 50, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sheetOption: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#111', padding: 16, borderRadius: 20, marginBottom: 15 },
  optionIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: 'rgba(255,215,0,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  optionText: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'right' },
  optionSubText: { color: '#666', fontSize: 12, textAlign: 'right' },
  goldBorder: { borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  newBadge: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  newBadgeText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  cancelSheet: { marginTop: 10, alignItems: 'center', padding: 10 },
  cancelText: { color: '#555', fontSize: 16 },
  goldCancelText: { color: '#FFD700', fontWeight: 'bold' },
  friendRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0F0F0F', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1A1A1A' },
  friendImg: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 1, borderColor: '#FFD700' },
  friendInfo: { flex: 1, marginRight: 15 },
  friendNameText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  friendRankBox: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 5 },
  friendRankText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
});