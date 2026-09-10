import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, AppState } from 'react-native';
import { BEETLE, CAT, STEP, configFor, createWorld, jump, resizeWorld, tick } from '../game/engine.mjs';

const CAT_RUN_SHEET = require('../../assets/kuro/kuro-run.png');
const CAT_JUMP_SHEET = require('../../assets/kuro/kuro-jump.png');
const SKYLINE = require('../../assets/kuro/santiago-skyline.png');
const URBAN_DETAIL = require('../../assets/kuro/santiago-urban-depth-cutout.png');
const ROOFS = require('../../assets/kuro/rooftop-segments.png');
const BEETLE_SHEET = require('../../bichito.png');
const BEETLE_DEFEATED_SHEET = require('../../assets/kuro/bichito-defeated.png');
const PIXELS = Platform.OS === 'web' ? { imageRendering: 'pixelated' } : {};
const BEETLE_FRAME = 64;
// The sprite includes a few transparent pixels below Kuro's paws. Lower only
// the artwork so the physics stay unchanged while the paws meet the roof lip.
const CAT_VISUAL_Y_OFFSET = 6;
const MOON_PHASES = require('../../assets/kuro/moon-phases.png');
// Source rectangle of the central full moon in the supplied 1200 x 679 sheet.
const MOON_CROP = { x: 523, y: 291, width: 145, height: 145 };
const MOON_SCALE = 31 / MOON_CROP.width;
const SKY_STARS = Array.from({ length: 36 }, (_, i) => ({ x: (i * 137.3) % 1000, y: 25 + (i * 47 % 180), size: i % 4 === 0 ? 2 : 1 }));
const JUMP_TAKEOFF_VY = -310;
const JUMP_APEX_VY = 70;
const HORIZON_STEPS = Array.from({ length: 32 }, (_, i) => {
  const mix = (i + 1) / 32;
  return `rgb(${Math.round(17 + 24 * mix)},${Math.round(24 + 11 * mix)},${Math.round(49 + 16 * mix)})`;
});
const FACADE_LINES = [0.18, 0.36, 0.57, 0.78];
const FACADE_EDGE_FADE = [0.16, 0.3, 0.46, 0.64, 0.82];
const FACADE_WINDOWS = [
  { x: 0.16, y: 0.24, lit: false },
  { x: 0.42, y: 0.19, lit: false },
  { x: 0.69, y: 0.27, lit: true },
  { x: 0.26, y: 0.48, lit: false },
  { x: 0.55, y: 0.54, lit: false },
  { x: 0.79, y: 0.46, lit: false },
];

function catSpriteFor(world) {
  if (world.grounded) {
    return { sheet: CAT_RUN_SHEET, frame: Math.floor(world.time * 10) % 4 };
  }
  if (world.vy <= JUMP_TAKEOFF_VY) return { sheet: CAT_JUMP_SHEET, frame: 0 };
  if (world.vy < -JUMP_APEX_VY) return { sheet: CAT_JUMP_SHEET, frame: 1 };
  if (world.vy <= JUMP_APEX_VY) return { sheet: CAT_JUMP_SHEET, frame: 2 };
  return { sheet: CAT_JUMP_SHEET, frame: 3 };
}

