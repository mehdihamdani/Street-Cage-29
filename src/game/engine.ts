import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildStreetArena,
  GOAL_DEPTH,
  GOAL_HALF_W,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  HALF_L,
  HALF_W,
  POST_RADIUS,
  type StreetArena,
} from './arena';
import { StreetAudio } from './audio';
import {
  createBallRig,
  createPlayerRig,
  ParticlePool,
  updatePlayerPose,
  type BallRig,
  type PlayerRig,
} from './entities';
import { loadSavedKit } from './kitStorage';
import { createRadialShadowTexture } from './textures';
import type {
  CalloutEvent,
  DifficultyLevel,
  GameHudState,
  GameMode,
  GamePhase,
  InputState,
  MusicStationId,
  PlayerKitConfig,
  SkillMoveType,
} from './types';

interface SimActor {
  id: string;
  team: 'player' | 'ai';
  role: 'outfield' | 'gk';
  isUserControlled: boolean;
  rig: PlayerRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  stridePhase: number;
  skillMove: SkillMoveType | null;
  skillTimer: number;
  skillDuration: number;
  skillDir: number;
  fallenTimer: number;
  slideTimer: number;
  slideCooldown: number;
  tackleWindup: number;
  diveDir: number;
  diveTimer: number;
  stealGraceTimer: number;
  homeX: number;
  homeZ: number;
}

// Pre-allocated math helpers (zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _axis = new THREE.Vector3();

const SKILL_DURATIONS: Record<SkillMoveType, number> = {
  stepover: 0.36,
  elastico: 0.38,
  roulette: 0.44,
  panna: 0.34,
};

