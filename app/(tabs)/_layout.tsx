import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#FFD700', // اللون الذهبي
      tabBarInactiveTintColor: '#888',
      tabBarShowLabel: false, // حذف النصوص بالكامل كما طلبت
      tabBarStyle: {
        backgroundColor: '#000',
        borderTopColor: '#222',
        height: 70, // زيادة الطول قليلاً لتناسب الأيقونات
        paddingBottom: 0,
      },
      headerShown: false,
    }}>
      {/* أيقونة الهوم المربعة والمميزة */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.homeIconBox,
              focused && { backgroundColor: 'rgba(255, 215, 0, 0.15)', borderColor: '#FFD700' }
            ]}>
              <MaterialCommunityIcons 
                name={focused ? "view-grid" : "view-grid-outline"} 
                size={28} 
                color={color} 
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "film" : "film-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "tv" : "tv-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  homeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14, // حواف مربعة ناعمة
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  }
});