import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, AppState } from 'react-native';
import { CAT, STEP, configFor, createWorld, jump, resizeWorld, tick } from '../game/engine.mjs';

const CAT_SHEET = require('../../assets/kuro/kuro-run.png');
const SKYLINE = require('../../assets/kuro/santiago-skyline.png');
const ROOFS = require('../../assets/kuro/rooftop-segments.png');
const PIXELS = Platform.OS === 'web' ? { imageRendering: 'pixelated' } : {};
const SKY_STARS = Array.from({ length: 36 }, (_, i) => ({ x: (i * 137.3) % 1000, y: 25 + (i * 47 % 180), size: i % 4 === 0 ? 2 : 1 }));

function Building({ roof, height }) {
  // The source artwork has unevenly spaced buildings. Crop the flat tile roof
  // by its actual pixel rectangle instead of dividing the sheet into quarters.
  const sx = roof.width / 362;
  const sy = 154 / 255;
  return (
    <View testID={`roof-${roof.id}`} style={[styles.building, { left: roof.x, top: roof.y, width: roof.width, height: height - roof.y + 50 }]}>
      <View style={styles.facade} />
      <View style={{ height: 154, overflow: 'hidden' }}>
        <Image source={ROOFS} resizeMode="stretch" style={[PIXELS, { position: 'absolute', width: 2172 * sx, height: 546 * sy, left: -1755 * sx, top: -283 * sy }]} />
      </View>
      <View style={styles.roofEdge} />
      <View style={styles.roofShadow} />
    </View>
  );
}

