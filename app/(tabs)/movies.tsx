import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, 
  TouchableOpacity, TextInput, ScrollView, ActivityIndicator, 
  SafeAreaView, Dimensions, StatusBar, RefreshControl, Modal, Pressable, Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// استيراد إعدادات Firebase
import { db } from '../../firebaseConfig'; 
import { 
  collection, query, onSnapshot, orderBy, where, limit 
} from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function MoviesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('الكل');
  const [movies, setMovies] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [dynamicCountries, setDynamicCountries] = useState<string[]>(['الكل']);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 1. جلب قائمة الدول ديناميكياً
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "movies"), (snapshot) => {
      const countries = snapshot.docs.map(doc => doc.data().country).filter(Boolean);
      const uniqueCountries = ['الكل', ...new Set(countries)];
      setDynamicCountries(uniqueCountries);
    });
    return () => unsub();
  }, []);

  // 2. جلب الأفلام (مع نظام المفضلات)
  useEffect(() => {
    setLoading(true);
    let moviesRef = collection(db, "movies");
    let q;

    if (selectedCountry === 'الكل') {
      q = query(moviesRef, orderBy("createdAt", "desc"), limit(50));
    } else {
      q = query(moviesRef, where("country", "==", selectedCountry), orderBy("createdAt", "desc"));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const moviesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // تطبيق فلترة البحث
      let filtered = moviesData.filter(m => 
        m.title?.toLowerCase().includes(search.toLowerCase())
      );

      // تطبيق فلترة المفضلات إذا تم تفعيلها
      if (showOnlyFavorites) {
        filtered = filtered.filter(m => favorites.some(fav => fav.id === m.id));
      }

      setMovies(filtered);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, [selectedCountry, search, showOnlyFavorites, favorites]);

  // دالة إضافة/إزالة من المفضلة (تخزين مؤقت في الحالة)
  const toggleFavorite = (item: any) => {
    const isExist = favorites.find(fav => fav.id === item.id);
    if (isExist) {
      setFavorites(favorites.filter(fav => fav.id !== item.id));
    } else {
      setFavorites([...favorites, item]);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topRow}>
        {/* زر عرض المفضلات فقط */}
        <TouchableOpacity 
          style={[styles.iconBtn, showOnlyFavorites && { borderColor: '#FFD700' }]} 
          onPress={() => setShowOnlyFavorites(!showOnlyFavorites)}
        >
          <Ionicons 
            name={showOnlyFavorites ? "heart" : "heart-outline"} 
            size={24} 
            color={showOnlyFavorites ? "#FFD700" : "#555"} 
          />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>JIYAN <Text style={{color: '#FFF'}}>FILMS</Text></Text>
          <View style={styles.indicator} />
        </View>

        {/* مساحة فارغة للحفاظ على التوازن بعد إزالة الأيقونات */}
        <View style={{ width: 42 }} /> 
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <TextInput 
            placeholder="ابحث عن فيلمك..." 
            placeholderTextColor="#444"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          <Ionicons name="search" size={20} color="#FFD700" />
        </View>
        
        <TouchableOpacity 
          style={styles.dropdownTrigger} 
          onPress={() => setShowDropdown(true)}
        >
          <Ionicons name="chevron-down" size={16} color="#000" />
          <Text style={styles.dropdownTriggerText}>{selectedCountry}</Text>
          <MaterialCommunityIcons name="filter-variant" size={18} color="#000" style={{marginLeft: 5}} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const MovieCard = ({ item }: { item: any }) => {
    const isFav = favorites.some(fav => fav.id === item.id);
    const [imgLoading, setImgLoading] = useState(true);

    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={styles.movieCard}
        onPress={() => router.push({ pathname: '/MovieDetails', params: { id: item.id } })}
      >
        {imgLoading && (
          <View style={styles.imgLoader}><ActivityIndicator size="small" color="#FFD700" /></View>
        )}
        <Image 
          source={{ uri: item.posterUrl }} 
          style={styles.poster}
          onLoadEnd={() => setImgLoading(false)}
        />

        {/* زر المفضلة فوق الفيلم */}
        <TouchableOpacity 
          style={styles.favBadge} 
          onPress={() => toggleFavorite(item)}
        >
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? "#FFD700" : "#FFF"} />
        </TouchableOpacity>

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.95)']} style={styles.cardGradient}>
          <View style={styles.cardInfo}>
            <Text style={styles.mTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.mMeta}>
              <Text style={styles.mYear}>{item.year}</Text>
              <View style={styles.rateTag}>
                <Ionicons name="star" size={10} color="#000" /><Text style={styles.rateText}>{item.rating}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => <MovieCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor="#FFD700" />}
        ListEmptyComponent={!loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="heart-dislike-outline" size={60} color="#222" />
              <Text style={styles.emptyText}>{showOnlyFavorites ? "قائمة المفضلات فارغة" : "لا توجد نتائج"}</Text>
            </View>
          ) : <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 50}} />
        }
      />

      <Modal visible={showDropdown} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>اختر تصنيف الدولة</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight: height * 0.5}}>
              {dynamicCountries.map((country) => (
                <TouchableOpacity 
                  key={country} 
                  style={[styles.modalItem, selectedCountry === country && styles.modalItemActive]}
                  onPress={() => { setSelectedCountry(country); setShowDropdown(false); }}
                >
                  <Text style={[styles.modalItemText, selectedCountry === country && styles.modalItemTextActive]}>{country}</Text>
                  {selectedCountry === country && <Ionicons name="checkmark-circle" size={20} color="#000" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingBottom: 10 },
  topRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  logoContainer: { alignItems: 'center' },
  logoText: { color: '#FFD700', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  indicator: { width: 40, height: 3, backgroundColor: '#FFD700', borderRadius: 2, marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  
  searchSection: { paddingHorizontal: 20, marginTop: 20, flexDirection: 'row-reverse', alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0A0A0A', height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#1A1A1A', paddingHorizontal: 15 },
  searchInput: { flex: 1, color: '#FFF', textAlign: 'right', fontSize: 14, marginRight: 10 },
  
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', height: 50, borderRadius: 16, paddingHorizontal: 15, marginRight: 10 },
  dropdownTriggerText: { color: '#000', fontWeight: 'bold', fontSize: 13 },

  list: { paddingHorizontal: 8, paddingBottom: 100 },
  movieCard: { width: (width / 2) - 16, height: 280, margin: 8, borderRadius: 24, overflow: 'hidden', backgroundColor: '#080808', position: 'relative' },
  poster: { width: '100%', height: '100%' },
  favBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 10, zIndex: 10 },
  imgLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
  cardGradient: { position: 'absolute', bottom: 0, width: '100%', height: '60%', justifyContent: 'flex-end' },
  cardInfo: { padding: 15 },
  mTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  mMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  mYear: { color: '#888', fontSize: 12 },
  rateTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rateText: { color: '#000', fontSize: 11, fontWeight: '900', marginLeft: 2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  dropdownMenu: { backgroundColor: '#0F0F0F', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, borderColor: '#1A1A1A' },
  modalHandle: { width: 50, height: 5, backgroundColor: '#333', borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 25 },
  modalItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 10, backgroundColor: '#151515' },
  modalItemActive: { backgroundColor: '#FFD700' },
  modalItemText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  modalItemTextActive: { color: '#000' },

  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#444', marginTop: 10, fontSize: 16 }
});