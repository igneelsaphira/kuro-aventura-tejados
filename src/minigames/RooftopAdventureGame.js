import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme/tokens';

const KURO_RUN_SHEET = require('../../assets/kuro/kuro-run.png');
const SANTIAGO_SKYLINE = require('../../assets/kuro/santiago-skyline.png');
const ROOFTOP_SEGMENTS = require('../../assets/kuro/rooftop-segments.png');

const BOARD_WIDTH = 310;
const BOARD_HEIGHT = 245;
const GROUND_Y = 174;
const KURO_WIDTH = 74;
const KURO_HEIGHT = 54;
const KURO_X = 48;
const GRAVITY = 0.5;
const JUMP_FORCE = -9.4;
const MAX_JUMPS = 2;
const MAX_FRAMES = 1800;
const OBSTACLES_ENABLED = false;

const SPRITE_FRAME_COUNT = 4;
const SPRITE_FRAME_WIDTH = 74;
const SPRITE_SHEET_WIDTH = SPRITE_FRAME_WIDTH * SPRITE_FRAME_COUNT;
const RUN_FRAME_TICKS = 4;
const SKYLINE_WIDTH = 390;
const SKYLINE_HEIGHT = 76;
const ROOFTOP_FRAME_COUNT = 4;
const ROOFTOP_FRAME_WIDTH = 248;
const ROOFTOP_IMAGE_HEIGHT = 140;
const ROOFTOP_HEIGHT = 152;
const ROOFTOP_STEP = 198;
const ROOFTOP_SHEET_WIDTH = ROOFTOP_FRAME_WIDTH * ROOFTOP_FRAME_COUNT;
const WEB_PIXEL_STYLE = Platform.OS === 'web' ? { imageRendering: 'pixelated' } : null;

const PIXEL_EMPTY = '.';
const PIXEL_COLORS = {
  g: '#ffe08a',
  y: '#f4b75f',
  p: '#edd6ff',
};

const STAR_FRAMES = [
  ['..g..', '.ggg.', 'ggggg', '.ggg.', '..g..'],
  ['.....', '..g..', '.gyg.', '..g..', '.....'],
];

const INITIAL_WORLD = {
  status: 'start',
  frame: 0,
  distance: 0,
  stars: 0,
  kuroY: GROUND_Y - KURO_HEIGHT,
  velocityY: 0,
  jumpsUsed: 0,
  obstacles: [],
  collectibles: [],
};

function makeObstacle(id, frame) {
  const gap = id > 1 && frame % 4 === 0;
  return {
    id: `obstacle-${id}`,
    type: gap ? 'gap' : 'chimney',
    x: BOARD_WIDTH + 86,
    width: gap ? 48 : 22,
    height: gap ? 60 : 32 + (id % 2) * 8,
  };
}

