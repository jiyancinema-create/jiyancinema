import {initializeApp, getApp,getApps } from 'firebase/app';
import {getFirestore } from 'firebase/firestore';
import { initializeAuth,getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {   apiKey: "AIzaSyC1oEcR70FpTpMCkbHb4DvJlPdwED-r_no",
      authDomain: "jiyan-6990f.firebaseapp.com",
      projectId: "jiyan-6990f",
        storageBucket: "jiyan-6990f.firebasestorage.app",
      messagingSenderId: "793669058952",
      appId: "1:793669058952:web:12381b830128301e8b7a3d",
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage)});

const db = getFirestore(app);
export {auth, db};