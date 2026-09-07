import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import RooftopAdventureGame from './src/minigames/RooftopAdventureGame';

export default function App() {
  const [session, setSession] = useState(0);

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text style={styles.eyebrow}>UNA NOCHE EN SANTIAGO</Text>
        <Text accessibilityRole="header" style={styles.title}>Kuro: Aventura de Tejados</Text>
        <Text style={styles.subtitle}>Un gatito, los tejados y un cielo lleno de estrellitas.</Text>
        <View style={styles.card}>
          <RooftopAdventureGame key={session} onComplete={() => setSession((value) => value + 1)} />
        </View>
        <Text style={styles.controls}>Toca o haz clic para saltar. En teclado, usa Espacio o ↑. Puedes saltar dos veces.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b1023' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 48 },
  eyebrow: { color: '#ffd76f', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  title: { color: '#f8f4ed', fontSize: 30, fontWeight: '800', textAlign: 'center', maxWidth: 540, marginBottom: 12 },
  subtitle: { color: '#b9bed3', fontSize: 15, textAlign: 'center', maxWidth: 420, lineHeight: 23, marginBottom: 28 },
  card: { backgroundColor: '#161c32', borderRadius: 28 },
  controls: { color: '#949db9', fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 340, marginTop: 22 },
});