export default function RooftopAdventureGame() {
  const dimensions = useWindowDimensions();
  const [size, setSize] = useState({ width: dimensions.width, height: dimensions.height });
  const config = configFor(size.width, size.height);
  const configRef = useRef(config);
  const [world, setWorld] = useState(() => createWorld(config, 'start', 1));
  const [nextNight, setNextNight] = useState(1);
  const worldRef = useRef(world);
  const [best, setBest] = useState(0);
  const publish = useCallback((next) => { worldRef.current = next; setWorld(next); }, []);
  const start = useCallback(() => {
    const night = nextNight;
    publish(createWorld(configRef.current, 'playing', night));
    setNextNight((value) => Math.min(5, value + 1));
  }, [nextNight, publish]);
  const doJump = useCallback(() => publish(jump(worldRef.current)), [publish]);
  const pause = useCallback(() => {
    const current = worldRef.current;
    if (current.status === 'playing' || current.status === 'paused') {
      publish({ ...current, status: current.status === 'playing' ? 'paused' : 'playing' });
    }
  }, [publish]);

  useEffect(() => {
    const nextConfig = configFor(size.width, size.height);
    publish(resizeWorld(worldRef.current, configRef.current, nextConfig));
    configRef.current = nextConfig;
  }, [size.width, size.height, publish]);

  useEffect(() => {
    if (world.status !== 'playing') return undefined;
    let raf;
    let previous;
    let accumulated = 0;
    const animate = (now) => {
      if (previous !== undefined) accumulated += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      let next = worldRef.current;
      while (accumulated >= STEP) { next = tick(next, configRef.current); accumulated -= STEP; }
      publish(next);
      if (next.status === 'playing') raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [world.status, publish]);

  useEffect(() => {
    if (world.status === 'ended') setBest((value) => Math.max(value, Math.round(world.distance + world.stars * 18)));
  }, [world.status, world.distance, world.stars]);

  useEffect(() => {
    const autoPause = () => {
      if (worldRef.current.status === 'playing') publish({ ...worldRef.current, status: 'paused' });
    };
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') autoPause(); });
    if (Platform.OS !== 'web') return () => subscription.remove();
    const keydown = (event) => {
      if (event.repeat || event.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
        if (event.code === 'Space' && event.target?.closest?.('button, [role="button"]')) return;
        event.preventDefault();
        if (worldRef.current.status === 'start' || worldRef.current.status === 'ended') start();
        else if (worldRef.current.status === 'playing') doJump();
      }
      if (['Escape', 'KeyP'].includes(event.code)) pause();
    };
    const visibility = () => { if (document.hidden) autoPause(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      subscription.remove();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [doJump, pause, publish, start]);

  const compact = size.height < 430;
  const narrow = size.width < 360;
  const isPlaying = world.status === 'playing';
  const frame = world.grounded ? Math.floor(world.time * 10) % 4 : 2;
  const skylineOffset = -(world.scroll * 0.18 % 600);
  const score = Math.round(world.distance + world.stars * 18);
  return (
    <View testID="game-viewport" style={styles.viewport} onLayout={({ nativeEvent: { layout } }) => {
      if (layout.width > 0 && layout.height > 0) setSize({ width: layout.width, height: layout.height });
    }}>
      <View pointerEvents="none" style={[styles.scene, {
        width: config.width, height: config.height,
        left: (size.width - config.width) / 2, top: (size.height - config.height) / 2,
        transform: [{ scale: config.scale }],
      }]}>
        <View style={[styles.horizon, { top: config.ground - 170 }]} />
        {SKY_STARS.map((star, i) => <View key={i} style={[styles.skyStar, {
          left: ((star.x - world.scroll * 0.03) % config.width + config.width) % config.width,
          top: star.y * config.ground / 300, width: star.size, height: star.size, opacity: i % 3 === 0 ? 0.45 : 0.8,
        }]} />)}
        <View style={[styles.moonGlow, { left: config.width * 0.73, top: config.ground * 0.25 }]}><View style={styles.moon} /></View>
        {Array.from({ length: Math.ceil(config.width / 600) + 1 }, (_, i) => <Image key={i} source={SKYLINE} resizeMode="stretch" style={[styles.skyline, PIXELS, { left: skylineOffset + i * 600, top: config.ground - 145 }]} />)}
        {world.roofs.map((roof) => <Building key={roof.id} roof={roof} height={config.height} />)}
        {world.collectibles.map((star) => <Text key={star.id} style={[styles.star, { left: star.x, top: star.y }]}>✦</Text>)}
        <View testID="kuro" style={[styles.catFrame, { left: CAT.x, top: world.y,
          transform: [{ rotate: world.grounded ? '0deg' : world.vy > 0 ? '12deg' : '-8deg' }],
        }]}>
          <Image source={CAT_SHEET} resizeMode="stretch" style={[PIXELS, styles.catSheet, { left: -frame * CAT.width }]} />
        </View>
      </View>

      {isPlaying ? <Pressable testID="jump-surface" accessibilityLabel="Saltar" style={StyleSheet.absoluteFill} onPressIn={doJump} /> : null}
      <View style={[styles.topBar, narrow && { padding: 14 }]} pointerEvents="box-none">
        <View pointerEvents="none"><Text style={[styles.brand, narrow && { fontSize: 18 }]}>KURO <Text style={styles.brandAccent}>✦</Text></Text><Text style={styles.location}>NOCHE {world.night} · SANTIAGO · DE NOCHE</Text></View>
        <View style={styles.stats} pointerEvents="box-none">
          <View style={styles.stat} pointerEvents="none"><Text style={styles.statText}>{Math.floor(world.distance)} m</Text></View>
          <View style={styles.stat} pointerEvents="none"><Text style={styles.starCount}>✦ {world.stars}</Text></View>
          {isPlaying || world.status === 'paused' ? <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pausar' : 'Continuar'} onPress={pause} style={styles.pause}><Text style={styles.pauseText}>{isPlaying ? 'Ⅱ' : '▶'}</Text></Pressable> : null}
        </View>
      </View>
      {isPlaying ? <View pointerEvents="none" style={styles.bottomBar}><Text style={styles.hint}>{world.mission.completed ? 'MISIÓN COMPLETADA  ·  SIGUE EXPLORANDO' : `MISIÓN  ·  ${Math.floor(world.distance)} / ${world.mission.target} m`}</Text><Text style={styles.hint}>ESPACIO / TOCA  ·  DOBLE SALTO</Text></View> : null}
      {world.status !== 'playing' ? <View style={styles.overlay}>
        <View style={[styles.panel, compact && { padding: 20 }]}>
          <Text style={styles.eyebrow}>{world.status === 'start' ? `NOCHE ${world.night} · PRIMERA MISIÓN` : world.status === 'paused' ? `NOCHE ${world.night} · UN RESPIRO EN LOS TEJADOS` : `NOCHE ${world.night} · OTRA AVENTURA`}</Text>
          <Text accessibilityRole="header" style={[styles.title, compact && { fontSize: 27, lineHeight: 31, marginBottom: 10 }]}>{world.status === 'start' ? 'La ciudad duerme.\nKuro no.' : world.status === 'paused' ? 'Tomemos una pausa.' : '¡Cuidado con el vacío!'}</Text>
          <Text style={[styles.description, compact && { marginBottom: 16 }]}>{world.status === 'start' ? 'Salta de tejado en tejado y sigue las estrellas. Si no saltas, Kuro caerá entre los edificios.' : world.status === 'paused' ? 'Kuro te espera. Continúa cuando quieras.' : `Recorriste ${Math.floor(world.distance)} m y juntaste ${world.stars} ${world.stars === 1 ? 'estrella' : 'estrellas'}.`}</Text>
          <Text style={styles.mission}>{world.mission.completed ? '✦ Misión completada' : `Primera misión: recorre ${world.mission.target} m`}</Text>
          {world.status === 'ended' ? <View style={styles.scoreRow}><Text style={styles.score}>{score} <Text style={styles.scoreLabel}>PUNTOS</Text></Text><Text style={styles.best}>MEJOR DE LA SESIÓN  {Math.max(best, score)}</Text></View> : null}
          <Pressable accessibilityRole="button" onPress={world.status === 'paused' ? pause : start} style={({ pressed }) => [styles.play, pressed && styles.pressed]}><Text style={styles.playText}>{world.status === 'start' ? 'Jugar  →' : world.status === 'paused' ? 'Continuar  →' : 'Volver a intentar  →'}</Text></Pressable>
          <Text style={styles.instructions}>Espacio, ↑ o toca para saltar. Dos saltos antes de aterrizar.</Text>
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#10152e', ...(Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none' } : {}) },
  scene: { position: 'absolute', overflow: 'hidden', backgroundColor: '#111831' },
  horizon: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#292341' },
  skyStar: { position: 'absolute', backgroundColor: '#ffdc9a' },
  moonGlow: { position: 'absolute', width: 75, height: 75, borderRadius: 40, backgroundColor: 'rgba(255,221,146,0.035)', alignItems: 'center', justifyContent: 'center' },
  moon: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#ffe4a0', borderWidth: 3, borderColor: '#f6cf85' },
  skyline: { position: 'absolute', width: 600, height: 150, opacity: 0.65 },
  building: { position: 'absolute', overflow: 'hidden', backgroundColor: '#1b1b32' },
  facade: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1d2038', borderLeftWidth: 3, borderRightWidth: 3, borderColor: '#383047' },
  roofEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: '#b88380' },
  roofShadow: { position: 'absolute', left: 0, right: 0, top: 4, height: 2, backgroundColor: '#402e44' },
  catFrame: { position: 'absolute', width: CAT.width, height: CAT.height, overflow: 'hidden' },
  catSheet: { position: 'absolute', width: CAT.width * 4, height: CAT.height },
  star: { position: 'absolute', color: '#ffdc85', fontSize: 22, lineHeight: 24, textShadowColor: '#bc7834', textShadowRadius: 7 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { color: '#fff4dd', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  brandAccent: { color: '#f6cf85' },
  location: { color: '#a3a5bc', fontSize: 8, letterSpacing: 1.5, marginTop: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { borderRadius: 22, backgroundColor: 'rgba(9,12,29,0.6)', paddingHorizontal: 14, paddingVertical: 11 },
  statText: { color: '#f7f0e2', fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] },
  starCount: { color: '#ffdc85', fontWeight: '800', fontSize: 14 },
  pause: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#292c43', alignItems: 'center', justifyContent: 'center' },
  pauseText: { color: '#f9e9ce', fontSize: 18, fontWeight: '800' },
  bottomBar: { position: 'absolute', bottom: 18, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  hint: { color: '#b4afc4', fontSize: 10, letterSpacing: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,12,28,0.58)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  panel: { width: '100%', maxWidth: 480, padding: 28, backgroundColor: 'rgba(20,25,46,0.96)', borderRadius: 24, borderWidth: 1, borderColor: '#3c3c55' },
  eyebrow: { color: '#f4ce87', fontSize: 10, letterSpacing: 1.6, fontWeight: '700', marginBottom: 14 },
  title: { color: '#fff1da', fontSize: 34, lineHeight: 39, fontWeight: '800', marginBottom: 16 },
  description: { color: '#c1bed1', fontSize: 15, lineHeight: 23, marginBottom: 24 },
  play: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6d18a', borderRadius: 14 },
  pressed: { opacity: 0.8 },
  playText: { color: '#272137', fontSize: 16, fontWeight: '800' },
  instructions: { color: '#9392ac', fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
  mission: { color: '#f4ce87', fontSize: 12, fontWeight: '700', marginBottom: 18 },
  scoreRow: { marginBottom: 22 },
  score: { color: '#f6d18a', fontSize: 32, fontWeight: '800' },
  scoreLabel: { color: '#b2adc3', fontSize: 11, letterSpacing: 1 },
  best: { color: '#9392ac', fontSize: 10, letterSpacing: 1, marginTop: 6 },
});
