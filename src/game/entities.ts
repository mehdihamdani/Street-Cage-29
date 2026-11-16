import * as THREE from 'three';
import {
  createBallTexture,
  createJerseyTexture,
  createRadialShadowTexture,
} from './textures';
import type { SkillMoveType } from './types';

export interface PlayerAppearance {
  jerseyPrimary: string;
  jerseyStripe: string;
  shortsColor: number;
  sockColor: number;
  bootColor: number | string;
  skinColor: number;
  hairColor: number;
  numberText: string;
  striped?: boolean;
  hasHeadband?: boolean;
  ringColor?: number;
}

export interface PlayerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Mesh;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  indicatorRing: THREE.Mesh;
  gamebreakerAura: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  dizzyHalo: THREE.Mesh;
  updateAppearance: (
    jerseyPrimary: string,
    jerseyStripe: string,
    bootColor: string,
    striped: boolean,
  ) => void;
  dispose: () => void;
}

export interface PlayerPoseInput {
  speed: number;
  stridePhase: number;
  skillMove: SkillMoveType | null;
  skillTimer: number;
  skillDuration: number;
  fallenTimer: number;
  slideTimer: number;
  tackleWindup: number;
  diveDir: number; // -1 left, 0 none, +1 right
  diveTimer: number;
  hasBall: boolean;
  gamebreakerActive: boolean;
  isControlled: boolean;
  time: number;
}