function makeStar(id) {
  return {
    id: `star-${id}`,
    x: BOARD_WIDTH + 44,
    y: 78 + ((id * 31) % 48),
    collected: false,
  };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function hasCollision(kuroY, obstacle) {
  const kuroLeft = KURO_X + 17;
  const kuroRight = KURO_X + KURO_WIDTH - 12;
  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + obstacle.width;

  if (!rangesOverlap(kuroLeft, kuroRight, obstacleLeft, obstacleRight)) return false;

  if (obstacle.type === 'gap') {
    return kuroY + KURO_HEIGHT >= GROUND_Y - 1;
  }

  const chimneyTop = GROUND_Y - obstacle.height;
  return kuroY + KURO_HEIGHT >= chimneyTop + 7;
}

function canCollectStar(kuroY, star) {
  const kuroLeft = KURO_X + 8;
  const kuroRight = KURO_X + KURO_WIDTH - 4;
  const kuroTop = kuroY + 2;
  const kuroBottom = kuroY + KURO_HEIGHT - 2;
  return (
    rangesOverlap(kuroLeft, kuroRight, star.x, star.x + 22) &&
    rangesOverlap(kuroTop, kuroBottom, star.y, star.y + 22)
  );
}

function PixelSprite({ pixels, cell = 4, style }) {
  return (
    <View style={[styles.pixelSprite, { width: pixels[0].length * cell, height: pixels.length * cell }, style]}>
      {pixels.map((row, y) => row.split('').map((token, x) => (
        token === PIXEL_EMPTY ? null : (
          <View
            key={`${x}-${y}`}
            style={[
              styles.pixelBlock,
              {
                left: x * cell,
                top: y * cell,
                width: cell,
                height: cell,
                backgroundColor: PIXEL_COLORS[token] || token,
              },
            ]}
          />
        )
      )))}
    </View>
  );
}

function PixelStar({ star, frame }) {
  if (star.collected) return null;

  return (
    <View style={[styles.collectibleStar, { left: star.x, top: star.y }]}>
      <PixelSprite pixels={STAR_FRAMES[Math.floor(frame / 8) % STAR_FRAMES.length]} cell={4} />
    </View>
  );
}

function Moon() {
  return (
    <View style={styles.moon}>
      <View style={styles.moonCraterOne} />
      <View style={styles.moonCraterTwo} />
    </View>
  );
}

function BackgroundStars({ frame }) {
  const stars = [
    { left: 32, top: 34, size: 3, slow: 0.16 },
    { left: 88, top: 74, size: 2, slow: 0.12 },
    { left: 132, top: 42, size: 3, slow: 0.14 },
    { left: 215, top: 68, size: 2, slow: 0.1 },
    { left: 270, top: 34, size: 3, slow: 0.18 },
  ];

  return stars.map((star, index) => (
    <View
      key={index}
      style={[
        styles.skyStar,
        {
          left: (star.left - frame * star.slow + BOARD_WIDTH) % BOARD_WIDTH,
          top: star.top,
          width: star.size,
          height: star.size,
          opacity: Math.floor(frame / 18 + index) % 2 ? 0.5 : 0.9,
        },
      ]}
    />
  ));
}

function SantiagoSkyline({ frame }) {
  const offset = -(frame * 0.28) % SKYLINE_WIDTH;

  return (
    <View style={styles.skylineLayer} pointerEvents="none">
      {Array.from({ length: 3 }).map((_, index) => (
        <Image
          key={index}
          source={SANTIAGO_SKYLINE}
          resizeMode="stretch"
          style={[
            styles.skylineImage,
            WEB_PIXEL_STYLE,
            { left: offset + index * SKYLINE_WIDTH },
          ]}
        />
      ))}
    </View>
  );
}

function RooftopSegment({ left, variant }) {
  return (
    <View style={[styles.rooftopSegment, { left }]} pointerEvents="none">
      <View style={styles.rooftopFacadeFill} />
      <Image
        source={ROOFTOP_SEGMENTS}
        resizeMode="stretch"
        style={[
          styles.rooftopSheet,
          WEB_PIXEL_STYLE,
          { left: -variant * ROOFTOP_FRAME_WIDTH },
        ]}
      />
    </View>
  );
}

function RooftopLayer({ frame }) {
  const scroll = frame * 1.1;
  const firstTile = Math.floor(scroll / ROOFTOP_STEP);
  const offset = -(scroll % ROOFTOP_STEP);

  return (
    <View style={styles.rooftopLayer} pointerEvents="none">
      <View style={styles.rooftopBaseFill} />
      {Array.from({ length: 4 }).map((_, index) => {
        const tileIndex = firstTile + index;
        const left = offset + index * ROOFTOP_STEP - 34;
        return <RooftopSegment key={tileIndex} left={left} variant={tileIndex % ROOFTOP_FRAME_COUNT} />;
      })}
    </View>
  );
}

function KuroRunner({ y, status, frame }) {
  const isAirborne = y < GROUND_Y - KURO_HEIGHT - 1;
  const frameIndex = status === 'ended' ? 0 : Math.floor(frame / RUN_FRAME_TICKS) % SPRITE_FRAME_COUNT;

  return (
    <View
      style={[
        styles.kuroFrame,
        {
          top: y,
          opacity: status === 'ended' ? 0.68 : 1,
          transform: [{ rotate: isAirborne && status !== 'ended' ? '-5deg' : '0deg' }],
        },
      ]}
    >
      <Image
        source={KURO_RUN_SHEET}
        resizeMode="stretch"
        style={[
          styles.kuroSheet,
          WEB_PIXEL_STYLE,
          {
            left: -frameIndex * SPRITE_FRAME_WIDTH,
          },
        ]}
      />
    </View>
  );
}

function Chimney({ obstacle }) {
  return (
    <View style={[styles.chimney, { left: obstacle.x, height: obstacle.height, top: GROUND_Y - obstacle.height }]}>
      <View style={styles.chimneyCap} />
      <View style={styles.chimneyWarmWindow} />
      <View style={styles.smokeOne} />
      <View style={styles.smokeTwo} />
    </View>
  );
}

function Gap({ obstacle }) {
  return (
    <View style={[styles.gap, { left: obstacle.x, width: obstacle.width }]}>
      <View style={styles.gapWallLeft} />
      <View style={styles.gapWallRight} />
    </View>
  );
}

function Obstacle({ obstacle }) {
  return obstacle.type === 'gap' ? <Gap obstacle={obstacle} /> : <Chimney obstacle={obstacle} />;
}

export default function RooftopAdventureGame({ onComplete }) {
  const [world, setWorld] = useState(INITIAL_WORLD);
  const worldRef = useRef(world);
  const nextObstacleId = useRef(1);
  const nextStarId = useRef(1);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  const finalScore = useMemo(() => (
    Math.round(world.distance + world.stars * 18)
  ), [world.distance, world.stars]);

  const startGame = () => {
    nextObstacleId.current = 1;
    nextStarId.current = 1;
    setWorld({
      ...INITIAL_WORLD,
      status: 'playing',
      collectibles: [makeStar(nextStarId.current++)],
    });
  };

  const jump = () => {
    const current = worldRef.current;
    if (current.status !== 'playing') return;
    if (current.jumpsUsed >= MAX_JUMPS) return;

    setWorld((prev) => {
      if (prev.status !== 'playing' || prev.jumpsUsed >= MAX_JUMPS) return prev;
      return {
        ...prev,
        velocityY: JUMP_FORCE,
        jumpsUsed: prev.jumpsUsed + 1,
      };
    });
  };

  useEffect(() => {
    if (world.status !== 'playing') return undefined;

    const interval = setInterval(() => {
      setWorld((prev) => {
        if (prev.status !== 'playing') return prev;

        const nextFrame = prev.frame + 1;
        const difficulty = Math.min(1.55, 1 + nextFrame / 2600);
        const speed = 2 + difficulty * 0.34;
        const nextVelocity = Math.min(prev.velocityY + GRAVITY, 12);
        const nextY = Math.min(GROUND_Y - KURO_HEIGHT, prev.kuroY + nextVelocity);
        const landed = nextY >= GROUND_Y - KURO_HEIGHT - 1;

        let obstacles = prev.obstacles
          .map((obstacle) => ({ ...obstacle, x: obstacle.x - speed }))
          .filter((obstacle) => obstacle.x > -78);

        let collectibles = prev.collectibles
          .map((star) => ({ ...star, x: star.x - speed * 0.95 }))
          .filter((star) => star.x > -38);

        const spawnEvery = Math.max(92, Math.round(136 - difficulty * 18));
        if (OBSTACLES_ENABLED && nextFrame > 100 && nextFrame % spawnEvery === 0) {
          obstacles = [...obstacles, makeObstacle(nextObstacleId.current++, nextFrame)];
        }

        if (nextFrame % 112 === 28) {
          collectibles = [...collectibles, makeStar(nextStarId.current++)];
        }

        let stars = prev.stars;
        collectibles = collectibles.map((star) => {
          if (!star.collected && canCollectStar(nextY, star)) {
            stars += 1;
            return { ...star, collected: true };
          }
          return star;
        });

        const crashed = OBSTACLES_ENABLED && obstacles.some((obstacle) => hasCollision(nextY, obstacle));
        const finished = crashed || nextFrame >= MAX_FRAMES;

        return {
          ...prev,
          status: finished ? 'ended' : 'playing',
          frame: nextFrame,
          distance: prev.distance + speed * 0.08,
          stars,
          kuroY: nextY,
          velocityY: landed ? 0 : nextVelocity,
          jumpsUsed: landed ? 0 : prev.jumpsUsed,
          obstacles,
          collectibles,
        };
      });
    }, 33);

    return () => clearInterval(interval);
  }, [world.status]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handlePressIn = () => {
    if (world.status === 'playing') jump();
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.94}
        style={styles.board}
        onPressIn={handlePressIn}
      >
        <View style={styles.skyBandTop} />
        <View style={styles.skyBandMid} />
        <View style={styles.skyBandLow} />
        <Moon />
        <BackgroundStars frame={world.frame} />
        <SantiagoSkyline frame={world.frame} />
        <RooftopLayer frame={world.frame} />

        <View style={styles.hud}>
          <View style={styles.hudPill}>
            <Ionicons name="footsteps-outline" size={13} color="#c9d8ff" />
            <Text style={styles.hudText}>{Math.floor(world.distance)} m</Text>
          </View>
          <View style={styles.hudPill}>
            <Ionicons name="star" size={13} color="#ffd76f" />
            <Text style={styles.hudText}>{world.stars}</Text>
          </View>
        </View>

        {OBSTACLES_ENABLED && world.obstacles.map((obstacle) => (
          <Obstacle key={obstacle.id} obstacle={obstacle} />
        ))}
        {world.collectibles.map((star) => (
          <PixelStar key={star.id} star={star} frame={world.frame} />
        ))}
        <KuroRunner y={world.kuroY} status={world.status} frame={world.frame} />

        {world.status === 'start' ? (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>Noche de tejados</Text>
            <Text style={styles.panelTitle}>Kuro: Aventura de Tejados</Text>
            <Text style={styles.panelText}>Toca, haz clic o usa espacio para saltar hasta dos veces y juntar estrellitas.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={startGame} activeOpacity={0.88}>
              <Ionicons name="play" size={15} color="#20172f" />
              <Text style={styles.primaryButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {world.status === 'ended' ? (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>Aventura completada</Text>
            <Text style={styles.panelTitle}>{finalScore} puntos</Text>
            <Text style={styles.panelText}>Kuro corrio {Math.floor(world.distance)} m y junto {world.stars} estrellitas doradas.</Text>
            <View style={styles.endButtonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={startGame} activeOpacity={0.88}>
                <Text style={styles.secondaryButtonText}>Jugar otra vez</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonSmall} onPress={onComplete} activeOpacity={0.88}>
                <Text style={styles.primaryButtonText}>Inicio</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
      <Text style={styles.footerText}>
        {world.status === 'playing' ? 'Kuro puede saltar dos veces en el aire.' : 'Salta por los tejados y junta estrellitas.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
  },
  board: {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    alignSelf: 'center',
    borderRadius: RADII.lg,
    overflow: 'hidden',
    backgroundColor: '#101631',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  skyBandTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 62,
    backgroundColor: '#111936',
  },
  skyBandMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 62,
    height: 70,
    backgroundColor: '#1f2250',
  },
  skyBandLow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 113,
    backgroundColor: '#3a2454',
  },
  moon: {
    position: 'absolute',
    right: 72,
    top: 36,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffe8a3',
    borderWidth: 2,
    borderColor: '#f0c96e',
  },
  moonCraterOne: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e7c978',
  },
  moonCraterTwo: {
    position: 'absolute',
    right: 5,
    bottom: 6,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#e7c978',
  },
  pixelSprite: {
    position: 'relative',
  },
  pixelBlock: {
    position: 'absolute',
  },
  skyStar: {
    position: 'absolute',
    backgroundColor: '#ffd76f',
  },
  skylineLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    height: SKYLINE_HEIGHT,
    overflow: 'hidden',
    zIndex: 2,
  },
  skylineImage: {
    position: 'absolute',
    bottom: 0,
    width: SKYLINE_WIDTH,
    height: SKYLINE_HEIGHT,
    opacity: 0.95,
  },
  rooftopLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ROOFTOP_HEIGHT,
    overflow: 'hidden',
    zIndex: 4,
  },
  rooftopSegment: {
    position: 'absolute',
    bottom: 0,
    width: ROOFTOP_FRAME_WIDTH,
    height: ROOFTOP_HEIGHT,
    overflow: 'hidden',
  },
  rooftopSheet: {
    position: 'absolute',
    top: 0,
    width: ROOFTOP_SHEET_WIDTH,
    height: ROOFTOP_IMAGE_HEIGHT,
  },
  rooftopBaseFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 96,
    bottom: 0,
    backgroundColor: '#171a34',
  },
  rooftopFacadeFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 84,
    bottom: 0,
    backgroundColor: '#161932',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#2f2b54',
  },
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 8,
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(11, 14, 32, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hudText: {
    color: '#f4ecff',
    fontSize: 12,
    fontWeight: '800',
  },
  kuroFrame: {
    position: 'absolute',
    left: KURO_X,
    width: SPRITE_FRAME_WIDTH,
    height: KURO_HEIGHT,
    zIndex: 7,
    overflow: 'hidden',
  },
  kuroSheet: {
    position: 'absolute',
    top: 0,
    width: SPRITE_SHEET_WIDTH,
    height: KURO_HEIGHT,
  },
  chimney: {
    position: 'absolute',
    width: 22,
    backgroundColor: '#432843',
    borderBottomWidth: 3,
    borderBottomColor: '#211729',
    zIndex: 6,
  },
  chimneyCap: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: -7,
    height: 7,
    borderRadius: 3,
    backgroundColor: '#6f4563',
  },
  chimneyWarmWindow: {
    position: 'absolute',
    right: 5,
    bottom: 7,
    width: 5,
    height: 5,
    backgroundColor: '#f0a15e',
  },
  smokeOne: {
    position: 'absolute',
    top: -20,
    left: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(223, 206, 236, 0.28)',
  },
  smokeTwo: {
    position: 'absolute',
    top: -34,
    left: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(223, 206, 236, 0.18)',
  },
  gap: {
    position: 'absolute',
    top: GROUND_Y - 4,
    height: 76,
    backgroundColor: '#060711',
    zIndex: 6,
  },
  gapWallLeft: {
    position: 'absolute',
    left: -7,
    top: 4,
    width: 7,
    height: 40,
    backgroundColor: '#241833',
    transform: [{ rotate: '-6deg' }],
  },
  gapWallRight: {
    position: 'absolute',
    right: -7,
    top: 3,
    width: 7,
    height: 42,
    backgroundColor: '#241833',
    transform: [{ rotate: '6deg' }],
  },
  collectibleStar: {
    position: 'absolute',
    width: 22,
    height: 22,
    zIndex: 6,
  },
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 12, 30, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    zIndex: 12,
  },
  panelKicker: {
    color: '#ffd76f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  panelText: {
    color: '#d9d4ea',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  primaryButton: {
    minWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: RADII.pill,
    backgroundColor: '#ffd76f',
  },
  primaryButtonSmall: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
    backgroundColor: '#ffd76f',
  },
  primaryButtonText: {
    color: '#20172f',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    minWidth: 138,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  endButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    flexWrap: 'wrap',
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
});