export class StreetFootballEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private arena: StreetArena;
  private ballRig: BallRig;
  private particles: ParticlePool;
  private shadowTex: THREE.Texture;
  private envTex: THREE.Texture;
  private audio = new StreetAudio();

  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsedTime = 0;
  private playerKit: PlayerKitConfig = loadSavedKit();

  private actors: SimActor[] = [];
  private userActor!: SimActor;
  private teammateActor: SimActor | null = null;
  private defenders: SimActor[] = [];
  private northGk!: SimActor;
  private southGk: SimActor | null = null;

  // Ball physics state
  private ballX = 0;
  private ballY = 0.155;
  private ballZ = 0;
  private ballVx = 0;
  private ballVy = 0;
  private ballVz = 0;
  private ballSpinX = 0;
  private ballOwner: SimActor | null = null;
  private lastTouchTeam: 'player' | 'ai' = 'player';
  private pickupCooldown = 0;

  // Match & game state
  private phase: GamePhase = 'title';
  private mode: GameMode = 'panna1v1';
  private difficulty: DifficultyLevel = 'pro';
  private playerGoals = 0;
  private aiGoals = 0;
  private roundNumber = 1;
  private totalRounds = 5;
  private timeRemaining = 25;
  private styleMeter = 0;
  private gamebreakerTimer = 0;
  private stylePoints = 0;
  private ankleBreakers = 0;
  private pannas = 0;
  private shotsOnTarget = 0;
  private winner: 'player' | 'ai' | 'draw' | null = null;

  private shotCharging = false;
  private shotCharge = 0;
  private dribbleAudioTimer = 0;
  private roundResetTimer = 0;
  private hitstopTimer = 0;
  private footFireTimer = 0;
  private cameraShake = 0;
  private currentFov = 48;
  private currentRoll = 0;
  private collisionCooldown = 0;
  private crowdExcitement = 0.1;

  private callout: CalloutEvent | null = null;
  private calloutTimer = 0;
  private calloutCounter = 1;
  private hudSyncTimer = 0;
  private onHudUpdate: (hud: GameHudState) => void;

  // Input & buffering
  private heldKeys = new Set<string>();
  private virtualInput = {
    dx: 0,
    dz: 0,
    sprint: false,
  };
  private input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    shootHeld: false,
    shootJustPressed: false,
    shootJustReleased: false,
    passOrPannaJustPressed: false,
    tackleJustPressed: false,
    skillStepoverJustPressed: false,
    skillElasticoJustPressed: false,
    skillRouletteJustPressed: false,
  };
  private bufferedAction: 'stepover' | 'elastico' | 'roulette' | 'panna' | null = null;
  private bufferTimer = 0;

  constructor(container: HTMLElement, onHudUpdate: (hud: GameHudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // WebGL Context Loss safety
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    // 3. Scene & Environment Map
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080c14);
    this.scene.fog = new THREE.FogExp2(0x080c14, 0.017);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    pmrem.dispose();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.shadowTex = createRadialShadowTexture();

    // 4. Camera
    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.2, 140);
    this.camera.position.set(0, 10, 16);
    this.camera.lookAt(0, 0.5, 0);

    // 5. Arena, Ball, Particles, Actors
    this.arena = buildStreetArena(this.scene, maxAnisotropy, this.isSoftwareGl);
    this.ballRig = createBallRig(this.scene, maxAnisotropy, this.shadowTex);
    this.particles = new ParticlePool(this.scene);

    this.spawnActorsForMode(this.mode, maxAnisotropy);
    this.resetPositionsForKickoff(true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Event listeners
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    this.pushHud();
    this.lastTime = performance.now();
    this.startLoop();
  }

  private spawnActorsForMode(mode: GameMode, maxAnisotropy: number): void {
    // Dispose previous actors
    this.actors.forEach((a) => {
      this.scene.remove(a.rig.root);
      a.rig.dispose();
    });
    this.actors = [];
    this.defenders = [];
    this.teammateActor = null;
    this.southGk = null;

    const makeActor = (
      id: string,
      team: 'player' | 'ai',
      role: 'outfield' | 'gk',
      isUserControlled: boolean,
      homeX: number,
      homeZ: number,
      appearance: Parameters<typeof createPlayerRig>[0],
    ): SimActor => {
      const rig = createPlayerRig(appearance, this.shadowTex, maxAnisotropy);
      this.scene.add(rig.root);
      return {
        id,
        team,
        role,
        isUserControlled,
        rig,
        x: homeX,
        z: homeZ,
        vx: 0,
        vz: 0,
        facing: team === 'player' ? Math.PI : 0,
        stridePhase: 0,
        skillMove: null,
        skillTimer: 0,
        skillDuration: 0.36,
        skillDir: 1,
        fallenTimer: 0,
        slideTimer: 0,
        slideCooldown: 0,
        tackleWindup: 0,
        diveDir: 0,
        diveTimer: 0,
        stealGraceTimer: 0,
        homeX,
        homeZ,
      };
    };

    // Player #29 (Customizable jersey & boots!)
    this.userActor = makeActor('player-29', 'player', 'outfield', true, 0, 5.5, {
      jerseyPrimary: this.playerKit.jerseyPrimary,
      jerseyStripe: this.playerKit.jerseyStripe,
      shortsColor: 0x0f172a,
      sockColor: 0xf8fafc,
      bootColor: this.playerKit.bootColor,
      skinColor: 0xd9a07b,
      hairColor: 0x111827,
      numberText: '29',
      striped: this.playerKit.striped,
      hasHeadband: true,
      ringColor: 0x06b6d4,
    });
    this.actors.push(this.userActor);

    // Primary Defender #8 (Teal & Dark kit like video clips!)
    const def1 = makeActor('ai-def-1', 'ai', 'outfield', false, 0, -2.5, {
      jerseyPrimary: '#0d9488',
      jerseyStripe: '#0f172a',
      shortsColor: 0x111827,
      sockColor: 0x0d9488,
      bootColor: 0x38bdf8,
      skinColor: 0xc68b67,
      hairColor: 0x1f2937,
      numberText: '8',
      striped: false,
      ringColor: 0xef4444,
    });
    this.actors.push(def1);
    this.defenders.push(def1);

    // North Goalkeeper #1
    this.northGk = makeActor('ai-gk-north', 'ai', 'gk', false, 0, -HALF_L + 0.85, {
      jerseyPrimary: '#84cc16',
      jerseyStripe: '#1e293b',
      shortsColor: 0x1e293b,
      sockColor: 0x84cc16,
      bootColor: 0xf8fafc,
      skinColor: 0xd9a07b,
      hairColor: 0x0f172a,
      numberText: '1',
      striped: false,
    });
    this.actors.push(this.northGk);

    if (mode === 'cage2v2') {
      // Teammate #10 (Amber & Charcoal)
      this.teammateActor = makeActor('player-10', 'player', 'outfield', false, -3.5, 4.5, {
        jerseyPrimary: '#f59e0b',
        jerseyStripe: '#111827',
        shortsColor: 0x111827,
        sockColor: 0xf59e0b,
        bootColor: 0xffffff,
        skinColor: 0x8d5524,
        hairColor: 0x09090b,
        numberText: '10',
        striped: false,
      });
      this.actors.push(this.teammateActor);

      // Second AI Defender #4
      const def2 = makeActor('ai-def-2', 'ai', 'outfield', false, 3.2, -5.0, {
        jerseyPrimary: '#0f766e',
        jerseyStripe: '#1e293b',
        shortsColor: 0x0f172a,
        sockColor: 0x14b8a6,
        bootColor: 0xf43f5e,
        skinColor: 0xe0ac8b,
        hairColor: 0x292524,
        numberText: '4',
        striped: false,
      });
      this.actors.push(def2);
      this.defenders.push(def2);

      // Player Side South Goalkeeper #99
      this.southGk = makeActor('player-gk-south', 'player', 'gk', false, 0, HALF_L - 0.85, {
        jerseyPrimary: '#38bdf8',
        jerseyStripe: '#0f172a',
        shortsColor: 0x0f172a,
        sockColor: 0x38bdf8,
        bootColor: 0xf8fafc,
        skinColor: 0xc68b67,
        hairColor: 0x111827,
        numberText: '99',
        striped: false,
      });
      this.actors.push(this.southGk);
    }
  }

  public startMatch(mode: GameMode, difficulty: DifficultyLevel): void {
    this.audio.unlock();
    this.mode = mode;
    this.difficulty = difficulty;
    this.playerGoals = 0;
    this.aiGoals = 0;
    this.roundNumber = 1;
    this.totalRounds = 5;
    this.timeRemaining = mode === 'panna1v1' ? 25 : 90;
    this.styleMeter = 0;
    this.gamebreakerTimer = 0;
    this.stylePoints = 0;
    this.ankleBreakers = 0;
    this.pannas = 0;
    this.shotsOnTarget = 0;
    this.winner = null;
    this.roundResetTimer = 0;
    this.callout = null;

    this.spawnActorsForMode(mode, this.renderer.capabilities.getMaxAnisotropy());
    this.resetPositionsForKickoff(true);
    this.phase = 'playing';
    this.audio.setBeatMood('match');
    this.audio.playWhistle();
    this.triggerCallout(
      mode === 'panna1v1' ? 'الجولة 1 — 1 ضد 1' : 'انطلاق مباراة القفص!',
      mode === 'panna1v1' ? 'اكسر كاحل المدافع وسجل!' : '2 ضد 2 — بلا حدود!',
      'cyan',
    );
    this.pushHud();
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.audio.setBeatMood('ducked');
      this.pushHud();
    }
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.audio.setBeatMood(this.gamebreakerTimer > 0 ? 'gamebreaker' : 'match');
      this.lastTime = performance.now();
      this.pushHud();
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.audio.setBeatMood('chill');
    this.resetPositionsForKickoff(true);
    this.pushHud();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setMusicStation(station: MusicStationId): void {
    this.audio.setStation(station);
    this.pushHud();
  }

  public cycleMusicStation(): MusicStationId {
    const next = this.audio.cycleStation();
    this.pushHud();
    return next;
  }

  public setPlayerKit(kit: PlayerKitConfig): void {
    this.playerKit = { ...kit };
    if (this.userActor) {
      this.userActor.rig.updateAppearance(
        kit.jerseyPrimary,
        kit.jerseyStripe,
        kit.bootColor,
        kit.striped,
      );
    }
  }

  public setVirtualAxis(dx: number, dz: number, sprint: boolean): void {
    this.virtualInput.dx = dx;
    this.virtualInput.dz = dz;
    this.virtualInput.sprint = sprint;
  }

  public triggerVirtualSkill(skill: SkillMoveType): void {
    this.audio.unlock();
    if (this.phase !== 'playing') return;
    if (skill === 'stepover') this.input.skillStepoverJustPressed = true;
    else if (skill === 'elastico') this.input.skillElasticoJustPressed = true;
    else if (skill === 'roulette') this.input.skillRouletteJustPressed = true;
    else if (skill === 'panna') this.input.passOrPannaJustPressed = true;
  }

  public triggerVirtualShootStart(): void {
    this.audio.unlock();
    if (this.phase !== 'playing') return;
    if (this.ballOwner === this.userActor) {
      this.input.shootHeld = true;
      this.input.shootJustPressed = true;
    } else {
      this.input.tackleJustPressed = true;
    }
  }

  public triggerVirtualShootEnd(): void {
    if (this.input.shootHeld) {
      this.input.shootHeld = false;
      this.input.shootJustReleased = true;
    }
  }

  private resetPositionsForKickoff(playerStartsWithBall: boolean): void {
    this.ballOwner = null;
    this.shotCharging = false;
    this.shotCharge = 0;
    this.pickupCooldown = 0;

    if (this.mode === 'panna1v1') {
      this.userActor.x = 0;
      this.userActor.z = 5.5;
      this.userActor.facing = Math.PI;
      this.defenders[0].x = 0;
      this.defenders[0].z = -2.2;
      this.defenders[0].facing = 0;
      this.northGk.x = 0;
      this.northGk.z = -HALF_L + 0.85;
      this.northGk.facing = 0;

      this.ballX = 0;
      this.ballY = this.ballRig.radius;
      this.ballZ = 4.9;
      this.ballVx = 0;
      this.ballVy = 0;
      this.ballVz = 0;
      this.ballOwner = this.userActor;
    } else {
      this.userActor.x = 0;
      this.userActor.z = 1.2;
      this.userActor.facing = Math.PI;
      if (this.teammateActor) {
        this.teammateActor.x = -3.4;
        this.teammateActor.z = 3.8;
        this.teammateActor.facing = Math.PI;
      }
      this.defenders[0].x = 0;
      this.defenders[0].z = playerStartsWithBall ? -3.2 : -1.1;
      this.defenders[0].facing = 0;
      if (this.defenders[1]) {
        this.defenders[1].x = 3.4;
        this.defenders[1].z = -4.6;
        this.defenders[1].facing = 0;
      }
      this.northGk.x = 0;
      this.northGk.z = -HALF_L + 0.85;
      this.northGk.facing = 0;
      if (this.southGk) {
        this.southGk.x = 0;
        this.southGk.z = HALF_L - 0.85;
        this.southGk.facing = Math.PI;
      }

      this.ballX = 0;
      this.ballY = this.ballRig.radius;
      this.ballZ = 0;
      this.ballVx = 0;
      this.ballVy = 0;
      this.ballVz = 0;
      this.ballOwner = playerStartsWithBall ? this.userActor : this.defenders[0];
    }

    for (const a of this.actors) {
      a.vx = 0;
      a.vz = 0;
      a.skillMove = null;
      a.skillTimer = 0;
      a.fallenTimer = 0;
      a.slideTimer = 0;
      a.tackleWindup = 0;
      a.diveTimer = 0;
      a.diveDir = 0;
      a.stealGraceTimer = 0;
      a.rig.root.position.set(a.x, 0, a.z);
      a.rig.root.rotation.y = a.facing;
    }
  }

  private triggerCallout(
    title: string,
    subtitle: string,
    accent: CalloutEvent['accent'],
  ): void {
    this.callout = {
      id: this.calloutCounter++,
      title,
      subtitle,
      accent,
    };
    this.calloutTimer = 1.9;
  }

  private addStyle(points: number, meterDelta: number): void {
    this.stylePoints += points;
    if (this.gamebreakerTimer <= 0) {
      this.styleMeter = Math.min(100, this.styleMeter + meterDelta);
      if (this.styleMeter >= 100) {
        this.gamebreakerTimer = 6.5;
        this.crowdExcitement = 1.0;
        this.triggerCallout('GAMEBREAKER!', 'تسديدة ذهبية خارقة جاهزة!', 'gold');
        this.audio.playPanna();
      }
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    this.elapsedTime += dt;
    this.audio.beat.update(dt);

    if (this.phase === 'title') {
      this.updateTitleShowcase(dt);
      this.arena.updateCrowd(this.elapsedTime, 0.22);
      this.arena.updateNets(dt);
      this.particles.update(dt);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'gameover') {
      this.arena.updateCrowd(this.elapsedTime, 0.12);
      this.particles.update(dt);
      return;
    }

    // Hitstop freeze for heavy ankle-breakers / post clangs
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt);
      return;
    }

    // Timers
    this.crowdExcitement = Math.max(0.08, this.crowdExcitement - dt * 0.32);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.9);
    if (this.collisionCooldown > 0) this.collisionCooldown -= dt;
    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) this.callout = null;
    }
    if (this.gamebreakerTimer > 0) {
      this.gamebreakerTimer -= dt;
      if (this.gamebreakerTimer <= 0) {
        this.styleMeter = 0;
        this.audio.setBeatMood('match');
      } else {
        this.audio.setBeatMood('gamebreaker');
      }
    }
    if (this.pickupCooldown > 0) {
      this.pickupCooldown -= dt;
    }
    if (this.footFireTimer > 0) {
      this.footFireTimer -= dt;
    }

    // Round/Goal celebration freeze
    if (this.roundResetTimer > 0) {
      this.roundResetTimer -= dt;
      if (Math.random() < 0.45) {
        this.particles.emitFootSparks(
          this.userActor.x,
          this.userActor.z,
          this.userActor.vx,
          this.userActor.vz,
          2,
          'fire',
        );
      }
      this.updateBallPhysics(dt);
      this.arena.updateCrowd(this.elapsedTime, this.crowdExcitement);
      this.arena.updateNets(dt);
      this.particles.update(dt);
      this.updateCamera(dt);
      if (this.roundResetTimer <= 0) {
        this.advanceAfterReset();
      }
      this.syncHudThrottled(dt);
      this.clearEdgeInputs();
      return;
    }

    // Match / Shot Clock
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      if (this.mode === 'panna1v1') {
        // Shot clock expired -> AI wins the round
        this.aiGoals += 1;
        this.audio.playWhistle();
        this.triggerCallout('انتهى الوقت!', 'جولة للمدافع', 'rose');
        this.roundResetTimer = 1.5;
        this.pushHud();
        this.clearEdgeInputs();
        return;
      } else {
        this.finishMatch();
        this.clearEdgeInputs();
        return;
      }
    }

    // Update User & AI
    this.updateUserActor(dt);
    this.updateTeammateAI(dt);
    this.updateDefendersAI(dt);
    this.updateGoalkeeperAI(this.northGk, -1, dt);
    if (this.southGk) {
      this.updateGoalkeeperAI(this.southGk, 1, dt);
    }

    // Physical Player-to-Player Collisions & Heavy Impact Camera Shake
    this.resolveActorCollisions();

    // Update Ball & Goals
    this.updateBallPhysics(dt);

    // Update Rigs & Crowd & Particles
    for (const actor of this.actors) {
      actor.rig.root.position.set(actor.x, 0, actor.z);
      actor.rig.root.rotation.y = actor.facing;
      const spd = Math.hypot(actor.vx, actor.vz);
      updatePlayerPose(actor.rig, {
        speed: spd,
        stridePhase: actor.stridePhase,
        skillMove: actor.skillMove,
        skillTimer: actor.skillTimer,
        skillDuration: actor.skillDuration,
        fallenTimer: actor.fallenTimer,
        slideTimer: actor.slideTimer,
        tackleWindup: actor.tackleWindup,
        diveDir: actor.diveDir,
        diveTimer: actor.diveTimer,
        hasBall: this.ballOwner === actor,
        gamebreakerActive: actor.isUserControlled && this.gamebreakerTimer > 0,
        isControlled: actor.isUserControlled,
        time: this.elapsedTime,
      });
    }

    this.arena.updateCrowd(this.elapsedTime, this.crowdExcitement);
    this.arena.updateNets(dt);
    this.particles.update(dt);
    this.updateCamera(dt);
    this.syncHudThrottled(dt);
    this.clearEdgeInputs();
  }

  private updateTitleShowcase(dt: number): void {
    const t = this.elapsedTime;
    // Live orbit camera around floodlit night cage
    const angle = t * 0.22;
    this.camera.position.set(Math.sin(angle) * 14, 6.2 + Math.sin(t * 0.4) * 0.7, Math.cos(angle) * 14);
    this.camera.lookAt(0, 1.1, 0);

    // Animated 1v1 demo duel in center circle
    this.userActor.x = Math.sin(t * 1.4) * 1.8;
    this.userActor.z = 1.6 + Math.cos(t * 1.4) * 0.8;
    this.userActor.vx = Math.cos(t * 1.4) * 2.5;
    this.userActor.vz = -Math.sin(t * 1.4) * 1.2;
    this.userActor.facing = Math.atan2(this.userActor.vx, this.userActor.vz);
    this.userActor.stridePhase += dt * 9;
    this.userActor.rig.root.position.set(this.userActor.x, 0, this.userActor.z);
    this.userActor.rig.root.rotation.y = this.userActor.facing;

    const demoSkill: SkillMoveType | null =
      Math.floor(t / 2.2) % 2 === 0 ? 'stepover' : null;
    updatePlayerPose(this.userActor.rig, {
      speed: 3.5,
      stridePhase: this.userActor.stridePhase,
      skillMove: demoSkill,
      skillTimer: demoSkill ? 0.2 : 0,
      skillDuration: 0.36,
      fallenTimer: 0,
      slideTimer: 0,
      tackleWindup: 0,
      diveDir: 0,
      diveTimer: 0,
      hasBall: true,
      gamebreakerActive: false,
      isControlled: true,
      time: t,
    });

    const def = this.defenders[0];
    def.x = this.userActor.x * 0.6;
    def.z = -1.6;
    def.facing = Math.atan2(this.userActor.x - def.x, this.userActor.z - def.z);
    def.stridePhase += dt * 6;
    def.rig.root.position.set(def.x, 0, def.z);
    def.rig.root.rotation.y = def.facing;
    updatePlayerPose(def.rig, {
      speed: 2.0,
      stridePhase: def.stridePhase,
      skillMove: null,
      skillTimer: 0,
      skillDuration: 0.36,
      fallenTimer: 0,
      slideTimer: 0,
      tackleWindup: 0,
      diveDir: 0,
      diveTimer: 0,
      hasBall: false,
      gamebreakerActive: false,
      isControlled: false,
      time: t,
    });

    this.ballX = this.userActor.x + Math.sin(this.userActor.facing) * 0.48;
    this.ballZ = this.userActor.z + Math.cos(this.userActor.facing) * 0.48;
    this.ballY = this.ballRig.radius;
    this.ballRig.mesh.position.set(this.ballX, this.ballY, this.ballZ);
    this.ballRig.mesh.rotation.y = t * 4;
    this.ballRig.shadow.position.set(this.ballX, 0.016, this.ballZ);
  }

  private updateUserActor(dt: number): void {
    const u = this.userActor;
    if (u.stealGraceTimer > 0) u.stealGraceTimer -= dt;
    if (u.slideCooldown > 0) u.slideCooldown -= dt;
    if (u.fallenTimer > 0) {
      u.fallenTimer -= dt;
      u.vx *= 0.88;
      u.vz *= 0.88;
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      this.clampActorToPitch(u);
      return;
    }

    // Input direction
    let ix =
      (this.input.right || this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
      (this.input.left || this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0);
    let iz =
      (this.input.down || this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) -
      (this.input.up || this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0);

    if (Math.abs(this.virtualInput.dx) > 0.05 || Math.abs(this.virtualInput.dz) > 0.05) {
      ix = this.virtualInput.dx;
      iz = this.virtualInput.dz;
    }

    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }

    const sprinting =
      this.input.sprint ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight') ||
      this.virtualInput.sprint;

    // Input buffering for skill moves
    if (this.input.skillStepoverJustPressed) {
      this.bufferedAction = 'stepover';
      this.bufferTimer = 0.16;
    } else if (this.input.skillElasticoJustPressed) {
      this.bufferedAction = 'elastico';
      this.bufferTimer = 0.16;
    } else if (this.input.skillRouletteJustPressed) {
      this.bufferedAction = 'roulette';
      this.bufferTimer = 0.16;
    } else if (this.input.passOrPannaJustPressed) {
      this.bufferedAction = 'panna';
      this.bufferTimer = 0.16;
    }

    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.bufferTimer <= 0) this.bufferedAction = null;
    }

    const hasBall = this.ballOwner === u;

    // Slide Tackle when defending (without ball)
    if (!hasBall && u.slideTimer <= 0 && u.slideCooldown <= 0) {
      if (this.input.tackleJustPressed || this.input.shootJustPressed) {
        u.slideTimer = 0.42;
        u.slideCooldown = 0.75;
        const dirAngle = len > 0.1 ? Math.atan2(ix, iz) : u.facing;
        u.facing = dirAngle;
        u.vx = Math.sin(dirAngle) * 10.5;
        u.vz = Math.cos(dirAngle) * 10.5;
        this.audio.playSkill('stepover');
        this.particles.emit(u.x, 0.1, u.z, 8, 0x22c55e, 3.2, 0.9);
      }
    }

    if (u.slideTimer > 0) {
      u.slideTimer -= dt;
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      u.vx *= 0.94;
      u.vz *= 0.94;
      this.clampActorToPitch(u);

      // Check steal during slide
      const distBall = Math.hypot(this.ballX - u.x, this.ballZ - u.z);
      if (distBall < 1.15 && this.ballY < 0.7 && this.ballOwner !== u) {
        if (this.ballOwner && this.ballOwner.team === 'ai') {
          this.ballOwner.fallenTimer = 0.95;
        }
        this.ballOwner = u;
        u.stealGraceTimer = 0.45;
        this.audio.playDribble(0.9);
        this.particles.emit(u.x, 0.2, u.z, 10, 0x06b6d4, 3.5, 1.0);
      }
      return;
    }

    // Active skill move execution
    if (hasBall && u.skillTimer <= 0 && this.bufferedAction) {
      const action = this.bufferedAction;
      this.bufferedAction = null;
      this.bufferTimer = 0;

      if (action === 'panna' && this.mode === 'cage2v2' && this.teammateActor) {
        // Check if defender is right in front for Panna, else pass to teammate!
        const closeDef = this.findClosestOpponent(u, 2.15);
        if (closeDef) {
          this.executeSkillMove(u, 'panna', ix, iz);
        } else {
          this.executePass(u, this.teammateActor);
        }
      } else {
        this.executeSkillMove(u, action, ix, iz);
      }
    }

    // Skill move motion burst
    if (u.skillTimer > 0) {
      u.skillTimer -= dt;
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      u.stridePhase += dt * 16;
      this.clampActorToPitch(u);
      this.particles.emitFootSparks(u.x, u.z, u.vx, u.vz, 3, 'fire');
      return;
    }

    // Shot Charging & Firing
    if (hasBall) {
      if (this.input.shootHeld || this.heldKeys.has('Space')) {
        this.shotCharging = true;
        this.shotCharge = Math.min(1, this.shotCharge + dt * 1.45);
      }
      if (this.shotCharging && (this.input.shootJustReleased || (!this.input.shootHeld && !this.heldKeys.has('Space')))) {
        this.fireUserShot(ix, iz);
        this.shotCharging = false;
        this.shotCharge = 0;
      }
    } else {
      this.shotCharging = false;
      this.shotCharge = 0;
    }

    // Normal athletic movement
    const gbBonus = this.gamebreakerTimer > 0 ? 1.18 : 1.0;
    const baseMax = (hasBall ? 6.4 : 7.0) * (sprinting ? 1.24 : 1.0) * gbBonus;
    const targetVx = ix * baseMax;
    const targetVz = iz * baseMax;
    const accel = 1 - Math.exp(-15 * dt);
    u.vx += (targetVx - u.vx) * accel;
    u.vz += (targetVz - u.vz) * accel;

    u.x += u.vx * dt;
    u.z += u.vz * dt;
    this.clampActorToPitch(u);

    const speed = Math.hypot(u.vx, u.vz);
    if (speed > 0.3) {
      const targetFacing = Math.atan2(u.vx, u.vz);
      u.facing = this.lerpAngle(u.facing, targetFacing, 1 - Math.exp(-14 * dt));
      u.stridePhase += dt * (4.5 + speed * 1.35);

      if ((this.footFireTimer > 0 || this.gamebreakerTimer > 0) && speed > 2.2) {
        this.particles.emitFootSparks(u.x, u.z, u.vx, u.vz, 2, 'fire');
      }

      if (hasBall) {
        this.dribbleAudioTimer -= dt;
        if (this.dribbleAudioTimer <= 0) {
          this.audio.playDribble(0.45 + (speed / 9) * 0.35);
          this.dribbleAudioTimer = 0.28;
        }
      }
    }
  }

  private executeSkillMove(
    actor: SimActor,
    skill: SkillMoveType,
    ix: number,
    iz: number,
  ): void {
    actor.skillMove = skill;
    actor.skillDuration = SKILL_DURATIONS[skill];
    actor.skillTimer = actor.skillDuration;
    actor.stealGraceTimer = actor.skillDuration + 0.25;

    const dirAngle = Math.hypot(ix, iz) > 0.15 ? Math.atan2(ix, iz) : actor.facing;
    actor.facing = dirAngle;

    // Lateral burst direction
    const side = Math.random() > 0.5 ? 1 : -1;
    actor.skillDir = side;
    const fwdX = Math.sin(dirAngle);
    const fwdZ = Math.cos(dirAngle);
    const rightX = Math.cos(dirAngle);
    const rightZ = -Math.sin(dirAngle);

    if (skill === 'stepover') {
      actor.vx = fwdX * 7.2 + rightX * side * 3.8;
      actor.vz = fwdZ * 7.2 + rightZ * side * 3.8;
    } else if (skill === 'elastico') {
      actor.vx = fwdX * 8.2 - rightX * side * 4.4;
      actor.vz = fwdZ * 8.2 - rightZ * side * 4.4;
    } else if (skill === 'roulette') {
      actor.vx = fwdX * 8.5 + rightX * side * 2.2;
      actor.vz = fwdZ * 8.5 + rightZ * side * 2.2;
    } else if (skill === 'panna') {
      actor.vx = fwdX * 9.4;
      actor.vz = fwdZ * 9.4;
    }

    this.audio.playSkill(skill);
    this.particles.emitFootSparks(actor.x, actor.z, actor.vx, actor.vz, 12, 'fire');

    // Check Ankle-Breaker / Panna against nearby defenders!
    const breakRadius = this.gamebreakerTimer > 0 ? 3.4 : skill === 'elastico' ? 2.95 : 2.65;
    for (const def of this.defenders) {
      if (def.fallenTimer > 0) continue;
      const dist = Math.hypot(def.x - actor.x, def.z - actor.z);
      if (dist <= breakRadius) {
        if (actor.isUserControlled) {
          this.footFireTimer = 2.4;
        }
        if (skill === 'panna' && dist <= 2.35) {
          // Panna Nutmeg!
          def.fallenTimer = 1.65;
          def.vx = -fwdX * 2.5;
          def.vz = -fwdZ * 2.5;
          this.pannas += 1;
          this.hitstopTimer = 0.05;
          this.addCameraTrauma(0.55);
          this.crowdExcitement = 0.95;
          this.addStyle(350, 45);
          this.audio.playPanna();
          this.audio.triggerBeatEvent('skill', 3.4);
          this.particles.emitFootSparks(actor.x, actor.z, actor.vx, actor.vz, 20, 'cyanFire');
          this.particles.emit(def.x, 0.5, def.z, 24, 0x06b6d4, 5.8, 1.3);
          this.triggerCallout('كوبري! PANNA!', '+350 نقاط مهارة', 'cyan');
        } else {
          // Ankle Breaker! Defender tumbles onto the turf!
          def.fallenTimer = 1.95;
          def.tackleWindup = 0;
          def.slideTimer = 0;
          def.vx = rightX * -side * 3.4;
          def.vz = rightZ * -side * 3.4;
          this.ankleBreakers += 1;
          this.hitstopTimer = 0.055;
          this.addCameraTrauma(0.62);
          this.crowdExcitement = 0.95;
          this.addStyle(250, 35);
          this.audio.playAnkleBreaker();
          this.audio.triggerBeatEvent('skill', 3.4);
          this.particles.emitFootSparks(actor.x, actor.z, actor.vx, actor.vz, 22, 'fire');
          this.particles.emit(def.x, 0.45, def.z, 28, 0xf59e0b, 6.5, 1.35);
          this.triggerCallout('كسر كاحل! ANKLE BREAKER!', 'المدافع على الأرض! +250', 'gold');
        }
      }
    }
  }

  private executePass(from: SimActor, to: SimActor): void {
    this.ballOwner = null;
    this.pickupCooldown = 0.14;
    const leadX = to.x + to.vx * 0.25;
    const leadZ = to.z + to.vz * 0.25;
    const dx = leadX - this.ballX;
    const dz = leadZ - this.ballZ;
    const dist = Math.max(0.5, Math.hypot(dx, dz));
    const speed = Math.min(15.5, 9.5 + dist * 0.7);
    this.ballVx = (dx / dist) * speed;
    this.ballVz = (dz / dist) * speed;
    this.ballVy = 0.8;
    this.ballSpinX = 0;
    this.lastTouchTeam = from.team;
    from.facing = Math.atan2(dx, dz);
    this.audio.playKick(0.4, false);
    this.particles.emit(this.ballX, 0.18, this.ballZ, 6, 0xffffff, 2.5, 0.7);
  }

  private fireUserShot(ix: number, iz: number): void {
    const u = this.userActor;
    this.ballOwner = null;
    this.pickupCooldown = 0.18;
    this.lastTouchTeam = 'player';

    const power = 0.35 + this.shotCharge * 0.65;
    const isGB = this.gamebreakerTimer > 0;
    if (isGB) {
      this.gamebreakerTimer = 0;
      this.styleMeter = 0;
    }

    // Target North Goal (-HALF_L), steered left/right by player X input
    const aimX = THREE.MathUtils.clamp(ix * (GOAL_HALF_W * 0.92), -GOAL_HALF_W + 0.25, GOAL_HALF_W - 0.25);
    const targetZ = -HALF_L - 0.5;
    const dx = aimX - this.ballX;
    const dz = targetZ - this.ballZ;
    const dist = Math.max(1, Math.hypot(dx, dz));

    const speed = (isGB ? 25.5 : 14.5 + power * 8.5);
    this.ballVx = (dx / dist) * speed;
    this.ballVz = (dz / dist) * speed;
    // Slight loft & curve
    this.ballVy = (isGB ? 3.2 : 1.6 + power * 2.6) + (iz < -0.2 ? 0.9 : 0);
    this.ballSpinX = ix * (isGB ? 9.5 : 5.5);

    u.facing = Math.atan2(dx, dz);
    this.shotsOnTarget += 1;
    this.hitstopTimer = isGB ? 0.055 : 0.028;
    this.cameraShake = isGB ? 0.48 : 0.22;
    this.audio.playKick(power, isGB);
    this.particles.emit(
      this.ballX,
      0.25,
      this.ballZ,
      isGB ? 28 : 12,
      isGB ? 0xf59e0b : 0xf8fafc,
      isGB ? 6.5 : 3.8,
      isGB ? 1.4 : 0.9,
    );
  }

  private updateTeammateAI(dt: number): void {
    const mate = this.teammateActor;
    if (!mate) return;
    if (mate.stealGraceTimer > 0) mate.stealGraceTimer -= dt;
    if (mate.fallenTimer > 0) {
      mate.fallenTimer -= dt;
      return;
    }

    if (this.ballOwner === mate) {
      // Teammate looks to pass to user or shoot if very close to goal
      const distToGoal = Math.hypot(mate.x, mate.z - -HALF_L);
      if (distToGoal < 6.2) {
        this.ballOwner = null;
        this.pickupCooldown = 0.2;
        const aimX = (Math.random() - 0.5) * (GOAL_WIDTH * 0.7);
        const dx = aimX - this.ballX;
        const dz = -HALF_L - this.ballZ;
        const d = Math.hypot(dx, dz);
        this.ballVx = (dx / d) * 16.5;
        this.ballVz = (dz / d) * 16.5;
        this.ballVy = 2.0;
        this.lastTouchTeam = 'player';
        this.audio.playKick(0.65, false);
      } else {
        // Pass back to user!
        this.executePass(mate, this.userActor);
      }
      return;
    }

    // Support positioning opposite side of user
    const targetX = THREE.MathUtils.clamp(
      this.userActor.x > 0 ? -4.2 : 4.2,
      -HALF_W + 1.5,
      HALF_W - 1.5,
    );
    const targetZ = THREE.MathUtils.clamp(this.userActor.z - 2.6, -HALF_L + 3.0, HALF_L - 3.5);
    this.steerActorToward(mate, targetX, targetZ, 5.8, dt);
  }

  private updateDefendersAI(dt: number): void {
    const diffMult = this.difficulty === 'street' ? 0.78 : this.difficulty === 'pro' ? 0.96 : 1.14;

    this.defenders.forEach((def, idx) => {
      if (def.stealGraceTimer > 0) def.stealGraceTimer -= dt;
      if (def.slideCooldown > 0) def.slideCooldown -= dt;

      if (def.fallenTimer > 0) {
        def.fallenTimer -= dt;
        def.vx *= 0.88;
        def.vz *= 0.88;
        def.x += def.vx * dt;
        def.z += def.vz * dt;
        this.clampActorToPitch(def);
        return;
      }

      // If AI defender has the ball
      if (this.ballOwner === def) {
        if (this.mode === 'panna1v1') {
          // In 1v1, defender tries to clear past z = +7.5 to win the round
          this.steerActorToward(def, 0, HALF_L - 2, 6.2 * diffMult, dt);
          if (def.z > 7.5) {
            this.aiGoals += 1;
            this.audio.playWhistle();
            this.triggerCallout('تم قطع الكرة!', 'المدافع أبعد الهجمة', 'rose');
            this.roundResetTimer = 1.5;
            this.pushHud();
          }
        } else {
          // 2v2 AI attacks South Goal (+HALF_L)
          const distSouth = Math.hypot(def.x, HALF_L - def.z);
          if (distSouth < 7.8) {
            this.ballOwner = null;
            this.pickupCooldown = 0.2;
            const aimX = (Math.random() - 0.5) * (GOAL_WIDTH * 0.72);
            const dx = aimX - this.ballX;
            const dz = HALF_L - this.ballZ;
            const d = Math.hypot(dx, dz);
            this.ballVx = (dx / d) * (14.5 * diffMult);
            this.ballVz = (dz / d) * (14.5 * diffMult);
            this.ballVy = 2.0;
            this.lastTouchTeam = 'ai';
            this.audio.playKick(0.65, false);
          } else {
            this.steerActorToward(def, Math.sin(this.elapsedTime + idx) * 2.5, HALF_L - 4.5, 5.9 * diffMult, dt);
          }
        }
        return;
      }

      // Slide lunge execution
      if (def.slideTimer > 0) {
        def.slideTimer -= dt;
        def.x += def.vx * dt;
        def.z += def.vz * dt;
        def.vx *= 0.94;
        def.vz *= 0.94;
        this.clampActorToPitch(def);
        this.tryAISteal(def, 1.05);
        return;
      }

      // Tackle windup telegraph (0.28s crouch + red ring flash!)
      if (def.tackleWindup > 0) {
        def.tackleWindup -= dt;
        def.vx *= 0.85;
        def.vz *= 0.85;
        if (def.tackleWindup <= 0) {
          // Commit lunge!
          const dx = this.ballX - def.x;
          const dz = this.ballZ - def.z;
          const d = Math.max(0.1, Math.hypot(dx, dz));
          def.facing = Math.atan2(dx, dz);
          def.vx = (dx / d) * (9.5 * diffMult);
          def.vz = (dz / d) * (9.5 * diffMult);
          def.slideTimer = 0.36;
          def.slideCooldown = 1.65;
          this.particles.emit(def.x, 0.1, def.z, 7, 0x22c55e, 2.8, 0.8);
        }
        return;
      }

      // Press ball or hold zone
      const carrier = this.ballOwner;
      const shouldPress =
        idx === 0 ||
        !carrier ||
        Math.hypot(def.x - this.ballX, def.z - this.ballZ) < 6.0;

      if (shouldPress) {
        // Jockey point slightly between ball and North goal
        const targetX = this.ballX;
        const targetZ = this.ballZ - (this.mode === 'panna1v1' ? 0.55 : 0.35);
        this.steerActorToward(def, targetX, targetZ, 5.45 * diffMult, dt);

        const distToBall = Math.hypot(this.ballX - def.x, this.ballZ - def.z);
        if (
          distToBall < 1.9 &&
          def.slideCooldown <= 0 &&
          carrier &&
          carrier.team === 'player' &&
          carrier.stealGraceTimer <= 0
        ) {
          // Telegraph tackle! Gives player a crisp window to ankle-break with a skill move!
          def.tackleWindup = 0.28;
        } else if (distToBall < 0.72 && (!carrier || carrier.stealGraceTimer <= 0)) {
          this.tryAISteal(def, 0.75);
        }
      } else {
        // Zone cover
        this.steerActorToward(def, def.homeX, def.homeZ, 4.4 * diffMult, dt);
      }
    });
  }

  private tryAISteal(def: SimActor, radius: number): void {
    if (this.pickupCooldown > 0) return;
    if (this.ballOwner && this.ballOwner.stealGraceTimer > 0) return;
    if (this.ballY > 0.65) return;
    const dist = Math.hypot(this.ballX - def.x, this.ballZ - def.z);
    if (dist <= radius) {
      this.ballOwner = def;
      def.stealGraceTimer = 0.4;
      this.lastTouchTeam = 'ai';
      this.audio.playDribble(0.8);
      this.particles.emit(this.ballX, 0.2, this.ballZ, 8, 0xef4444, 3.0, 0.8);
    }
  }

  private updateGoalkeeperAI(gk: SimActor, goalSign: -1 | 1, dt: number): void {
    if (gk.diveTimer > 0) {
      gk.diveTimer -= dt;
      gk.x += gk.vx * dt;
      gk.vx *= 0.92;
      gk.x = THREE.MathUtils.clamp(gk.x, -GOAL_HALF_W + 0.35, GOAL_HALF_W - 0.35);
      return;
    }

    const diffReact = this.difficulty === 'street' ? 3.8 : this.difficulty === 'pro' ? 4.9 : 6.1;
    const lineZ = goalSign * (HALF_L - 0.85);
    const targetX = THREE.MathUtils.clamp(this.ballX * 0.65, -GOAL_HALF_W + 0.5, GOAL_HALF_W - 0.5);
    const dx = targetX - gk.x;
    const dz = lineZ - gk.z;
    gk.vx = THREE.MathUtils.clamp(dx * 5.2, -diffReact, diffReact);
    gk.vz = THREE.MathUtils.clamp(dz * 5.0, -3.5, 3.5);
    gk.x += gk.vx * dt;
    gk.z += gk.vz * dt;
    gk.facing = goalSign < 0 ? 0 : Math.PI;
    gk.stridePhase += dt * Math.abs(gk.vx) * 2.2;

    // Trigger dive when a fast shot approaches goal!
    const ballMovingTowardGoal = goalSign < 0 ? this.ballVz < -6.5 : this.ballVz > 6.5;
    const distZ = Math.abs(this.ballZ - lineZ);
    if (!this.ballOwner && ballMovingTowardGoal && distZ < 5.5 && Math.abs(this.ballX) < GOAL_HALF_W + 1.2) {
      const timeToLine = distZ / Math.max(1, Math.abs(this.ballVz));
      const predictedX = this.ballX + this.ballVx * timeToLine;
      const offset = predictedX - gk.x;
      if (Math.abs(offset) > 0.65 && Math.abs(offset) < 3.4) {
        gk.diveDir = offset > 0 ? 1 : -1;
        gk.diveTimer = 0.55;
        gk.vx = gk.diveDir * (diffReact * 1.15);
      }
    }
  }

  private updateBallPhysics(dt: number): void {
    if (this.ballOwner) {
      const o = this.ballOwner;
      const fwd = 0.52;
      this.ballX = o.x + Math.sin(o.facing) * fwd;
      this.ballZ = o.z + Math.cos(o.facing) * fwd;
      this.ballY = this.ballRig.radius;
      this.ballVx = o.vx;
      this.ballVz = o.vz;
      this.ballVy = 0;

      // Rotate ball forward proportionally to speed
      const spd = Math.hypot(o.vx, o.vz);
      if (spd > 0.1) {
        _axis.set(o.vz, 0, -o.vx).normalize();
        this.ballRig.mesh.rotateOnWorldAxis(_axis, (spd * dt) / this.ballRig.radius);
      }

      this.syncBallMesh();
      return;
    }

    // Free ball physics + Magnus curve + gravity
    if (Math.abs(this.ballSpinX) > 0.1) {
      this.ballVx += this.ballSpinX * dt * 1.6;
      this.ballSpinX *= Math.pow(0.6, dt);
    }

    this.ballVy -= 18.5 * dt;
    this.ballX += this.ballVx * dt;
    this.ballY += this.ballVy * dt;
    this.ballZ += this.ballVz * dt;

    // Ground bounce & rolling friction
    if (this.ballY <= this.ballRig.radius) {
      this.ballY = this.ballRig.radius;
      if (this.ballVy < -1.8) {
        this.ballVy = -this.ballVy * 0.56;
        this.audio.playDribble(0.35);
      } else {
        this.ballVy = 0;
      }
      const drag = Math.pow(0.38, dt);
      this.ballVx *= drag;
      this.ballVz *= drag;
    } else {
      const airDrag = Math.pow(0.84, dt);
      this.ballVx *= airDrag;
      this.ballVz *= airDrag;
    }

    // Spin visual
    const spd = Math.hypot(this.ballVx, this.ballVz);
    if (spd > 0.1) {
      _axis.set(this.ballVz, 0, -this.ballVx).normalize();
      this.ballRig.mesh.rotateOnWorldAxis(_axis, (spd * dt) / this.ballRig.radius);
    }

    // Cage Side Wall Rebounds (X)
    const wallX = HALF_W + 0.52;
    if (this.ballX > wallX) {
      this.ballX = wallX;
      this.ballVx = -Math.abs(this.ballVx) * 0.78;
      this.audio.playDribble(0.5);
    } else if (this.ballX < -wallX) {
      this.ballX = -wallX;
      this.ballVx = Math.abs(this.ballVx) * 0.78;
      this.audio.playDribble(0.5);
    }

    // Goalposts & End Wall Rebounds (Z)
    this.checkGoalAndEndWalls();

    // Goalkeeper Saves
    if (this.roundResetTimer <= 0) {
      this.checkGoalkeeperSave(this.northGk);
      if (this.southGk) this.checkGoalkeeperSave(this.southGk);
    }

    // Outfield Pickup
    if (this.pickupCooldown <= 0 && this.roundResetTimer <= 0 && this.ballY < 0.72) {
      for (const actor of this.actors) {
        if (actor.role === 'gk' || actor.fallenTimer > 0) continue;
        const dist = Math.hypot(this.ballX - actor.x, this.ballZ - actor.z);
        if (dist < 0.78) {
          this.ballOwner = actor;
          this.lastTouchTeam = actor.team;
          this.audio.playDribble(0.5);
          break;
        }
      }
    }

    this.syncBallMesh();
  }

  private checkGoalAndEndWalls(): void {
    const r = this.ballRig.radius;
    const inGoalX = Math.abs(this.ballX) < GOAL_HALF_W - POST_RADIUS;
    const underBar = this.ballY < GOAL_HEIGHT - POST_RADIUS;

    // Post cylinder collisions (4 posts)
    const posts: Array<[number, number]> = [
      [-GOAL_HALF_W, -HALF_L],
      [GOAL_HALF_W, -HALF_L],
      [-GOAL_HALF_W, HALF_L],
      [GOAL_HALF_W, HALF_L],
    ];
    for (const [px, pz] of posts) {
      if (this.ballY < GOAL_HEIGHT + r) {
        const dx = this.ballX - px;
        const dz = this.ballZ - pz;
        const dist = Math.hypot(dx, dz);
        const minDist = r + POST_RADIUS;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;
          this.ballX = px + nx * minDist;
          this.ballZ = pz + nz * minDist;
          const dot = this.ballVx * nx + this.ballVz * nz;
          if (dot < 0) {
            this.ballVx -= 1.8 * dot * nx;
            this.ballVz -= 1.8 * dot * nz;
            this.hitstopTimer = 0.04;
            this.cameraShake = 0.35;
            this.audio.playPostClang();
            this.particles.emit(px, this.ballY, pz, 14, 0xfbbf24, 4.5, 1.0);
          }
        }
      }
    }

    // North Goal (-Z)
    if (this.ballZ < -HALF_L - r) {
      if (inGoalX && underBar) {
        if (this.roundResetTimer <= 0) {
          this.onGoalScored('player', 'north');
        }
        // Keep ball inside net
        this.ballX = THREE.MathUtils.clamp(this.ballX, -GOAL_HALF_W + r, GOAL_HALF_W - r);
        if (this.ballZ < -HALF_L - GOAL_DEPTH + r) {
          this.ballZ = -HALF_L - GOAL_DEPTH + r;
          this.ballVz = Math.abs(this.ballVz) * 0.2;
          this.ballVx *= 0.4;
        }
        return;
      }
      // Bounce off North end wall
      if (this.ballZ < -HALF_L - 0.5) {
        this.ballZ = -HALF_L - 0.5;
        this.ballVz = Math.abs(this.ballVz) * 0.78;
        this.audio.playDribble(0.5);
      }
    }

    // South Goal (+Z)
    if (this.ballZ > HALF_L + r) {
      if (inGoalX && underBar) {
        if (this.roundResetTimer <= 0 && this.mode === 'cage2v2') {
          this.onGoalScored('ai', 'south');
        } else if (this.ballZ > HALF_L + GOAL_DEPTH - r) {
          this.ballZ = HALF_L + GOAL_DEPTH - r;
          this.ballVz = -Math.abs(this.ballVz) * 0.3;
        }
        this.ballX = THREE.MathUtils.clamp(this.ballX, -GOAL_HALF_W + r, GOAL_HALF_W - r);
        return;
      }
      if (this.ballZ > HALF_L + 0.5) {
        this.ballZ = HALF_L + 0.5;
        this.ballVz = -Math.abs(this.ballVz) * 0.78;
        this.audio.playDribble(0.5);
      }
    }
  }

  private checkGoalkeeperSave(gk: SimActor): void {
    const reach = gk.diveTimer > 0 ? 1.15 : 0.75;
    const dist = Math.hypot(this.ballX - gk.x, this.ballZ - gk.z);
    if (dist < reach && this.ballY < 2.05) {
      const speed = Math.hypot(this.ballVx, this.ballVz);
      if (speed > 2.5) {
        // Parry away from goal
        const pushZ = gk === this.northGk ? 1 : -1;
        this.ballVz = pushZ * Math.max(5.5, speed * 0.45);
        this.ballVx = (this.ballX - gk.x) * 6.5 + (Math.random() - 0.5) * 4;
        this.ballVy = 2.4;
        this.pickupCooldown = 0.2;
        this.audio.playKick(0.5, false);
        this.particles.emit(this.ballX, this.ballY, this.ballZ, 12, 0x84cc16, 4.2, 1.0);
        this.triggerCallout('تصدي الحارس!', 'حاول تسديداً مقوساً بالزاوية', 'emerald');
      }
    }
  }

  private onGoalScored(scoringTeam: 'player' | 'ai', netSide: 'north' | 'south'): void {
    const shotSpeed = Math.hypot(this.ballVx, this.ballVz);
    const isPowerGoal = shotSpeed > 15.5;
    this.arena.triggerNetRipple(netSide, 1.0);
    this.hitstopTimer = isPowerGoal ? 0.075 : 0.05;
    this.addCameraTrauma(isPowerGoal ? 1.0 : 0.78);
    this.crowdExcitement = 1.0;
    this.audio.playGoal();
    this.audio.triggerBeatEvent('goal', 2.8);

    const goalZ = netSide === 'north' ? -HALF_L : HALF_L;
    this.particles.emitGoalBurst(this.ballX, 1.1, this.ballZ, 52);
    this.particles.emitGoalBurst(-GOAL_HALF_W, 0.25, goalZ, 18);
    this.particles.emitGoalBurst(GOAL_HALF_W, 0.25, goalZ, 18);
    this.particles.emitFootSparks(
      this.userActor.x,
      this.userActor.z,
      this.userActor.vx,
      this.userActor.vz,
      20,
      'fire',
    );

    if (scoringTeam === 'player') {
      this.playerGoals += 1;
      this.footFireTimer = 2.6;
      this.addStyle(400, 30);
      this.triggerCallout('هـــدف رائـع! GOOOAL!', 'أسلوب شوارع حقيقي +400', 'gold');
    } else {
      this.aiGoals += 1;
      this.triggerCallout('هدف للخصم!', 'حاول العودة سريعاً', 'rose');
    }
    this.roundResetTimer = 1.85;
    this.pushHud();
  }

  private advanceAfterReset(): void {
    if (this.mode === 'panna1v1') {
      if (this.roundNumber >= this.totalRounds) {
        this.finishMatch();
        return;
      }
      this.roundNumber += 1;
      this.timeRemaining = 25;
      this.resetPositionsForKickoff(true);
      this.audio.playWhistle();
      this.triggerCallout(`الجولة ${this.roundNumber} من ${this.totalRounds}`, 'انطلق نحو المرمى!', 'cyan');
    } else {
      this.resetPositionsForKickoff(this.lastTouchTeam === 'ai');
      this.audio.playWhistle();
    }
    this.pushHud();
  }

  private finishMatch(): void {
    this.phase = 'gameover';
    this.audio.setBeatMood('ducked');
    this.audio.playWhistle();
    if (this.playerGoals > this.aiGoals) this.winner = 'player';
    else if (this.aiGoals > this.playerGoals) this.winner = 'ai';
    else this.winner = 'draw';
    this.pushHud();
  }

  private steerActorToward(
    actor: SimActor,
    tx: number,
    tz: number,
    maxSpeed: number,
    dt: number,
  ): void {
    const dx = tx - actor.x;
    const dz = tz - actor.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) {
      actor.vx *= 0.82;
      actor.vz *= 0.82;
      return;
    }
    const desiredVx = (dx / dist) * maxSpeed;
    const desiredVz = (dz / dist) * maxSpeed;
    const k = 1 - Math.exp(-10 * dt);
    actor.vx += (desiredVx - actor.vx) * k;
    actor.vz += (desiredVz - actor.vz) * k;
    actor.x += actor.vx * dt;
    actor.z += actor.vz * dt;
    this.clampActorToPitch(actor);

    const spd = Math.hypot(actor.vx, actor.vz);
    if (spd > 0.25) {
      actor.facing = this.lerpAngle(actor.facing, Math.atan2(actor.vx, actor.vz), 1 - Math.exp(-12 * dt));
      actor.stridePhase += dt * (4.2 + spd * 1.3);
    }
  }

  private findClosestOpponent(from: SimActor, maxRadius: number): SimActor | null {
    let best: SimActor | null = null;
    let bestDist = maxRadius;
    for (const def of this.defenders) {
      if (def.fallenTimer > 0) continue;
      const d = Math.hypot(def.x - from.x, def.z - from.z);
      if (d < bestDist) {
        bestDist = d;
        best = def;
      }
    }
    return best;
  }

  private clampActorToPitch(a: SimActor): void {
    a.x = THREE.MathUtils.clamp(a.x, -HALF_W + 0.15, HALF_W - 0.15);
    a.z = THREE.MathUtils.clamp(a.z, -HALF_L + 0.2, HALF_L - 0.2);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  private syncBallMesh(): void {
    this.ballRig.mesh.position.set(this.ballX, this.ballY, this.ballZ);
    this.ballRig.shadow.position.set(this.ballX, 0.016, this.ballZ);
    const heightScale = Math.max(0.45, 1 - (this.ballY - this.ballRig.radius) * 0.25);
    this.ballRig.shadow.scale.setScalar(heightScale);
    (this.ballRig.shadow.material as THREE.MeshBasicMaterial).opacity = 0.62 * heightScale;

    const trailMat = this.ballRig.trailRing.material as THREE.MeshBasicMaterial;
    const speed = Math.hypot(this.ballVx, this.ballVz);
    if (!this.ballOwner && speed > 13) {
      this.ballRig.trailRing.position.set(this.ballX, 0.025, this.ballZ);
      trailMat.opacity = Math.min(0.7, (speed - 12) / 14);
      this.ballRig.trailRing.scale.setScalar(1 + Math.sin(this.elapsedTime * 20) * 0.15);
    } else {
      trailMat.opacity = 0;
    }
  }

  private addCameraTrauma(amount: number): void {
    this.cameraShake = Math.min(1.0, this.cameraShake + amount);
  }

  private resolveActorCollisions(): void {
    const minDist = 0.78;
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      if (a.role === 'gk') continue;
      for (let j = i + 1; j < this.actors.length; j++) {
        const b = this.actors[j];
        if (b.role === 'gk') continue;

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;
          this.clampActorToPitch(a);
          this.clampActorToPitch(b);

          // Relative impact velocity along collision normal
          const rvx = b.vx - a.vx;
          const rvz = b.vz - a.vz;
          const impactSpeed = -(rvx * nx + rvz * nz);
          const isSlideCollision = a.slideTimer > 0 || b.slideTimer > 0;

          if ((impactSpeed > 5.8 || isSlideCollision) && this.collisionCooldown <= 0) {
            this.collisionCooldown = 0.38;
            const intensity = THREE.MathUtils.clamp((impactSpeed + (isSlideCollision ? 3.5 : 0)) / 12, 0.35, 1.0);

            // Bounce actors apart slightly
            a.vx -= nx * 2.4 * intensity;
            a.vz -= nz * 2.4 * intensity;
            b.vx += nx * 2.4 * intensity;
            b.vz += nz * 2.4 * intensity;

            // Heavy collision shake + hitstop + sparks!
            this.addCameraTrauma(0.38 + intensity * 0.34);
            this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
            this.audio.playBodyImpact(intensity);
            this.particles.emit(
              (a.x + b.x) * 0.5,
              0.55,
              (a.z + b.z) * 0.5,
              12,
              0xfbbf24,
              4.2,
              0.9,
            );
          }
        }
      }
    }
  }

  private updateCamera(dt: number): void {
    const userSpeed = Math.hypot(this.userActor.vx, this.userActor.vz);
    const ballSpeed = Math.hypot(this.ballVx, this.ballVz);
    const closestDef = this.findClosestOpponent(this.userActor, 4.2);
    const inCloseDuel = Boolean(closestDef && this.ballOwner === this.userActor);

    // Lead camera subtly ahead of player velocity & ball direction
    const leadX = this.userActor.vx * 0.24 + (this.ballOwner ? 0 : this.ballVx * 0.12);
    const leadZ = this.userActor.vz * 0.22 + (this.ballOwner ? 0 : this.ballVz * 0.12);

    const focusX = THREE.MathUtils.lerp(this.userActor.x, this.ballX, 0.44) + leadX * 0.45;
    const focusZ = THREE.MathUtils.lerp(this.userActor.z, this.ballZ, 0.44) + leadZ * 0.45;

    // Tighter action framing during 1v1 duels or goal celebration, wider on high speed
    const isGoalCelebration = this.roundResetTimer > 0 && this.crowdExcitement > 0.75;
    const camHeight = isGoalCelebration ? 6.6 : inCloseDuel ? 7.6 : 8.8;
    const camDistZ = isGoalCelebration ? 8.8 : inCloseDuel ? 9.6 : 11.2;

    _camDesired.set(
      focusX * 0.66,
      camHeight,
      THREE.MathUtils.clamp(focusZ + camDistZ, 2.0, HALF_L + 10.5),
    );
    _camTarget.set(focusX * 0.74, 0.75, focusZ - 2.1);

    const k = 1 - Math.exp(-6.2 * dt);
    this.camera.position.lerp(_camDesired, k);

    // Dynamic FOV widening during sprints, Gamebreaker, and fast shots
    const speedRatio = THREE.MathUtils.clamp((Math.max(userSpeed, ballSpeed * 0.5) - 4.0) / 8.0, 0, 1);
    const targetFov =
      isGoalCelebration
        ? 44
        : 48 + speedRatio * 5.2 + (this.gamebreakerTimer > 0 ? 2.5 : 0);
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.5, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.02) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    // Subtle lateral banking roll on sharp cuts + squared trauma Camera Shake
    const targetRoll = THREE.MathUtils.clamp(-this.userActor.vx * 0.0042, -0.032, 0.032);
    this.currentRoll = THREE.MathUtils.damp(this.currentRoll, targetRoll, 7, dt);

    const traumaSq = this.cameraShake * this.cameraShake;
    let shakeRoll = 0;
    if (traumaSq > 0.001) {
      const t = this.elapsedTime;
      const amp = traumaSq * 0.58;
      this.camera.position.x += Math.sin(t * 57.3) * amp;
      this.camera.position.y += Math.cos(t * 49.1) * amp * 0.78;
      this.camera.position.z += Math.sin(t * 41.7) * amp * 0.42;
      shakeRoll = Math.sin(t * 63.0) * traumaSq * 0.045;
    }

    this.camera.lookAt(_camTarget);
    this.camera.rotateZ(this.currentRoll + shakeRoll);
  }

  private clearEdgeInputs(): void {
    this.input.shootJustPressed = false;
    this.input.shootJustReleased = false;
    this.input.passOrPannaJustPressed = false;
    this.input.tackleJustPressed = false;
    this.input.skillStepoverJustPressed = false;
    this.input.skillElasticoJustPressed = false;
    this.input.skillRouletteJustPressed = false;
  }

  private syncHudThrottled(dt: number): void {
    this.hudSyncTimer -= dt;
    if (this.hudSyncTimer <= 0) {
      this.hudSyncTimer = 0.06;
      this.pushHud();
    }
  }

  private pushHud(): void {
    this.onHudUpdate({
      phase: this.phase,
      mode: this.mode,
      difficulty: this.difficulty,
      playerGoals: this.playerGoals,
      aiGoals: this.aiGoals,
      timeRemaining: Math.ceil(this.timeRemaining),
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      styleMeter: Math.round(this.styleMeter),
      gamebreakerActive: this.gamebreakerTimer > 0,
      shotCharge: this.shotCharge,
      hasBall: this.ballOwner === this.userActor,
      stylePoints: this.stylePoints,
      ankleBreakers: this.ankleBreakers,
      pannas: this.pannas,
      shotsOnTarget: this.shotsOnTarget,
      callout: this.callout,
      winner: this.winner,
      musicStation: this.audio.beat.getStation(),
      beatMood: this.audio.beat.getEffectiveMood(),
      beatBpm: this.audio.beat.getCurrentBpm(),
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.audio.unlock();
    if (e.code === 'KeyM' && !e.repeat) {
      this.cycleMusicStation();
      return;
    }
    if (e.code === 'Escape') {
      if (this.phase === 'playing') this.pauseGame();
      else if (this.phase === 'paused') this.resumeGame();
      return;
    }

    if (this.phase !== 'playing') return;
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
    ) {
      e.preventDefault();
    }

    const wasDown = this.heldKeys.has(e.code);
    this.heldKeys.add(e.code);
    if (wasDown) return;

    if (e.code === 'Space') {
      this.input.shootHeld = true;
      this.input.shootJustPressed = true;
    } else if (e.code === 'KeyJ' || e.code === 'Digit1') {
      this.input.skillStepoverJustPressed = true;
    } else if (e.code === 'KeyK' || e.code === 'Digit2') {
      this.input.skillElasticoJustPressed = true;
    } else if (e.code === 'KeyL' || e.code === 'Digit3') {
      this.input.skillRouletteJustPressed = true;
    } else if (e.code === 'KeyE' || e.code === 'KeyQ') {
      this.input.passOrPannaJustPressed = true;
    } else if (e.code === 'KeyF') {
      this.input.tackleJustPressed = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
    if (e.code === 'Space') {
      this.input.shootHeld = false;
      this.input.shootJustReleased = true;
    }
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.input.shootHeld = false;
    this.shotCharging = false;
    this.shotCharge = 0;
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private onContextRestored = (): void => {
    this.lastTime = performance.now();
    this.startLoop();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.actors.forEach((a) => a.rig.dispose());
    this.arena.dispose();
    this.ballRig.dispose();
    this.particles.dispose();
    this.shadowTex.dispose();
    this.envTex.dispose();
    this.audio.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