function Building({ roof, height }) {
  // The source artwork has unevenly spaced buildings. Crop the flat tile roof
  // by its actual pixel rectangle instead of dividing the sheet into quarters.
  const sx = roof.width / 362;
  const sy = 154 / 255;
  const buildingHeight = height - roof.y + 50;
  const facadeTop = 154;
  const facadeHeight = Math.max(0, buildingHeight - facadeTop);
  const facadeInset = Math.min(14, Math.max(8, roof.width * 0.035));
  return (
    <View testID={`roof-${roof.id}`} style={[styles.building, { left: roof.x, top: roof.y, width: roof.width, height: buildingHeight }]}>
      <View style={[styles.facade, { left: facadeInset, right: facadeInset, top: facadeTop }]} />
      {FACADE_EDGE_FADE.map((opacity, index) => {
        const stripWidth = facadeInset / FACADE_EDGE_FADE.length;
        return (
          <React.Fragment key={`facade-edge-${index}`}>
            <View style={[styles.facadeEdgeFade, {
              left: index * stripWidth,
              top: facadeTop,
              width: stripWidth + 1,
              opacity,
            }]} />
            <View style={[styles.facadeEdgeFade, {
              right: index * stripWidth,
              top: facadeTop,
              width: stripWidth + 1,
              opacity,
            }]} />
          </React.Fragment>
        );
      })}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {FACADE_LINES.map((line, index) => (
          <View key={`facade-line-${index}`} style={[styles.facadeLine, { left: facadeInset + (roof.width - facadeInset * 2) * line }]} />
        ))}
        {FACADE_WINDOWS.map((window, index) => (
          <View key={`facade-window-${index}`} style={[
            styles.facadeWindow,
            window.lit && styles.facadeWindowLit,
            {
              left: Math.min(roof.width - facadeInset - 28, facadeInset + (roof.width - facadeInset * 2) * window.x),
              top: facadeTop + facadeHeight * window.y,
            },
          ]} />
        ))}
      </View>
      <View style={{ height: 154, overflow: 'hidden' }}>
        <Image source={ROOFS} resizeMode="stretch" style={[PIXELS, { position: 'absolute', width: 2172 * sx, height: 546 * sy, left: -1755 * sx, top: -283 * sy }]} />
      </View>
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
  const catSprite = catSpriteFor(world);
  const skylineOffset = -(world.scroll * 0.18 % 600);
  // Keep the artwork proportional while covering the entire space below the roofs.
  const urbanDepthTop = config.ground - 140;
  const urbanDepthHeight = Math.max(280, config.height - urbanDepthTop + 8);
  const urbanDepthWidth = urbanDepthHeight * 3;
  const urbanDepthTravel = world.scroll * 0.38;
  const urbanDepthTile = Math.floor(urbanDepthTravel / urbanDepthWidth);
  const urbanDepthOffset = -(urbanDepthTravel % urbanDepthWidth);
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
        <View style={[styles.horizon, { top: config.ground - 90 }]} />
        {HORIZON_STEPS.map((backgroundColor, i) => <View key={`horizon-${i}`} style={{
          position: 'absolute', left: 0, right: 0, top: config.ground - 250 + i * 5,
          height: 6, backgroundColor,
        }} />)}
        {SKY_STARS.map((star, i) => <View key={i} style={[styles.skyStar, {
          left: ((star.x - world.scroll * 0.03) % config.width + config.width) % config.width,
          top: star.y * config.ground / 300, width: star.size, height: star.size, opacity: i % 3 === 0 ? 0.45 : 0.8,
        }]} />)}
        <View style={[styles.moonGlow, { left: config.width * 0.73, top: config.ground * 0.25 }]}>
          {Array.from({ length: 16 }, (_, i) => {
            const diameter = 75 - i * 2.5;
            return <View key={`moon-halo-${i}`} style={{
              position: 'absolute', width: diameter, height: diameter,
              left: (75 - diameter) / 2, top: (75 - diameter) / 2,
              borderRadius: diameter / 2, backgroundColor: 'rgba(155,190,255,0.005)',
            }} />;
          })}
          <View style={styles.moon}>
            <Image source={MOON_PHASES} resizeMode="stretch" style={[PIXELS, {
              position: 'absolute', width: 1200 * MOON_SCALE, height: 679 * MOON_SCALE,
              left: -MOON_CROP.x * MOON_SCALE, top: -MOON_CROP.y * MOON_SCALE,
            }]} />
          </View>
        </View>
        {Array.from({ length: Math.ceil(config.width / 600) + 1 }, (_, i) => <Image key={i} source={SKYLINE} resizeMode="stretch" style={[styles.skyline, PIXELS, { left: skylineOffset + i * 600, top: config.ground - 145 }]} />)}
        {/* Opaque city silhouettes conceal the skyline's flat base.
            Reflected tiles keep adjoining edges continuous during scrolling. */}
        {Array.from({ length: Math.ceil(config.width / urbanDepthWidth) + 1 }, (_, i) => (
          <View key={i} style={[styles.urbanDepth, {
            left: urbanDepthOffset + i * urbanDepthWidth, top: urbanDepthTop,
            width: urbanDepthWidth, height: urbanDepthHeight,
            transform: [{ scaleX: (urbanDepthTile + i) % 2 === 0 ? 1 : -1 }],
          }]}>
            <Image source={URBAN_DETAIL} resizeMode="stretch" style={[StyleSheet.absoluteFillObject, PIXELS, { width: urbanDepthWidth, height: urbanDepthHeight }]} />
          </View>
        ))}
        {world.roofs.map((roof) => <Building key={roof.id} roof={roof} height={config.height} />)}
        {world.collectibles.map((star) => <Text key={star.id} style={[styles.star, { left: star.x, top: star.y }]}>✦</Text>)}
        {world.obstacles.map((obstacle) => {
          const defeated = obstacle.state === 'defeated';
          const frame = defeated
            ? Math.min(3, Math.floor((world.time - obstacle.defeatedAt) * 9))
            : Math.floor(world.time * 5) % 4;
          return <View key={obstacle.id} testID={obstacle.id} style={[styles.beetleFrame, {
            left: obstacle.x - 6,
            top: obstacle.y - 10,
            transform: [{ rotate: defeated && frame >= 2 ? `${(frame - 1) * 9}deg` : '0deg' }],
          }]}><Image source={defeated ? BEETLE_DEFEATED_SHEET : BEETLE_SHEET} resizeMode="stretch" style={[PIXELS, styles.beetleSheet, { left: -frame * BEETLE_FRAME }]} /></View>;
        })}
        <View testID="kuro" style={[styles.catFrame, { left: CAT.x, top: world.y + CAT_VISUAL_Y_OFFSET,
          transform: [{ rotate: world.grounded ? '0deg' : world.vy > 0 ? '12deg' : '-8deg' }],
        }]}>
          <Image source={catSprite.sheet} resizeMode="stretch" style={[PIXELS, styles.catSheet, { left: -catSprite.frame * CAT.width }]} />
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
          <Text accessibilityRole="header" style={[styles.title, compact && { fontSize: 27, lineHeight: 31, marginBottom: 10 }]}>{world.status === 'start' ? 'La ciudad duerme.\nKuro no.' : world.status === 'paused' ? 'Tomemos una pausa.' : world.reason === 'obstacle' ? '¡Cuidado con el bichito!' : '¡Cuidado con el vacío!'}</Text>
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
  moonGlow: { position: 'absolute', width: 75, height: 75, alignItems: 'center', justifyContent: 'center' },
  moon: { width: 31, height: 31, borderRadius: 15.5, overflow: 'hidden' },
  skyline: { position: 'absolute', width: 600, height: 150, opacity: 1 },
  urbanDepth: { position: 'absolute', opacity: 1 },
  building: { position: 'absolute', overflow: 'hidden' },
  facade: { position: 'absolute', bottom: 0, backgroundColor: '#1d2038', borderLeftWidth: 2, borderRightWidth: 2, borderColor: 'rgba(56,48,71,0.58)' },
  facadeEdgeFade: { position: 'absolute', bottom: 0, backgroundColor: '#1d2038' },
  facadeLine: { position: 'absolute', top: 152, bottom: 0, width: 2, backgroundColor: 'rgba(10,12,27,0.22)' },
  facadeWindow: { position: 'absolute', width: 22, height: 16, backgroundColor: '#101329', borderWidth: 2, borderColor: 'rgba(55,48,73,0.8)' },
  facadeWindowLit: { backgroundColor: '#e6b65d', borderColor: '#7d5e48', opacity: 0.82 },
  catFrame: { position: 'absolute', width: CAT.width, height: CAT.height, overflow: 'hidden' },
  beetleFrame: { position: 'absolute', width: BEETLE_FRAME, height: BEETLE_FRAME, overflow: 'hidden', zIndex: 6 },
  beetleSheet: { position: 'absolute', width: BEETLE_FRAME * 4, height: BEETLE_FRAME },
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