export function createPlayerRig(
  appearance: PlayerAppearance,
  shadowTexture: THREE.Texture,
  maxAnisotropy: number,
): PlayerRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();

  // Contact shadow disc grounded at y=0.015
  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);
  disposables.push(shadowGeo, shadowMat);

  // Active player selection / telegraph ring
  const ringGeo = new THREE.RingGeometry(0.46, 0.58, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: appearance.ringColor ?? 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const indicatorRing = new THREE.Mesh(ringGeo, ringMat);
  indicatorRing.rotation.x = -Math.PI / 2;
  indicatorRing.position.y = 0.022;
  indicatorRing.visible = false;
  root.add(indicatorRing);
  disposables.push(ringGeo, ringMat);

  // Golden Gamebreaker aura ring
  const auraGeo = new THREE.RingGeometry(0.58, 0.74, 32);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const gamebreakerAura = new THREE.Mesh(auraGeo, auraMat);
  gamebreakerAura.rotation.x = -Math.PI / 2;
  gamebreakerAura.position.y = 0.028;
  gamebreakerAura.visible = false;
  root.add(gamebreakerAura);
  disposables.push(auraGeo, auraMat);

  // Dizzy halo when ankle-broken
  const dizzyGeo = new THREE.TorusGeometry(0.26, 0.025, 8, 24);
  const dizzyMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
  });
  const dizzyHalo = new THREE.Mesh(dizzyGeo, dizzyMat);
  dizzyHalo.rotation.x = Math.PI / 2;
  dizzyHalo.position.y = 0.7;
  dizzyHalo.visible = false;
  root.add(dizzyHalo);
  disposables.push(dizzyGeo, dizzyMat);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.86; // hip height above ground
  root.add(bodyPivot);

  let jerseyTex = createJerseyTexture(
    appearance.jerseyPrimary,
    appearance.jerseyStripe,
    appearance.numberText,
    maxAnisotropy,
    appearance.striped ?? false,
  );
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.72,
    metalness: 0.05,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: appearance.shortsColor,
    roughness: 0.78,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinColor,
    roughness: 0.62,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: appearance.hairColor,
    roughness: 0.85,
    metalness: 0.02,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: appearance.sockColor,
    roughness: 0.8,
    metalness: 0.03,
  });
  const bootMat = new THREE.MeshPhysicalMaterial({
    color: appearance.bootColor,
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 0.6,
  });
  disposables.push(jerseyTex, jerseyMat, shortsMat, skinMat, hairMat, sockMat, bootMat);

  // Pelvis / Shorts
  const pelvisGeo = new THREE.BoxGeometry(0.38, 0.2, 0.24);
  const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
  pelvis.position.y = 0.02;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  // Torso / Jersey
  const torsoGeo = new THREE.BoxGeometry(0.44, 0.52, 0.26);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.y = 0.36;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Head + Hair + Optional Street Headband
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.76;
  const headGeo = new THREE.SphereGeometry(0.15, 14, 12);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const hairGeo = new THREE.SphereGeometry(0.158, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.y = 0.02;
  hairMesh.rotation.x = -0.18;
  headGroup.add(hairMesh);

  if (appearance.hasHeadband) {
    const bandGeo = new THREE.TorusGeometry(0.153, 0.02, 8, 20);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2 - 0.15;
    band.position.y = 0.04;
    headGroup.add(band);
    disposables.push(bandGeo, bandMat);
  }
  bodyPivot.add(headGroup);

  // Arms (Left & Right)
  const sleeveGeo = new THREE.CylinderGeometry(0.068, 0.058, 0.22, 8);
  const forearmGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.28, 8);
  const makeArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 0.56, 0);
    const sleeve = new THREE.Mesh(sleeveGeo, jerseyMat);
    sleeve.position.y = -0.1;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.32;
    forearm.castShadow = true;
    pivot.add(forearm);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Legs (Left & Right)
  const thighGeo = new THREE.CylinderGeometry(0.085, 0.072, 0.36, 10);
  const shinGeo = new THREE.CylinderGeometry(0.062, 0.05, 0.38, 10);
  const bootGeo = new THREE.BoxGeometry(0.13, 0.1, 0.24);
  const makeLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, -0.04, 0);

    const thigh = new THREE.Mesh(thighGeo, shortsMat);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    pivot.add(thigh);

    const shin = new THREE.Mesh(shinGeo, sockMat);
    shin.position.y = -0.54;
    shin.castShadow = true;
    pivot.add(shin);

    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, -0.77, 0.045);
    boot.castShadow = true;
    pivot.add(boot);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  disposables.push(
    pelvisGeo,
    torsoGeo,
    headGeo,
    hairGeo,
    sleeveGeo,
    forearmGeo,
    thighGeo,
    shinGeo,
    bootGeo,
  );

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    indicatorRing,
    gamebreakerAura,
    shadowDisc,
    dizzyHalo,
    updateAppearance(
      jerseyPrimary: string,
      jerseyStripe: string,
      bootColor: string,
      striped: boolean,
    ) {
      const nextTex = createJerseyTexture(
        jerseyPrimary,
        jerseyStripe,
        appearance.numberText,
        maxAnisotropy,
        striped,
      );
      jerseyMat.map = nextTex;
      jerseyMat.needsUpdate = true;
      jerseyTex.dispose();
      jerseyTex = nextTex;
      bootMat.color.set(bootColor);
    },
    dispose() {
      jerseyTex.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function updatePlayerPose(rig: PlayerRig, p: PlayerPoseInput): void {
  // Reset base transforms smoothly
  rig.bodyPivot.position.set(0, 0.86, 0);
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.leftArm.rotation.set(0, 0, 0.14);
  rig.rightArm.rotation.set(0, 0, -0.14);
  rig.leftLeg.rotation.set(0, 0, 0);
  rig.rightLeg.rotation.set(0, 0, 0);

  // Indicators
  rig.indicatorRing.visible = p.isControlled || p.tackleWindup > 0;
  const ringMat = rig.indicatorRing.material as THREE.MeshBasicMaterial;
  if (p.tackleWindup > 0) {
    ringMat.color.setHex(0xef4444);
    ringMat.opacity = 0.55 + Math.sin(p.time * 28) * 0.35;
    rig.indicatorRing.scale.setScalar(1.0 + p.tackleWindup * 0.35);
  } else {
    ringMat.color.setHex(p.hasBall ? 0xf59e0b : 0x06b6d4);
    ringMat.opacity = 0.82;
    rig.indicatorRing.scale.setScalar(1.0);
  }

  rig.gamebreakerAura.visible = p.gamebreakerActive;
  if (p.gamebreakerActive) {
    rig.gamebreakerAura.scale.setScalar(1.0 + Math.sin(p.time * 12) * 0.12);
    rig.gamebreakerAura.rotation.z = p.time * 3;
  }

  // 1. Fallen / Ankle-Broken Pose (just like the video!)
  if (p.fallenTimer > 0) {
    rig.bodyPivot.position.y = 0.22;
    rig.bodyPivot.rotation.x = -Math.PI * 0.44;
    rig.bodyPivot.rotation.z = Math.sin(p.fallenTimer * 4) * 0.18;
    rig.leftArm.rotation.z = 1.15;
    rig.rightArm.rotation.z = -1.15;
    rig.leftArm.rotation.x = -0.4;
    rig.rightArm.rotation.x = 0.3;
    rig.leftLeg.rotation.x = 0.35;
    rig.rightLeg.rotation.x = -0.25;
    rig.leftLeg.rotation.z = 0.28;
    rig.rightLeg.rotation.z = -0.28;

    rig.dizzyHalo.visible = true;
    rig.dizzyHalo.position.set(0, 0.72 + Math.sin(p.time * 8) * 0.04, -0.35);
    rig.dizzyHalo.rotation.y = p.time * 6;
    return;
  }
  rig.dizzyHalo.visible = false;

  // 2. Goalkeeper Dive Pose
  if (p.diveTimer > 0 && p.diveDir !== 0) {
    const arc = Math.sin((p.diveTimer / 0.55) * Math.PI);
    rig.bodyPivot.position.y = 0.86 + arc * 0.55;
    rig.bodyPivot.rotation.z = -p.diveDir * (Math.PI * 0.42);
    rig.leftArm.rotation.z = p.diveDir < 0 ? 2.6 : 0.4;
    rig.rightArm.rotation.z = p.diveDir > 0 ? -2.6 : -0.4;
    rig.leftLeg.rotation.x = -0.2;
    rig.rightLeg.rotation.x = 0.2;
    return;
  }

  // 3. Slide Tackle Pose
  if (p.slideTimer > 0) {
    rig.bodyPivot.position.y = 0.26;
    rig.bodyPivot.rotation.x = -1.05;
    rig.rightLeg.rotation.x = 0.95;
    rig.leftLeg.rotation.x = -0.35;
    rig.leftLeg.rotation.z = 0.35;
    rig.leftArm.rotation.x = -0.8;
    rig.rightArm.rotation.x = 0.4;
    return;
  }

  // 4. Skill Move Animations
  if (p.skillMove && p.skillTimer > 0) {
    const progress = 1 - p.skillTimer / Math.max(0.01, p.skillDuration);
    if (p.skillMove === 'roulette') {
      rig.bodyPivot.rotation.y = progress * Math.PI * 2;
      rig.bodyPivot.position.y = 0.92;
      rig.leftArm.rotation.z = 0.75;
      rig.rightArm.rotation.z = -0.75;
      rig.rightLeg.rotation.x = Math.sin(progress * Math.PI) * 0.7;
      return;
    }
    if (p.skillMove === 'stepover') {
      const wave = Math.sin(progress * Math.PI * 4);
      rig.bodyPivot.position.y = 0.88 + Math.abs(wave) * 0.08;
      rig.bodyPivot.rotation.z = wave * 0.28;
      rig.leftLeg.rotation.x = Math.max(0, wave) * 0.95;
      rig.rightLeg.rotation.x = Math.max(0, -wave) * 0.95;
      rig.leftArm.rotation.z = 0.55 + wave * 0.25;
      rig.rightArm.rotation.z = -0.55 + wave * 0.25;
      return;
    }
    if (p.skillMove === 'elastico') {
      const whip = Math.sin(progress * Math.PI * 2);
      rig.bodyPivot.rotation.z = whip * 0.34;
      rig.bodyPivot.rotation.x = 0.22;
      rig.rightLeg.rotation.z = -whip * 0.55;
      rig.rightLeg.rotation.x = 0.45;
      rig.leftArm.rotation.z = 0.7;
      rig.rightArm.rotation.z = -0.7;
      return;
    }
    if (p.skillMove === 'panna') {
      const flick = Math.sin(progress * Math.PI);
      rig.bodyPivot.position.y = 0.86 + flick * 0.14;
      rig.bodyPivot.rotation.x = 0.32 * flick;
      rig.rightLeg.rotation.x = flick * 1.1;
      rig.leftLeg.rotation.x = -flick * 0.45;
      return;
    }
  }

  // 5. Normal Athletic Stride / Jockey / Windup
  const speedRatio = Math.min(1, p.speed / 8.5);
  const swing = Math.sin(p.stridePhase) * (0.15 + speedRatio * 0.82);

  if (p.tackleWindup > 0) {
    // Low aggressive defensive crouch before lunging
    rig.bodyPivot.position.y = 0.74;
    rig.bodyPivot.rotation.x = 0.32;
    rig.leftArm.rotation.z = 0.65;
    rig.rightArm.rotation.z = -0.65;
  } else if (speedRatio > 0.08) {
    rig.bodyPivot.position.y = 0.86 + Math.abs(Math.sin(p.stridePhase)) * 0.065 * speedRatio;
    rig.bodyPivot.rotation.x = 0.1 + speedRatio * 0.18;
  } else {
    // Athletic idle breathing
    rig.bodyPivot.position.y = 0.86 + Math.sin(p.time * 3.2) * 0.015;
  }

  rig.leftLeg.rotation.x = swing;
  rig.rightLeg.rotation.x = -swing;
  rig.leftArm.rotation.x = -swing * 0.75;
  rig.rightArm.rotation.x = swing * 0.75;
}

export interface BallRig {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  trailRing: THREE.Mesh;
  radius: number;
  dispose: () => void;
}

export function createBallRig(
  scene: THREE.Scene,
  maxAnisotropy: number,
  shadowTex?: THREE.Texture,
): BallRig {
  const radius = 0.155;
  const ballTex = createBallTexture(maxAnisotropy);
  const geo = new THREE.SphereGeometry(radius, 24, 18);
  const mat = new THREE.MeshPhysicalMaterial({
    map: ballTex,
    roughness: 0.32,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(0, radius, 0);
  scene.add(mesh);

  const sTex = shadowTex ?? createRadialShadowTexture();
  const sGeo = new THREE.PlaneGeometry(0.55, 0.55);
  const sMat = new THREE.MeshBasicMaterial({
    map: sTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
  });
  const shadow = new THREE.Mesh(sGeo, sMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  scene.add(shadow);

  const trailGeo = new THREE.RingGeometry(0.18, 0.25, 20);
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const trailRing = new THREE.Mesh(trailGeo, trailMat);
  trailRing.rotation.x = -Math.PI / 2;
  trailRing.position.y = 0.025;
  scene.add(trailRing);

  return {
    mesh,
    shadow,
    trailRing,
    radius,
    dispose() {
      ballTex.dispose();
      geo.dispose();
      mat.dispose();
      sGeo.dispose();
      sMat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
    },
  };
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  bounce: boolean;
}

const FIRE_PALETTE = [0xfef08a, 0xfbbf24, 0xf97316, 0xef4444];
const CYAN_FIRE_PALETTE = [0xe0f2fe, 0x38bdf8, 0x06b6d4, 0xfbbf24];
const GOAL_PALETTE = [0xfef08a, 0xf59e0b, 0xf97316, 0xef4444, 0x22d3ee];

export class ParticlePool {
  private mesh: THREE.InstancedMesh;
  private geo: THREE.OctahedronGeometry;
  private mat: THREE.MeshBasicMaterial;
  private slots: ParticleSlot[] = [];
  private cursor = 0;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private count = 260;

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.OctahedronGeometry(0.075, 0);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.count);
    this.mesh.frustumCulled = false;

    const zero = new THREE.Color(0xf59e0b);
    for (let i = 0; i < this.count; i++) {
      this.slots.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        bounce: false,
      });
      this.mesh.setColorAt(i, zero);
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    scene.add(this.mesh);
  }

  public emit(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 4.5,
    size = 1.0,
  ): void {
    this.tmpColor.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const slot = this.slots[idx];
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 1.5 + Math.random() * speed * 0.8;
      slot.vz = Math.sin(angle) * spd;
      slot.maxLife = 0.35 + Math.random() * 0.45;
      slot.life = slot.maxLife;
      slot.size = size * (0.6 + Math.random() * 0.7);
      slot.bounce = true;
      this.mesh.setColorAt(idx, this.tmpColor);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public emitFootSparks(
    x: number,
    z: number,
    vx: number,
    vz: number,
    count: number,
    style: 'fire' | 'cyanFire' = 'fire',
  ): void {
    const palette = style === 'cyanFire' ? CYAN_FIRE_PALETTE : FIRE_PALETTE;
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const slot = this.slots[idx];
      const angle = Math.random() * Math.PI * 2;
      const spread = 1.6 + Math.random() * 2.8;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.42;
      slot.y = 0.05 + Math.random() * 0.12;
      slot.z = z + (Math.random() - 0.5) * 0.42;
      slot.vx = -vx * 0.35 + Math.cos(angle) * spread;
      slot.vy = 1.8 + Math.random() * 3.4;
      slot.vz = -vz * 0.35 + Math.sin(angle) * spread;
      slot.maxLife = 0.28 + Math.random() * 0.32;
      slot.life = slot.maxLife;
      slot.size = 0.65 + Math.random() * 0.65;
      slot.bounce = true;
      this.tmpColor.setHex(palette[i % palette.length]);
      this.mesh.setColorAt(idx, this.tmpColor);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public emitGoalBurst(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const slot = this.slots[idx];
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 7.0;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.5;
      slot.y = y;
      slot.z = z + (Math.random() - 0.5) * 0.4;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 4.2 + Math.random() * 6.5;
      slot.vz = Math.sin(angle) * spd;
      slot.maxLife = 0.55 + Math.random() * 0.65;
      slot.life = slot.maxLife;
      slot.size = 0.9 + Math.random() * 1.1;
      slot.bounce = true;
      this.tmpColor.setHex(GOAL_PALETTE[i % GOAL_PALETTE.length]);
      this.mesh.setColorAt(idx, this.tmpColor);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.count; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      anyActive = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.dummy.position.set(0, -10, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      s.vy -= 14.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.y <= 0.03) {
        s.y = 0.03;
        if (s.bounce && s.vy < -1.0) {
          s.vy = -s.vy * 0.46;
          s.vx *= 0.82;
          s.vz *= 0.82;
        } else {
          s.vy = 0;
        }
      }
      const lifeRatio = s.life / s.maxLife;
      const scale = lifeRatio * s.size;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.rotation.set(s.life * 9, s.life * 6, 0);
      // Elongate sparks slightly along vertical/motion feel
      this.dummy.scale.set(scale * 0.85, scale * 1.35, scale * 0.85);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (anyActive) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
