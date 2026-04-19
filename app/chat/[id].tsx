import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Modal, Image, Alert, Clipboard, Linking, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig'; 
import { 
  collection, addDoc, serverTimestamp, query, orderBy, 
  onSnapshot, doc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove, runTransaction 
} from 'firebase/firestore';

const GIFTS = [
  { id: 'heart', name: 'قلب', price: 100, icon: 'heart', color: '#ff4757' },
  { id: 'hat', name: 'قبعة', price: 500, icon: 'hat-wizard', color: '#ffa502' },
  { id: 'fire_sword', name: 'سيف النار', price: 1000, icon: 'fire', color: '#ff4757' },
  { id: 'ice', name: 'جليد', price: 2000, icon: 'snowflake', color: '#70a1ff' },
  { id: 'crown', name: 'تاج', price: 3000, icon: 'crown', color: '#eccc68' },
];

const GAMES = [
  { id: 'xo', name: 'إكس أو', icon: 'times-circle' },
  { id: 'dice', name: 'نرد', icon: 'dice' },
];

export default function JiyanCinemaChat() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [friend, setFriend] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [gameModal, setGameModal] = useState(false);
  const [giftModal, setGiftModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [msgOptionsModal, setMsgOptionsModal] = useState<any>(null);
  const [customBet, setCustomBet] = useState('100');
  const [replyTo, setReplyTo] = useState<any>(null);

  const chatId = [auth.currentUser?.uid, id as string].sort().join('_');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!auth.currentUser?.uid || !id) return;

    const unsubFriend = onSnapshot(doc(db, "users", id as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFriend(data);
        if (data.blockedUsers?.includes(auth.currentUser?.uid)) {
          Alert.alert("تنبيه", "تم إنهاء المحادثة.");
          router.back();
        }
      }
    });

    const unsubMe = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        if (data.blockedUsers?.includes(id)) router.back();
      }
    });

    return () => { unsubFriend(); unsubMe(); };
  }, [id]);

  // --- نظام الترتيب المحدث (Inverted) ---
  useEffect(() => {
    // الترتيب "desc" ضروري لعمل inverted FlatList بشكل صحيح
    const q = query(
      collection(db, "direct_messages", chatId, "messages"), 
      orderBy("createdAt", "desc") 
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const msgData = {
      text: inputText,
      senderId: auth.currentUser?.uid,
      type: 'text',
      replyTo: replyTo ? { text: replyTo.text, senderId: replyTo.senderId } : null,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, "direct_messages", chatId, "messages"), msgData);
    setInputText('');
    setReplyTo(null);
  };

  const sendGift = async (gift: any) => {
    const myId = auth.currentUser?.uid;
    const friendId = id as string;
    if (!myId || !friendId) return;

    if ((userData?.points || 0) < gift.price) {
      return Alert.alert("عذراً", "رصيدك غير كافي لإرسال هذه الهدية.");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const myRef = doc(db, "users", myId);
        const friendRef = doc(db, "users", friendId);
        const myDoc = await transaction.get(myRef);
        if (!myDoc.exists() || (myDoc.data().points < gift.price)) throw "النقاط غير كافية!";

        transaction.update(myRef, { points: increment(-gift.price) });
        transaction.update(friendRef, { points: increment(gift.price) });

        const giftMsgRef = doc(collection(db, "direct_messages", chatId, "messages"));
        transaction.set(giftMsgRef, {
          type: 'gift', giftId: gift.id, price: gift.price,
          senderId: myId, createdAt: serverTimestamp(),
        });
      });
      setGiftModal(false);
    } catch (e) {
      Alert.alert("خطأ", "فشلت العملية.");
    }
  };

  const sendGameChallenge = async (gameId: string) => {
    const bet = parseInt(customBet);
    if (isNaN(bet) || bet <= 0) return Alert.alert("خطأ", "أدخل مبلغاً صالحاً.");
    if ((userData?.points || 0) < bet) return Alert.alert("خطأ", "نقاطك غير كافية.");

    await addDoc(collection(db, "direct_messages", chatId, "messages"), {
      type: 'game_challenge', gameType: gameId, pot: bet,
      senderId: auth.currentUser?.uid, status: 'pending', createdAt: serverTimestamp(),
    });
    setGameModal(false);
  };

  const acceptChallenge = async (msg: any) => {
    const myId = auth.currentUser?.uid;
    if (!myId || msg.senderId === myId) return;
    if ((userData?.points || 0) < msg.pot) return Alert.alert("خطأ", "رصيدك غير كافي.");

    try {
      await runTransaction(db, async (transaction) => {
        const myRef = doc(db, "users", myId);
        const senderRef = doc(db, "users", msg.senderId);
        const msgRef = doc(db, "direct_messages", chatId, "messages", msg.id);

        transaction.update(myRef, { points: increment(-msg.pot) });
        transaction.update(senderRef, { points: increment(-msg.pot) });
        transaction.update(msgRef, { status: 'active', totalPot: msg.pot * 2 });
      });
    } catch (e) {
      Alert.alert("خطأ", "تعذر القبول.");
    }
  };

  const toggleBlock = async () => {
    if (!auth.currentUser?.uid || !id) return;
    const isBlocked = userData?.blockedUsers?.includes(id);
    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, { blockedUsers: isBlocked ? arrayRemove(id) : arrayUnion(id) });
    setProfileModal(false);
  };

  const renderTextWithLinks = (text: string, isMe: boolean) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
      <Text style={[styles.msgText, { color: isMe ? '#000' : '#FFF' }]}>
        {parts.map((part, i) => urlRegex.test(part) ? (
          <Text key={i} style={{ color: '#007AFF' }} onPress={() => Linking.openURL(part)}>{part}</Text>
        ) : part)}
      </Text>
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === auth.currentUser?.uid;

    if (item.type === 'gift') {
      const gift = GIFTS.find(g => g.id === item.giftId);
      return (
        <View style={[styles.giftBubble, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          <FontAwesome5 name={gift?.icon || 'gift'} size={32} color={gift?.color || '#FFD700'} />
          <Text style={styles.giftText}>{isMe ? 'أرسلت هدية' : 'أرسل لك هدية'}</Text>
          <View style={styles.giftTag}><Text style={styles.giftTagTxt}>{item.price} pts</Text></View>
        </View>
      );
    }

    if (item.type === 'game_challenge') {
      return (
        <View style={[styles.gameCard, isMe ? {alignSelf: 'flex-end'} : {alignSelf: 'flex-start'}]}>
          <MaterialCommunityIcons name="controller-classic" size={24} color="#FFD700" />
          <Text style={styles.gameTitle}>تحدي {item.gameType?.toUpperCase()}</Text>
          <Text style={styles.potValue}>{item.status === 'active' ? item.totalPot : item.pot} 🪙</Text>
          <TouchableOpacity style={[styles.playBtn, item.status === 'active' && {backgroundColor: '#2ecc71'}]} 
            onPress={() => item.status === 'pending' && acceptChallenge(item)}>
            <Text style={styles.playBtnTxt}>
              {item.status === 'active' ? "جاري اللعب..." : (isMe ? "في انتظار الخصم" : "قبول")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity onLongPress={() => setMsgOptionsModal(item)} style={[styles.msgWrap, isMe ? styles.myMsg : styles.theirMsg]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.replyTo && (
            <View style={styles.replyInBubble}><Text style={styles.replyInText} numberOfLines={1}>{item.replyTo.text}</Text></View>
          )}
          {renderTextWithLinks(item.text, isMe)}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFD700" /></TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={() => setProfileModal(true)}>
          <Text style={styles.headerName}>{friend?.fullName || '...'}</Text>
          <Text style={styles.rankText}>{friend?.rank || 'محارب'}</Text>
        </TouchableOpacity>
        <Image source={{ uri: friend?.profileImage || 'https://via.placeholder.com/150' }} style={styles.headerAvatar} />
      </View>

      {/* --- القائمة مقلوبة تلقائياً (Inverted) للحفاظ على الترتيب من الأسفل للأعلى --- */}
      <FlatList 
        ref={flatListRef} 
        data={messages} 
        keyExtractor={item => item.id} 
        renderItem={renderMessage} 
        contentContainerStyle={{ padding: 15 }}
        inverted 
      />

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={{ color: '#FFD700', fontSize: 12 }}>الرد على:</Text>
            <Text style={{ color: '#888', fontSize: 13 }} numberOfLines={1}>{replyTo.text}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={20} color="#e74c3c" /></TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity onPress={() => setGiftModal(true)} style={styles.iconBtn}><Ionicons name="gift" size={24} color="#FFD700" /></TouchableOpacity>
        <TouchableOpacity onPress={() => setGameModal(true)} style={styles.iconBtn}><Ionicons name="game-controller" size={24} color="#FFD700" /></TouchableOpacity>
        <TextInput style={styles.input} value={inputText} onChangeText={setInputText} placeholder="رسالتك..." placeholderTextColor="#666" multiline />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}><Ionicons name="send" size={18} color="#000" /></TouchableOpacity>
      </View>

      {/* مودالات الخيارات، الهدايا، الألعاب، والبروفايل */}
      <Modal visible={!!msgOptionsModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMsgOptionsModal(null)}>
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>خيارات الرسالة</Text>
            <TouchableOpacity style={styles.optionItem} onPress={() => { setReplyTo(msgOptionsModal); setMsgOptionsModal(null); }}>
              <Ionicons name="arrow-undo" size={20} color="#FFF" /><Text style={styles.optionText}>رد</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={() => { Clipboard.setString(msgOptionsModal.text); setMsgOptionsModal(null); }}>
              <Ionicons name="copy" size={20} color="#FFF" /><Text style={styles.optionText}>نسخ النص</Text>
            </TouchableOpacity>
            {msgOptionsModal?.senderId === auth.currentUser?.uid && (
              <TouchableOpacity style={[styles.optionItem, {borderBottomWidth: 0}]} onPress={() => { deleteDoc(doc(db, "direct_messages", chatId, "messages", msgOptionsModal.id)); setMsgOptionsModal(null); }}>
                <Ionicons name="trash" size={20} color="#e74c3c" /><Text style={[styles.optionText, {color: '#e74c3c'}]}>حذف</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={giftModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>إرسال هدية</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
              {GIFTS.map(gift => (
                <TouchableOpacity key={gift.id} style={styles.giftItem} onPress={() => sendGift(gift)}>
                  <FontAwesome5 name={gift.icon} size={30} color={gift.color} />
                  <Text style={styles.giftItemName}>{gift.name}</Text>
                  <Text style={styles.giftItemPrice}>{gift.price} 🪙</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setGiftModal(false)}><Text style={styles.closeBtnTxt}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={gameModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>تحدي الألعاب</Text>
            <View style={styles.betContainer}>
                <TextInput style={styles.betInput} keyboardType="numeric" value={customBet} onChangeText={setCustomBet} />
            </View>
            <View style={styles.gameGrid}>
              {GAMES.map(game => (
                <TouchableOpacity key={game.id} style={styles.gameItem} onPress={() => sendGameChallenge(game.id)}>
                  <FontAwesome5 name={game.icon} size={28} color="#FFD700" />
                  <Text style={{color: '#FFF', marginTop: 10}}>{game.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setGameModal(false)}><Text style={styles.closeBtnTxt}>إلغاء</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.profileSheet}>
            <Image source={{ uri: friend?.profileImage || 'https://via.placeholder.com/150' }} style={styles.largeAvatar} />
            <Text style={styles.profileTitle}>{friend?.fullName}</Text>
            <TouchableOpacity style={styles.blockBtn} onPress={toggleBlock}>
              <Text style={styles.blockBtnTxt}>{userData?.blockedUsers?.includes(id) ? "إلغاء الحظر" : "حظر المستخدم"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProfileModal(false)}><Text style={{color: '#888', marginTop: 15}}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#080808', borderBottomWidth: 1, borderColor: '#151515' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#FFD700' },
  headerInfo: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 15 },
  headerName: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  rankText: { color: '#FFD700', fontSize: 10, marginTop: 2 },
  msgWrap: { marginVertical: 6, maxWidth: '80%' },
  myMsg: { alignSelf: 'flex-end' },
  theirMsg: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: '#FFD700', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#181818', borderBottomLeftRadius: 2 },
  msgText: { textAlign: 'right', fontSize: 15, lineHeight: 22 },
  replyInBubble: { backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 10, marginBottom: 8, borderRightWidth: 3, borderRightColor: '#000' },
  replyInText: { color: '#333', fontSize: 12 },
  replyBar: { flexDirection: 'row-reverse', padding: 12, backgroundColor: '#080808', alignItems: 'center', borderTopWidth: 1, borderColor: '#222' },
  inputArea: { flexDirection: 'row', padding: 10, backgroundColor: '#050505', alignItems: 'center', borderTopWidth: 1, borderColor: '#111' },
  input: { flex: 1, backgroundColor: '#121212', borderRadius: 25, paddingHorizontal: 15, color: '#FFF', textAlign: 'right', minHeight: 45, marginHorizontal: 8 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  iconBtn: { padding: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  bottomSheet: { width: '100%', backgroundColor: '#0a0a0a', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center', position: 'absolute', bottom: 0, borderTopWidth: 1, borderColor: '#FFD700' },
  sheetTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  giftItem: { width: 90, height: 120, backgroundColor: '#151515', borderRadius: 20, marginHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222' },
  giftItemName: { color: '#FFF', fontSize: 12, marginTop: 8 },
  giftItemPrice: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  closeBtn: { marginTop: 15, padding: 10 },
  closeBtnTxt: { color: '#888', fontSize: 14 },
  gameGrid: { flexDirection: 'row', marginTop: 20 },
  gameItem: { width: 100, height: 100, backgroundColor: '#151515', borderRadius: 20, alignItems: 'center', justifyContent: 'center', margin: 10, borderWidth: 1, borderColor: '#FFD700' },
  betContainer: { width: '85%', alignItems: 'center' },
  betInput: { width: '100%', backgroundColor: '#151515', borderRadius: 15, padding: 15, color: '#FFD700', textAlign: 'center', fontSize: 20, fontWeight: 'bold', borderWidth: 1, borderColor: '#333' },
  profileSheet: { width: '85%', backgroundColor: '#0a0a0a', borderRadius: 30, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  largeAvatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: '#FFD700', marginBottom: 15 },
  profileTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  blockBtn: { backgroundColor: '#222', width: '100%', padding: 12, borderRadius: 15, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#e74c3c' },
  blockBtnTxt: { color: '#e74c3c', fontWeight: 'bold' },
  giftBubble: { backgroundColor: '#111', padding: 20, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#222', marginVertical: 5 },
  giftText: { color: '#FFF', marginTop: 8, fontSize: 13 },
  giftTag: { backgroundColor: '#FFD700', paddingHorizontal: 10, borderRadius: 10, marginTop: 5 },
  giftTagTxt: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  gameCard: { backgroundColor: '#111', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700', width: 170, alignItems: 'center' },
  gameTitle: { color: '#FFF', fontSize: 12, marginVertical: 5 },
  potValue: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' },
  playBtn: { backgroundColor: '#FFD700', padding: 10, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 10 },
  playBtnTxt: { color: '#000', fontSize: 13, fontWeight: 'bold' },
  optionsSheet: { width: '70%', backgroundColor: '#121212', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#333' },
  optionsTitle: { color: '#FFD700', textAlign: 'center', padding: 10, fontSize: 14, borderBottomWidth: 1, borderColor: '#222' },
  optionItem: { flexDirection: 'row-reverse', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#222', justifyContent: 'space-between' },
  optionText: { color: '#FFF', fontSize: 16 }
});