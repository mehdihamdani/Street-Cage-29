import * as THREE from 'three';
import {
  createBannerTexture,
  createBuildingFacadeTexture,
  createTurfTexture,
} from './textures';

export const PITCH_WIDTH = 16;
export const PITCH_LENGTH = 26;
export const HALF_W = PITCH_WIDTH / 2;
export const HALF_L = PITCH_LENGTH / 2;
export const GOAL_WIDTH = 5.0;
export const GOAL_HALF_W = GOAL_WIDTH / 2;
export const GOAL_HEIGHT = 2.35;
export const GOAL_DEPTH = 1.45;
export const POST_RADIUS = 0.065;

interface SpectatorSlot {
  x: number;
  y: number;
  z: number;
  rotY: number;
  phase: number;
  speed: number;
  scale: number;
}

export interface StreetArena {
  group: THREE.Group;
  updateCrowd: (time: number, excitement: number) => void;
  triggerNetRipple: (goalSide: 'north' | 'south', intensity: number) => void;
  updateNets: (dt: number) => void;
  dispose: () => void;
}

export function buildStreetArena(
  scene: THREE.Scene,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): StreetArena {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Outer urban asphalt courtyard (extends into fog)
  const asphaltGeo = new THREE.PlaneGeometry(160, 160);
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x141923,
    roughness: 0.92,
    metalness: 0.05,
  });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = -0.02;
  asphalt.receiveShadow = true;
  group.add(asphalt);
  disposables.push(asphaltGeo, asphaltMat);

  // Concrete apron around the cage
  const apronGeo = new THREE.BoxGeometry(PITCH_WIDTH + 4.4, 0.04, PITCH_LENGTH + 5.2);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x1e2532,
    roughness: 0.85,
    metalness: 0.08,
  });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.position.y = -0.015;
  apron.receiveShadow = true;
  group.add(apron);
  disposables.push(apronGeo, apronMat);

  // 2. Artificial Turf Pitch
  const turfTex = createTurfTexture(maxAnisotropy);
  const turfGeo = new THREE.PlaneGeometry(PITCH_WIDTH + 1.4, PITCH_LENGTH + 1.4);
  const turfMat = new THREE.MeshStandardMaterial({
    map: turfTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const turf = new THREE.Mesh(turfGeo, turfMat);
  turf.rotation.x = -Math.PI / 2;
  turf.position.y = 0.008;
  turf.receiveShadow = true;
  group.add(turf);
  disposables.push(turfTex, turfGeo, turfMat);

  // 3. Perimeter Rebound Boards & Street Banners + Cage Mesh
  const boardH = 0.85;
  const wallThick = 0.14;
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0x131924,
    roughness: 0.55,
    metalness: 0.35,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x3b475c,
    roughness: 0.35,
    metalness: 0.85,
  });
  const cageMeshMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.5,
    metalness: 0.7,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  disposables.push(boardMat, railMat, cageMeshMat);

  // Side boards (West & East)
  const sideLen = PITCH_LENGTH + 1.4;
  const sideBoardGeo = new THREE.BoxGeometry(wallThick, boardH, sideLen);
  const sideFenceGeo = new THREE.PlaneGeometry(sideLen, 2.1, 28, 4);
  disposables.push(sideBoardGeo, sideFenceGeo);

  const bannerTextures = [
    createBannerTexture('STREET CAGE 29', 'URBAN NIGHT TURF', '#0f172a', '#f59e0b', maxAnisotropy),
    createBannerTexture('PANNA KING', 'ANKLE BREAKER ARENA', '#0f172a', '#06b6d4', maxAnisotropy),
    createBannerTexture('NO MERCY 1V1', 'FLOODLIGHT SERIES', '#111827', '#10b981', maxAnisotropy),
  ];
  disposables.push(...bannerTextures);

  [-1, 1].forEach((sideSign, idx) => {
    const xPos = sideSign * (HALF_W + 0.7);
    const board = new THREE.Mesh(sideBoardGeo, boardMat);
    board.position.set(xPos, boardH / 2, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);

    // Top metal rail
    const railGeo = new THREE.BoxGeometry(0.18, 0.08, sideLen);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(xPos, boardH + 0.04, 0);
    group.add(rail);
    disposables.push(railGeo);

    // Upper chain-link fence
    const fence = new THREE.Mesh(sideFenceGeo, cageMeshMat);
    fence.position.set(xPos, boardH + 1.05, 0);
    fence.rotation.y = sideSign > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(fence);

    // Inner sponsor banners along sidelines
    for (let b = 0; b < 3; b++) {
      const bTex = bannerTextures[(b + idx) % bannerTextures.length];
      const bMat = new THREE.MeshStandardMaterial({
        map: bTex,
        roughness: 0.45,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const bGeo = new THREE.PlaneGeometry(6.8, 0.72);
      const banner = new THREE.Mesh(bGeo, bMat);
      banner.position.set(
        xPos - sideSign * (wallThick / 2 + 0.015),
        boardH * 0.5,
        -7.8 + b * 7.8,
      );
      banner.rotation.y = sideSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(banner);
      disposables.push(bMat, bGeo);
    }
  });

  // End boards flanking both goals
  const endSegmentW = (PITCH_WIDTH + 1.4 - GOAL_WIDTH) / 2;
  const endBoardGeo = new THREE.BoxGeometry(endSegmentW, boardH, wallThick);
  const endFenceGeo = new THREE.PlaneGeometry(endSegmentW, 2.1, 8, 4);
  disposables.push(endBoardGeo, endFenceGeo);

  [-1, 1].forEach((zSign) => {
    const zPos = zSign * (HALF_L + 0.7);
    [-1, 1].forEach((xSign) => {
      const xCenter = xSign * (GOAL_HALF_W + endSegmentW / 2);
      const eBoard = new THREE.Mesh(endBoardGeo, boardMat);
      eBoard.position.set(xCenter, boardH / 2, zPos);
      eBoard.castShadow = true;
      eBoard.receiveShadow = true;
      group.add(eBoard);

      const eFence = new THREE.Mesh(endFenceGeo, cageMeshMat);
      eFence.position.set(xCenter, boardH + 1.05, zPos);
      if (zSign < 0) eFence.rotation.y = 0;
      else eFence.rotation.y = Math.PI;
      group.add(eFence);
    });
  });

  // 4. Composite 3D Goals (North & South) with metallic frame & rippling nets
  const postMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.25,
    metalness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.85,
    metalness: 0.05,
    wireframe: true,
    transparent: true,
    opacity: 0.48,
  });
  disposables.push(postMat, netMat);

  let northRipple = 0;
  let southRipple = 0;
  let northNetBack: THREE.Mesh | null = null;
  let southNetBack: THREE.Mesh | null = null;

  const createGoal = (zSign: -1 | 1): THREE.Mesh => {
    const goalGroup = new THREE.Group();
    const zLine = zSign * HALF_L;
    const zBack = zLine + zSign * GOAL_DEPTH;

    // Left & Right front posts
    const postGeo = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 14);
    const crossbarGeo = new THREE.CylinderGeometry(
      POST_RADIUS,
      POST_RADIUS,
      GOAL_WIDTH + POST_RADIUS * 2,
      14,
    );
    const groundBarGeo = new THREE.CylinderGeometry(0.04, 0.04, GOAL_WIDTH, 10);
    const sideBarGeo = new THREE.CylinderGeometry(0.04, 0.04, GOAL_DEPTH, 10);
    disposables.push(postGeo, crossbarGeo, groundBarGeo, sideBarGeo);

    [-1, 1].forEach((xSign) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(xSign * GOAL_HALF_W, GOAL_HEIGHT / 2, zLine);
      post.castShadow = true;
      goalGroup.add(post);

      // Rear stanchion & bottom runner
      const backPost = new THREE.Mesh(postGeo, postMat);
      backPost.scale.set(0.7, 0.96, 0.7);
      backPost.position.set(xSign * GOAL_HALF_W, (GOAL_HEIGHT * 0.96) / 2, zBack);
      goalGroup.add(backPost);

      const topSide = new THREE.Mesh(sideBarGeo, postMat);
      topSide.rotation.x = Math.PI / 2;
      topSide.position.set(xSign * GOAL_HALF_W, GOAL_HEIGHT - 0.03, (zLine + zBack) / 2);
      goalGroup.add(topSide);

      const botSide = new THREE.Mesh(sideBarGeo, postMat);
      botSide.rotation.x = Math.PI / 2;
      botSide.position.set(xSign * GOAL_HALF_W, 0.04, (zLine + zBack) / 2);
      goalGroup.add(botSide);
    });

    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, GOAL_HEIGHT, zLine);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);

    const backTop = new THREE.Mesh(groundBarGeo, postMat);
    backTop.rotation.z = Math.PI / 2;
    backTop.position.set(0, GOAL_HEIGHT - 0.06, zBack);
    goalGroup.add(backTop);

    const backBot = new THREE.Mesh(groundBarGeo, postMat);
    backBot.rotation.z = Math.PI / 2;
    backBot.position.set(0, 0.04, zBack);
    goalGroup.add(backBot);

    // Goal netting (back, top, left, right)
    const backNetGeo = new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_HEIGHT - 0.06, 16, 8);
    const backNet = new THREE.Mesh(backNetGeo, netMat);
    backNet.position.set(0, GOAL_HEIGHT / 2, zBack);
    goalGroup.add(backNet);

    const topNetGeo = new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_DEPTH, 16, 6);
    const topNet = new THREE.Mesh(topNetGeo, netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.position.set(0, GOAL_HEIGHT - 0.04, (zLine + zBack) / 2);
    goalGroup.add(topNet);

    const sideNetGeo = new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT, 6, 8);
    [-1, 1].forEach((xSign) => {
      const sNet = new THREE.Mesh(sideNetGeo, netMat);
      sNet.rotation.y = Math.PI / 2;
      sNet.position.set(xSign * GOAL_HALF_W, GOAL_HEIGHT / 2, (zLine + zBack) / 2);
      goalGroup.add(sNet);
    });

    disposables.push(backNetGeo, topNetGeo, sideNetGeo);
    group.add(goalGroup);
    return backNet;
  };

  northNetBack = createGoal(-1);
  southNetBack = createGoal(1);

  // 5. Four Corner Floodlight Towers
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.85,
  });
  const lampHousingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.7,
  });
  const lampLedMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3d1,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const towerPoleGeo = new THREE.CylinderGeometry(0.11, 0.16, 11, 10);
  const lampBoxGeo = new THREE.BoxGeometry(1.5, 0.65, 0.22);
  const lampLedGeo = new THREE.PlaneGeometry(1.36, 0.52);
  disposables.push(poleMat, lampHousingMat, lampLedMat, towerPoleGeo, lampBoxGeo, lampLedGeo);

  const towerPositions: Array<[number, number]> = [
    [-HALF_W - 1.6, -HALF_L - 1.6],
    [HALF_W + 1.6, -HALF_L - 1.6],
    [-HALF_W - 1.6, HALF_L + 1.6],
    [HALF_W + 1.6, HALF_L + 1.6],
  ];

  towerPositions.forEach(([tx, tz]) => {
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(towerPoleGeo, poleMat);
    pole.position.y = 5.5;
    tower.add(pole);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 10.9, 0);
    headGroup.lookAt(-tx, 0, -tz);

    const housing = new THREE.Mesh(lampBoxGeo, lampHousingMat);
    headGroup.add(housing);

    const led = new THREE.Mesh(lampLedGeo, lampLedMat);
    led.position.z = 0.12;
    headGroup.add(led);

    tower.add(headGroup);
    tower.position.set(tx, 0, tz);
    group.add(tower);
  });

  // 6. Night Urban Apartment Buildings Backdrop (as seen in the video!)
  const bldgTex = createBuildingFacadeTexture(maxAnisotropy);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgTex,
    roughness: 0.85,
    metalness: 0.1,
    emissive: 0xffffff,
    emissiveMap: bldgTex,
    emissiveIntensity: 0.45,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.9,
  });
  disposables.push(bldgTex, bldgMat, roofMat);

  const buildings: Array<[number, number, number, number, number]> = [
    [-22, -26, 13, 18, 9],
    [-6, -30, 14, 21, 9],
    [10, -29, 13, 17, 9],
    [24, -23, 11, 20, 10],
    [-24, 0, 11, 16, 15],
    [24, -2, 11, 19, 16],
    [-22, 24, 13, 17, 10],
    [22, 24, 13, 18, 10],
  ];
  buildings.forEach(([bx, bz, bw, bh, bd]) => {
    const bGeo = new THREE.BoxGeometry(bw, bh, bd);
    const bMesh = new THREE.Mesh(bGeo, [bldgMat, bldgMat, roofMat, roofMat, bldgMat, bldgMat]);
    bMesh.position.set(bx, bh / 2 - 0.02, bz);
    group.add(bMesh);
    disposables.push(bGeo);
  });

  // 7. Animated Spectator Crowd Ring around the cage (InstancedMesh!)
  const spectators: SpectatorSlot[] = [];
  // West & East sidelines
  for (let i = 0; i < 18; i++) {
    const z = -11.5 + i * 1.35;
    spectators.push({
      x: -HALF_W - 1.35 - (i % 2) * 0.45,
      y: 0,
      z,
      rotY: Math.PI / 2,
      phase: Math.random() * Math.PI * 2,
      speed: 3.5 + Math.random() * 2,
      scale: 0.92 + Math.random() * 0.16,
    });
    spectators.push({
      x: HALF_W + 1.35 + ((i + 1) % 2) * 0.45,
      y: 0,
      z,
      rotY: -Math.PI / 2,
      phase: Math.random() * Math.PI * 2,
      speed: 3.5 + Math.random() * 2,
      scale: 0.92 + Math.random() * 0.16,
    });
  }
  // Behind North & South end boards
  for (let i = 0; i < 10; i++) {
    const x = -7.2 + i * 1.6;
    if (Math.abs(x) < GOAL_HALF_W + 0.5) continue;
    spectators.push({
      x,
      y: 0,
      z: -HALF_L - 1.5,
      rotY: 0,
      phase: Math.random() * Math.PI * 2,
      speed: 3.8 + Math.random() * 1.8,
      scale: 0.94 + Math.random() * 0.14,
    });
    spectators.push({
      x,
      y: 0,
      z: HALF_L + 1.5,
      rotY: Math.PI,
      phase: Math.random() * Math.PI * 2,
      speed: 3.8 + Math.random() * 1.8,
      scale: 0.94 + Math.random() * 0.14,
    });
  }

  const count = spectators.length;
  const specBodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.15, 8);
  const specHeadGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const specBodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
  });
  const specHeadMat = new THREE.MeshStandardMaterial({
    color: 0xd6a686,
    roughness: 0.7,
  });
  disposables.push(specBodyGeo, specHeadGeo, specBodyMat, specHeadMat);

  const specBodies = new THREE.InstancedMesh(specBodyGeo, specBodyMat, count);
  const specHeads = new THREE.InstancedMesh(specHeadGeo, specHeadMat, count);
  specBodies.frustumCulled = false;
  specHeads.frustumCulled = false;

  const palette = [
    new THREE.Color(0x1e293b),
    new THREE.Color(0x0f172a),
    new THREE.Color(0x334155),
    new THREE.Color(0x0f766e),
    new THREE.Color(0xb45309),
    new THREE.Color(0x374151),
    new THREE.Color(0x1d4ed8),
  ];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    specBodies.setColorAt(i, palette[i % palette.length]);
    const s = spectators[i];
    dummy.position.set(s.x, 0.58 * s.scale, s.z);
    dummy.rotation.set(0, s.rotY, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    specBodies.setMatrixAt(i, dummy.matrix);

    dummy.position.set(s.x, 1.3 * s.scale, s.z);
    dummy.updateMatrix();
    specHeads.setMatrixAt(i, dummy.matrix);
  }
  if (specBodies.instanceColor) specBodies.instanceColor.needsUpdate = true;
  specBodies.instanceMatrix.needsUpdate = true;
  specHeads.instanceMatrix.needsUpdate = true;
  specBodies.computeBoundingSphere();
  specHeads.computeBoundingSphere();
  group.add(specBodies, specHeads);

  // 8. Studio / Stadium Night Lighting Rig (<= 3 shadow casters)
  const hemiLight = new THREE.HemisphereLight(0x6488c9, 0x102819, 0.65);
  group.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
  keyLight.position.set(12, 22, 10);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 52;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  group.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.9);
  rimLight.position.set(-14, 14, -14);
  group.add(rimLight);

  scene.add(group);

  return {
    group,
    updateCrowd(time: number, excitement: number) {
      const amp = 0.035 + excitement * 0.22;
      const spdMult = 1 + excitement * 2.2;
      for (let i = 0; i < count; i++) {
        const s = spectators[i];
        const hop = Math.max(0, Math.sin(time * s.speed * spdMult + s.phase)) * amp;
        dummy.position.set(s.x, 0.58 * s.scale + hop, s.z);
        dummy.rotation.set(0, s.rotY, 0);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        specBodies.setMatrixAt(i, dummy.matrix);

        dummy.position.set(s.x, 1.3 * s.scale + hop * 1.15, s.z);
        dummy.updateMatrix();
        specHeads.setMatrixAt(i, dummy.matrix);
      }
      specBodies.instanceMatrix.needsUpdate = true;
      specHeads.instanceMatrix.needsUpdate = true;
    },
    triggerNetRipple(goalSide: 'north' | 'south', intensity: number) {
      if (goalSide === 'north') northRipple = Math.min(1, northRipple + intensity);
      else southRipple = Math.min(1, southRipple + intensity);
    },
    updateNets(dt: number) {
      if (northNetBack) {
        northRipple = Math.max(0, northRipple - dt * 1.8);
        const swell = Math.sin(northRipple * Math.PI * 5) * northRipple * 0.25;
        northNetBack.position.z = -HALF_L - GOAL_DEPTH - Math.abs(swell);
      }
      if (southNetBack) {
        southRipple = Math.max(0, southRipple - dt * 1.8);
        const swell = Math.sin(southRipple * Math.PI * 5) * southRipple * 0.25;
        southNetBack.position.z = HALF_L + GOAL_DEPTH + Math.abs(swell);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
