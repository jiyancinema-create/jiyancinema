import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, ScrollView, Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // أيقونات العين

// استيراد أدوات Firebase
import { auth, db } from '../firebaseConfig'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail, // دالة نسيت كلمة المرور
  signOut
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function AuthScreen() {
  const router = useRouter();

  // حالات الواجهة
  const [isLogin, setIsLogin] = useState(true); 
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true); // حالة إخفاء الباسورد
  
  // البيانات
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [image, setImage] = useState<string | null>(null);

  // دالة اختيار الصورة
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // دالة استعادة كلمة المرور
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('تنبيه', 'يرجى كتابة البريد الإلكتروني أولاً لإرسال رابط الاستعادة');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('تم الإرسال', 'تحقق من بريدك الإلكتروني لإعادة تعيين كلمة المرور');
    } catch (error: any) {
      Alert.alert('خطأ', 'تأكد من صحة البريد المدخل');
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('تنبيه', 'يرجى ملء الحقول الأساسية');
      return;
    }

    if (!isLogin && (password !== confirmPassword)) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          Alert.alert('تنبيه', 'يرجى تفعيل حسابك من البريد الإلكتروني أولاً');
          await signOut(auth);
          setLoading(false);
          return;
        }
        router.replace('/(tabs)/home');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await sendEmailVerification(user);

        // حفظ البيانات في Firestore
        await setDoc(doc(db, "users", user.uid), {
          fullName,
          username: username.toLowerCase(),
          email,
          profileImage: image,
          createdAt: new Date().toISOString(),
          uid: user.uid
        });

        Alert.alert('نجاح', 'تم إنشاء الحساب! يرجى تفعيل البريد الإلكتروني ثم سجل دخولك.');
        await signOut(auth);
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* اختيار الصورة في حالة التسجيل */}
        {!isLogin && (
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? <Image source={{ uri: image }} style={styles.selectedImage} /> : 
            <Ionicons name="camera-outline" size={40} color="#FFD700" />}
          </TouchableOpacity>
        )}

        <Text style={styles.title}>{isLogin ? 'Jiyan Cinema' : 'انضم إلينا'}</Text>
        <Text style={styles.subtitle}>{isLogin ? 'سجل دخولك للمتابعة' : 'أنشئ حسابك المجاني الآن'}</Text>

        {!isLogin && (
          <>
            <TextInput style={styles.input} placeholder="الاسم الكامل" placeholderTextColor="#666" value={fullName} onChangeText={setFullName} />
            <TextInput style={styles.input} placeholder="اسم المستخدم" placeholderTextColor="#666" value={username} onChangeText={setUsername} autoCapitalize="none" />
          </>
        )}

        <TextInput 
          style={styles.input} 
          placeholder="البريد الإلكتروني" 
          placeholderTextColor="#666" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
          keyboardType="email-address"
        />

        {/* حقل الباسورد مع زر العرض والإخفاء */}
        <View style={styles.passwordContainer}>
          <TextInput 
            style={[styles.input, { marginBottom: 0, flex: 1 }]} 
            placeholder="كلمة المرور" 
            placeholderTextColor="#666" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry={secureText} 
          />
          <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
            <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        {!isLogin && (
          <TextInput 
            style={styles.input} 
            placeholder="تأكيد كلمة المرور" 
            placeholderTextColor="#666" 
            value={confirmPassword} 
            onChangeText={setConfirmPassword} 
            secureTextEntry={secureText} 
          />
        )}

        {/* زر نسيت كلمة المرور */}
        {isLogin && (
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPass}>
            <Text style={styles.forgotPassText}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{isLogin ? 'دخول' : 'تسجيل'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            {isLogin ? 'لا تملك حساباً؟ سجل الآن' : 'لديك حساب بالفعل؟ ادخل'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#000', padding: 25, justifyContent: 'center' },
  imagePicker: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111', borderWidth: 1, borderColor: '#FFD700', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  selectedImage: { width: '100%', height: '100%' },
  title: { color: '#FFD700', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 30 },
  input: { width: '100%', height: 55, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 15, color: '#fff', marginBottom: 15, textAlign: 'right', borderWidth: 1, borderColor: '#222' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 15 },
  eyeIcon: { position: 'absolute', left: 15, zIndex: 1 },
  forgotPass: { alignSelf: 'flex-start', marginBottom: 20 },
  forgotPassText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },
  mainButton: { width: '100%', height: 55, backgroundColor: '#FFD700', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  switchBtn: { marginTop: 25, alignSelf: 'center' },
  switchText: { color: '#FFD700', fontSize: 14, textDecorationLine: 'underline' },
});